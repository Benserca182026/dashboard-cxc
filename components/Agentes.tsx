"use client";

// Fila de agentes, en el lugar donde la referencia pone la fila de personas.
//
// QUÉ SON, PARA QUE NO SE MALENTIENDA: no son IA ni personas. Cada agente es
// una LENTE determinista sobre el mismo dataset — una pregunta fija que se
// responde con las funciones ya probadas de lib/. Pasás el mouse y muestra lo
// que encontró; hacés clic y queda fijo. Si el dato no da para nada, el agente
// lo dice en vez de inventar un hallazgo.
//
// Por eso no llevan cara de persona: llevan el símbolo de su oficio (lupa,
// balanza, reloj, sello). Poner caras sugeriría que hay alguien mirando.

import { useCallback, useEffect, useRef, useState } from "react";
import { calcularAging, diasAtraso, disputaActiva, estadoFacturaDerivado, fmtMoneda } from "@/lib/calculos";
import { antiguedadPonderada, calcularDso, concentracionRiesgo } from "@/lib/kpis";
import { hayCadena, salidasSinVenta, stockPorProducto, ventasConTotal } from "@/lib/cadena";
import { forecastSimulado, prioridadSimulada } from "@/lib/simulados";
import type { Dataset } from "@/lib/types";

interface Hallazgo {
  hay: boolean;
  texto: string;
}

interface Agente {
  id: string;
  glifo: string;
  nombre: string;
  pregunta: string;
  /** De qué come el agente. Va a la vista para que el hallazgo se pueda
   *  auditar sin abrir el código: si alguien discute el resultado, discute
   *  esta línea. */
  base: string;
  mirar: (d: Dataset, corte: string) => Hallazgo;
}

const AGENTES: Agente[] = [
  {
    id: "rastreador",
    glifo: "🔍",
    nombre: "Rastreador",
    pregunta: "¿Hay una sola factura sosteniendo un tramo entero?",
    base: "mayor saldo del tramo ÷ total del tramo · umbral 60%",
    mirar: (d, corte) => {
      const a = calcularAging(d, corte);
      for (const [bucket, total] of Object.entries(a.totalesPorBucket)) {
        // "actual" (al día) se excluye igual que en tramoDominado()
        // (lib/argumento.ts): que una sola factura sea la mayor parte de lo
        // que YA está al día no es una señal de riesgo de cobranza.
        if (total <= 0 || bucket === "actual") continue;
        const enTramo = a.clasificadas.filter((c) => c.bucket === bucket);
        const mayor = [...enTramo].sort((x, y) => y.saldo - x.saldo)[0];
        if (!mayor) continue;
        const part = (mayor.saldo / total) * 100;
        if (part >= 60) {
          return {
            hay: true,
            texto: `${mayor.factura.numero_factura} es el ${Math.round(part)}% del tramo ${bucket} (${fmtMoneda(mayor.saldo)} de ${fmtMoneda(total)}). El tramo describe una factura, no una tendencia.`,
          };
        }
      }
      return { hay: false, texto: "Ningún tramo está dominado por una sola factura. El atraso está repartido." };
    },
  },
  {
    id: "balanza",
    glifo: "⚖",
    nombre: "Balanza",
    pregunta: "¿Un cliente concentra el riesgo?",
    base: "mayor saldo por cliente ÷ saldo total · umbral 35%",
    mirar: (d, corte) => {
      const c = concentracionRiesgo(d, corte);
      if ((c.mayorPct ?? 0) >= 35) {
        return {
          hay: true,
          texto: `${c.mayorCliente?.nombre} tiene el ${c.mayorPct}% de la cartera (${fmtMoneda(c.mayorCliente?.saldo ?? 0)} de ${fmtMoneda(c.saldoTotal)}). El promedio lo describe a él, no al conjunto.`,
        };
      }
      return { hay: false, texto: `Mayor cliente: ${c.mayorPct}%, bajo el umbral de 35%. Nadie concentra el riesgo.` };
    },
  },
  {
    id: "cronometro",
    glifo: "◷",
    nombre: "Cronómetro",
    pregunta: "¿El promedio simple esconde facturas grandes y viejas?",
    base: "Σ(saldo × días) ÷ Σ(saldo) contra promedio simple · brecha ≥ 3 d",
    mirar: (d, corte) => {
      const dso = calcularDso(d, corte);
      const ant = antiguedadPonderada(d, corte);
      if (ant.ponderada === null || ant.simple === null) {
        return { hay: false, texto: "No hay facturas clasificadas: la antigüedad no se puede promediar. No se inventa un valor." };
      }
      const brecha = Math.abs(ant.ponderada - ant.simple);
      const conDso = dso.dso === null ? "DSO no calculable (no hubo facturación en la ventana)" : `DSO ${dso.dso.toFixed(2)} d`;
      if (brecha >= 3) {
        // El signo de (ponderada − simple) importa: ponderar por saldo le da
        // más peso a las facturas grandes. Si eso SUBE el promedio,
        // las grandes son las viejas; si lo BAJA, es al revés — las chicas
        // son las viejas y las grandes son recientes. Afirmar siempre la
        // primera lectura (como hacía antes esta línea) es una conclusión de
        // negocio invertida cuando el signo es el otro — encontrado real con
        // datos de Benserca 18: hoy ponderada < simple.
        const grandesMasViejas = ant.ponderada > ant.simple;
        const lectura = grandesMasViejas
          ? "Las facturas grandes son más viejas que las chicas."
          : "Las facturas chicas son más viejas que las grandes — el saldo grande está concentrado en lo más reciente.";
        return {
          hay: true,
          texto: `Ponderada ${ant.ponderada.toFixed(2)} d contra promedio simple ${ant.simple.toFixed(2)} d: ${brecha.toFixed(2)} días de brecha. ${lectura} ${conDso}.`,
        };
      }
      return { hay: false, texto: `Ponderada ${ant.ponderada.toFixed(2)} d y promedio simple ${ant.simple.toFixed(2)} d casi coinciden: el tamaño no distorsiona la antigüedad.` };
    },
  },
  {
    id: "sello",
    glifo: "✓",
    nombre: "Sello",
    pregunta: "¿Hay saldo que el aging no puede clasificar?",
    base: "facturas con saldo y sin fecha de vencimiento",
    mirar: (d, corte) => {
      const a = calcularAging(d, corte);
      if (a.saldoNoClasificable > 0) {
        return {
          hay: true,
          texto: `${fmtMoneda(a.saldoNoClasificable)} quedan FUERA del aging por fecha de vencimiento faltante (${a.excluidas.length} factura(s)). No se les inventa una fecha: se las declara.`,
        };
      }
      return { hay: false, texto: "Todas las facturas con saldo tienen fecha de vencimiento. Nada queda fuera del aging." };
    },
  },
];

// ── Agentes propios de cada módulo nuevo (paso M6 de la reestructuración) ──
// Mismo contrato que AGENTES: una pregunta fija, una fórmula declarada en
// `base`, y una lente que mira el dataset (nunca inventa). Cada lista tiene
// EXACTAMENTE 4 agentes a propósito: el ancho de la muesca (MUESCA_W, en
// Argumento.tsx) se calcula una sola vez a partir de NUM_AGENTES = AGENTES.length
// — mantener 4 en cada módulo nuevo evita tener que tocar esa cuenta.

/** M3 — worklist de prioritarios: agentes sobre `prioridadSimulada`. */
export const AGENTES_PRIORITARIOS: Agente[] = [
  {
    id: "vigia",
    glifo: "👁",
    nombre: "Vigía",
    pregunta: "¿Una cuenta en disputa igual quedó entre las 3 más urgentes?",
    base: "prioridadSimulada() · top 3 por score · enDisputa === true",
    mirar: (d, corte) => {
      const top3 = prioridadSimulada(d, corte).slice(0, 3);
      const conDisputa = top3.find((f) => f.enDisputa);
      if (conDisputa) {
        return {
          hay: true,
          texto: `${conDisputa.nombreCliente} sigue en el top 3 (score ${conDisputa.scoreSimulado}) aunque la disputa ya penalizó su score a la mitad. La penalización no alcanza a bajarla del podio.`,
        };
      }
      return { hay: false, texto: "Ninguna cuenta en disputa quedó entre las 3 más urgentes: la penalización la sacó del podio." };
    },
  },
  {
    id: "balanza-worklist",
    glifo: "⚖",
    nombre: "Balanza",
    pregunta: "¿Un cliente concentra el saldo de la worklist?",
    base: "mayor saldoTotal de la worklist ÷ saldo total de la worklist · umbral 35%",
    mirar: (d, corte) => {
      const filas = prioridadSimulada(d, corte);
      const total = filas.reduce((s, f) => s + f.saldoTotal, 0);
      const mayor = [...filas].sort((a, b) => b.saldoTotal - a.saldoTotal)[0];
      if (!mayor || total <= 0) return { hay: false, texto: "Sin saldo en la worklist: nada que concentrar." };
      const part = (mayor.saldoTotal / total) * 100;
      if (part >= 35) {
        return {
          hay: true,
          texto: `${mayor.nombreCliente} concentra el ${Math.round(part)}% del saldo de la worklist (${fmtMoneda(mayor.saldoTotal)} de ${fmtMoneda(total)}).`,
        };
      }
      return { hay: false, texto: `Mayor cliente: ${Math.round(part)}% del saldo de la worklist, bajo el umbral de 35%. El saldo está repartido.` };
    },
  },
  {
    id: "compas",
    glifo: "🧭",
    nombre: "Compás",
    pregunta: "¿El score del líder lo explica el saldo o los días de atraso?",
    base: "nSaldo = saldo÷5.000 · nDias = días÷120 (techos del score simulado) · brecha ≥ 0.15",
    mirar: (d, corte) => {
      const lider = prioridadSimulada(d, corte)[0];
      if (!lider) return { hay: false, texto: "Worklist vacía: no hay líder que explicar." };
      const nSaldo = Math.min(lider.saldoTotal / 5000, 1);
      const nDias = Math.min(Math.max(lider.diasMaxAtraso, 0) / 120, 1);
      const brecha = Math.abs(nSaldo - nDias);
      if (brecha >= 0.15) {
        const manda = nSaldo > nDias ? "el saldo" : "los días de atraso";
        return {
          hay: true,
          texto: `En ${lider.nombreCliente}, ${manda} explica la mayor parte del score (saldo normalizado ${(nSaldo * 100).toFixed(0)}% contra días normalizados ${(nDias * 100).toFixed(0)}%).`,
        };
      }
      return { hay: false, texto: `En ${lider.nombreCliente}, saldo y días pesan casi igual en el score: ninguno de los dos manda solo.` };
    },
  },
  {
    id: "filtro",
    glifo: "🗂",
    nombre: "Filtro",
    pregunta: "¿Hay cuentas en la worklist sin un solo día de atraso?",
    base: "filas con saldoTotal > 0 y diasMaxAtraso === 0",
    mirar: (d, corte) => {
      const sinAtraso = prioridadSimulada(d, corte).filter((f) => f.diasMaxAtraso === 0);
      if (sinAtraso.length > 0) {
        return {
          hay: true,
          texto: `${sinAtraso.length} cuenta(s) están en la worklist con saldo abierto pero SIN un solo día de atraso: ${sinAtraso.map((f) => f.nombreCliente).join(", ")}. Entraron por tener saldo, no por estar vencidas.`,
        };
      }
      return { hay: false, texto: "Toda cuenta en la worklist tiene al menos un día de atraso." };
    },
  },
];

/** M5 — seguimiento de cobros: agentes sobre el dataset (facturas/disputas).
 *  La bitácora local (gestiones) NO pasa por acá — vive en el estado del
 *  componente, no en Dataset; el motor de argumentación de la página sí la usa. */
export const AGENTES_SEGUIMIENTO: Agente[] = [
  {
    id: "guardia",
    glifo: "⏳",
    nombre: "Guardia",
    pregunta: "¿Alguna disputa lleva más de 30 días abierta?",
    base: "disputas activas · fecha de corte − fecha de apertura > 30 días",
    mirar: (d, corte) => {
      const viejas = d.disputas.filter((x) => disputaActiva(x) && diasAtraso(corte, x.fecha_apertura) > 30);
      if (viejas.length > 0) {
        const peor = [...viejas].sort((a, b) => diasAtraso(corte, a.fecha_apertura) - diasAtraso(corte, b.fecha_apertura)).at(-1)!;
        return {
          hay: true,
          texto: `${viejas.length} disputa(s) llevan más de 30 días abiertas. La más vieja: factura ${peor.id_factura}, ${diasAtraso(corte, peor.fecha_apertura)} días sin resolver.`,
        };
      }
      return { hay: false, texto: "Ninguna disputa activa lleva más de 30 días abierta." };
    },
  },
  {
    id: "reloj-seguimiento",
    glifo: "⏱",
    nombre: "Reloj",
    pregunta: "¿Cuál factura abierta lleva más días esperando cobro?",
    base: "facturas clasificadas no pagadas · máximo de días de atraso",
    mirar: (d, corte) => {
      const abiertas = calcularAging(d, corte).clasificadas.filter((c) => c.estado !== "pagada");
      if (abiertas.length === 0) return { hay: false, texto: "No hay facturas clasificadas abiertas: nada que esperar." };
      const peor = [...abiertas].sort((x, y) => y.dias - x.dias)[0];
      if (peor.dias > 0) {
        return {
          hay: true,
          texto: `${peor.factura.numero_factura} lleva ${peor.dias} días de atraso — es la que más tiempo espera gestión (${fmtMoneda(peor.saldo)}).`,
        };
      }
      return { hay: false, texto: "Ninguna factura clasificada está vencida: la que más espera todavía está en plazo." };
    },
  },
  {
    id: "enlace",
    glifo: "🔗",
    nombre: "Enlace",
    pregunta: "¿Hay clientes con más de una factura abierta a la vez?",
    base: "facturas no pagadas agrupadas por cliente · cuenta ≥ 2",
    mirar: (d, corte) => {
      const porCliente = new Map<string, number>();
      for (const c of calcularAging(d, corte).clasificadas) {
        if (c.estado === "pagada") continue;
        porCliente.set(c.factura.id_cliente, (porCliente.get(c.factura.id_cliente) ?? 0) + 1);
      }
      const conVarias = [...porCliente.entries()].filter(([, n]) => n >= 2);
      if (conVarias.length > 0) {
        const nombre = (id: string) => d.clientes.find((c) => c.id_cliente === id)?.nombre_cliente ?? id;
        return {
          hay: true,
          texto: `${conVarias.length} cliente(s) tienen 2 o más facturas abiertas a la vez: ${conVarias.map(([id, n]) => `${nombre(id)} (${n})`).join(", ")}. Conviene gestionarlas juntas, no factura por factura.`,
        };
      }
      return { hay: false, texto: "Ningún cliente tiene más de una factura abierta a la vez." };
    },
  },
  {
    id: "bitacora-bloqueo",
    glifo: "🔒",
    nombre: "Bitácora",
    pregunta: "¿Cuántas facturas tienen el cobro bloqueado por una disputa?",
    base: "estadoFacturaDerivado === disputada, sobre las facturas no anuladas",
    mirar: (d, corte) => {
      void corte;
      const noAnuladas = d.facturas.filter((f) => f.estado_factura !== "anulada");
      const bloqueadas = noAnuladas.filter((f) => estadoFacturaDerivado(f, d.pagos, d.notasCredito, d.disputas) === "disputada");
      if (bloqueadas.length > 0) {
        return {
          hay: true,
          texto: `${bloqueadas.length} de ${noAnuladas.length} factura(s) no anuladas tienen el cobro bloqueado por disputa: ${bloqueadas.map((f) => f.numero_factura).join(", ")}. No se gestionan como cobranza normal hasta resolverse.`,
        };
      }
      return { hay: false, texto: "Ninguna factura tiene el cobro bloqueado por disputa." };
    },
  },
];

/** M8 — ventas: agentes sobre `dataset.ventas`/`ventaLineas` (Paso 11). Si el
 *  dataset no trae la cadena, cada agente lo declara en vez de mostrar ceros. */
export const AGENTES_VENTAS: Agente[] = [
  {
    id: "cuadre",
    glifo: "🧮",
    nombre: "Cuadre",
    pregunta: "¿Vendido y facturado cuadran exactamente?",
    base: "Σ líneas de venta vs Σ monto_original no anulado · diferencia exacta",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de ventas: nada que cuadrar." };
      const c = cuadreVentasFacturacionSafe(d);
      if (!c.cuadra) {
        return { hay: true, texto: `Descuadre de ${fmtMoneda(Math.abs(c.diferencia))}: vendido ${fmtMoneda(c.totalVendido)} contra facturado ${fmtMoneda(c.totalFacturado)}.` };
      }
      return { hay: false, texto: `Vendido y facturado cuadran: ${fmtMoneda(c.totalVendido)}.` };
    },
  },
  {
    id: "cadena-venta",
    glifo: "🔗",
    nombre: "Cadena",
    pregunta: "¿Hay ventas sin factura asociada?",
    base: "ventasConTotal() · id_factura ausente",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de ventas: nada que verificar." };
      const sinFactura = ventasConTotal(d).filter((v) => !v.id_factura);
      if (sinFactura.length > 0) {
        return { hay: true, texto: `${sinFactura.length} venta(s) no tienen factura asociada: ${sinFactura.map((v) => v.id_venta).join(", ")}. La cadena se rompió ahí.` };
      }
      return { hay: false, texto: "Toda venta tiene su factura asociada." };
    },
  },
  {
    id: "cliente-venta",
    glifo: "⚖",
    nombre: "Cliente",
    pregunta: "¿Un cliente concentra más de 35% de lo vendido?",
    base: "Σ total de ventas por cliente ÷ total vendido · umbral 35%",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de ventas: nada que concentrar." };
      const ventas = ventasConTotal(d);
      const total = ventas.reduce((s, v) => s + v.total, 0);
      const porCliente = new Map<string, number>();
      for (const v of ventas) porCliente.set(v.cliente, (porCliente.get(v.cliente) ?? 0) + v.total);
      const mayor = [...porCliente.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!mayor || total <= 0) return { hay: false, texto: "Sin ventas: nada que concentrar." };
      const part = (mayor[1] / total) * 100;
      if (part >= 35) {
        return { hay: true, texto: `${mayor[0]} concentra el ${Math.round(part)}% de lo vendido (${fmtMoneda(mayor[1])} de ${fmtMoneda(total)}).` };
      }
      return { hay: false, texto: `Mayor cliente: ${Math.round(part)}% de lo vendido, bajo el umbral de 35%.` };
    },
  },
  {
    id: "margen-venta",
    glifo: "💹",
    nombre: "Margen",
    pregunta: "¿Alguna venta se vendió con margen cero o negativo?",
    base: "ventasConTotal() · margen ≤ 0",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de ventas: nada que medir." };
      const sinMargen = ventasConTotal(d).filter((v) => v.margen <= 0);
      if (sinMargen.length > 0) {
        return { hay: true, texto: `${sinMargen.length} venta(s) tienen margen cero o negativo: ${sinMargen.map((v) => v.id_venta).join(", ")}.` };
      }
      return { hay: false, texto: "Toda venta tiene margen positivo." };
    },
  },
];

/** M7 — inventario: agentes sobre `dataset.movimientosInventario`/`productos`. */
export const AGENTES_INVENTARIO: Agente[] = [
  {
    id: "kardex",
    glifo: "🧾",
    nombre: "Kardex",
    pregunta: "¿Algún producto tiene existencia negativa?",
    base: "stockPorProducto() · existencia < 0",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de inventario: nada que auditar." };
      const negativos = stockPorProducto(d).filter((s) => s.existencia < 0);
      if (negativos.length > 0) {
        return { hay: true, texto: `${negativos.length} producto(s) con existencia NEGATIVA: ${negativos.map((s) => `${s.producto.sku} (${s.existencia})`).join(", ")}. El kardex no cuadra.` };
      }
      return { hay: false, texto: "Ningún producto tiene existencia negativa: el kardex cuadra." };
    },
  },
  {
    id: "minimo",
    glifo: "📉",
    nombre: "Mínimo",
    pregunta: "¿Cuántos productos están bajo su stock mínimo?",
    base: "stockPorProducto() · existencia ≤ stock_minimo",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de inventario: nada que medir." };
      const bajos = stockPorProducto(d).filter((s) => s.bajoMinimo);
      if (bajos.length > 0) {
        return { hay: true, texto: `${bajos.length} producto(s) bajo su mínimo: ${bajos.map((s) => s.producto.sku).join(", ")}.` };
      }
      return { hay: false, texto: "Ningún producto está bajo su stock mínimo." };
    },
  },
  {
    id: "rotacion",
    glifo: "🔄",
    nombre: "Rotación",
    pregunta: "¿Qué producto tuvo más salidas (mayor rotación)?",
    base: "Σ|cantidad| de movimientos tipo salida, por producto · máximo",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de inventario: nada que rotar." };
      const stock = stockPorProducto(d);
      const conSalidas = stock
        .map((s) => ({ s, salidas: s.movimientos.filter((m) => m.tipo === "salida").reduce((acc, m) => acc + Math.abs(m.cantidad), 0) }))
        .sort((a, b) => b.salidas - a.salidas);
      const mayor = conSalidas[0];
      if (!mayor || mayor.salidas === 0) return { hay: false, texto: "Ningún producto registra salidas." };
      return { hay: true, texto: `${mayor.s.producto.sku} es el de mayor rotación: ${mayor.salidas} unidad(es) de salida.` };
    },
  },
  {
    id: "huerfano",
    glifo: "🕳",
    nombre: "Huérfano",
    pregunta: "¿Hay salidas de inventario sin venta de origen?",
    base: "movimientosInventario · tipo salida · id_venta ausente",
    mirar: (d) => {
      if (!hayCadena(d)) return { hay: false, texto: "Este dataset no trae la cadena de inventario: nada que auditar." };
      const huerfanas = salidasSinVenta(d);
      if (huerfanas.length > 0) {
        return { hay: true, texto: `${huerfanas.length} salida(s) no declaran qué venta las produjo: ${huerfanas.map((m) => m.id_movimiento).join(", ")}.` };
      }
      return { hay: false, texto: "Toda salida de inventario declara la venta que la produjo." };
    },
  },
];

/** M4 — forecast: agentes sobre `forecastSimulado()`. Siempre declaran que es
 *  simulación, nunca dato real — el hallazgo describe el simulacro, no la caja. */
export const AGENTES_FORECAST: Agente[] = [
  {
    id: "horizonte",
    glifo: "🕐",
    nombre: "Horizonte",
    pregunta: "¿Cuántas facturas abiertas entran en la simulación?",
    base: "facturas con estado abierta/disputada al corte",
    mirar: (d, corte) => {
      const abiertas = d.facturas.filter((f) => {
        const e = estadoFacturaDerivado(f, d.pagos, d.notasCredito, d.disputas);
        return e === "abierta" || e === "disputada";
      });
      void corte;
      if (abiertas.length === 0) return { hay: false, texto: "No hay facturas abiertas: la simulación parte de cero." };
      return { hay: true, texto: `${abiertas.length} factura(s) abiertas o disputadas alimentan las tres curvas simuladas.` };
    },
  },
  {
    id: "brecha",
    glifo: "📏",
    nombre: "Brecha",
    pregunta: "¿En qué semana la brecha optimista−pesimista es mayor?",
    base: "max(optimista − pesimista) sobre las 13 semanas simuladas",
    mirar: (d, corte) => {
      const puntos = forecastSimulado(d, corte);
      const conBrecha = puntos.map((p) => ({ semana: p.semana, brecha: p.optimista - p.pesimista }));
      const mayor = [...conBrecha].sort((a, b) => b.brecha - a.brecha)[0];
      if (!mayor || mayor.brecha <= 0) return { hay: false, texto: "Las tres curvas simuladas casi no se separan: la incertidumbre es pareja." };
      return { hay: true, texto: `La brecha simulada es mayor en la semana ${mayor.semana}: ${fmtMoneda(mayor.brecha)} entre optimista y pesimista.` };
    },
  },
  {
    id: "disputa-forecast",
    glifo: "🚫",
    nombre: "Disputa",
    pregunta: "¿Cuánto saldo disputado el escenario pesimista no cobra?",
    base: "Σ saldo de facturas con estado disputada — el pesimista las excluye del horizonte",
    mirar: (d, corte) => {
      const disputadas = d.facturas.filter(
        (f) => estadoFacturaDerivado(f, d.pagos, d.notasCredito, d.disputas) === "disputada"
      );
      void corte;
      if (disputadas.length === 0) return { hay: false, texto: "No hay facturas disputadas: el escenario pesimista no excluye nada por esa causa." };
      const monto = disputadas.reduce((s, f) => s + f.monto_original, 0);
      return { hay: true, texto: `${fmtMoneda(monto)} en ${disputadas.length} factura(s) disputada(s) NO se cobran en el escenario pesimista dentro del horizonte (supuesto de simulación).` };
    },
  },
  {
    id: "meseta",
    glifo: "⏸",
    nombre: "Meseta",
    pregunta: "¿Cuánto del cobro de 13 semanas ya se simuló para la semana 4?",
    base: "punto de la semana 4 ÷ punto de la semana 13, escenario base",
    mirar: (d, corte) => {
      const puntos = forecastSimulado(d, corte);
      const s4 = puntos.find((p) => p.semana === 4);
      const s13 = puntos[puntos.length - 1];
      if (!s4 || !s13 || s13.base <= 0) return { hay: false, texto: "Sin cobro simulado: no hay meseta que describir." };
      const part = (s4.base / s13.base) * 100;
      if (part >= 50) {
        return { hay: true, texto: `Para la semana 4 ya se simuló el ${Math.round(part)}% del cobro base de las 13 semanas: la curva se adelanta, no se reparte pareja.` };
      }
      return { hay: false, texto: `Para la semana 4 sólo se simuló el ${Math.round(part)}% del cobro base: el grueso llega después, no al principio.` };
    },
  },
];

/** M6 — carga y calidad de datos: agentes sobre el propio dataset, no sobre
 *  el negocio. Complementan (no repiten) las etapas de `argumentoDatos`. */
export const AGENTES_DATOS: Agente[] = [
  {
    id: "vencimiento-dato",
    glifo: "📅",
    nombre: "Vencimiento",
    pregunta: "¿Cuántas facturas no tienen fecha de vencimiento?",
    base: "facturas · fecha_vencimiento === null",
    mirar: (d) => {
      const sinFecha = d.facturas.filter((f) => !f.fecha_vencimiento);
      if (sinFecha.length > 0) {
        return { hay: true, texto: `${sinFecha.length} de ${d.facturas.length} factura(s) no tienen fecha de vencimiento: quedan fuera del aging y no se les inventa una.` };
      }
      return { hay: false, texto: "Toda factura tiene fecha de vencimiento." };
    },
  },
  {
    id: "emision-dato",
    glifo: "🗓",
    nombre: "Emisión",
    pregunta: "¿Alguna factura tiene fecha de emisión sin informar?",
    base: "facturas · fecha_emision === '1970-01-01' (centinela de importación sin mapear)",
    mirar: (d) => {
      const sinEmision = d.facturas.filter((f) => f.fecha_emision === "1970-01-01");
      if (sinEmision.length > 0) {
        return { hay: true, texto: `${sinEmision.length} factura(s) quedaron con fecha de emisión centinela (1970-01-01): la columna no se mapeó o venía vacía al importar.` };
      }
      return { hay: false, texto: "Toda factura tiene una fecha de emisión distinta del centinela de importación." };
    },
  },
  {
    id: "duplicado-dato",
    glifo: "⧉",
    nombre: "Duplicado",
    pregunta: "¿Hay números de factura repetidos para el mismo cliente?",
    base: "agrupado por (id_cliente, numero_factura) · cuenta > 1",
    mirar: (d) => {
      const claves = new Map<string, number>();
      for (const f of d.facturas) {
        const k = `${f.id_cliente}|${f.numero_factura}`;
        claves.set(k, (claves.get(k) ?? 0) + 1);
      }
      const repetidos = [...claves.entries()].filter(([, n]) => n > 1);
      if (repetidos.length > 0) {
        return { hay: true, texto: `${repetidos.length} número(s) de factura están repetidos para el mismo cliente. Posible duplicado de carga.` };
      }
      return { hay: false, texto: "Ningún número de factura se repite para el mismo cliente." };
    },
  },
  {
    id: "catalogo-dato",
    glifo: "👤",
    nombre: "Catálogo",
    pregunta: "¿Hay clientes en el catálogo sin ninguna factura?",
    base: "clientes cuyo id_cliente no aparece en ninguna factura",
    mirar: (d) => {
      const sinFactura = d.clientes.filter((c) => !d.facturas.some((f) => f.id_cliente === c.id_cliente));
      if (sinFactura.length > 0) {
        return { hay: true, texto: `${sinFactura.length} cliente(s) del catálogo no tienen ninguna factura: ${sinFactura.map((c) => c.nombre_cliente).join(", ")}.` };
      }
      return { hay: false, texto: "Todo cliente del catálogo tiene al menos una factura." };
    },
  },
];

/** cuadreVentasFacturacion, pero importado con nombre local porque `Cuadre`
 *  ya usa la palabra `cuadra` como propiedad — se referencia calificada para
 *  no chocar con el parámetro `d` de cada agente. */
function cuadreVentasFacturacionSafe(d: Dataset) {
  const ventas = ventasConTotal(d);
  const totalVendido = Math.round(ventas.reduce((s, v) => s + v.total, 0) * 100) / 100;
  const totalFacturado =
    Math.round(
      d.facturas.filter((f) => f.estado_factura !== "anulada").reduce((s, f) => s + f.monto_original, 0) * 100
    ) / 100;
  const diferencia = Math.round((totalVendido - totalFacturado) * 100) / 100;
  return { totalVendido, totalFacturado, diferencia, cuadra: Math.abs(diferencia) < 0.005 };
}

/** Medidas de la fila de fichas. Viven acá porque el número de agentes vive
 *  acá: la muesca de la franja se calcula a partir de esto para que el hueco
 *  siga al grupo y no se desalinee si mañana hay cinco agentes. */
export const FICHA_PX = 44;
export const FICHA_GAP_PX = 8;
export const NUM_AGENTES = AGENTES.length;

/** Cuántos agentes encontraron algo. Vive acá porque la lista de agentes vive
 *  acá: así el panel puede escribir "2 de 4" en su pie sin tener que meter esa
 *  frase dentro de la franja, donde rompía la alineación de la fila.
 *  `agentes` es opcional — sin él sigue contando sobre AGENTES (cartera),
 *  igual que siempre; cada módulo nuevo pasa su propia lista. */
export function contarHallazgos(dataset: Dataset, fechaCorte: string, agentes: Agente[] = AGENTES) {
  return {
    con: agentes.filter((a) => a.mirar(dataset, fechaCorte).hay).length,
    total: agentes.length,
  };
}

/** `agentes` es opcional — por defecto sigue siendo AGENTES (los 4 de cartera
 *  general que ya usan `/` y `/aging`, sin tocar su comportamiento). Los
 *  módulos M3/M4/M5/M6/M7/M8 pasan su propia lista de 4 (AGENTES_PRIORITARIOS,
 *  etc.): mismo componente, otra lente sobre el mismo dataset. */
export function FilaAgentes({
  dataset,
  fechaCorte,
  agentes = AGENTES,
}: {
  dataset: Dataset;
  fechaCorte: string;
  agentes?: Agente[];
}) {
  const vistos = agentes.map((a) => ({ agente: a, hallazgo: a.mirar(dataset, fechaCorte) }));

  // Arranca cerrado: ahora el resultado abre una ventana sobre el tablero, y
  // abrirla sola al entrar sería tapar la pantalla sin que nadie lo pidiera.
  // El anillo de cada ficha ya dice quién encontró algo.
  const [abierto, setAbierto] = useState<string | null>(null);

  const actual = vistos.find((v) => v.agente.id === abierto);

  return (
    <>
      {/* Las fichas van SUELTAS dentro de la franja del panel, con aire entre
          ellas: en la referencia los avatares no están montados unos sobre
          otros ni encerrados en una cápsula propia. El contenedor es la banda
          entera, que la pone el panel, no este componente. */}
      <div className="flex items-center justify-center">
        <span className="fichas-asomadas flex items-center gap-2">
          {vistos.map(({ agente, hallazgo }) => {
            const activo = abierto === agente.id;
            return (
              <button
                key={agente.id}
                onClick={() => setAbierto(activo ? null : agente.id)}
                aria-expanded={activo}
                aria-controls="pantalla-agente"
                aria-label={`${agente.nombre}: ${agente.pregunta}`}
                title={`${agente.nombre} — ${agente.pregunta}`}
                className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-[16px] transition hover:z-10 hover:-translate-y-0.5 focus:outline-none focus-visible:-translate-y-0.5"
                style={{
                  // El anillo dice si ESE agente encontró algo, no es adorno.
                  boxShadow: `0 0 0 2px #ffffff, 0 0 0 ${activo ? 4 : 3.5}px ${
                    hallazgo.hay ? "#c2703a" : "#c6cad2"
                  }, 0 ${activo ? 10 : 4}px ${activo ? 20 : 10}px -8px rgba(22,24,29,.35)`,
                  transform: activo ? "translateY(-2px)" : undefined,
                  zIndex: activo ? 20 : undefined,
                }}
              >
                <span aria-hidden>{agente.glifo}</span>
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 grid h-[15px] w-[15px] place-items-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: hallazgo.hay ? "#c2703a" : "#a8adb6", boxShadow: "0 0 0 1.5px #fff" }}
                >
                  {hallazgo.hay ? "!" : "·"}
                </span>
              </button>
            );
          })}
        </span>
      </div>

      {actual && (
        <VentanaAgente
          agente={actual.agente}
          hallazgo={actual.hallazgo}
          fechaCorte={fechaCorte}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}

/** La ventana del hallazgo: se abre en el centro con el tablero desenfocado
 *  detrás, y se puede arrastrar por su cabecera a donde haga falta —
 *  normalmente para destapar la tarjeta con la que uno quiere compararla.
 *
 *  Arranca centrada por CSS. En cuanto se arrastra, pasa a posición fija en
 *  píxeles: así no hay que calcular el centro a mano y no salta al agarrarla. */
function VentanaAgente({
  agente,
  hallazgo,
  fechaCorte,
  onCerrar,
}: {
  agente: Agente;
  hallazgo: Hallazgo;
  fechaCorte: string;
  onCerrar: () => void;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const pinza = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Esc cierra. Es lo que todo el mundo intenta primero.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [onCerrar]);

  const alMover = useCallback((e: PointerEvent) => {
    if (!pinza.current || !caja.current) return;
    const w = caja.current.offsetWidth;
    const h = caja.current.offsetHeight;
    // Se puede llevar a cualquier lado, pero nunca fuera del alcance del ratón:
    // siempre queda un borde agarrable dentro de la ventana del navegador.
    const x = Math.min(Math.max(e.clientX - pinza.current.dx, 8 - w + 120), window.innerWidth - 120);
    const y = Math.min(Math.max(e.clientY - pinza.current.dy, 8), window.innerHeight - 56);
    setPos({ x, y });
  }, []);

  const alSoltar = useCallback(() => {
    pinza.current = null;
    window.removeEventListener("pointermove", alMover);
    window.removeEventListener("pointerup", alSoltar);
  }, [alMover]);

  const alAgarrar = (e: React.PointerEvent) => {
    if (!caja.current) return;
    const r = caja.current.getBoundingClientRect();
    pinza.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    setPos({ x: r.left, y: r.top }); // fija la posición actual antes de mover
    window.addEventListener("pointermove", alMover);
    window.addEventListener("pointerup", alSoltar);
  };

  useEffect(() => () => alSoltar(), [alSoltar]);

  return (
    // El velo dura hasta que la ventana se mueve. Se mueve justamente para
    // comparar el hallazgo con una tarjeta del tablero: mantener el desenfoque
    // ahí sería tapar aquello que uno acaba de destapar. Al soltar, el tablero
    // queda nítido y la ventana flota encima.
    <div
      className={`entrada-suave fixed inset-0 z-50 grid place-items-center p-6 ${pos ? "" : "velo-agente"}`}
      onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-label={`${agente.nombre}: ${agente.pregunta}`}
    >
      <div
        id="pantalla-agente"
        ref={caja}
        className="ventana-agente w-full max-w-lg"
        style={pos ? { position: "fixed", left: pos.x, top: pos.y, margin: 0 } : undefined}
      >
        {/* Cabecera = asa. Se arrastra de acá, no de todo el cuerpo, para poder
            seleccionar el texto del hallazgo sin mover la ventana. */}
        <div
          onPointerDown={alAgarrar}
          className="ventana-agente-asa flex items-start gap-3 px-5 pb-3 pt-4"
          style={{ touchAction: "none" }}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2f4f8] text-[15px]"
          >
            {agente.glifo}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-tinta">{agente.nombre}</p>
            <p className="text-[11px] leading-snug text-[#8b8f98]">{agente.pregunta}</p>
          </div>
          <span
            className="mt-0.5 shrink-0 rounded-pastilla px-2.5 py-1 text-[10px] font-semibold"
            style={
              hallazgo.hay
                ? { background: "rgba(194,112,58,.12)", color: "#a4551f" }
                : { background: "rgba(22,24,29,.06)", color: "#6b6f78" }
            }
          >
            {hallazgo.hay ? "hallazgo" : "sin hallazgo"}
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onCerrar}
            aria-label="Cerrar el resultado"
            className="-mr-1.5 -mt-1 shrink-0 rounded-full px-2 py-1 text-[14px] leading-none text-[#a0a2a6] transition hover:text-tinta"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-[13.5px] leading-relaxed text-tinta">{hallazgo.texto}</p>

          {/* La base a la vista: quien discuta el resultado, discute esta línea
              y no el color de la ficha. */}
          <p className="mt-3.5 inline-block rounded-[9px] bg-[rgba(22,24,29,.04)] px-2.5 py-1.5 font-mono text-[10.5px] text-[#7c808a]">
            {agente.base}
          </p>

          <p className="mt-3 text-[10.5px] leading-relaxed text-[#a0a2a6]">
            {hallazgo.hay
              ? "Derivado del dataset al corte"
              : "Sin hallazgo — y vale igual: el agente miró y no encontró"}
            {" · "}corte {fechaCorte} · umbrales 🟡 pendientes de validación por Finanzas
            <br />
            Arrastrá desde el encabezado para moverla · Esc o clic fuera para cerrar
          </p>
        </div>
      </div>
    </div>
  );
}
