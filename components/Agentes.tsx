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
import { calcularAging, diasAtraso, disputaActiva, estadoFacturaDerivado, fmtMoneda, nombreDeCliente } from "@/lib/calculos";
import type { ResultadoAging } from "@/lib/calculos";
import { antiguedadPonderada, calcularDso, concentracionRiesgo } from "@/lib/kpis";
import type { ResultadoAntiguedad, ResultadoConcentracion, ResultadoDso } from "@/lib/kpis";
import {
  hayCadena,
  integridadInventario,
  salidasSinVenta,
  stockPorProducto,
  ventasConTotal,
  vinculoVentaFacturaDisponible,
} from "@/lib/cadena";
import type { FilaStock, IntegridadInventario } from "@/lib/cadena";
import { forecastSimulado, prioridadSimulada } from "@/lib/simulados";
import type { FilaPrioridad, PuntoForecast } from "@/lib/simulados";
import type { Dataset, Disputa, Moneda } from "@/lib/types";

// ── El tipo de un hallazgo: TRES estados, no dos ──────────────────────────
//
// Antes esto era `{ hay: boolean; texto: string }`, y ese booleano era la causa
// raíz de todo lo que fallaba acá abajo. La realidad de un agente tiene TRES
// estados y el tipo sólo sabía representar dos:
//
//   a) encontré algo
//   b) miré y no había nada          ← legítimo, y vale tanto como (a)
//   c) NO PUDE MIRAR: el dato no existe
//
// Con dos estados, (b) y (c) colapsan en el mismo `false`. Por eso el pie de la
// ventana afirmaba "el agente miró y no encontró" TAMBIÉN cuando el agente no
// había mirado nada — una frase falsa la mitad de las veces. Una unión
// discriminada hace imposible seguir confundiéndolos.

/** Una entrada de la fórmula: el número que entró, y con qué nombre entró. */
export interface EntradaEvidencia {
  nombre: string;
  valor: number | string;
  unidad?: string;
}

/** De dónde salió el dato. Una cuenta sin origen declarado no es evidencia:
 *  es una afirmación. */
export interface Procedencia {
  /** Qué alimentó el cálculo (modelo de origen o función de lib/). */
  modelo: string;
  /** Qué quedó afuera, y por qué. */
  filtro: string;
  /** A qué fecha se midió. */
  corte: string;
  /** Adónde ir a verlo, si hay adónde. */
  enlace?: string;
}

export interface Evidencia {
  /** La fórmula tal como se aplica. */
  expresion: string;
  /** Los valores concretos que entraron en esa fórmula. */
  entradas: EntradaEvidencia[];
  procedencia: Procedencia;
}

export interface FilaRanking {
  id: string;
  etiqueta: string;
  valor: number;
  pct: number;
}

/** Las filas MÁS el total contra el que se calculó cada pct. El denominador va
 *  explícito: un porcentaje sin denominador declarado es exactamente lo que
 *  este proyecto lleva una tanda entera sacando de la pantalla. */
export interface Ranking {
  filas: FilaRanking[];
  total: number;
  unidad?: string;
}

export type Hallazgo =
  | { estado: "hallazgo"; texto: string; evidencia: Evidencia; ranking?: Ranking }
  | { estado: "sin-hallazgo"; texto: string; evidencia: Evidencia }
  | {
      estado: "sin-dato";
      /** Los tres campos son OBLIGATORIOS a propósito, no opcionales. Un campo
       *  opcional que documenta una ausencia no se llena nunca. Así, un agente
       *  que no puede mirar NO COMPILA hasta explicar qué le falta, qué se
       *  pierde por no tenerlo, y cómo se llena: la mudez pasa a ser un error
       *  de tipo en vez de un silencio. */
      queFalta: string;
      consecuencia: string;
      comoSeLlena: string;
    };

// ── EL ADAPTADOR TEMPORAL: MUERTO, Y ESTA ES SU ACTA ──────────────────────
//
// Acá vivían `HallazgoLegado` (`{ hay: boolean; texto: string }`) y su
// traductor `normalizarHallazgo()`. Existían para que los agentes sin migrar
// siguieran compilando mientras se pasaba, grupo por grupo, al tipo de tres
// estados. Su condición de muerte estaba escrita desde el principio: se
// borraban cuando migrara el ÚLTIMO de los seis grupos de módulo. Ya migraron
// los seis, por nombre:
//
//   1. AGENTES_PRIORITARIOS   (M3 · worklist)
//   2. AGENTES_SEGUIMIENTO    (M5 · cobros)
//   3. AGENTES_VENTAS         (M8 · ventas)
//   4. AGENTES_INVENTARIO     (M7 · inventario)
//   5. AGENTES_FORECAST       (M4 · forecast)
//   6. AGENTES_DATOS          (M6 · calidad de datos)
//
// Con los seis migrados el adaptador quedaba en función identidad: recibía un
// Hallazgo y devolvía el mismo Hallazgo. Un adaptador que no adapta nada es
// justamente el vestigio que se vuelve permanente si nadie lo borra el día que
// sobra, así que se borró ese día. Los 28 agentes (4 de cartera + 6 × 4 de
// módulo) construyen su Hallazgo de tres estados directamente, y `mirar`
// devuelve ese tipo y ningún otro: ya no hay borde que normalizar.

export interface Agente {
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

/** Un agente ya migrado: MIDE y REDACTA por separado.
 *
 *  Antes `mirar` hacía las dos cosas en la misma pasada, y por eso la evidencia
 *  se calculaba y se tiraba: la función devolvía una frase y nada más. Separado,
 *  `medir` produce la medición estructurada —que es lo que el drill-down
 *  necesita— y `redactar` la convierte en prosa. `mirar` queda como la
 *  composición de las dos, para que los consumidores no cambien. */
export interface AgenteMedido<M> extends Agente {
  medir: (d: Dataset, corte: string) => M;
  redactar: (m: M) => Hallazgo;
  mirar: (d: Dataset, corte: string) => Hallazgo;
}

function definirAgente<M>(spec: Omit<AgenteMedido<M>, "mirar">): AgenteMedido<M> {
  return { ...spec, mirar: (d, corte) => spec.redactar(spec.medir(d, corte)) };
}

// `Moneda` vive en lib/types.ts junto al resto del vocabulario de dinero: acá
// se reexporta para no romper a quien ya la importaba desde este módulo, pero
// la definición es UNA SOLA. Dos listas de monedas que hay que mantener
// sincronizadas a mano se desincronizan.
export type { Moneda };
const monedaDe = (d: Dataset): Moneda => (d.fuente === "odoo-real" ? "GTQ" : "USD");

interface TramoMedido {
  bucket: string;
  part: number;
  mayorSaldo: number;
  total: number;
}

interface MedicionRastreador {
  moneda: Moneda;
  corte: string;
  porTramo: TramoMedido[];
  dominado:
    | null
    | { bucket: string; numero: string; mayorSaldo: number; total: number; part: number; ranking: Ranking };
}

export const AGENTES: Agente[] = [
  definirAgente<MedicionRastreador>({
    id: "rastreador",
    glifo: "🔍",
    nombre: "Rastreador",
    pregunta: "¿Hay una sola factura sosteniendo un tramo entero?",
    base: "mayor saldo del tramo ÷ total del tramo · umbral 60%",
    medir: (d, corte) => {
      const moneda = monedaDe(d);
      const a = calcularAging(d, corte);
      const porTramo: TramoMedido[] = [];
      let dominado: MedicionRastreador["dominado"] = null;
      for (const [bucket, total] of Object.entries(a.totalesPorBucket)) {
        // "actual" (al día) se excluye igual que en tramoDominado()
        // (lib/argumento.ts): que una sola factura sea la mayor parte de lo
        // que YA está al día no es una señal de riesgo de cobranza.
        if (total <= 0 || bucket === "actual") continue;
        const enTramo = a.clasificadas.filter((c) => c.bucket === bucket);
        // Este orden YA se calculaba y se descartaba: sólo se usaba [0] para
        // sacar `mayor` y el resto se tiraba. El ranking no se computa acá, se
        // deja de perder.
        const ordenado = [...enTramo].sort((x, y) => y.saldo - x.saldo);
        const mayor = ordenado[0];
        if (!mayor) continue;
        const part = (mayor.saldo / total) * 100;
        porTramo.push({ bucket, part, mayorSaldo: mayor.saldo, total });
        if (part >= 60 && !dominado) {
          dominado = {
            bucket,
            numero: mayor.factura.numero_factura,
            mayorSaldo: mayor.saldo,
            total,
            part,
            ranking: {
              total,
              unidad: moneda,
              filas: ordenado.slice(0, 10).map((c) => ({
                id: c.factura.id_factura,
                etiqueta: c.factura.numero_factura,
                valor: c.saldo,
                pct: (c.saldo / total) * 100,
              })),
            },
          };
        }
      }
      return { moneda, corte, porTramo, dominado };
    },
    redactar: (m) => {
      const fmt = (n: number) => fmtMoneda(n, m.moneda);
      const procedencia: Procedencia = {
        modelo: "facturas → calcularAging(dataset, corte)",
        filtro: "tramos con total > 0; se excluye el tramo «actual»",
        corte: m.corte,
      };
      if (m.dominado) {
        const x = m.dominado;
        return {
          estado: "hallazgo",
          texto: `${x.numero} es el ${Math.round(x.part)}% del tramo ${x.bucket} (${fmt(x.mayorSaldo)} de ${fmt(x.total)}). El tramo describe una factura, no una tendencia.`,
          evidencia: {
            expresion: "mayor saldo del tramo ÷ total del tramo · umbral 60%",
            entradas: [
              { nombre: "tramo", valor: x.bucket },
              { nombre: "mayor saldo del tramo", valor: x.mayorSaldo, unidad: m.moneda },
              { nombre: "total del tramo", valor: x.total, unidad: m.moneda },
              { nombre: "participación", valor: x.part, unidad: "%" },
              { nombre: "umbral", valor: 60, unidad: "%" },
            ],
            procedencia,
          },
          ranking: x.ranking,
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ningún tramo está dominado por una sola factura. El atraso está repartido.",
        evidencia: {
          expresion: "mayor saldo del tramo ÷ total del tramo · umbral 60%",
          entradas: [
            ...m.porTramo.map((t) => ({
              nombre: `participación del mayor en ${t.bucket}`,
              valor: t.part,
              unidad: "%",
            })),
            { nombre: "umbral", valor: 60, unidad: "%" },
          ],
          procedencia,
        },
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; c: ResultadoConcentracion }>({
    id: "balanza",
    glifo: "⚖",
    nombre: "Balanza",
    pregunta: "¿Un cliente concentra el riesgo?",
    base: "mayor saldo por cliente ÷ saldo total · umbral 35%",
    medir: (d, corte) => ({ moneda: monedaDe(d), corte, c: concentracionRiesgo(d, corte) }),
    redactar: ({ moneda, corte, c }) => {
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const procedencia: Procedencia = {
        modelo: "facturas → concentracionRiesgo(dataset, corte)",
        filtro: "incluye el saldo no clasificable: la deuda sin fecha sigue siendo riesgo de quien la debe",
        corte,
      };
      // `porCliente` ya venía ordenado de mayor a menor y con su pct calculado.
      // Antes se descartaba entero y sólo se usaba `mayorCliente`.
      const ranking: Ranking = {
        total: c.saldoTotal,
        unidad: moneda,
        filas: c.porCliente.slice(0, 10).map((x) => ({
          id: x.id_cliente,
          etiqueta: x.nombre,
          valor: x.saldo,
          pct: x.pct,
        })),
      };
      const entradas: EntradaEvidencia[] = [
        { nombre: "mayor saldo por cliente", valor: c.mayorCliente?.saldo ?? 0, unidad: moneda },
        { nombre: "saldo total", valor: c.saldoTotal, unidad: moneda },
        { nombre: "concentración", valor: c.mayorPct ?? 0, unidad: "%" },
        { nombre: "umbral", valor: 35, unidad: "%" },
        { nombre: "clientes con saldo", valor: c.porCliente.length },
      ];
      if ((c.mayorPct ?? 0) >= 35) {
        return {
          estado: "hallazgo",
          texto: `${c.mayorCliente?.nombre} tiene el ${c.mayorPct}% de la cartera (${fmt(c.mayorCliente?.saldo ?? 0)} de ${fmt(c.saldoTotal)}). El promedio lo describe a él, no al conjunto.`,
          evidencia: { expresion: "mayor saldo por cliente ÷ saldo total · umbral 35%", entradas, procedencia },
          ranking,
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `Mayor cliente: ${c.mayorPct}%, bajo el umbral de 35%. Nadie concentra el riesgo.`,
        evidencia: { expresion: "mayor saldo por cliente ÷ saldo total · umbral 35%", entradas, procedencia },
        ranking,
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; dso: ResultadoDso; ant: ResultadoAntiguedad }>({
    id: "cronometro",
    glifo: "◷",
    nombre: "Cronómetro",
    pregunta: "¿El promedio simple esconde facturas grandes y viejas?",
    base: "Σ(saldo × días) ÷ Σ(saldo) contra promedio simple · brecha ≥ 3 d",
    medir: (d, corte) => ({
      moneda: monedaDe(d),
      corte,
      dso: calcularDso(d, corte),
      ant: antiguedadPonderada(d, corte),
    }),
    redactar: ({ moneda, corte, dso, ant }) => {
      // ÉSTE es el caso (c) del comentario de arriba: no es que el agente haya
      // mirado y no encontrara nada — es que NO PUDO MIRAR. Sin facturas
      // clasificadas no hay antigüedad que promediar. Con el tipo viejo esto
      // devolvía `hay: false` y la ventana lo anunciaba como "el agente miró y
      // no encontró", que era falso.
      if (ant.ponderada === null || ant.simple === null) {
        return {
          estado: "sin-dato",
          queFalta: "No hay ninguna factura clasificada en el aging al corte declarado: sin facturas con saldo y fecha de vencimiento, no hay antigüedad que promediar.",
          consecuencia: "No se puede decir si el promedio simple esconde facturas grandes y viejas. No se inventa un valor: un promedio sobre cero facturas no es 0 días, es ninguna respuesta.",
          comoSeLlena: "Con facturas abiertas con fecha de vencimiento al corte. Si las hay en Odoo y acá no aparecen, el problema es de importación, no de cálculo: revisar scripts/importar-facturas-odoo.mjs y el corte usado.",
        };
      }
      const brecha = Math.abs(ant.ponderada - ant.simple);
      const conDso =
        dso.dso === null ? "DSO no calculable (no hubo facturación en la ventana)" : `DSO ${dso.dso.toFixed(2)} d`;
      const procedencia: Procedencia = {
        modelo: "facturas → antiguedadPonderada() y calcularDso()",
        filtro: "sólo facturas clasificadas en el aging (con saldo y fecha de vencimiento)",
        corte,
      };
      const entradas: EntradaEvidencia[] = [
        { nombre: "antigüedad ponderada", valor: Number(ant.ponderada.toFixed(2)), unidad: "d" },
        { nombre: "promedio simple", valor: Number(ant.simple.toFixed(2)), unidad: "d" },
        { nombre: "brecha", valor: Number(brecha.toFixed(2)), unidad: "d" },
        { nombre: "umbral", valor: 3, unidad: "d" },
        { nombre: "Σ(saldo × días)", valor: ant.totalPonderado },
        { nombre: "Σ(saldo)", valor: ant.saldoTotal, unidad: moneda },
        { nombre: "facturas clasificadas", valor: ant.filas.length },
        { nombre: "DSO", valor: dso.dso === null ? "no calculable" : Number(dso.dso.toFixed(2)), unidad: "d" },
      ];
      // `ant.filas` ya traía cada factura con su saldo, sus días y su aporte
      // saldo×días. El agente lo descartaba entero.
      const ranking: Ranking = {
        total: ant.totalPonderado,
        unidad: `${moneda}×d`,
        filas: [...ant.filas]
          .sort((x, y) => y.aporte - x.aporte)
          .slice(0, 10)
          .map((f) => ({
            id: f.id_factura,
            etiqueta: `${f.numero} · ${f.dias} d`,
            valor: f.aporte,
            pct: ant.totalPonderado > 0 ? (f.aporte / ant.totalPonderado) * 100 : 0,
          })),
      };
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
          estado: "hallazgo",
          texto: `Ponderada ${ant.ponderada.toFixed(2)} d contra promedio simple ${ant.simple.toFixed(2)} d: ${brecha.toFixed(2)} días de brecha. ${lectura} ${conDso}.`,
          evidencia: { expresion: "Σ(saldo × días) ÷ Σ(saldo) contra promedio simple · brecha ≥ 3 d", entradas, procedencia },
          ranking,
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `Ponderada ${ant.ponderada.toFixed(2)} d y promedio simple ${ant.simple.toFixed(2)} d casi coinciden: el tamaño no distorsiona la antigüedad.`,
        evidencia: { expresion: "Σ(saldo × días) ÷ Σ(saldo) contra promedio simple · brecha ≥ 3 d", entradas, procedencia },
        ranking,
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; a: ResultadoAging }>({
    id: "sello",
    glifo: "✓",
    nombre: "Sello",
    pregunta: "¿Hay saldo que el aging no puede clasificar?",
    base: "facturas con saldo y sin fecha de vencimiento",
    medir: (d, corte) => ({ moneda: monedaDe(d), corte, a: calcularAging(d, corte) }),
    redactar: ({ moneda, corte, a }) => {
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const procedencia: Procedencia = {
        modelo: "facturas → calcularAging(dataset, corte).excluidas",
        filtro: "facturas con saldo > 0 y fecha_vencimiento nula; nunca se inventa una fecha",
        corte,
      };
      const entradas: EntradaEvidencia[] = [
        { nombre: "saldo no clasificable", valor: a.saldoNoClasificable, unidad: moneda },
        { nombre: "facturas fuera del aging", valor: a.excluidas.length },
        { nombre: "saldo clasificado", valor: a.totalClasificado, unidad: moneda },
        { nombre: "facturas clasificadas", valor: a.clasificadas.length },
      ];
      if (a.saldoNoClasificable > 0) {
        // `excluidas` ya estaba calculada: se usaba sólo para contar `.length`.
        const ranking: Ranking = {
          total: a.saldoNoClasificable,
          unidad: moneda,
          filas: [...a.excluidas]
            .sort((x, y) => y.saldo - x.saldo)
            .slice(0, 10)
            .map((e) => ({
              id: e.factura.id_factura,
              etiqueta: e.factura.numero_factura,
              valor: e.saldo,
              pct: a.saldoNoClasificable > 0 ? (e.saldo / a.saldoNoClasificable) * 100 : 0,
            })),
        };
        return {
          estado: "hallazgo",
          texto: `${fmt(a.saldoNoClasificable)} quedan FUERA del aging por fecha de vencimiento faltante (${a.excluidas.length} factura(s)). No se les inventa una fecha: se las declara.`,
          evidencia: { expresion: "facturas con saldo y sin fecha de vencimiento", entradas, procedencia },
          ranking,
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Todas las facturas con saldo tienen fecha de vencimiento. Nada queda fuera del aging.",
        evidencia: { expresion: "facturas con saldo y sin fecha de vencimiento", entradas, procedencia },
      };
    },
  }),
];

// ── Agentes propios de cada módulo nuevo (paso M6 de la reestructuración) ──
// Mismo contrato que AGENTES: una pregunta fija, una fórmula declarada en
// `base`, y una lente que mira el dataset (nunca inventa). Cada lista tiene
// EXACTAMENTE 4 agentes a propósito: el ancho de la muesca (MUESCA_W, en
// Argumento.tsx) se calcula una sola vez a partir de NUM_AGENTES = AGENTES.length
// — mantener 4 en cada módulo nuevo evita tener que tocar esa cuenta.

/** Procedencia armada en una línea: los tres campos obligatorios, siempre. */
function proc(modelo: string, filtro: string, corte: string, enlace?: string): Procedencia {
  return { modelo, filtro, corte, enlace };
}

/** El dataset real de Odoo NO trae tabla de disputas: `lib/datosReales.ts`
 *  devuelve `disputas: []` literal porque esa tabla no existe en el Supabase
 *  real (verificado 2026-08-19). Por eso "no hay disputas viejas" es una frase
 *  que NO se puede decir con datos reales: no es que se haya mirado y no
 *  hubiera — es que no hay dónde mirar. Los agentes que dependen de disputas
 *  consultan esto y caen a "sin-dato" en vez de afirmar tranquilidad. */
const hayFuenteDeDisputas = (d: Dataset): boolean =>
  // La segunda mitad no es defensa vacía: si algún día el import SÍ trae
  // disputas reales, el dato manda sobre la suposición y estos agentes vuelven
  // a medir solos. La regla es "no hay dónde mirar", no "la fuente es odoo".
  d.fuente !== "odoo-real" || d.disputas.length > 0;

// RAMA R7 — RESUELTA el 2026-08-24 (docs/hallazgos-odoo-en-vivo.md, «¿Existen
// disputas en Odoo?»): NO EXISTEN COMO TAL. No es que el import las haya
// dejado afuera — es que en Odoo no hay ningún modelo de disputa o reclamo. Lo
// más parecido es el seguimiento de cobranza (account_followup, 64 clientes en
// follow-up-reports.xlsx), y el propio boletín lo separa con todas las letras:
// «eso es gestión de cobro, no disputa». Un seguimiento dice que se está
// reclamando; una disputa dice que el cliente DESCONOCE el cargo. Tomar uno por
// el otro convertiría a 64 clientes gestionados en 64 clientes en conflicto.
const SIN_FUENTE_DISPUTAS = {
  queFalta:
    "La fuente de disputas, que no existe en ningún lado. Ni la tabla en Supabase (lib/datosReales.ts devuelve la lista vacía), ni el modelo en Odoo: el Frente 1 lo buscó el 2026-08-24 y no encontró ningún modelo de disputa ni de reclamo. No es una lista vacía: es una fuente que no está.",
  consecuencia:
    "No se puede afirmar que no haya disputas, ni contarlas, ni medir su antigüedad. Un cero acá sería tranquilidad inventada: se estaría leyendo una ausencia de datos como una ausencia de conflictos.",
  comoSeLlena:
    "Primero hay que decidir dónde se registran los reclamos, porque hoy no se registran. Lo más cercano que existe es el seguimiento de cobranza de Odoo (account_followup, 64 clientes), pero eso es gestión de cobro y NO es una disputa: confundirlos convertiría clientes gestionados en clientes en conflicto. Confirmar contra Odoo vivo antes de construir cualquier pantalla de disputas.",
} as const;

const SIN_CADENA_VENTAS = {
  queFalta:
    "Este dataset no trae la cadena de ventas: faltan productos, ventas o líneas de venta. Un CSV solo-CxC es un dataset válido, pero no contiene lo vendido.",
  consecuencia:
    "No se puede comparar lo vendido contra lo facturado, ni seguir una venta hasta su factura. No se muestra un cero: cero ventas y no saber de ventas son cosas distintas, y sólo una de las dos es cierta acá.",
  comoSeLlena:
    "Cargando el dataset real de Odoo (que sí trae la cadena) o importando ventas y líneas con scripts/importar-ventas-odoo.mjs.",
} as const;

const SIN_CADENA_INVENTARIO = {
  queFalta:
    "Este dataset no trae la cadena de inventario: faltan productos o movimientos.",
  consecuencia:
    "No se puede auditar el kardex ni medir rotación. Un tablero de inventario en blanco es honesto; uno lleno de ceros afirmaría que no hay mercadería, que es otra cosa.",
  comoSeLlena:
    "Cargando el dataset real de Odoo o importando movimientos con scripts/importar-inventario-odoo.mjs.",
} as const;

/** M3 — worklist de prioritarios: agentes sobre `prioridadSimulada`. */
export const AGENTES_PRIORITARIOS: Agente[] = [
  definirAgente<{ corte: string; filas: FilaPrioridad[] }>({
    id: "vigia",
    glifo: "👁",
    nombre: "Vigía",
    pregunta: "¿Una cuenta en disputa igual quedó entre las 3 más urgentes?",
    base: "prioridadSimulada() · top 3 por score · enDisputa === true",
    medir: (d, corte) => ({ corte, filas: prioridadSimulada(d, corte) }),
    redactar: ({ corte, filas }) => {
      // Con la worklist vacía, "la penalización la sacó del podio" era una
      // afirmación sobre un podio que no existe. No hay tres cuentas que mirar.
      if (filas.length === 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "La worklist de prioritarios salió vacía al corte: prioridadSimulada() no devolvió ninguna cuenta con saldo abierto.",
          consecuencia:
            "No hay top 3 sobre el cual preguntar si una disputa se coló. Decir que la penalización la sacó del podio describiría un podio que no existe.",
          comoSeLlena:
            "Con facturas abiertas al corte declarado. Si las hay en Odoo y acá no aparecen, el corte o la importación son el problema, no el score.",
        };
      }
      const top3 = filas.slice(0, 3);
      const conDisputa = top3.find((f) => f.enDisputa);
      const procedencia = proc(
        "facturas + disputas → prioridadSimulada(dataset, corte)",
        "sólo las 3 primeras filas por score simulado; el score de una cuenta en disputa ya viene penalizado a la mitad",
        corte,
        "/prioritarios"
      );
      // Sin ranking A PROPÓSITO: la pregunta es de pertenencia (quedó o no en
      // el top 3), no de reparto. Un top N con porcentajes exigiría un
      // denominador, y la suma de scores no es una magnitud: no significa nada.
      const entradas: EntradaEvidencia[] = [
        ...top3.map((f, i) => ({
          nombre: `#${i + 1} ${f.nombreCliente}${f.enDisputa ? " (en disputa)" : ""}`,
          valor: f.scoreSimulado,
          unidad: "score",
        })),
        { nombre: "cuentas en la worklist", valor: filas.length },
      ];
      if (conDisputa) {
        return {
          estado: "hallazgo",
          texto: `${conDisputa.nombreCliente} sigue en el top 3 (score ${conDisputa.scoreSimulado}) aunque la disputa ya penalizó su score a la mitad. La penalización no alcanza a bajarla del podio.`,
          evidencia: { expresion: "prioridadSimulada() · top 3 por score · enDisputa === true", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ninguna cuenta en disputa quedó entre las 3 más urgentes: la penalización la sacó del podio.",
        evidencia: { expresion: "prioridadSimulada() · top 3 por score · enDisputa === true", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; filas: FilaPrioridad[] }>({
    id: "balanza-worklist",
    glifo: "⚖",
    nombre: "Balanza",
    pregunta: "¿Un cliente concentra el saldo de la worklist?",
    base: "mayor saldoTotal de la worklist ÷ saldo total de la worklist · umbral 35%",
    medir: (d, corte) => ({ moneda: monedaDe(d), corte, filas: prioridadSimulada(d, corte) }),
    redactar: ({ moneda, corte, filas }) => {
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const total = filas.reduce((s, f) => s + f.saldoTotal, 0);
      const ordenado = [...filas].sort((a, b) => b.saldoTotal - a.saldoTotal);
      const mayor = ordenado[0];
      if (!mayor || total <= 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "La worklist no tiene saldo al corte: o salió vacía, o todas sus cuentas suman cero. Sin denominador no hay reparto que medir.",
          consecuencia:
            "No se puede decir si alguien concentra el riesgo ni tampoco descartarlo. Un cero por ciento de concentración sería una división por cero disfrazada de tranquilidad.",
          comoSeLlena:
            "Con facturas abiertas con saldo al corte declarado. Si las hay en Odoo y acá no aparecen, revisar la importación y el corte usado.",
        };
      }
      const part = (mayor.saldoTotal / total) * 100;
      const procedencia = proc(
        "facturas → prioridadSimulada(dataset, corte) · saldoTotal por cuenta",
        "todas las cuentas de la worklist con saldo abierto al corte",
        corte,
        "/prioritarios"
      );
      const entradas: EntradaEvidencia[] = [
        { nombre: "mayor saldo de la worklist", valor: mayor.saldoTotal, unidad: moneda },
        { nombre: "saldo total de la worklist", valor: total, unidad: moneda },
        { nombre: "concentración", valor: part, unidad: "%" },
        { nombre: "umbral", valor: 35, unidad: "%" },
        { nombre: "cuentas en la worklist", valor: filas.length },
      ];
      const ranking: Ranking = {
        total,
        unidad: moneda,
        filas: ordenado.slice(0, 10).map((f) => ({
          id: f.idCliente,
          etiqueta: f.nombreCliente,
          valor: f.saldoTotal,
          pct: (f.saldoTotal / total) * 100,
        })),
      };
      if (part >= 35) {
        return {
          estado: "hallazgo",
          texto: `${mayor.nombreCliente} concentra el ${Math.round(part)}% del saldo de la worklist (${fmt(mayor.saldoTotal)} de ${fmt(total)}).`,
          evidencia: { expresion: "mayor saldoTotal de la worklist ÷ saldo total de la worklist · umbral 35%", entradas, procedencia },
          ranking,
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `Mayor cliente: ${Math.round(part)}% del saldo de la worklist, bajo el umbral de 35%. El saldo está repartido.`,
        evidencia: { expresion: "mayor saldoTotal de la worklist ÷ saldo total de la worklist · umbral 35%", entradas, procedencia },
        ranking,
      };
    },
  }),
  definirAgente<{ corte: string; lider: FilaPrioridad | undefined }>({
    id: "compas",
    glifo: "🧭",
    nombre: "Compás",
    pregunta: "¿El score del líder lo explica el saldo o los días de atraso?",
    base: "nSaldo = saldo÷5.000 · nDias = días÷120 (techos del score simulado) · brecha ≥ 0.15",
    medir: (d, corte) => ({ corte, lider: prioridadSimulada(d, corte)[0] }),
    redactar: ({ corte, lider }) => {
      if (!lider) {
        return {
          estado: "sin-dato",
          queFalta:
            "La worklist salió vacía al corte: no hay una cuenta líder cuyo score se pueda descomponer en saldo y días.",
          consecuencia:
            "No se puede decir qué pesa más en la urgencia. Sin líder no hay score, y sin score no hay nada que explicar.",
          comoSeLlena:
            "Con facturas abiertas al corte declarado. Si las hay en Odoo y acá no aparecen, revisar la importación y el corte usado.",
        };
      }
      const nSaldo = Math.min(lider.saldoTotal / 5000, 1);
      const nDias = Math.min(Math.max(lider.diasMaxAtraso, 0) / 120, 1);
      const brecha = Math.abs(nSaldo - nDias);
      const procedencia = proc(
        "facturas → prioridadSimulada(dataset, corte) · primera fila",
        "sólo la cuenta líder; los techos 5.000 y 120 d son los del score simulado, no umbrales de negocio",
        corte,
        "/prioritarios"
      );
      // Sin ranking: se comparan DOS componentes de UNA cuenta, no una
      // población. Fabricar un top N acá sería inventar un orden inexistente.
      const entradas: EntradaEvidencia[] = [
        { nombre: "cuenta líder", valor: lider.nombreCliente },
        { nombre: "saldo del líder", valor: lider.saldoTotal },
        { nombre: "saldo normalizado (÷5.000, tope 1)", valor: Number(nSaldo.toFixed(4)) },
        { nombre: "días de atraso del líder", valor: lider.diasMaxAtraso, unidad: "d" },
        { nombre: "días normalizados (÷120, tope 1)", valor: Number(nDias.toFixed(4)) },
        { nombre: "brecha", valor: Number(brecha.toFixed(4)) },
        { nombre: "umbral", valor: 0.15 },
      ];
      if (brecha >= 0.15) {
        const manda = nSaldo > nDias ? "el saldo" : "los días de atraso";
        return {
          estado: "hallazgo",
          texto: `En ${lider.nombreCliente}, ${manda} explica la mayor parte del score (saldo normalizado ${(nSaldo * 100).toFixed(0)}% contra días normalizados ${(nDias * 100).toFixed(0)}%).`,
          evidencia: { expresion: "nSaldo = saldo÷5.000 · nDias = días÷120 (techos del score simulado) · brecha ≥ 0.15", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `En ${lider.nombreCliente}, saldo y días pesan casi igual en el score: ninguno de los dos manda solo.`,
        evidencia: { expresion: "nSaldo = saldo÷5.000 · nDias = días÷120 (techos del score simulado) · brecha ≥ 0.15", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; filas: FilaPrioridad[] }>({
    id: "filtro",
    glifo: "🗂",
    nombre: "Filtro",
    pregunta: "¿Hay cuentas en la worklist sin un solo día de atraso?",
    base: "filas con saldoTotal > 0 y diasMaxAtraso === 0",
    medir: (d, corte) => ({ corte, filas: prioridadSimulada(d, corte) }),
    redactar: ({ corte, filas }) => {
      if (filas.length === 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "La worklist salió vacía al corte: no hay ninguna cuenta cuyos días de atraso se puedan revisar.",
          consecuencia:
            "Afirmar que toda cuenta tiene al menos un día de atraso, sobre cero cuentas, es cierto por vacío y falso como información: daría por revisada una lista que no existe.",
          comoSeLlena:
            "Con facturas abiertas al corte declarado. Si las hay en Odoo y acá no aparecen, revisar la importación y el corte usado.",
        };
      }
      const sinAtraso = filas.filter((f) => f.diasMaxAtraso === 0);
      const procedencia = proc(
        "facturas → prioridadSimulada(dataset, corte) · diasMaxAtraso",
        "todas las cuentas de la worklist; se entra por tener saldo abierto, no por estar vencida",
        corte,
        "/prioritarios"
      );
      // La pregunta es un CONTEO: cuántas cuentas cumplen la condición. Un top N
      // no aporta orden alguno acá — todas valen lo mismo frente al criterio.
      const entradas: EntradaEvidencia[] = [
        { nombre: "cuentas en la worklist", valor: filas.length },
        { nombre: "cuentas sin un solo día de atraso", valor: sinAtraso.length },
        { nombre: "cuentas con al menos un día de atraso", valor: filas.length - sinAtraso.length },
      ];
      if (sinAtraso.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${sinAtraso.length} cuenta(s) están en la worklist con saldo abierto pero SIN un solo día de atraso: ${sinAtraso.map((f) => f.nombreCliente).join(", ")}. Entraron por tener saldo, no por estar vencidas.`,
          evidencia: { expresion: "filas con saldoTotal > 0 y diasMaxAtraso === 0", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Toda cuenta en la worklist tiene al menos un día de atraso.",
        evidencia: { expresion: "filas con saldoTotal > 0 y diasMaxAtraso === 0", entradas, procedencia },
      };
    },
  }),
];

/** M5 — seguimiento de cobros: agentes sobre el dataset (facturas/disputas).
 *  La bitácora local (gestiones) NO pasa por acá — vive en el estado del
 *  componente, no en Dataset; el motor de argumentación de la página sí la usa. */
export const AGENTES_SEGUIMIENTO: Agente[] = [
  definirAgente<{ corte: string; hayFuente: boolean; activas: Disputa[]; viejas: Disputa[] }>({
    id: "guardia",
    glifo: "⏳",
    nombre: "Guardia",
    pregunta: "¿Alguna disputa lleva más de 30 días abierta?",
    base: "disputas activas · fecha de corte − fecha de apertura > 30 días",
    medir: (d, corte) => {
      const activas = d.disputas.filter((x) => disputaActiva(x));
      return {
        corte,
        hayFuente: hayFuenteDeDisputas(d),
        activas,
        viejas: activas.filter((x) => diasAtraso(corte, x.fecha_apertura) > 30),
      };
    },
    redactar: ({ corte, hayFuente, activas, viejas }) => {
      // Sin tabla de disputas NO se puede decir "ninguna lleva más de 30 días":
      // esa frase afirma haber revisado una lista que no existe.
      if (!hayFuente) return { estado: "sin-dato", ...SIN_FUENTE_DISPUTAS };
      const procedencia = proc(
        "disputas → disputaActiva() + diasAtraso(corte, fecha_apertura)",
        "sólo disputas activas (abierta o en revisión); las resueltas y rechazadas no cuentan",
        corte,
        "/seguimiento"
      );
      // Sin ranking: la pregunta es un CONTEO con un peor caso, y la prosa ya
      // nombra ese peor caso. Un top N por días no tiene denominador posible
      // (la suma de días de varias disputas no es una magnitud).
      const entradas: EntradaEvidencia[] = [
        { nombre: "disputas activas", valor: activas.length },
        { nombre: "disputas con más de 30 días", valor: viejas.length },
        { nombre: "umbral", valor: 30, unidad: "d" },
        ...viejas.map((x) => ({
          nombre: `factura ${x.id_factura} abierta desde ${x.fecha_apertura}`,
          valor: diasAtraso(corte, x.fecha_apertura),
          unidad: "d",
        })),
      ];
      if (viejas.length > 0) {
        const peor = [...viejas].sort((a, b) => diasAtraso(corte, a.fecha_apertura) - diasAtraso(corte, b.fecha_apertura)).at(-1)!;
        return {
          estado: "hallazgo",
          texto: `${viejas.length} disputa(s) llevan más de 30 días abiertas. La más vieja: factura ${peor.id_factura}, ${diasAtraso(corte, peor.fecha_apertura)} días sin resolver.`,
          evidencia: { expresion: "disputas activas · fecha de corte − fecha de apertura > 30 días", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ninguna disputa activa lleva más de 30 días abierta.",
        evidencia: { expresion: "disputas activas · fecha de corte − fecha de apertura > 30 días", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; abiertas: ResultadoAging["clasificadas"] }>({
    id: "reloj-seguimiento",
    glifo: "⏱",
    nombre: "Reloj",
    pregunta: "¿Cuál factura abierta lleva más días esperando cobro?",
    base: "facturas clasificadas no pagadas · máximo de días de atraso",
    medir: (d, corte) => ({
      moneda: monedaDe(d),
      corte,
      abiertas: calcularAging(d, corte).clasificadas.filter((c) => c.estado !== "pagada"),
    }),
    redactar: ({ moneda, corte, abiertas }) => {
      const fmt = (n: number) => fmtMoneda(n, moneda);
      if (abiertas.length === 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "No hay ninguna factura clasificada y abierta al corte: sin facturas con saldo y fecha de vencimiento, no hay espera que medir.",
          consecuencia:
            "No se puede señalar cuál lleva más tiempo esperando gestión. No es que la cobranza esté al día: es que no hay nada sobre lo cual afirmarlo.",
          comoSeLlena:
            "Con facturas abiertas con fecha de vencimiento al corte. Si las hay en Odoo y acá no aparecen, revisar scripts/importar-facturas-odoo.mjs y el corte usado.",
        };
      }
      const peor = [...abiertas].sort((x, y) => y.dias - x.dias)[0];
      const procedencia = proc(
        "facturas → calcularAging(dataset, corte).clasificadas",
        "sólo facturas clasificadas cuyo estado derivado no es «pagada»; las sin fecha de vencimiento quedan fuera del aging",
        corte,
        "/seguimiento"
      );
      // Sin ranking: es un MÁXIMO, no un reparto. Los días de varias facturas
      // no suman un total contra el cual sacar porcentajes.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas clasificadas abiertas", valor: abiertas.length },
        { nombre: "factura que más espera", valor: peor.factura.numero_factura },
        { nombre: "días de atraso de esa factura", valor: peor.dias, unidad: "d" },
        { nombre: "saldo de esa factura", valor: peor.saldo, unidad: moneda },
      ];
      if (peor.dias > 0) {
        return {
          estado: "hallazgo",
          texto: `${peor.factura.numero_factura} lleva ${peor.dias} días de atraso — es la que más tiempo espera gestión (${fmt(peor.saldo)}).`,
          evidencia: { expresion: "facturas clasificadas no pagadas · máximo de días de atraso", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ninguna factura clasificada está vencida: la que más espera todavía está en plazo.",
        evidencia: { expresion: "facturas clasificadas no pagadas · máximo de días de atraso", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; abiertas: number; conVarias: [string, number][]; nombre: (id: string) => string }>({
    id: "enlace",
    glifo: "🔗",
    nombre: "Enlace",
    pregunta: "¿Hay clientes con más de una factura abierta a la vez?",
    base: "facturas no pagadas agrupadas por cliente · cuenta ≥ 2",
    medir: (d, corte) => {
      const porCliente = new Map<string, number>();
      let abiertas = 0;
      for (const c of calcularAging(d, corte).clasificadas) {
        if (c.estado === "pagada") continue;
        abiertas++;
        porCliente.set(c.factura.id_cliente, (porCliente.get(c.factura.id_cliente) ?? 0) + 1);
      }
      return {
        corte,
        abiertas,
        conVarias: [...porCliente.entries()].filter(([, n]) => n >= 2),
        nombre: (id: string) => nombreDeCliente(d.clientes, id),
      };
    },
    redactar: ({ corte, abiertas, conVarias, nombre }) => {
      if (abiertas === 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "No hay ninguna factura clasificada y abierta al corte: no hay nada que agrupar por cliente.",
          consecuencia:
            "Afirmar que ningún cliente acumula facturas, sobre cero facturas, es cierto por vacío y engañoso como información: sugiere una cartera revisada y sana donde no hay cartera.",
          comoSeLlena:
            "Con facturas abiertas con fecha de vencimiento al corte. Si las hay en Odoo y acá no aparecen, revisar scripts/importar-facturas-odoo.mjs y el corte usado.",
        };
      }
      const procedencia = proc(
        "facturas → calcularAging(dataset, corte).clasificadas, agrupadas por id_cliente",
        "sólo facturas clasificadas cuyo estado derivado no es «pagada»",
        corte,
        "/seguimiento"
      );
      // Sin ranking: es un CONTEO de clientes que cruzan un umbral de 2, y la
      // prosa ya los nombra con su cuenta. No hay reparto de un total.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas clasificadas abiertas", valor: abiertas },
        { nombre: "clientes con 2 o más facturas abiertas", valor: conVarias.length },
        { nombre: "umbral", valor: 2, unidad: "facturas" },
        ...conVarias.map(([id, n]) => ({ nombre: nombre(id), valor: n, unidad: "facturas" })),
      ];
      if (conVarias.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${conVarias.length} cliente(s) tienen 2 o más facturas abiertas a la vez: ${conVarias.map(([id, n]) => `${nombre(id)} (${n})`).join(", ")}. Conviene gestionarlas juntas, no factura por factura.`,
          evidencia: { expresion: "facturas no pagadas agrupadas por cliente · cuenta ≥ 2", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ningún cliente tiene más de una factura abierta a la vez.",
        evidencia: { expresion: "facturas no pagadas agrupadas por cliente · cuenta ≥ 2", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; hayFuente: boolean; noAnuladas: number; bloqueadas: string[] }>({
    id: "bitacora-bloqueo",
    glifo: "🔒",
    nombre: "Bitácora",
    pregunta: "¿Cuántas facturas tienen el cobro bloqueado por una disputa?",
    base: "estadoFacturaDerivado === disputada, sobre las facturas no anuladas",
    medir: (d, corte) => {
      const noAnuladas = d.facturas.filter((f) => f.estado_factura !== "anulada");
      return {
        corte,
        hayFuente: hayFuenteDeDisputas(d),
        noAnuladas: noAnuladas.length,
        bloqueadas: noAnuladas
          .filter((f) => estadoFacturaDerivado(f, d.pagos, d.notasCredito, d.disputas) === "disputada")
          .map((f) => f.numero_factura),
      };
    },
    redactar: ({ corte, hayFuente, noAnuladas, bloqueadas }) => {
      // El estado "disputada" se DERIVA de la tabla de disputas. Sin esa tabla
      // ninguna factura puede salir disputada nunca, así que el conteo daría 0
      // por construcción — un cero que no mide nada.
      if (!hayFuente) return { estado: "sin-dato", ...SIN_FUENTE_DISPUTAS };
      const procedencia = proc(
        "facturas + disputas → estadoFacturaDerivado(factura, pagos, notasCredito, disputas)",
        "se excluyen las facturas anuladas; el estado se deriva, no se lee del campo estado_factura",
        corte,
        "/seguimiento"
      );
      // La pregunta empieza con "¿cuántas?": es un conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas no anuladas", valor: noAnuladas },
        { nombre: "facturas con cobro bloqueado por disputa", valor: bloqueadas.length },
      ];
      if (bloqueadas.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${bloqueadas.length} de ${noAnuladas} factura(s) no anuladas tienen el cobro bloqueado por disputa: ${bloqueadas.join(", ")}. No se gestionan como cobranza normal hasta resolverse.`,
          evidencia: { expresion: "estadoFacturaDerivado === disputada, sobre las facturas no anuladas", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ninguna factura tiene el cobro bloqueado por disputa.",
        evidencia: { expresion: "estadoFacturaDerivado === disputada, sobre las facturas no anuladas", entradas, procedencia },
      };
    },
  }),
];

/** M8 — ventas: agentes sobre `dataset.ventas`/`ventaLineas` (Paso 11). Si el
 *  dataset no trae la cadena, cada agente lo declara en vez de mostrar ceros. */
export const AGENTES_VENTAS: Agente[] = [
  definirAgente<{
    moneda: Moneda;
    corte: string;
    hay: boolean;
    c: ReturnType<typeof cuadreVentasFacturacionSafe> | null;
  }>({
    id: "cuadre",
    glifo: "🧮",
    nombre: "Cuadre",
    pregunta: "¿Vendido y facturado cuadran exactamente?",
    base: "Σ líneas de venta vs Σ monto_original no anulado · diferencia exacta",
    medir: (d, corte) => ({
      moneda: monedaDe(d),
      corte,
      hay: hayCadena(d),
      c: hayCadena(d) ? cuadreVentasFacturacionSafe(d) : null,
    }),
    redactar: ({ moneda, corte, hay, c }) => {
      if (!hay || !c) return { estado: "sin-dato", ...SIN_CADENA_VENTAS };
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const procedencia = proc(
        "ventaLineas → Σ(cantidad × precio_unitario) contra facturas → Σ monto_original",
        "capa «composicion»: las líneas van A PRECIO DE LISTA porque el export de Odoo no trae la columna descuento. Se comparan dos poblaciones distintas (pedidos contra facturas)",
        corte,
        "/ventas"
      );
      // Sin ranking: es UNA resta entre dos totales, no un reparto.
      const entradas: EntradaEvidencia[] = [
        { nombre: "vendido (Σ líneas, a precio de lista)", valor: c.totalVendido, unidad: moneda },
        { nombre: "facturado (Σ monto_original, sin anuladas)", valor: c.totalFacturado, unidad: moneda },
        { nombre: "diferencia", valor: c.diferencia, unidad: moneda },
        { nombre: "tolerancia", valor: 0.005, unidad: moneda },
      ];
      if (!c.cuadra) {
        return {
          estado: "hallazgo",
          texto: `Descuadre de ${fmt(Math.abs(c.diferencia))}: vendido ${fmt(c.totalVendido)} contra facturado ${fmt(c.totalFacturado)}.`,
          evidencia: { expresion: "Σ líneas de venta vs Σ monto_original no anulado · diferencia exacta", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `Vendido y facturado cuadran: ${fmt(c.totalVendido)}.`,
        evidencia: { expresion: "Σ líneas de venta vs Σ monto_original no anulado · diferencia exacta", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; hay: boolean; hayVinculo: boolean; ventas: number; sinFactura: string[] }>({
    id: "cadena-venta",
    glifo: "🔗",
    nombre: "Cadena",
    pregunta: "¿Hay ventas sin factura asociada?",
    base: "ventasConTotal() · id_factura ausente",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      const filas = hay ? ventasConTotal(d) : [];
      return {
        corte,
        hay,
        hayVinculo: vinculoVentaFacturaDisponible(d),
        ventas: filas.length,
        sinFactura: filas.filter((v) => !v.id_factura).map((v) => v.id_venta),
      };
    },
    redactar: ({ corte, hay, hayVinculo, ventas, sinFactura }) => {
      if (!hay) return { estado: "sin-dato", ...SIN_CADENA_VENTAS };
      // Si NINGUNA factura trae id_venta, "ventas sin factura" no es una alarma
      // de negocio: es que este export nunca capturó el vínculo. Acusar a la
      // venta de una cadena rota que el dato es incapaz de mostrar sería
      // fabricar un hallazgo — el mismo vicio, con otro disfraz.
      if (!hayVinculo) {
        return {
          estado: "sin-dato",
          queFalta:
            "Ninguna factura del dataset trae id_venta poblado: este export de Odoo nunca capturó el vínculo venta ↔ factura.",
          consecuencia:
            "Todas las ventas parecerían huérfanas, y no lo son: la cadena no está rota, está sin registrar. Reportarlas como hallazgo sería acusar a la venta de un defecto del export.",
          comoSeLlena:
            "Trayendo de Odoo el campo que liga account.move con sale.order (invoice_origin o la relación sale_line_ids) y mapeándolo a Factura.id_venta en scripts/importar-facturas-odoo.mjs.",
        };
      }
      const procedencia = proc(
        "ventas → ventasConTotal(dataset), cruzado contra facturas por id_venta",
        "sólo ventas del dataset; el vínculo se resuelve por Factura.id_venta, nunca por coincidencia de monto o fecha",
        corte,
        "/ventas"
      );
      // La pregunta es de existencia y conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "ventas en el dataset", valor: ventas },
        { nombre: "ventas sin factura asociada", valor: sinFactura.length },
      ];
      if (sinFactura.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${sinFactura.length} venta(s) no tienen factura asociada: ${sinFactura.join(", ")}. La cadena se rompió ahí.`,
          evidencia: { expresion: "ventasConTotal() · id_factura ausente", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Toda venta tiene su factura asociada.",
        evidencia: { expresion: "ventasConTotal() · id_factura ausente", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; hay: boolean; total: number; porCliente: [string, number][] }>({
    id: "cliente-venta",
    glifo: "⚖",
    nombre: "Cliente",
    pregunta: "¿Un cliente concentra más de 35% de lo vendido?",
    base: "Σ total de ventas por cliente ÷ total vendido · umbral 35%",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      const ventas = hay ? ventasConTotal(d) : [];
      const porCliente = new Map<string, number>();
      for (const v of ventas) porCliente.set(v.cliente, (porCliente.get(v.cliente) ?? 0) + v.total);
      return {
        moneda: monedaDe(d),
        corte,
        hay,
        total: ventas.reduce((s, v) => s + v.total, 0),
        porCliente: [...porCliente.entries()].sort((a, b) => b[1] - a[1]),
      };
    },
    redactar: ({ moneda, corte, hay, total, porCliente }) => {
      if (!hay) return { estado: "sin-dato", ...SIN_CADENA_VENTAS };
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const mayor = porCliente[0];
      if (!mayor || total <= 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "El dataset trae la cadena de ventas pero el total vendido es cero: no hay denominador contra el cual medir concentración.",
          consecuencia:
            "No se puede afirmar ni descartar que alguien concentre las ventas. Un cero por ciento sería una división por cero disfrazada de reparto sano.",
          comoSeLlena:
            "Con líneas de venta que tengan cantidad y precio unitario distintos de cero. Si las hay en Odoo y acá no aparecen, revisar scripts/importar-ventas-odoo.mjs.",
        };
      }
      const part = (mayor[1] / total) * 100;
      const procedencia = proc(
        "ventas → ventasConTotal(dataset) · Σ total por cliente",
        "capa «composicion»: el total de cada venta va A PRECIO DE LISTA porque el export no trae la columna descuento",
        corte,
        "/ventas"
      );
      const entradas: EntradaEvidencia[] = [
        { nombre: "mayor total por cliente", valor: mayor[1], unidad: moneda },
        { nombre: "total vendido (a precio de lista)", valor: total, unidad: moneda },
        { nombre: "concentración", valor: part, unidad: "%" },
        { nombre: "umbral", valor: 35, unidad: "%" },
        { nombre: "clientes con ventas", valor: porCliente.length },
      ];
      const ranking: Ranking = {
        total,
        unidad: moneda,
        filas: porCliente.slice(0, 10).map(([cliente, monto]) => ({
          id: cliente,
          etiqueta: cliente,
          valor: monto,
          pct: (monto / total) * 100,
        })),
      };
      if (part >= 35) {
        return {
          estado: "hallazgo",
          texto: `${mayor[0]} concentra el ${Math.round(part)}% de lo vendido (${fmt(mayor[1])} de ${fmt(total)}).`,
          evidencia: { expresion: "Σ total de ventas por cliente ÷ total vendido · umbral 35%", entradas, procedencia },
          ranking,
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `Mayor cliente: ${Math.round(part)}% de lo vendido, bajo el umbral de 35%.`,
        evidencia: { expresion: "Σ total de ventas por cliente ÷ total vendido · umbral 35%", entradas, procedencia },
        ranking,
      };
    },
  }),
  definirAgente<{ corte: string; hay: boolean; ventas: number; sinMargen: string[] }>({
    id: "margen-venta",
    glifo: "💹",
    nombre: "Margen",
    pregunta: "¿Alguna venta se vendió con margen cero o negativo?",
    base: "ventasConTotal() · margen ≤ 0",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      const filas = hay ? ventasConTotal(d) : [];
      return {
        corte,
        hay,
        ventas: filas.length,
        sinMargen: filas.filter((v) => v.margen <= 0).map((v) => v.id_venta),
      };
    },
    redactar: ({ corte, hay, ventas, sinMargen }) => {
      if (!hay) return { estado: "sin-dato", ...SIN_CADENA_VENTAS };
      const procedencia = proc(
        "ventas → ventasConTotal(dataset) · margen = total − costoTotal",
        "capa «composicion»: es precio de lista menos costo, NO margen comercial — el descuento no está restado, así que el margen real es MENOR que éste",
        corte,
        "/ventas"
      );
      // La pregunta es de existencia y conteo. Sin ranking: ordenar por margen
      // exigiría un denominador que la pregunta no tiene.
      const entradas: EntradaEvidencia[] = [
        { nombre: "ventas en el dataset", valor: ventas },
        { nombre: "ventas con margen cero o negativo", valor: sinMargen.length },
        { nombre: "umbral", valor: 0 },
      ];
      if (sinMargen.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${sinMargen.length} venta(s) tienen margen cero o negativo: ${sinMargen.join(", ")}.`,
          evidencia: { expresion: "ventasConTotal() · margen ≤ 0", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Toda venta tiene margen positivo.",
        evidencia: { expresion: "ventasConTotal() · margen ≤ 0", entradas, procedencia },
      };
    },
  }),
];

/** M7 — inventario: agentes sobre `dataset.movimientosInventario`/`productos`.
 *
 *  DEPENDE DE (R7): los dos primeros agentes hablan de EXISTENCIA, y la
 *  existencia sólo es afirmable si la serie de movimientos contiene toda la
 *  historia del producto. `integridadInventario()` (lib/cadena.ts) lo DERIVA
 *  del propio dato: si la serie de un producto arranca con una salida, hubo
 *  stock antes que el dataset no tiene. Si el Frente 1 confirma que Odoo puede
 *  entregar el saldo inicial y los mínimos reales, estos agentes vuelven solos
 *  a medir — no hay ningún interruptor que acordarse de tocar. */
export const AGENTES_INVENTARIO: Agente[] = [
  definirAgente<{
    corte: string;
    hay: boolean;
    integridad: IntegridadInventario | null;
    stock: FilaStock[];
  }>({
    id: "kardex",
    glifo: "🧾",
    nombre: "Kardex",
    pregunta: "¿Algún producto tiene existencia negativa?",
    base: "stockPorProducto() · existencia < 0",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      return {
        corte,
        hay,
        integridad: hay ? integridadInventario(d) : null,
        stock: hay ? stockPorProducto(d) : [],
      };
    },
    redactar: ({ corte, hay, integridad, stock }) => {
      if (!hay || !integridad) return { estado: "sin-dato", ...SIN_CADENA_INVENTARIO };
      // Una existencia negativa sólo prueba que "el kardex no cuadra" si la
      // serie está COMPLETA. Si arranca a mitad de la historia, el negativo es
      // el síntoma esperable de un saldo inicial ausente, no un descuadre. Se
      // diagnosticaba una cosa por otra.
      if (!integridad.existenciaEsAfirmable) {
        const t = integridad.seriesTruncadas;
        return {
          estado: "sin-dato",
          queFalta: `No hay saldo inicial de existencias: ${t.length} de ${integridad.productosConMovimiento} producto(s) con movimiento arrancan su serie con una SALIDA${integridad.desde ? `, y el dataset sólo tiene movimientos desde ${integridad.desde}` : ""}. Para que saliera mercadería tenía que haber entrado antes, y esa entrada no está.`,
          consecuencia:
            "La suma de movimientos NO es la existencia: es la variación de la existencia dentro de la ventana importada. Sobre una serie recortada, un saldo negativo no prueba que el kardex no cuadre — es lo que cabe esperar. Llamarlo descuadre sería diagnosticar un problema de datos como un problema de bodega.",
          comoSeLlena:
            "Con un saldo inicial por producto a la fecha en que arranca la ventana (en Odoo, stock.quant a esa fecha o un ajuste de apertura), cargado como movimiento de apertura. Poner 0 NO sirve: afirmaría que la bodega arrancó vacía, que es falso.",
        };
      }
      const negativos = stock.filter((s) => s.existencia < 0);
      const procedencia = proc(
        "movimientosInventario → stockPorProducto(dataset) · existencia = Σ cantidad",
        "serie COMPLETA verificada: ningún producto arranca con salida, así que la suma de movimientos sí es la existencia",
        corte,
        "/inventario"
      );
      // La pregunta es de existencia y conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "productos con movimiento", valor: integridad.productosConMovimiento },
        { nombre: "productos con existencia negativa", valor: negativos.length },
        ...negativos.map((s) => ({ nombre: s.producto.sku, valor: s.existencia, unidad: "u" })),
      ];
      if (negativos.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${negativos.length} producto(s) con existencia NEGATIVA: ${negativos.map((s) => `${s.producto.sku} (${s.existencia})`).join(", ")}. El kardex no cuadra.`,
          evidencia: { expresion: "stockPorProducto() · existencia < 0", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ningún producto tiene existencia negativa: el kardex cuadra.",
        evidencia: { expresion: "stockPorProducto() · existencia < 0", entradas, procedencia },
      };
    },
  }),
  definirAgente<{
    corte: string;
    hay: boolean;
    integridad: IntegridadInventario | null;
    stock: FilaStock[];
  }>({
    id: "minimo",
    glifo: "📉",
    nombre: "Mínimo",
    pregunta: "¿Cuántos productos están bajo su stock mínimo?",
    base: "stockPorProducto() · existencia ≤ stock_minimo",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      return {
        corte,
        hay,
        integridad: hay ? integridadInventario(d) : null,
        stock: hay ? stockPorProducto(d) : [],
      };
    },
    redactar: ({ corte, hay, integridad, stock }) => {
      if (!hay || !integridad) return { estado: "sin-dato", ...SIN_CADENA_INVENTARIO };
      // Esta comparación necesita DOS datos, y los dos pueden faltar por
      // separado: un lado (la existencia) y el umbral contra el que se compara.
      if (!integridad.existenciaEsAfirmable || !integridad.minimoEsAfirmable) {
        const faltantes: string[] = [];
        if (!integridad.existenciaEsAfirmable) {
          faltantes.push(
            `el saldo inicial de existencias (${integridad.seriesTruncadas.length} de ${integridad.productosConMovimiento} producto(s) con movimiento arrancan su serie con una salida${integridad.desde ? `, con movimientos sólo desde ${integridad.desde}` : ""})`
          );
        }
        if (!integridad.minimoEsAfirmable) {
          faltantes.push(
            "el punto de reorden real (ningún producto declara un stock_minimo mayor que cero: scripts/importar-inventario-odoo.mjs escribe 0 para todo el catálogo, y un mínimo de 0 para todo no es una política de inventario, es una columna vacía). El 2026-08-24 el Frente 1 confirmó que NO existe ni un solo export de stock.warehouse.orderpoint en disco: es el único de los tres huecos que no se puede tapar con material ya guardado"
          );
        }
        return {
          estado: "sin-dato",
          queFalta: `Falta ${faltantes.join("; y falta ")}.`,
          consecuencia:
            "El conteo de productos bajo mínimo compara dos números que no se pueden afirmar. Con existencia = 0 por serie recortada y mínimo = 0 por columna vacía, la condición «existencia ≤ mínimo» se cumple sola y marcaría casi todo el catálogo como crítico. Ese número no mediría el inventario: mediría el hueco en los datos.",
          comoSeLlena:
            "El mínimo se pide a Odoo vivo con search_read sobre stock.warehouse.orderpoint (product_id, product_min_qty): no hay ningún export en disco que lo traiga. El saldo inicial necesita un movimiento de apertura por producto, y su fecha tiene que ser EL MISMO instante en que arranca la ventana de movimientos: el boletín del 2026-08-24 muestra dos cifras de Odoo para el mismo SKU (714 al 19-08, 658 al 23-08) y advierte que mezclar una fecha con la otra da un resultado plausible y equivocado.",
        };
      }
      const bajos = stock.filter((s) => s.bajoMinimo);
      const procedencia = proc(
        "movimientosInventario + productos → stockPorProducto(dataset) · existencia ≤ stock_minimo",
        `serie COMPLETA y mínimos declarados (${integridad.productosConMinimoPositivo} producto(s) con stock_minimo mayor que cero)`,
        corte,
        "/inventario"
      );
      // La pregunta empieza con "¿cuántos?": es un conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "productos con movimiento", valor: integridad.productosConMovimiento },
        { nombre: "productos bajo su mínimo", valor: bajos.length },
        ...bajos.map((s) => ({
          nombre: `${s.producto.sku} (mín. ${s.producto.stock_minimo})`,
          valor: s.existencia,
          unidad: "u",
        })),
      ];
      if (bajos.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${bajos.length} producto(s) bajo su mínimo: ${bajos.map((s) => s.producto.sku).join(", ")}.`,
          evidencia: { expresion: "stockPorProducto() · existencia ≤ stock_minimo", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ningún producto está bajo su stock mínimo.",
        evidencia: { expresion: "stockPorProducto() · existencia ≤ stock_minimo", entradas, procedencia },
      };
    },
  }),
  definirAgente<{
    corte: string;
    hay: boolean;
    conSalidas: { sku: string; id: string; salidas: number }[];
    totalSalidas: number;
  }>({
    id: "rotacion",
    glifo: "🔄",
    nombre: "Rotación",
    pregunta: "¿Qué producto tuvo más salidas (mayor rotación)?",
    base: "Σ|cantidad| de movimientos tipo salida, por producto · máximo",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      const conSalidas = (hay ? stockPorProducto(d) : [])
        .map((s) => ({
          sku: s.producto.sku,
          id: s.producto.id_producto,
          salidas: s.movimientos.filter((m) => m.tipo === "salida").reduce((acc, m) => acc + Math.abs(m.cantidad), 0),
        }))
        .sort((a, b) => b.salidas - a.salidas);
      return { corte, hay, conSalidas, totalSalidas: conSalidas.reduce((s, x) => s + x.salidas, 0) };
    },
    redactar: ({ corte, hay, conSalidas, totalSalidas }) => {
      if (!hay) return { estado: "sin-dato", ...SIN_CADENA_INVENTARIO };
      const mayor = conSalidas[0];
      const procedencia = proc(
        "movimientosInventario → movimientos tipo «salida», agrupados por producto",
        "sólo salidas dentro de la ventana importada. NO depende del saldo inicial: la rotación es un FLUJO, no un nivel — por eso este agente sigue midiendo donde Kardex y Mínimo no pueden",
        corte,
        "/inventario"
      );
      if (!mayor || mayor.salidas === 0) {
        return {
          estado: "sin-hallazgo",
          texto: "Ningún producto registra salidas.",
          evidencia: {
            expresion: "Σ|cantidad| de movimientos tipo salida, por producto · máximo",
            entradas: [
              { nombre: "productos evaluados", valor: conSalidas.length },
              { nombre: "unidades de salida en total", valor: 0, unidad: "u" },
            ],
            procedencia,
          },
        };
      }
      const entradas: EntradaEvidencia[] = [
        { nombre: "productos evaluados", valor: conSalidas.length },
        { nombre: "producto de mayor rotación", valor: mayor.sku },
        { nombre: "unidades de salida de ese producto", valor: mayor.salidas, unidad: "u" },
        { nombre: "unidades de salida en total", valor: totalSalidas, unidad: "u" },
      ];
      // Acá el ranking SÍ corresponde: hay un reparto real de un total real
      // (las unidades salidas se reparten entre productos y suman el total).
      const ranking: Ranking = {
        total: totalSalidas,
        unidad: "u",
        filas: conSalidas
          .filter((x) => x.salidas > 0)
          .slice(0, 10)
          .map((x) => ({
            id: x.id,
            etiqueta: x.sku,
            valor: x.salidas,
            pct: totalSalidas > 0 ? (x.salidas / totalSalidas) * 100 : 0,
          })),
      };
      return {
        estado: "hallazgo",
        texto: `${mayor.sku} es el de mayor rotación: ${mayor.salidas} unidad(es) de salida.`,
        evidencia: { expresion: "Σ|cantidad| de movimientos tipo salida, por producto · máximo", entradas, procedencia },
        ranking,
      };
    },
  }),
  definirAgente<{ corte: string; hay: boolean; salidas: number; huerfanas: string[] }>({
    id: "huerfano",
    glifo: "🕳",
    nombre: "Huérfano",
    pregunta: "¿Hay salidas de inventario sin venta de origen?",
    base: "movimientosInventario · tipo salida · id_venta ausente",
    medir: (d, corte) => {
      const hay = hayCadena(d);
      return {
        corte,
        hay,
        salidas: (d.movimientosInventario ?? []).filter((m) => m.tipo === "salida").length,
        huerfanas: hay ? salidasSinVenta(d).map((m) => m.id_movimiento) : [],
      };
    },
    redactar: ({ corte, hay, salidas, huerfanas }) => {
      if (!hay) return { estado: "sin-dato", ...SIN_CADENA_INVENTARIO };
      const procedencia = proc(
        "movimientosInventario → salidasSinVenta(dataset)",
        "sólo movimientos tipo «salida». NO depende del saldo inicial: es una auditoría de referencias, no de niveles",
        corte,
        "/inventario"
      );
      // La pregunta es de existencia y conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "salidas registradas", valor: salidas },
        { nombre: "salidas sin venta de origen", valor: huerfanas.length },
      ];
      if (huerfanas.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${huerfanas.length} salida(s) no declaran qué venta las produjo: ${huerfanas.join(", ")}.`,
          evidencia: { expresion: "movimientosInventario · tipo salida · id_venta ausente", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Toda salida de inventario declara la venta que la produjo.",
        evidencia: { expresion: "movimientosInventario · tipo salida · id_venta ausente", entradas, procedencia },
      };
    },
  }),
];

/** M4 — forecast: agentes sobre `forecastSimulado()`. Siempre declaran que es
 *  simulación, nunca dato real — el hallazgo describe el simulacro, no la caja. */
export const AGENTES_FORECAST: Agente[] = [
  definirAgente<{ corte: string; facturas: number; abiertas: number }>({
    id: "horizonte",
    glifo: "🕐",
    nombre: "Horizonte",
    pregunta: "¿Cuántas facturas abiertas entran en la simulación?",
    base: "facturas con estado abierta/disputada al corte",
    medir: (d, corte) => {
      void corte;
      const abiertas = d.facturas.filter((f) => {
        const e = estadoFacturaDerivado(f, d.pagos, d.notasCredito, d.disputas);
        return e === "abierta" || e === "disputada";
      });
      return { corte, facturas: d.facturas.length, abiertas: abiertas.length };
    },
    redactar: ({ corte, facturas, abiertas }) => {
      const procedencia = proc(
        "facturas → estadoFacturaDerivado(factura, pagos, notasCredito, disputas)",
        "sólo facturas cuyo estado derivado es «abierta» o «disputada». SIMULACIÓN: describe qué alimenta las curvas, no cuánto va a entrar en caja",
        corte,
        "/forecast"
      );
      // La pregunta empieza con "¿cuántas?": es un conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas en el dataset", valor: facturas },
        { nombre: "facturas abiertas o disputadas", valor: abiertas },
      ];
      if (abiertas === 0) {
        return {
          estado: "sin-hallazgo",
          texto: "No hay facturas abiertas: la simulación parte de cero.",
          evidencia: { expresion: "facturas con estado abierta/disputada al corte", entradas, procedencia },
        };
      }
      return {
        estado: "hallazgo",
        texto: `${abiertas} factura(s) abiertas o disputadas alimentan las tres curvas simuladas.`,
        evidencia: { expresion: "facturas con estado abierta/disputada al corte", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; puntos: PuntoForecast[] }>({
    id: "brecha",
    glifo: "📏",
    nombre: "Brecha",
    pregunta: "¿En qué semana la brecha optimista−pesimista es mayor?",
    base: "max(optimista − pesimista) sobre las 13 semanas simuladas",
    medir: (d, corte) => ({ moneda: monedaDe(d), corte, puntos: forecastSimulado(d, corte) }),
    redactar: ({ moneda, corte, puntos }) => {
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const conBrecha = puntos.map((p) => ({ semana: p.semana, brecha: p.optimista - p.pesimista }));
      const mayor = [...conBrecha].sort((a, b) => b.brecha - a.brecha)[0];
      const procedencia = proc(
        "facturas → forecastSimulado(dataset, corte) · optimista − pesimista por semana",
        "SIMULACIÓN de 13 semanas con supuestos del prototipo. La brecha mide la incertidumbre del simulacro, NO un rango de cobro comprometido",
        corte,
        "/forecast"
      );
      // Sin ranking: la pregunta pide UNA semana (el máximo). Las brechas
      // semanales no reparten un total: sumarlas no significaría nada.
      const entradas: EntradaEvidencia[] = [
        { nombre: "semanas simuladas", valor: puntos.length },
        ...(mayor
          ? [
              { nombre: "semana de mayor brecha", valor: mayor.semana },
              { nombre: "brecha en esa semana", valor: mayor.brecha, unidad: moneda },
            ]
          : []),
      ];
      if (!mayor || mayor.brecha <= 0) {
        return {
          estado: "sin-hallazgo",
          texto: "Las tres curvas simuladas casi no se separan: la incertidumbre es pareja.",
          evidencia: { expresion: "max(optimista − pesimista) sobre las 13 semanas simuladas", entradas, procedencia },
        };
      }
      return {
        estado: "hallazgo",
        texto: `La brecha simulada es mayor en la semana ${mayor.semana}: ${fmt(mayor.brecha)} entre optimista y pesimista.`,
        evidencia: { expresion: "max(optimista − pesimista) sobre las 13 semanas simuladas", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ moneda: Moneda; corte: string; hayFuente: boolean; cuantas: number; monto: number }>({
    id: "disputa-forecast",
    glifo: "🚫",
    nombre: "Disputa",
    pregunta: "¿Cuánto saldo disputado el escenario pesimista no cobra?",
    base: "Σ saldo de facturas con estado disputada — el pesimista las excluye del horizonte",
    medir: (d, corte) => {
      void corte;
      const disputadas = d.facturas.filter(
        (f) => estadoFacturaDerivado(f, d.pagos, d.notasCredito, d.disputas) === "disputada"
      );
      return {
        moneda: monedaDe(d),
        corte,
        hayFuente: hayFuenteDeDisputas(d),
        cuantas: disputadas.length,
        monto: disputadas.reduce((s, f) => s + f.monto_original, 0),
      };
    },
    redactar: ({ moneda, corte, hayFuente, cuantas, monto }) => {
      // Sin tabla de disputas ninguna factura puede derivar a "disputada": el
      // conteo daría 0 por construcción, y ese 0 no mide nada.
      if (!hayFuente) return { estado: "sin-dato", ...SIN_FUENTE_DISPUTAS };
      const fmt = (n: number) => fmtMoneda(n, moneda);
      const procedencia = proc(
        "facturas + disputas → estadoFacturaDerivado() === «disputada»",
        "SUPUESTO DE SIMULACIÓN: el escenario pesimista excluye del horizonte todo lo disputado. Es una regla del prototipo, no una política de cobranza validada",
        corte,
        "/forecast"
      );
      // La pregunta empieza con "¿cuánto?": es un monto agregado. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas disputadas", valor: cuantas },
        { nombre: "monto disputado excluido del pesimista", valor: monto, unidad: moneda },
      ];
      if (cuantas === 0) {
        return {
          estado: "sin-hallazgo",
          texto: "No hay facturas disputadas: el escenario pesimista no excluye nada por esa causa.",
          evidencia: { expresion: "Σ saldo de facturas con estado disputada — el pesimista las excluye del horizonte", entradas, procedencia },
        };
      }
      return {
        estado: "hallazgo",
        texto: `${fmt(monto)} en ${cuantas} factura(s) disputada(s) NO se cobran en el escenario pesimista dentro del horizonte (supuesto de simulación).`,
        evidencia: { expresion: "Σ saldo de facturas con estado disputada — el pesimista las excluye del horizonte", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; s4: PuntoForecast | undefined; s13: PuntoForecast | undefined }>({
    id: "meseta",
    glifo: "⏸",
    nombre: "Meseta",
    pregunta: "¿Cuánto del cobro de 13 semanas ya se simuló para la semana 4?",
    base: "punto de la semana 4 ÷ punto de la semana 13, escenario base",
    medir: (d, corte) => {
      const puntos = forecastSimulado(d, corte);
      return { corte, s4: puntos.find((p) => p.semana === 4), s13: puntos[puntos.length - 1] };
    },
    redactar: ({ corte, s4, s13 }) => {
      if (!s4 || !s13 || s13.base <= 0) {
        return {
          estado: "sin-dato",
          queFalta:
            "La curva base simulada no acumula nada al final del horizonte: no hay total de 13 semanas contra el cual medir qué proporción cae en la semana 4.",
          consecuencia:
            "No hay forma de decir si el cobro simulado se adelanta o se reparte. Un porcentaje sobre un denominador de cero no es un cero: no es ningún número.",
          comoSeLlena:
            "Con facturas abiertas al corte que alimenten la simulación. Si las hay en Odoo y acá no aparecen, revisar la importación y el corte usado.",
        };
      }
      const part = (s4.base / s13.base) * 100;
      const procedencia = proc(
        "facturas → forecastSimulado(dataset, corte) · escenario base, semana 4 contra semana 13",
        "SIMULACIÓN: describe la forma de la curva del simulacro, no un calendario de cobro comprometido",
        corte,
        "/forecast"
      );
      // Sin ranking: es UNA razón entre dos puntos de la misma curva.
      const entradas: EntradaEvidencia[] = [
        { nombre: "acumulado base a la semana 4", valor: s4.base },
        { nombre: "acumulado base a la semana 13", valor: s13.base },
        { nombre: "proporción", valor: part, unidad: "%" },
        { nombre: "umbral", valor: 50, unidad: "%" },
      ];
      if (part >= 50) {
        return {
          estado: "hallazgo",
          texto: `Para la semana 4 ya se simuló el ${Math.round(part)}% del cobro base de las 13 semanas: la curva se adelanta, no se reparte pareja.`,
          evidencia: { expresion: "punto de la semana 4 ÷ punto de la semana 13, escenario base", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: `Para la semana 4 sólo se simuló el ${Math.round(part)}% del cobro base: el grueso llega después, no al principio.`,
        evidencia: { expresion: "punto de la semana 4 ÷ punto de la semana 13, escenario base", entradas, procedencia },
      };
    },
  }),
];

/** M6 — carga y calidad de datos: agentes sobre el propio dataset, no sobre
 *  el negocio. Complementan (no repiten) las etapas de `argumentoDatos`.
 *
 *  Los cuatro comparten una regla: sobre un dataset SIN filas, "todo está
 *  bien" es cierto por vacío y engañoso como información — daría por auditada
 *  una carga que no ocurrió. Por eso caen a "sin-dato" en vez de felicitar. */
const SIN_FACTURAS_QUE_AUDITAR = {
  queFalta:
    "El dataset no tiene ni una factura: no hay filas que auditar al corte declarado.",
  consecuencia:
    "Un veredicto de calidad sobre cero filas es cierto por vacío y engañoso como información: se leería como «la carga está limpia» cuando lo que pasa es que no hay carga.",
  comoSeLlena:
    "Importando facturas con scripts/importar-facturas-odoo.mjs, o cargando el dataset real. Si el import corrió y aun así no hay filas, el problema está en el import, no en los datos de Odoo.",
} as const;

export const AGENTES_DATOS: Agente[] = [
  definirAgente<{ corte: string; facturas: number; sinFecha: number }>({
    id: "vencimiento-dato",
    glifo: "📅",
    nombre: "Vencimiento",
    pregunta: "¿Cuántas facturas no tienen fecha de vencimiento?",
    base: "facturas · fecha_vencimiento === null",
    medir: (d, corte) => ({
      corte,
      facturas: d.facturas.length,
      sinFecha: d.facturas.filter((f) => !f.fecha_vencimiento).length,
    }),
    redactar: ({ corte, facturas, sinFecha }) => {
      if (facturas === 0) return { estado: "sin-dato", ...SIN_FACTURAS_QUE_AUDITAR };
      const procedencia = proc(
        "facturas → campo fecha_vencimiento",
        "todas las facturas del dataset, sin filtrar por estado ni por corte: es una auditoría de la CARGA, no de la cartera",
        corte,
        "/datos"
      );
      // La pregunta empieza con "¿cuántas?": es un conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas en el dataset", valor: facturas },
        { nombre: "facturas sin fecha de vencimiento", valor: sinFecha },
        { nombre: "proporción", valor: Number(((sinFecha / facturas) * 100).toFixed(2)), unidad: "%" },
      ];
      if (sinFecha > 0) {
        return {
          estado: "hallazgo",
          texto: `${sinFecha} de ${facturas} factura(s) no tienen fecha de vencimiento: quedan fuera del aging y no se les inventa una.`,
          evidencia: { expresion: "facturas · fecha_vencimiento === null", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Toda factura tiene fecha de vencimiento.",
        evidencia: { expresion: "facturas · fecha_vencimiento === null", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; facturas: number; sinEmision: number }>({
    id: "emision-dato",
    glifo: "🗓",
    nombre: "Emisión",
    pregunta: "¿Alguna factura tiene fecha de emisión sin informar?",
    base: "facturas · fecha_emision === '1970-01-01' (centinela de importación sin mapear)",
    medir: (d, corte) => ({
      corte,
      facturas: d.facturas.length,
      sinEmision: d.facturas.filter((f) => f.fecha_emision === "1970-01-01").length,
    }),
    redactar: ({ corte, facturas, sinEmision }) => {
      if (facturas === 0) return { estado: "sin-dato", ...SIN_FACTURAS_QUE_AUDITAR };
      const procedencia = proc(
        "facturas → campo fecha_emision, comparado contra el centinela 1970-01-01",
        "todas las facturas del dataset. 1970-01-01 es el epoch: lo escribe la importación cuando la columna venía vacía o sin mapear, nunca es una fecha real",
        corte,
        "/datos"
      );
      // Pregunta de existencia y conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas en el dataset", valor: facturas },
        { nombre: "facturas con fecha de emisión centinela", valor: sinEmision },
        { nombre: "centinela", valor: "1970-01-01" },
      ];
      if (sinEmision > 0) {
        return {
          estado: "hallazgo",
          texto: `${sinEmision} factura(s) quedaron con fecha de emisión centinela (1970-01-01): la columna no se mapeó o venía vacía al importar.`,
          evidencia: { expresion: "facturas · fecha_emision === '1970-01-01' (centinela de importación sin mapear)", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Toda factura tiene una fecha de emisión distinta del centinela de importación.",
        evidencia: { expresion: "facturas · fecha_emision === '1970-01-01' (centinela de importación sin mapear)", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; facturas: number; repetidos: number; claves: number }>({
    id: "duplicado-dato",
    glifo: "⧉",
    nombre: "Duplicado",
    pregunta: "¿Hay números de factura repetidos para el mismo cliente?",
    base: "agrupado por (id_cliente, numero_factura) · cuenta > 1",
    medir: (d, corte) => {
      const claves = new Map<string, number>();
      for (const f of d.facturas) {
        const k = `${f.id_cliente}|${f.numero_factura}`;
        claves.set(k, (claves.get(k) ?? 0) + 1);
      }
      return {
        corte,
        facturas: d.facturas.length,
        claves: claves.size,
        repetidos: [...claves.values()].filter((n) => n > 1).length,
      };
    },
    redactar: ({ corte, facturas, repetidos, claves }) => {
      if (facturas === 0) return { estado: "sin-dato", ...SIN_FACTURAS_QUE_AUDITAR };
      const procedencia = proc(
        "facturas → agrupadas por la clave (id_cliente, numero_factura)",
        "todas las facturas del dataset. Un mismo número para DISTINTOS clientes no cuenta: la numeración sólo tiene que ser única dentro de cada cliente",
        corte,
        "/datos"
      );
      // Pregunta de existencia y conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "facturas en el dataset", valor: facturas },
        { nombre: "claves (cliente + número) distintas", valor: claves },
        { nombre: "claves repetidas", valor: repetidos },
      ];
      if (repetidos > 0) {
        return {
          estado: "hallazgo",
          texto: `${repetidos} número(s) de factura están repetidos para el mismo cliente. Posible duplicado de carga.`,
          evidencia: { expresion: "agrupado por (id_cliente, numero_factura) · cuenta > 1", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Ningún número de factura se repite para el mismo cliente.",
        evidencia: { expresion: "agrupado por (id_cliente, numero_factura) · cuenta > 1", entradas, procedencia },
      };
    },
  }),
  definirAgente<{ corte: string; clientes: number; sinFactura: string[] }>({
    id: "catalogo-dato",
    glifo: "👤",
    nombre: "Catálogo",
    pregunta: "¿Hay clientes en el catálogo sin ninguna factura?",
    base: "clientes cuyo id_cliente no aparece en ninguna factura",
    medir: (d, corte) => ({
      corte,
      clientes: d.clientes.length,
      sinFactura: d.clientes
        .filter((c) => !d.facturas.some((f) => f.id_cliente === c.id_cliente))
        .map((c) => c.nombre_cliente),
    }),
    redactar: ({ corte, clientes, sinFactura }) => {
      // Acá el vacío que importa es el del CATÁLOGO, no el de las facturas: sin
      // clientes no hay a quién buscarle facturas.
      if (clientes === 0) {
        return {
          estado: "sin-dato",
          queFalta: "El catálogo de clientes está vacío: no hay a quién buscarle facturas.",
          consecuencia:
            "Afirmar que todo cliente tiene al menos una factura, sobre cero clientes, es cierto por vacío y engañoso como información: daría por auditado un catálogo que no se cargó.",
          comoSeLlena:
            "Importando el catálogo de clientes (res.partner) desde Odoo, o cargando el dataset real.",
        };
      }
      const procedencia = proc(
        "clientes → id_cliente, cruzado contra facturas",
        "todo el catálogo. Un cliente sin facturas no es necesariamente un error: puede ser un alta reciente o un prospecto. Se declara, no se acusa",
        corte,
        "/datos"
      );
      // Pregunta de existencia y conteo. Sin ranking.
      const entradas: EntradaEvidencia[] = [
        { nombre: "clientes en el catálogo", valor: clientes },
        { nombre: "clientes sin ninguna factura", valor: sinFactura.length },
      ];
      if (sinFactura.length > 0) {
        return {
          estado: "hallazgo",
          texto: `${sinFactura.length} cliente(s) del catálogo no tienen ninguna factura: ${sinFactura.join(", ")}.`,
          evidencia: { expresion: "clientes cuyo id_cliente no aparece en ninguna factura", entradas, procedencia },
        };
      }
      return {
        estado: "sin-hallazgo",
        texto: "Todo cliente del catálogo tiene al menos una factura.",
        evidencia: { expresion: "clientes cuyo id_cliente no aparece en ninguna factura", entradas, procedencia },
      };
    },
  }),
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

/** El vocabulario visual de los TRES estados, en un solo lugar, para que la
 *  ficha y la ventana no puedan discrepar entre sí.
 *
 *  "sin dato" es azul frío y lleva "?": tenía que verse distinto de los otros
 *  dos y no parecerse a una alarma, porque no es un error del sistema — es una
 *  ausencia del dato. Un gris más lo habría vuelto a confundir con
 *  "sin hallazgo", que es justamente lo que se está separando. */
const PINTA: Record<
  Hallazgo["estado"],
  { anillo: string; insignia: string; glifo: string; etiqueta: string; fondoPastilla: string; textoPastilla: string }
> = {
  hallazgo: {
    anillo: "#c2703a",
    insignia: "#c2703a",
    glifo: "!",
    etiqueta: "hallazgo",
    fondoPastilla: "rgba(194,112,58,.12)",
    textoPastilla: "#a4551f",
  },
  "sin-hallazgo": {
    anillo: "#c6cad2",
    insignia: "#a8adb6",
    glifo: "·",
    etiqueta: "sin hallazgo",
    fondoPastilla: "rgba(22,24,29,.06)",
    textoPastilla: "#6b6f78",
  },
  "sin-dato": {
    anillo: "#5b7a99",
    insignia: "#5b7a99",
    glifo: "?",
    etiqueta: "sin dato",
    fondoPastilla: "rgba(91,122,153,.14)",
    textoPastilla: "#3f5a75",
  },
};

// `contarHallazgos()` vivía acá y se borró (2026-08-24). Devolvía los tres
// conteos (con / sinHallazgo / sinDato) para un pie de panel que decía "2 de 4".
// Ese pie no existe en ninguna pantalla: un grep sobre app/, components/, lib/
// y scripts/ no encontró ni un consumidor fuera de su propia prueba, que se
// borró con ella. Una función exportada que sólo usa su test no está probada:
// está sostenida por su test. Si mañana un panel necesita ese pie, son cinco
// líneas y vuelve — con un consumidor de verdad.

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
  // Ya no hay borde que normalizar: los 28 agentes devuelven el tipo de tres
  // estados directamente (ver el acta del adaptador, arriba del todo).
  const vistos = agentes.map((a) => ({
    agente: a,
    hallazgo: a.mirar(dataset, fechaCorte),
  }));

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
                  // El anillo dice en cuál de los TRES estados quedó ESE agente.
                  boxShadow: `0 0 0 2px #ffffff, 0 0 0 ${activo ? 4 : 3.5}px ${
                    PINTA[hallazgo.estado].anillo
                  }, 0 ${activo ? 10 : 4}px ${activo ? 20 : 10}px -8px rgba(22,24,29,.35)`,
                  transform: activo ? "translateY(-2px)" : undefined,
                  zIndex: activo ? 20 : undefined,
                }}
              >
                <span aria-hidden>{agente.glifo}</span>
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 grid h-[15px] w-[15px] place-items-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: PINTA[hallazgo.estado].insignia, boxShadow: "0 0 0 1.5px #fff" }}
                >
                  {PINTA[hallazgo.estado].glifo}
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
            style={{
              background: PINTA[hallazgo.estado].fondoPastilla,
              color: PINTA[hallazgo.estado].textoPastilla,
            }}
          >
            {PINTA[hallazgo.estado].etiqueta}
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

        <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
          {hallazgo.estado === "sin-dato" ? (
            <BloqueSinDato hallazgo={hallazgo} base={agente.base} />
          ) : (
            <>
              <p className="text-[13.5px] leading-relaxed text-tinta">{hallazgo.texto}</p>

              {/* La base a la vista: quien discuta el resultado, discute esta línea
                  y no el color de la ficha. Ahora además con los VALORES que
                  entraron, que antes se calculaban y se tiraban. */}
              <BloqueFormula evidencia={hallazgo.evidencia} />

              {"ranking" in hallazgo && hallazgo.ranking ? (
                <TablaRanking ranking={hallazgo.ranking} />
              ) : null}

              <BloqueProcedencia procedencia={hallazgo.evidencia.procedencia} />
            </>
          )}

          <p className="mt-3 text-[10.5px] leading-relaxed text-[#a0a2a6]">
            {hallazgo.estado === "hallazgo"
              ? "Derivado del dataset al corte"
              : hallazgo.estado === "sin-hallazgo"
              ? "Sin hallazgo — y vale igual: el agente miró y no encontró"
              : "Sin dato — el agente NO pudo mirar. Esto NO es evidencia de que no haya nada"}
            {" · "}corte {fechaCorte} · umbrales 🟡 pendientes de validación por Finanzas
            <br />
            Arrastrá desde el encabezado para moverla · Esc o clic fuera para cerrar
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Las piezas del drill-down ─────────────────────────────────────────────
//
// No son un componente nuevo ni una ventana nueva: son el interior de la
// ventana que ya existía. El fondo, el arrastre y el velo no se tocan.

/** Un valor con su unidad. El dinero se formatea como dinero; lo demás, no. */
function valorConUnidad(valor: number | string, unidad?: string): string {
  if (typeof valor === "string") return unidad ? `${valor} ${unidad}` : valor;
  if (unidad === "GTQ" || unidad === "USD") return fmtMoneda(valor, unidad);
  const n = Number.isInteger(valor) ? valor.toLocaleString("es-GT") : valor.toLocaleString("es-GT", { maximumFractionDigits: 2 });
  return unidad ? `${n} ${unidad}` : n;
}

/** La fórmula CON sus entradas. Antes sólo se mostraba la expresión: los
 *  números que entraban en ella se calculaban y se descartaban, así que quien
 *  quería auditar el resultado tenía que abrir el código. */
function BloqueFormula({ evidencia }: { evidencia: Evidencia }) {
  return (
    <div className="mt-3.5">
      <p className="inline-block rounded-[9px] bg-[rgba(22,24,29,.04)] px-2.5 py-1.5 font-mono text-[10.5px] text-[#7c808a]">
        {evidencia.expresion}
      </p>
      {evidencia.entradas.length === 0 ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-[#a0a2a6]">
          Entradas no declaradas todavía: este agente aún no separa medición de
          redacción. No se inventan — se declara que faltan.
        </p>
      ) : (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          {evidencia.entradas.map((e) => (
            <div key={e.nombre} className="contents">
              <dt className="text-[11px] text-[#7c808a]">{e.nombre}</dt>
              <dd className="text-right font-mono text-[11px] tabular-nums text-tinta">
                {valorConUnidad(e.valor, e.unidad)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** El ranking. Sólo aparece cuando el agente lo tiene: una pregunta de conteo
 *  ("¿hay facturas sin cliente?") no admite un top N, y fabricarle uno sería
 *  inventar un orden donde no lo hay. */
function TablaRanking({ ranking }: { ranking: Ranking }) {
  if (ranking.filas.length === 0) return null;
  return (
    <div className="mt-3.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8f98]">
        Las {ranking.filas.length} mayores · sobre {valorConUnidad(ranking.total, ranking.unidad)}
      </p>
      <ul className="mt-1.5 space-y-1">
        {ranking.filas.map((f) => (
          <li key={f.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <span className="truncate text-[11.5px] text-tinta" title={f.etiqueta}>
              {f.etiqueta}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[#6b6f78]">
              {valorConUnidad(f.valor, ranking.unidad)}
            </span>
            <span className="w-[46px] text-right font-mono text-[11px] tabular-nums text-[#8b8f98]">
              {f.pct.toFixed(1)}%
            </span>
            <span className="col-span-3 h-[3px] rounded-full bg-[rgba(22,24,29,.06)]">
              <span
                className="block h-full rounded-full bg-[#c2703a]"
                style={{ width: `${Math.max(0, Math.min(100, f.pct))}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** De dónde vino el número. Sin esto, la fórmula flota. */
function BloqueProcedencia({ procedencia }: { procedencia: Procedencia }) {
  return (
    <div className="mt-3.5 rounded-[9px] border border-[rgba(22,24,29,.07)] px-2.5 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8f98]">Procedencia</p>
      <dl className="mt-1 space-y-0.5 text-[11px] leading-relaxed">
        <div className="flex gap-2">
          <dt className="shrink-0 text-[#a0a2a6]">origen</dt>
          <dd className="text-[#6b6f78]">{procedencia.modelo}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-[#a0a2a6]">filtro</dt>
          <dd className="text-[#6b6f78]">{procedencia.filtro}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-[#a0a2a6]">corte</dt>
          <dd className="font-mono text-[#6b6f78]">{procedencia.corte}</dd>
        </div>
        {procedencia.enlace ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-[#a0a2a6]">ver</dt>
            <dd>
              <a className="text-[#a4551f] underline" href={procedencia.enlace}>
                {procedencia.enlace}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** El tercer estado. No dice qué encontró: dice qué NO pudo mirar, qué se
 *  pierde por eso, y cómo se llena. Los tres son obligatorios en el tipo
 *  justamente para que esta pantalla nunca pueda quedar a medias. */
function BloqueSinDato({
  hallazgo,
  base,
}: {
  hallazgo: Extract<Hallazgo, { estado: "sin-dato" }>;
  base: string;
}) {
  const filas: { rotulo: string; texto: string }[] = [
    { rotulo: "Qué falta", texto: hallazgo.queFalta },
    { rotulo: "Qué se pierde", texto: hallazgo.consecuencia },
    { rotulo: "Cómo se llena", texto: hallazgo.comoSeLlena },
  ];
  return (
    <div>
      <p className="text-[13.5px] leading-relaxed text-tinta">
        El agente <b>no pudo mirar</b>. Esto no es un &quot;no hay nada&quot;: es que la
        pregunta no se pudo responder con el dato disponible.
      </p>
      <div className="mt-3 space-y-2.5">
        {filas.map((f) => (
          <div key={f.rotulo}>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#3f5a75]">{f.rotulo}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#6b6f78]">{f.texto}</p>
          </div>
        ))}
      </div>
      <p className="mt-3.5 inline-block rounded-[9px] bg-[rgba(22,24,29,.04)] px-2.5 py-1.5 font-mono text-[10.5px] text-[#7c808a]">
        {base}
      </p>
    </div>
  );
}
