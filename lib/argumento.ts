// Motor de argumentación — la innovación sobre la referencia visual.
//
// Un tablero común ENUNCIA: "el DSO es 103.43 días". Este DEMUESTRA: encadena
// premisas derivadas de los mismos datos hasta una conclusión que termina en un
// acto concreto.
//
// TRES REGLAS que este archivo respeta, y sin las cuales esto degeneraría en
// teatro (ver el artículo 4 de la conversación de diseño):
//
//   1. El argumento se DERIVA, nunca se escribe. Si dijéramos "el problema es
//      Alfa" en el código, sería verdad hoy y mentira el mes que viene. Estas
//      funciones BUSCAN dónde está la concentración y qué desmiente la primera
//      impresión.
//   2. Sólo se argumenta donde la cifra sola ENGAÑA. El DSO es el caso perfecto
//      porque parece sistémico y casi nunca lo es.
//   3. La conclusión puede ser NEGATIVA. Si el atraso está repartido, se dice
//      eso — no se inventa un culpable. Una plantilla que siempre acusa a
//      alguien no es un argumento.
//
// ⚠️ Los umbrales (concentración > 35%, dominancia de tramo > 60%) son
// PROPUESTA PENDIENTE DE VALIDACIÓN POR FINANZAS, como toda regla del proyecto.

import { calcularAging, saldoPendiente, type FacturaClasificada } from "./calculos";
import { antiguedadPonderada, calcularDso, concentracionRiesgo } from "./kpis";
import { BUCKETS, type BucketAging, type Dataset, type GestionCobranza } from "./types";
import { prioridadSimulada, forecastSimulado } from "./simulados";
import { hayCadena, ventasConTotal, cuadreVentasFacturacion } from "./cadena";

/** Umbrales declarados en un solo lugar, para poder discutirlos. */
export const UMBRALES = {
  /** Sobre este % de cartera en un cliente, la concentración es un hecho, no ruido. */
  concentracionAlta: 35,
  /** Si una factura es más que esto de su tramo, el tramo ES esa factura. */
  dominanciaTramo: 60,
  /** Bajo este % al día, el problema sí empieza a parecer sistémico. */
  alDiaSano: 40,
  /** Si un tramo de aging pesa más que esto dentro del vencido, la antigüedad
   *  del vencido ES ese tramo y no un reparto parejo entre tramos. */
  tramoDominante: 50,
};

export type TipoEtapa = "premisa" | "objecion" | "hallazgo" | "conclusion";

export interface Etapa {
  id: string;
  /** Nombre corto de la fase — el equivalente a "Case Allocation" de la referencia. */
  fase: string;
  tipo: TipoEtapa;
  /** Rótulo corto de 2-4 palabras para la tarjeta; el titulo largo va al detalle. */
  rotulo: string;
  titulo: string;
  /** El dato duro que sostiene esta etapa. */
  dato: string;
  /** Por qué esta etapa hace avanzar el argumento. */
  porque: string;
  /** Barras para el sub-gráfico de la etapa; vacío si la etapa es puramente textual. */
  barras?: { etiqueta: string; valor: number; destacada?: boolean }[];
}

export interface Argumento {
  /** El número que se muestra en grande y que la primera impresión malinterpreta. */
  titular: string;
  valorTitular: string;
  /** Qué diría alguien que sólo mira el titular. */
  lecturaIngenua: string;
  etapas: Etapa[];
  /** El acto que se sigue. Es la tarjeta negra de la referencia. */
  accion: string;
  /** true cuando el argumento concluye que NO hay caso puntual (conclusión negativa). */
  sinHallazgo: boolean;
}

// Igual que fmtMoneda (lib/calculos.ts): USD para demo-ficticio, GTQ para
// datos reales de Benserca 18 (moneda_id real en el 100% de la muestra).
// Default USD para no romper ningún llamador que no pase moneda.
const dinero = (n: number, moneda: "USD" | "GTQ" = "USD") =>
  n.toLocaleString(moneda === "GTQ" ? "es-GT" : "en-US", { style: "currency", currency: moneda, minimumFractionDigits: 2 });
const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);
/** Recorta el sufijo "Ficticia/Ficticio" de los nombres del dataset demo, para
 *  que los rótulos cortos de las tarjetas no se llenen con esa palabra. */
const corto = (s: string) => s.replace(/Fictici[oa]s?/gi, "").trim();

/**
 * Encuentra si un tramo de aging está dominado por UNA factura.
 * Devuelve null si el tramo está repartido — que es una respuesta legítima.
 */
function tramoDominado(clasificadas: FacturaClasificada[], totalesPorBucket: Record<BucketAging, number>) {
  let mejor: { bucket: BucketAging; factura: FacturaClasificada; participacion: number } | null = null;
  for (const c of clasificadas) {
    const totalTramo = totalesPorBucket[c.bucket];
    if (totalTramo <= 0 || c.bucket === "actual") continue;
    const participacion = pct(c.saldo, totalTramo);
    if (participacion >= UMBRALES.dominanciaTramo && (!mejor || participacion > mejor.participacion)) {
      mejor = { bucket: c.bucket, factura: c, participacion };
    }
  }
  return mejor;
}

/**
 * Construye el argumento del DSO: por qué un DSO alto casi nunca significa
 * "la cobranza funciona mal".
 */
export function argumentoDso(dataset: Dataset, fechaCorte: string): Argumento {
  const d = (n: number) => dinero(n, dataset.fuente === "odoo-real" ? "GTQ" : "USD");
  const aging = calcularAging(dataset, fechaCorte);
  const dso = calcularDso(dataset, fechaCorte);
  const conc = concentracionRiesgo(dataset, fechaCorte);
  const cartera = aging.totalClasificado + aging.saldoNoClasificable;
  const alDia = aging.totalesPorBucket["actual"];
  const pctAlDia = pct(alDia, cartera);

  const etapas: Etapa[] = [];

  // ── Etapa 1 · la objeción: ¿es sistémico de verdad? ──
  const esSano = pctAlDia >= UMBRALES.alDiaSano;
  etapas.push({
    id: "e1",
    fase: "¿Es sistémico?",
    tipo: "objecion",
    rotulo: esSano ? `${Math.round(pctAlDia)}% al día` : `Sólo ${Math.round(pctAlDia)}% al día`,
    titulo: esSano
      ? `El ${Math.round(pctAlDia)}% de la cartera está al día`
      : `Sólo el ${Math.round(pctAlDia)}% está al día`,
    dato: `${d(alDia)} al día de ${d(cartera)} totales`,
    porque: esSano
      ? "Si la cobranza fallara de forma general, este porcentaje sería bajo. No lo es: la primera impresión ya queda desmentida."
      : "Este porcentaje bajo SÍ sugiere un problema general de cobranza, no un caso aislado.",
    barras: [
      { etiqueta: "Al día", valor: alDia, destacada: esSano },
      { etiqueta: "Vencido", valor: cartera - alDia, destacada: !esSano },
    ],
  });

  // ── Etapa 2 · dónde se concentra ──
  const hayConcentracion = (conc.mayorPct ?? 0) >= UMBRALES.concentracionAlta;
  etapas.push({
    id: "e2",
    fase: "¿Dónde se concentra?",
    tipo: "premisa",
    rotulo: hayConcentracion
      ? `${(conc.mayorCliente?.nombre ?? "").replace(/Fictici[oa]s?/gi, "").trim()} ${conc.mayorPct}%`
      : "Deuda repartida",
    titulo: hayConcentracion
      ? `${conc.mayorCliente?.nombre} concentra el ${conc.mayorPct}%`
      : "La deuda está repartida entre clientes",
    dato: hayConcentracion
      ? `${d(conc.mayorCliente?.saldo ?? 0)} de ${d(conc.saldoTotal)}`
      : `Mayor cliente: ${conc.mayorPct}% — bajo el umbral de ${UMBRALES.concentracionAlta}%`,
    porque: hayConcentracion
      ? "Un solo cliente por encima del umbral convierte el promedio en una media engañosa: no describe a la cartera, describe a ese cliente."
      : "Sin concentración, el atraso es un comportamiento del conjunto y no se puede atribuir a nadie en particular.",
    barras: conc.porCliente.slice(0, 4).map((c, i) => ({
      etiqueta: c.nombre.replace(/Fictici[oa]s?/gi, "").trim(),
      valor: c.saldo,
      destacada: i === 0 && hayConcentracion,
    })),
  });

  // ── Etapa 3 · el caso puntual, si existe ──
  const dominado = tramoDominado(aging.clasificadas, aging.totalesPorBucket);
  if (dominado) {
    etapas.push({
      id: "e3",
      fase: "¿Es un caso o una tendencia?",
      tipo: "hallazgo",
      rotulo: `Tramo ${dominado.bucket}: 1 factura`,
      titulo: `El tramo ${dominado.bucket} es UNA sola factura`,
      dato: `${dominado.factura.factura.numero_factura} · ${d(dominado.factura.saldo)} · ${dominado.factura.dias} días de atraso · ${Math.round(dominado.participacion)}% del tramo`,
      porque:
        "Lo que la vista de tramos presenta como una banda de cartera vieja no es un grupo de facturas: es un caso puntual. El promedio lo disolvía en una categoría.",
      barras: aging.clasificadas
        .filter((c) => c.bucket === dominado.bucket)
        .map((c) => ({
          etiqueta: c.factura.numero_factura,
          valor: c.saldo,
          destacada: c.factura.id_factura === dominado.factura.factura.id_factura,
        })),
    });
  }

  // ── Conclusión ──
  const sinHallazgo = !dominado && !hayConcentracion;
  etapas.push({
    id: "conclusion",
    fase: "Conclusión",
    tipo: "conclusion",
    rotulo: dominado
      ? "Es una factura"
      : hayConcentracion
      ? "Es un cliente"
      : "Es un patrón",
    titulo: dominado
      ? "El DSO alto describe una factura, no la cobranza"
      : hayConcentracion
      ? "El DSO alto describe a un cliente, no la cobranza"
      : "El atraso está repartido: sí es un patrón general",
    dato: dominado
      ? `${dominado.factura.factura.numero_factura} explica el ${Math.round(dominado.participacion)}% de su tramo`
      : hayConcentracion
      ? `${conc.mayorCliente?.nombre}: ${conc.mayorPct}% de la cartera`
      : "Ningún cliente ni factura supera los umbrales",
    porque: sinHallazgo
      ? "Es una conclusión negativa y vale igual: no hay un culpable puntual que gestionar. Corresponde revisar el proceso, no perseguir un caso."
      : "El acto que se sigue es puntual y verificable, no una reforma general.",
  });

  return {
    titular: "DSO — días de venta en calle",
    valorTitular: dso.dso === null ? "—" : `${dso.dso} d`,
    lecturaIngenua:
      "Leído solo, un DSO de tres dígitos sugiere que la cobranza funciona mal de forma general.",
    etapas,
    accion: dominado
      ? `Gestionar ${dominado.factura.factura.numero_factura} (${d(dominado.factura.saldo)}) antes que revisar el proceso`
      : hayConcentracion
      ? `Revisar condiciones con ${conc.mayorCliente?.nombre}`
      : "Revisar el proceso de cobranza: el atraso no tiene un origen puntual",
    sinHallazgo,
  };
}

/**
 * Argumento del inventario: por qué el valor total esconde el riesgo real.
 * Se calcula sólo si el dataset trae la cadena del Paso 11.
 */
export function argumentoInventario(dataset: Dataset): Argumento | null {
  if (!dataset.productos?.length || !dataset.movimientosInventario?.length) return null;

  const stock = dataset.productos.map((p) => {
    const movs = (dataset.movimientosInventario ?? []).filter((m) => m.id_producto === p.id_producto);
    const existencia = movs.reduce((s, m) => s + m.cantidad, 0);
    const salidas = movs.filter((m) => m.cantidad < 0).reduce((s, m) => s + Math.abs(m.cantidad), 0);
    return { p, existencia, salidas, valor: existencia * p.costo_unitario, bajo: existencia <= p.stock_minimo };
  });

  const valorTotal = stock.reduce((s, x) => s + x.valor, 0);
  const bajos = stock.filter((x) => x.bajo);
  const critico = bajos.sort((a, b) => b.salidas - a.salidas)[0] ?? null;

  const etapas: Etapa[] = [
    {
      id: "i1",
      fase: "¿El total dice algo?",
      tipo: "objecion",
      rotulo: `${dinero(valorTotal)} en ${stock.length} SKU`,
      titulo: `${dinero(valorTotal)} repartidos en ${stock.length} productos`,
      dato: stock.map((x) => `${x.p.sku}: ${dinero(x.valor)}`).join(" · "),
      porque:
        "El valor total es una suma contable: no distingue lo que sobra de lo que está por faltar. Dos inventarios con el mismo valor pueden estar en situaciones opuestas.",
      barras: stock.map((x) => ({ etiqueta: x.p.sku, valor: x.valor, destacada: x.bajo })),
    },
    {
      id: "i2",
      fase: "¿Qué está por faltar?",
      tipo: "premisa",
      rotulo: bajos.length ? `${bajos.length} bajo mínimo` : "Ninguno bajo mínimo",
      titulo: bajos.length
        ? `${bajos.length} producto(s) bajo el mínimo`
        : "Ningún producto bajo el mínimo",
      dato: bajos.length ? bajos.map((x) => `${x.p.sku}: ${x.existencia} u (mín. ${x.p.stock_minimo})`).join(" · ") : "Todas las existencias sobre su umbral",
      porque: bajos.length
        ? "La custodia se mide por faltante, no por valor: un producto barato agotado cuesta más que uno caro sobrando."
        : "Sin faltantes, el riesgo de custodia hoy es bajo.",
      barras: stock.map((x) => ({ etiqueta: x.p.sku, valor: x.existencia, destacada: x.bajo })),
    },
  ];

  if (critico) {
    etapas.push({
      id: "i3",
      fase: "¿Con qué urgencia?",
      tipo: "hallazgo",
      rotulo: `${critico.p.sku} es el urgente`,
      titulo: `${critico.p.sku} es el más demandado de los que faltan`,
      dato: `${critico.existencia} u en existencia · ${critico.salidas} u vendidas en el período`,
      porque:
        "Cruzar existencia con rotación separa lo que falta y no importa de lo que falta y se vende. Sólo lo segundo es urgente.",
      barras: stock.map((x) => ({ etiqueta: x.p.sku, valor: x.salidas, destacada: x.p.sku === critico.p.sku })),
    });
  }

  etapas.push({
    id: "iconclusion",
    fase: "Conclusión",
    tipo: "conclusion",
    rotulo: critico ? `Reponer ${critico.p.sku}` : "Sin acción hoy",
    titulo: critico
      ? `Reponer ${critico.p.sku} antes que mirar el valor total`
      : "El inventario no exige acción hoy",
    dato: critico
      ? `${critico.existencia} u restantes contra ${critico.salidas} u de demanda reciente`
      : "Sin faltantes ni productos críticos",
    porque: critico
      ? "El valor total ($" + valorTotal.toFixed(0) + ") no habría revelado esto: es un promedio que esconde el caso."
      : "Conclusión negativa: no hay acto pendiente derivado de los datos actuales.",
  });

  return {
    titular: "Inventario a costo",
    valorTitular: dinero(valorTotal),
    lecturaIngenua: "Leído solo, el valor total sugiere que el inventario está sano porque hay existencias.",
    etapas,
    accion: critico ? `Reponer ${critico.p.sku} — ${critico.existencia} u restantes` : "Sin acción pendiente",
    sinHallazgo: !critico,
  };
}

/**
 * Argumento del AGING — la pregunta del módulo M2: ¿cuánto está vencido, desde
 * cuándo, y en quién se concentra?
 *
 * Mismas tres reglas del archivo: cada etapa se DERIVA de `calcularAging` al
 * corte vigente, y si el dato no da para un hallazgo la conclusión lo dice en
 * vez de inventar un culpable. Todo depende de la fecha de corte: cambiarla
 * reescribe el argumento entero, que es exactamente lo que debe pasar.
 *
 * Las cuatro etapas, y de qué comen:
 *   1 · ¿Cuánto está vencido?   → totalesPorBucket (todo menos `actual`) sobre
 *                                 la cartera total (clasificado + no clasificable).
 *   2 · ¿Desde cuándo?          → el tramo más pesado dentro del vencido, más
 *                                 la antigüedad ponderada por monto.
 *   3 · ¿En quién se concentra? → saldo VENCIDO por cliente (no el saldo total:
 *                                 acá interesa quién debe lo atrasado).
 *   4 · Conclusión              → deudor, tramo, o reparto — y el saldo que el
 *                                 aging no puede clasificar, declarado aparte.
 */
export function argumentoAging(dataset: Dataset, fechaCorte: string): Argumento {
  const d = (n: number) => dinero(n, dataset.fuente === "odoo-real" ? "GTQ" : "USD");
  const aging = calcularAging(dataset, fechaCorte);
  const ant = antiguedadPonderada(dataset, fechaCorte);
  const cartera = aging.totalClasificado + aging.saldoNoClasificable;
  const alDia = aging.totalesPorBucket["actual"];
  const vencido = Math.max(0, aging.totalClasificado - alDia);
  const pctVencido = pct(vencido, cartera);

  const tramosVencidos = BUCKETS.filter((b) => b !== "actual").map((b) => ({
    bucket: b,
    monto: aging.totalesPorBucket[b],
  }));
  const mayorTramo = [...tramosVencidos].sort((a, b) => b.monto - a.monto)[0];
  const pctTramo = pct(mayorTramo?.monto ?? 0, vencido);
  const tramoManda = vencido > 0 && pctTramo >= UMBRALES.tramoDominante;

  // Concentración sobre lo VENCIDO, no sobre la cartera entera: la pregunta del
  // módulo es quién debe lo atrasado, no quién factura más.
  const porCliente = new Map<string, number>();
  for (const c of aging.clasificadas) {
    if (c.bucket === "actual") continue;
    porCliente.set(c.factura.id_cliente, (porCliente.get(c.factura.id_cliente) ?? 0) + c.saldo);
  }
  const nombreDe = (id: string) =>
    dataset.clientes.find((c) => c.id_cliente === id)?.nombre_cliente ?? id;
  const ranking = [...porCliente.entries()]
    .map(([id, saldo]) => ({ id, nombre: nombreDe(id), saldo }))
    .sort((a, b) => b.saldo - a.saldo);
  const deudor = ranking[0] ?? null;
  const pctDeudor = pct(deudor?.saldo ?? 0, vencido);
  const deudorManda = vencido > 0 && pctDeudor >= UMBRALES.concentracionAlta;

  const corto = (s: string) => s.replace(/Fictici[oa]s?/gi, "").trim();

  const etapas: Etapa[] = [];

  // ── Etapa 1 · cuánto está vencido ──
  etapas.push({
    id: "a1",
    fase: "¿Cuánto está vencido?",
    tipo: "objecion",
    rotulo: vencido > 0 ? `${Math.round(pctVencido)}% vencido` : "Nada vencido",
    titulo:
      vencido > 0
        ? `El ${Math.round(pctVencido)}% de la cartera está vencido`
        : "Ninguna factura clasificada está vencida al corte",
    dato: `${d(vencido)} vencidos de ${d(cartera)} de cartera · corte ${fechaCorte}`,
    porque:
      vencido > 0
        ? "El total de cartera no distingue lo que todavía no vence de lo que ya se debió cobrar. Separarlos es el primer corte útil: sólo el vencido es gestionable hoy."
        : "Al corte elegido todo lo clasificable está dentro de plazo: no hay atraso que gestionar, sólo plazo por correr.",
    barras: [
      { etiqueta: "Al día", valor: alDia, destacada: vencido <= 0 },
      { etiqueta: "Vencido", valor: vencido, destacada: vencido > 0 },
    ],
  });

  // ── Etapa 2 · desde cuándo ──
  etapas.push({
    id: "a2",
    fase: "¿Desde cuándo?",
    tipo: "premisa",
    rotulo:
      vencido <= 0
        ? "Sin atraso"
        : tramoManda
        ? `Tramo ${mayorTramo.bucket}: ${Math.round(pctTramo)}%`
        : "Atraso repartido",
    titulo:
      vencido <= 0
        ? "No hay antigüedad de atraso que medir"
        : tramoManda
        ? `El tramo ${mayorTramo.bucket} concentra el ${Math.round(pctTramo)}% del vencido`
        : "El vencido está repartido entre tramos",
    dato:
      ant.ponderada === null
        ? "Sin facturas clasificadas: la antigüedad no se puede promediar"
        : `Antigüedad ponderada ${ant.ponderada.toFixed(2)} d contra promedio simple ${ant.simple?.toFixed(2) ?? "—"} d · tramo mayor ${mayorTramo?.bucket ?? "—"}: ${d(mayorTramo?.monto ?? 0)}`,
    porque:
      vencido <= 0
        ? "No se inventa una antigüedad donde no hay atraso."
        : tramoManda
        ? "La antigüedad no es pareja: un solo tramo explica la mayor parte del vencido, y ese tramo dice desde cuándo viene el problema."
        : "Sin un tramo dominante, el atraso no tiene una fecha de origen común: se acumuló de a poco y no responde a un evento puntual.",
    barras: tramosVencidos.map((t) => ({
      etiqueta: t.bucket,
      valor: t.monto,
      destacada: tramoManda && t.bucket === mayorTramo.bucket,
    })),
  });

  // ── Etapa 3 · en quién se concentra ──
  etapas.push({
    id: "a3",
    fase: "¿En quién se concentra?",
    tipo: deudorManda ? "hallazgo" : "premisa",
    rotulo:
      !deudor || vencido <= 0
        ? "Sin deudor"
        : deudorManda
        ? `${corto(deudor.nombre)} ${Math.round(pctDeudor)}%`
        : "Vencido repartido",
    titulo:
      !deudor || vencido <= 0
        ? "No hay deuda vencida atribuible a nadie"
        : deudorManda
        ? `${deudor.nombre} concentra el ${Math.round(pctDeudor)}% del vencido`
        : "Ningún cliente concentra el vencido",
    dato:
      !deudor || vencido <= 0
        ? "Ninguna factura vencida al corte"
        : `${d(deudor.saldo)} de ${d(vencido)} vencidos · umbral ${UMBRALES.concentracionAlta}%`,
    porque:
      !deudor || vencido <= 0
        ? "Sin vencido no hay a quién reclamar: la conclusión negativa es el resultado."
        : deudorManda
        ? "Con un cliente por encima del umbral, el aging deja de describir a la cartera y pasa a describir una relación comercial concreta."
        : "El vencido repartido no se gestiona cliente por cliente: es el proceso el que se revisa.",
    barras: ranking.slice(0, 4).map((c, i) => ({
      etiqueta: corto(c.nombre),
      valor: c.saldo,
      destacada: i === 0 && deudorManda,
    })),
  });

  // ── Conclusión ──
  const sinHallazgo = !deudorManda && !tramoManda;
  etapas.push({
    id: "aconclusion",
    fase: "Conclusión",
    tipo: "conclusion",
    rotulo: deudorManda ? "Es un deudor" : tramoManda ? "Es un tramo" : "Está repartido",
    titulo: deudorManda
      ? `El vencido describe a ${deudor?.nombre}, no a la cartera`
      : tramoManda
      ? `El vencido describe al tramo ${mayorTramo.bucket}, no a la cartera`
      : "El vencido está repartido: no hay un caso puntual",
    dato:
      aging.saldoNoClasificable > 0
        ? `${d(aging.saldoNoClasificable)} quedan FUERA del aging por falta de fecha de vencimiento (${aging.excluidas.filter((e) => e.motivo === "sin_fecha_vencimiento").length} factura(s)): no se les inventa fecha`
        : "Todo el saldo con deuda tiene fecha de vencimiento: nada queda fuera del aging",
    porque: sinHallazgo
      ? "Conclusión negativa y vale igual: sin deudor ni tramo dominante, no hay un caso que perseguir — corresponde revisar el proceso de cobro, no una cuenta."
      : "El acto que se sigue es puntual y verificable al corte declarado, no una reforma general.",
  });

  return {
    titular: "Cartera vencida al corte",
    valorTitular: d(vencido),
    lecturaIngenua:
      "Leído solo, el saldo vencido sugiere que la cartera entera está atrasada por igual y que hay que perseguirla completa.",
    etapas,
    accion: deudorManda
      ? `Reclamar a ${deudor?.nombre} — ${d(deudor?.saldo ?? 0)} vencidos`
      : tramoManda
      ? `Atacar el tramo ${mayorTramo.bucket} — ${d(mayorTramo.monto)}`
      : "Revisar el proceso de cobro: el vencido no tiene un origen puntual",
    sinHallazgo,
  };
}

/**
 * Argumento del M3 — worklist de clientes prioritarios: ¿cuántos requieren
 * atención, cuál pesa más, es un caso puntual o un patrón, y a quién priorizar
 * hoy? Se deriva de `prioridadSimulada` (score 🟣 simulado, pendiente de
 * validación por Finanzas) — la etiqueta de simulación NO se oculta acá.
 */
export function argumentoPrioritarios(dataset: Dataset, fechaCorte: string): Argumento {
  const filas = prioridadSimulada(dataset, fechaCorte);
  const totalClientes = dataset.clientes.length;
  const totalSaldo = filas.reduce((s, f) => s + f.saldoTotal, 0);
  const lider = filas[0] ?? null;
  const parteLider = lider && totalSaldo > 0 ? pct(lider.saldoTotal, totalSaldo) : 0;
  const esCaso = lider !== null && parteLider >= UMBRALES.concentracionAlta;

  const etapas: Etapa[] = [
    {
      id: "pr1",
      fase: "¿Cuántos requieren atención?",
      tipo: "objecion",
      rotulo: `${filas.length} de ${totalClientes}`,
      titulo: `${filas.length} de ${totalClientes} cliente(s) tienen saldo abierto`,
      dato: `${dinero(totalSaldo)} en saldo abierto repartidos en ${filas.length} cuenta(s)`,
      porque:
        filas.length > 0
          ? "No todo el catálogo debe cobranza hoy: la worklist filtra al que sí, antes de preguntar a quién primero."
          : "Ningún cliente tiene saldo abierto: no hay worklist que priorizar hoy.",
      barras: filas.slice(0, 4).map((f) => ({ etiqueta: corto(f.nombreCliente), valor: f.saldoTotal })),
    },
    {
      id: "pr2",
      fase: "¿Cuál pesa más?",
      tipo: "premisa",
      rotulo: lider ? `${corto(lider.nombreCliente)} · score ${lider.scoreSimulado}` : "Sin líder",
      titulo: lider
        ? `${lider.nombreCliente} tiene el score (🟣 simulado) más alto: ${lider.scoreSimulado}`
        : "No hay cuentas para puntuar",
      dato: lider ? `${dinero(lider.saldoTotal)} · ${lider.diasMaxAtraso} días de atraso máx.` : "—",
      porque:
        "El score combina saldo y días de atraso 50/50 (🟣 simulado, sin validar): el más alto es el candidato a mirar primero, no el que más ruido hace.",
      barras: filas
        .slice(0, 4)
        .map((f) => ({ etiqueta: corto(f.nombreCliente), valor: f.scoreSimulado, destacada: lider ? f.idCliente === lider.idCliente : false })),
    },
    {
      id: "pr3",
      fase: "¿Es un caso o un patrón?",
      tipo: esCaso ? "hallazgo" : "premisa",
      rotulo: esCaso ? `${corto(lider!.nombreCliente)} ${Math.round(parteLider)}%` : "Saldo repartido",
      titulo: esCaso
        ? `${lider!.nombreCliente} concentra el ${Math.round(parteLider)}% del saldo priorizado`
        : "El saldo priorizado está repartido entre varios clientes",
      dato: lider ? `${dinero(lider.saldoTotal)} de ${dinero(totalSaldo)} en la worklist` : "—",
      porque: esCaso
        ? "Con un cliente por encima del umbral, priorizar hoy es gestionar una cuenta puntual, no reorganizar el proceso de cobranza entero."
        : "Sin concentración, la worklist describe un comportamiento repartido: conviene trabajarla en orden, no perseguir un caso.",
    },
    {
      id: "prconclusion",
      fase: "Conclusión",
      tipo: "conclusion",
      rotulo: lider ? `Priorizar a ${corto(lider.nombreCliente)}` : "Sin acción hoy",
      titulo: lider ? `Priorizar a ${lider.nombreCliente} hoy: ${lider.accionSugerida}` : "Ningún cliente requiere priorización",
      dato: lider ? `score ${lider.scoreSimulado} · ${lider.accionSugerida}` : "worklist vacía",
      porque: lider
        ? "El acto sugerido sale de la cascada de reglas (disputa → escalamiento → llamada → recordatorio), no de una opinión."
        : "Conclusión negativa y vale igual: no hay una cuenta que priorizar por encima de las demás.",
    },
  ];

  return {
    titular: "Worklist de cobranza",
    valorTitular: `${filas.length} cuenta(s)`,
    lecturaIngenua:
      "Leída sola, una lista larga de cuentas pendientes sugiere que hay que llamar a todas por igual, empezando por la primera de la lista.",
    etapas,
    accion: lider ? `${lider.accionSugerida} — ${lider.nombreCliente} (${dinero(lider.saldoTotal)})` : "Sin acción pendiente",
    sinHallazgo: !esCaso,
  };
}

/**
 * Argumento del M5 — seguimiento de cobros: ¿cuánta gestión se ha hecho, sobre
 * quién se concentra, qué queda pendiente de arrancar, y a quién contactar
 * hoy? `gestiones` es el estado local del navegador (bitácora), NUNCA
 * persistido en servidor — se pasa como parámetro porque no vive en Dataset.
 */
export function argumentoSeguimiento(
  dataset: Dataset,
  gestiones: GestionCobranza[],
  fechaCorte: string
): Argumento {
  const prioridad = prioridadSimulada(dataset, fechaCorte);
  const nombreDe = (id: string) => dataset.clientes.find((c) => c.id_cliente === id)?.nombre_cliente ?? id;

  const porCliente = new Map<string, number>();
  for (const g of gestiones) {
    porCliente.set(g.id_cliente, (porCliente.get(g.id_cliente) ?? 0) + 1);
  }
  const clientesConGestion = new Set(porCliente.keys());
  const clientesConSaldo = new Set(prioridad.map((f) => f.idCliente));
  const cubiertos = [...clientesConSaldo].filter((id) => clientesConGestion.has(id));
  const sinGestion = prioridad.filter((f) => !clientesConGestion.has(f.idCliente));

  const ranking = [...porCliente.entries()]
    .map(([id, n]) => ({ id, nombre: nombreDe(id), n }))
    .sort((a, b) => b.n - a.n);
  const masGestionado = ranking[0] ?? null;
  const hayPendientes = sinGestion.length > 0;
  const prioridadSinGestion = sinGestion[0] ?? null; // prioridad ya viene ordenada por score desc

  const etapas: Etapa[] = [
    {
      id: "s1",
      fase: "¿Cuánta gestión se ha hecho?",
      tipo: "objecion",
      rotulo: `${cubiertos.length} de ${clientesConSaldo.size} con saldo`,
      titulo: `${gestiones.length} gestión(es) registradas cubren a ${cubiertos.length} de ${clientesConSaldo.size} cliente(s) con saldo`,
      dato: `${gestiones.length} gestión(es) sobre ${clientesConGestion.size} cliente(s) distinto(s) · corte ${fechaCorte}`,
      porque: "El total de gestiones no dice si están bien repartidas: hay que separar cuántas de a quiénes.",
      barras: [
        { etiqueta: "Con gestión", valor: cubiertos.length, destacada: true },
        { etiqueta: "Sin gestión", valor: sinGestion.length, destacada: sinGestion.length > 0 },
      ],
    },
    {
      id: "s2",
      fase: "¿Sobre quién se concentra?",
      tipo: "premisa",
      rotulo: masGestionado ? `${corto(masGestionado.nombre)} · ${masGestionado.n}` : "Sin gestiones",
      titulo: masGestionado
        ? `${masGestionado.nombre} concentra ${masGestionado.n} de ${gestiones.length} gestión(es)`
        : "Todavía no hay gestiones registradas",
      dato: masGestionado ? `${masGestionado.n} gestión(es) de ${gestiones.length} totales` : "—",
      porque: "La bitácora se puede llenar hablando siempre con el mismo cliente y dejando a los demás sin tocar.",
      barras: ranking.slice(0, 4).map((r) => ({ etiqueta: corto(r.nombre), valor: r.n, destacada: masGestionado ? r.id === masGestionado.id : false })),
    },
    {
      id: "s3",
      fase: "¿Qué queda pendiente?",
      tipo: hayPendientes ? "hallazgo" : "premisa",
      rotulo: hayPendientes ? `${sinGestion.length} sin contacto` : "Todos con contacto",
      titulo: hayPendientes
        ? `${sinGestion.length} cliente(s) con saldo abierto no tienen NINGUNA gestión registrada`
        : "Todo cliente con saldo abierto tiene al menos una gestión registrada",
      dato: hayPendientes ? sinGestion.map((f) => f.nombreCliente).join(", ") : "—",
      porque: hayPendientes
        ? "Un cliente con saldo y cero gestiones es un vacío de proceso, no un caso resuelto: nadie lo ha tocado todavía."
        : "Sin vacíos, el trabajo pendiente es de seguimiento, no de arranque.",
    },
    {
      id: "sconclusion",
      fase: "Conclusión",
      tipo: "conclusion",
      rotulo: prioridadSinGestion ? `Contactar a ${corto(prioridadSinGestion.nombreCliente)}` : "Seguimiento al día",
      titulo: prioridadSinGestion
        ? `Iniciar contacto con ${prioridadSinGestion.nombreCliente} — el de mayor score sin ninguna gestión`
        : "Todos los clientes con saldo ya tienen historial de gestión",
      dato: prioridadSinGestion
        ? `score ${prioridadSinGestion.scoreSimulado} · ${dinero(prioridadSinGestion.saldoTotal)}`
        : `${gestiones.length} gestión(es) sobre ${clientesConGestion.size} cliente(s)`,
      porque: prioridadSinGestion
        ? "Empezar por el de mayor score sin contacto cierra el vacío más urgente antes que repetir gestión donde ya hay historial."
        : "Conclusión negativa y vale igual: no hay un vacío de arranque que resolver hoy.",
    },
  ];

  return {
    titular: "Cobertura de gestión",
    valorTitular: `${cubiertos.length} de ${clientesConSaldo.size}`,
    lecturaIngenua:
      "Leído solo, el conteo de gestiones sugiere que la cobranza está trabajando toda la cartera por igual.",
    etapas,
    accion: prioridadSinGestion
      ? `Registrar el primer contacto con ${prioridadSinGestion.nombreCliente}`
      : "Sin vacíos de arranque — continuar el seguimiento en curso",
    sinHallazgo: !hayPendientes,
  };
}

/**
 * Argumento del M8 — ventas: ¿vendido y facturado cuadran, cuál venta pesa
 * más, se concentra el margen en una operación, y qué se sigue de eso? Sólo
 * corre si el dataset trae la cadena del Paso 11 (Decisión de alcance
 * 2026-08-15) — si no, la página avisa en vez de mostrar ceros.
 */
export function argumentoVentas(dataset: Dataset): Argumento | null {
  if (!hayCadena(dataset)) return null;

  const ventas = ventasConTotal(dataset);
  const cuadre = cuadreVentasFacturacion(dataset);
  const totalVendido = ventas.reduce((s, v) => s + v.total, 0);
  const margenTotal = ventas.reduce((s, v) => s + v.margen, 0);

  const mayorVenta = [...ventas].sort((a, b) => b.total - a.total)[0] ?? null;
  const pctMayorVenta = mayorVenta && totalVendido > 0 ? pct(mayorVenta.total, totalVendido) : 0;

  const mayorMargen = [...ventas].sort((a, b) => b.margen - a.margen)[0] ?? null;
  const pctMayorMargen = mayorMargen && margenTotal > 0 ? pct(mayorMargen.margen, margenTotal) : 0;
  const margenConcentrado = mayorMargen !== null && margenTotal > 0 && pctMayorMargen >= UMBRALES.concentracionAlta;

  const etapas: Etapa[] = [
    {
      id: "v1",
      fase: "¿Vendido y facturado cuadran?",
      tipo: "objecion",
      rotulo: cuadre.cuadra ? "Cuadra" : `Descuadre ${dinero(Math.abs(cuadre.diferencia))}`,
      titulo: cuadre.cuadra
        ? `Vendido y facturado cuadran: ${dinero(cuadre.totalVendido)}`
        : `Hay un descuadre de ${dinero(Math.abs(cuadre.diferencia))} entre lo vendido y lo facturado`,
      dato: `vendido ${dinero(cuadre.totalVendido)} · facturado ${dinero(cuadre.totalFacturado)}`,
      porque: cuadre.cuadra
        ? "Vendido y facturado nacen de la misma cadena de hechos: si cuadran, es porque están bien construidos, no porque coincida."
        : "Un descuadre significa que la cadena se rompió: hay una venta sin factura o una factura sin venta. Se declara el monto exacto, no un booleano.",
      barras: [
        { etiqueta: "Vendido", valor: cuadre.totalVendido, destacada: cuadre.cuadra },
        { etiqueta: "Facturado", valor: cuadre.totalFacturado, destacada: !cuadre.cuadra },
      ],
    },
    {
      id: "v2",
      fase: "¿Cuál venta pesa más?",
      tipo: "premisa",
      rotulo: mayorVenta ? `${mayorVenta.id_venta} · ${Math.round(pctMayorVenta)}%` : "Sin ventas",
      titulo: mayorVenta
        ? `${mayorVenta.id_venta} (${mayorVenta.cliente}) es el ${Math.round(pctMayorVenta)}% de lo vendido`
        : "No hay ventas para comparar",
      dato: mayorVenta
        ? `${dinero(mayorVenta.total)} de ${dinero(totalVendido)} vendidos en ${ventas.length} venta(s)`
        : "—",
      porque: "El total vendido es una suma: no dice si nace de muchas ventas parejas o de una sola grande.",
      barras: ventas
        .slice(0, 4)
        .map((v) => ({ etiqueta: v.id_venta, valor: v.total, destacada: mayorVenta ? v.id_venta === mayorVenta.id_venta : false })),
    },
    {
      id: "v3",
      fase: "¿El margen se concentra en una venta?",
      tipo: margenConcentrado ? "hallazgo" : "premisa",
      rotulo: margenConcentrado ? `${mayorMargen!.id_venta} · ${Math.round(pctMayorMargen)}%` : "Margen repartido",
      titulo: margenConcentrado
        ? `${mayorMargen!.id_venta} aporta el ${Math.round(pctMayorMargen)}% del margen bruto`
        : "El margen bruto está repartido entre varias ventas",
      dato: mayorMargen ? `${dinero(mayorMargen.margen)} de ${dinero(margenTotal)} de margen total` : "—",
      porque: margenConcentrado
        ? `El margen total (${dinero(margenTotal)}) esconde que una sola venta sostiene la mayor parte: perderla pesa más que el promedio sugiere.`
        : "Sin una venta dominante, el margen depende del conjunto y no de una operación puntual.",
    },
    {
      id: "vconclusion",
      fase: "Conclusión",
      tipo: "conclusion",
      rotulo: !cuadre.cuadra ? "Revisar la cadena" : margenConcentrado ? `Cuidar ${mayorMargen!.id_venta}` : "Cartera de ventas sana",
      titulo: !cuadre.cuadra
        ? "Revisar la cadena Ventas↔Inventario↔CxC antes que el total vendido"
        : margenConcentrado
        ? `${mayorMargen!.id_venta} sostiene el margen: cuidar esa relación antes que el promedio`
        : "Vendido, facturado y margen no dependen de un caso puntual",
      dato: !cuadre.cuadra
        ? `descuadre de ${dinero(Math.abs(cuadre.diferencia))}`
        : margenConcentrado
        ? `${mayorMargen!.id_venta}: ${dinero(mayorMargen!.margen)} de margen`
        : `${ventas.length} venta(s), ninguna domina el margen`,
      porque:
        cuadre.cuadra && !margenConcentrado
          ? "Conclusión negativa y vale igual: no hay una venta ni un descuadre que exija acción hoy."
          : "El acto que se sigue es puntual y verificable, no una reforma general del proceso de ventas.",
    },
  ];

  return {
    titular: "Total vendido",
    valorTitular: dinero(totalVendido),
    lecturaIngenua:
      "Leído solo, el total vendido sugiere una cartera de ventas pareja, sin saber si depende de una sola operación.",
    etapas,
    accion: !cuadre.cuadra
      ? `Investigar el descuadre de ${dinero(Math.abs(cuadre.diferencia))}`
      : margenConcentrado
      ? `Dar seguimiento a la venta ${mayorMargen!.id_venta} (${mayorVenta?.cliente ?? ""})`
      : "Sin acción puntual pendiente",
    sinHallazgo: cuadre.cuadra && !margenConcentrado,
  };
}

/**
 * Argumento del M4 — forecast: el propio simulacro contado en cuatro etapas.
 * Cada etapa insiste en que es SIMULACIÓN — nunca dato real — porque acá el
 * riesgo no es una cifra mal leída, es una cifra simulada leída como si fuera
 * caja real.
 */
export function argumentoForecast(dataset: Dataset, fechaCorte: string): Argumento {
  const puntos = forecastSimulado(dataset, fechaCorte);
  const ultimo = puntos[puntos.length - 1];
  const spread = ultimo.optimista - ultimo.pesimista;
  const pctSpread = ultimo.base > 0 ? pct(spread, ultimo.base) : 0;
  const mitad = ultimo.base / 2;
  const semanaMitad = ultimo.base > 0 ? puntos.find((p) => p.base >= mitad)?.semana ?? null : null;

  const etapas: Etapa[] = [
    {
      id: "f1",
      fase: "¿Qué se proyecta cobrar?",
      tipo: "objecion",
      rotulo: `${dinero(ultimo.base)} en 13 sem.`,
      titulo: `El escenario base simula ${dinero(ultimo.base)} cobrados en 13 semanas`,
      dato: `optimista ${dinero(ultimo.optimista)} · pesimista ${dinero(ultimo.pesimista)} · corte ${fechaCorte}`,
      porque:
        "Es una ILUSTRACIÓN mecánica de tres desplazamientos inventados (10/30/60 días), no una proyección de caja real: no hay histórico de cobro detrás.",
      barras: [
        { etiqueta: "Optimista", valor: ultimo.optimista },
        { etiqueta: "Base", valor: ultimo.base, destacada: true },
        { etiqueta: "Pesimista", valor: ultimo.pesimista },
      ],
    },
    {
      id: "f2",
      fase: "¿Qué tan ancha es la incertidumbre?",
      tipo: "premisa",
      rotulo: `${Math.round(pctSpread)}% de ancho`,
      titulo: `Entre optimista y pesimista hay ${dinero(spread)} de diferencia — el ${Math.round(pctSpread)}% del escenario base`,
      dato: `semana 13: optimista ${dinero(ultimo.optimista)} − pesimista ${dinero(ultimo.pesimista)} = ${dinero(spread)}`,
      porque:
        "Tres escenarios sin ancho no dirían nada distinto entre sí: el ancho es la única razón de mostrar tres líneas y no una.",
      barras: puntos
        .filter((_, i) => i % 3 === 0 || i === puntos.length - 1)
        .map((p) => ({ etiqueta: `sem ${p.semana}`, valor: p.optimista - p.pesimista })),
    },
    {
      id: "f3",
      fase: "¿Cuándo se cobra la mitad?",
      tipo: semanaMitad !== null ? "hallazgo" : "premisa",
      rotulo: semanaMitad !== null ? `Semana ${semanaMitad}` : "Sin punto medio",
      titulo:
        semanaMitad !== null
          ? `El escenario base llega a la mitad de su cobro simulado en la semana ${semanaMitad}`
          : "No hay cobro simulado que promediar",
      dato:
        semanaMitad !== null
          ? `${dinero(mitad)} es la mitad de ${dinero(ultimo.base)} · alcanzada en la semana ${semanaMitad} de 13`
          : "—",
      porque: "El total de la semana 13 no dice si el cobro simulado se concentra al principio o al final del horizonte.",
      barras: puntos.map((p) => ({ etiqueta: `${p.semana}`, valor: p.base, destacada: p.semana === semanaMitad })),
    },
    {
      id: "fconclusion",
      fase: "Conclusión",
      tipo: "conclusion",
      rotulo: "Simulación, no dato",
      titulo: "Ningún número de este forecast es caja real: es una ilustración del patrón de tres escenarios",
      dato: `base semana 13: ${dinero(ultimo.base)} · pendiente de validación por Finanzas`,
      porque:
        "La conclusión acá no es un acto de cobranza: es una advertencia. Tratar esta cifra como caja real sería el error que el rótulo «Simulación» busca evitar.",
    },
  ];

  return {
    titular: "Forecast de cobro (simulado)",
    valorTitular: dinero(ultimo.base),
    lecturaIngenua:
      "Leído solo, un forecast con curvas suaves y tres escenarios sugiere una proyección de caja calculada con datos históricos reales.",
    etapas,
    accion: "Ninguna — es simulación; no ejecutar cobranza sobre esta cifra sin validación de Finanzas",
    sinHallazgo: semanaMitad === null,
  };
}

/**
 * Argumento del M6 — calidad de datos: el único módulo cuyo "caso" no es de
 * negocio, es del propio dataset. ¿Cuántas filas hay y cuántas sirven, dónde
 * se concentran los problemas, y es usable el resultado?
 */
export function argumentoDatos(dataset: Dataset): Argumento {
  const total = dataset.facturas.length;
  const problemas = dataset.facturas.map((f) => {
    const motivos: string[] = [];
    if (!f.fecha_vencimiento) motivos.push("sin fecha de vencimiento");
    if (f.fecha_emision === "1970-01-01") motivos.push("sin fecha de emisión real");
    if (f.monto_original <= 0) motivos.push("monto no positivo");
    return { factura: f, motivos };
  });
  const conProblema = problemas.filter((p) => p.motivos.length > 0);
  const pctProblema = pct(conProblema.length, total);

  const conteoPorMotivo = new Map<string, number>();
  for (const p of conProblema) {
    for (const m of p.motivos) conteoPorMotivo.set(m, (conteoPorMotivo.get(m) ?? 0) + 1);
  }
  const motivoDominante = [...conteoPorMotivo.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const clientesSinFactura = dataset.clientes.filter(
    (c) => !dataset.facturas.some((f) => f.id_cliente === c.id_cliente)
  );

  const etapas: Etapa[] = [
    {
      id: "d1",
      fase: "¿Cuántas filas hay y cuántas sirven?",
      tipo: "objecion",
      rotulo: `${total - conProblema.length} de ${total} limpias`,
      titulo: `${total - conProblema.length} de ${total} factura(s) no tienen ningún problema detectado`,
      dato: `fuente: ${dataset.fuente} · ${dataset.clientes.length} cliente(s) · ${total} factura(s)`,
      porque: "El conteo de filas cargadas no dice si sirven: hay que separar lo que entró de lo que entró completo.",
      barras: [
        { etiqueta: "Limpias", valor: total - conProblema.length, destacada: conProblema.length === 0 },
        { etiqueta: "Con problema", valor: conProblema.length, destacada: conProblema.length > 0 },
      ],
    },
    {
      id: "d2",
      fase: "¿Cuántas filas tienen problemas?",
      tipo: "premisa",
      rotulo: `${Math.round(pctProblema)}% con problema`,
      titulo:
        conProblema.length > 0
          ? `${conProblema.length} factura(s) (${Math.round(pctProblema)}%) tienen al menos un problema`
          : "Ninguna factura tiene problemas detectados",
      dato:
        conProblema.length > 0
          ? conProblema.slice(0, 6).map((p) => p.factura.numero_factura).join(", ") + (conProblema.length > 6 ? "…" : "")
          : "—",
      porque: "El porcentaje con problema es lo que decide si el dataset se puede usar tal cual o necesita limpieza antes.",
      barras: [...conteoPorMotivo.entries()].map(([m, n]) => ({ etiqueta: m, valor: n })),
    },
    {
      id: "d3",
      fase: "¿Dónde se concentran?",
      tipo: motivoDominante ? "hallazgo" : "premisa",
      rotulo: motivoDominante ? `${motivoDominante[1]}× «${motivoDominante[0]}»` : "Sin concentración",
      titulo: motivoDominante
        ? `El problema más común es «${motivoDominante[0]}» (${motivoDominante[1]} factura(s))`
        : "No hay un tipo de problema que domine",
      dato: motivoDominante
        ? `${motivoDominante[1]} de ${conProblema.length} fila(s) con problema comparten el mismo motivo`
        : "—",
      porque: motivoDominante
        ? "Si un solo motivo explica la mayoría de los problemas, corregir ESE campo en el origen limpia casi todo el dataset de una vez."
        : "Sin un motivo dominante, los problemas son heterogéneos: no hay una sola corrección que los resuelva todos.",
    },
    {
      id: "dconclusion",
      fase: "Conclusión",
      tipo: "conclusion",
      rotulo: pctProblema === 0 ? "Dataset usable" : pctProblema < 20 ? "Usable con reservas" : "Requiere limpieza",
      titulo:
        pctProblema === 0
          ? "El dataset no tiene problemas detectados: usable tal cual"
          : pctProblema < 20
          ? "El dataset es usable, pero con filas declaradas fuera de ciertos cálculos"
          : "El dataset necesita limpieza antes de confiar en sus indicadores",
      dato: `${conProblema.length} de ${total} factura(s) con problema · ${clientesSinFactura.length} cliente(s) sin ninguna factura`,
      porque:
        pctProblema === 0
          ? "Conclusión negativa y vale igual: no hay corrección pendiente sobre este dataset."
          : "El acto que sigue es corregir el origen del motivo dominante, no auditar fila por fila.",
    },
  ];

  return {
    titular: "Calidad del dataset",
    valorTitular: `${Math.round(100 - pctProblema)}% limpio`,
    lecturaIngenua:
      "Leído solo, el número de filas cargadas sugiere que el dataset está completo y listo para calcular cualquier indicador.",
    etapas,
    accion: motivoDominante
      ? `Corregir «${motivoDominante[0]}» en el origen — afecta ${motivoDominante[1]} factura(s)`
      : "Sin corrección pendiente",
    sinHallazgo: conProblema.length === 0,
  };
}
