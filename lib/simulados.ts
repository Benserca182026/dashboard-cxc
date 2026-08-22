// ============================================================================
// MÓDULO DE CÁLCULOS SIMULADOS — NADA DE ESTE ARCHIVO ESTÁ VALIDADO
// ============================================================================
// DSO, CEI, scoring de prioridad y forecast son SIMULACIONES con supuestos
// ficticios elegidos solo para demostrar la mecánica visual del prototipo
// (Decisión B del usuario, Paso 3/4). Ninguna cifra producida aquí debe
// tratarse como resultado financiero real ni presentarse como aprobada por
// Finanzas. Los pesos y desplazamientos son propios de esta demo — NO son los
// de la referencia AR Cockpit ni de ningún sistema real.
// ============================================================================

import type { Dataset, Disputa, Factura } from "./types";
import {
  diasAtraso,
  disputaActiva,
  estadoFacturaDerivado,
  saldoPendiente,
} from "./calculos";

// ---------------------------------------------------------------------------
// DSO simulado
// ---------------------------------------------------------------------------

export const SUPUESTOS_DSO = [
  "Fórmula de referencia del plan maestro (Fase 3): DSO = CxC promedio / ventas a crédito del período × días del período — PENDIENTE de definición final con Finanzas.",
  "«Ventas a crédito del período» NO existe como dato en este prototipo: se usa una cifra ficticia de $12,000 USD/90 días solo para que el indicador renderice.",
  "«CxC promedio» se aproxima con el saldo pendiente actual (no hay serie histórica real).",
];

const VENTAS_CREDITO_FICTICIAS = 12000;
const DIAS_PERIODO_FICTICIO = 90;

export function dsoSimulado(saldoTotal: number): number {
  return Math.round((saldoTotal / VENTAS_CREDITO_FICTICIAS) * DIAS_PERIODO_FICTICIO);
}

// ---------------------------------------------------------------------------
// CEI simulado
// ---------------------------------------------------------------------------

export const SUPUESTOS_CEI = [
  "CEI requiere saldo inicial, ventas a crédito, saldo final y cartera corriente según política de la empresa (plan maestro, Fase 3) — ninguno de esos datos existe aquí.",
  "Se usan valores ficticios: saldo inicial $9,000, ventas a crédito $12,000, para que el indicador renderice.",
  "El resultado NO mide efectividad de cobranza real de nadie.",
];

export function ceiSimulado(saldoFinalTotal: number, carteraCorriente: number): number {
  const saldoInicialFicticio = 9000;
  const ventasFicticias = 12000;
  const numerador = saldoInicialFicticio + ventasFicticias - saldoFinalTotal;
  const denominador = saldoInicialFicticio + ventasFicticias - carteraCorriente;
  if (denominador === 0) return 0;
  return Math.round((numerador / denominador) * 100);
}

// ---------------------------------------------------------------------------
// Scoring de prioridad simulado (M3)
// ---------------------------------------------------------------------------

export const SUPUESTOS_SCORING = [
  "El score combina saldo normalizado y días de atraso normalizados con pesos 50/50 — pesos FICTICIOS de demostración, sin ninguna base de negocio.",
  "No existe señal de riesgo de crédito real (historial, buró, límite de crédito) en este prototipo — el plan maestro exige definirla con Finanzas antes de usar un score en serio.",
  "Las cuentas en disputa se retiran del flujo de cobro y se marcan «resolver disputa» (regla estructural del Paso 3/4 — esta parte sí es regla de diseño, no simulación).",
  "Techos de normalización: NO son constantes — se recalculan sobre el dataset cargado como el percentil 95 observado del saldo por cliente y de los días de atraso máximo. Sobre los datos reales de Benserca 18 (111 cuentas, corte 2026-08-20) dan Q39,637.50 y 1,164 días; sobre el demo-ficticio dan otros. El techo describe la distribución que tiene enfrente, no una cifra heredada.",
];

export interface FilaPrioridad {
  idCliente: string;
  nombreCliente: string;
  saldoTotal: number;
  diasMaxAtraso: number;
  enDisputa: boolean;
  /** 0-100, SIMULADO. */
  scoreSimulado: number;
  accionSugerida: string;
}

// Techos MÍNIMOS de emergencia. Sólo se usan si el p95 observado no sirve como
// divisor (dataset vacío, una sola fila, o p95 = 0 porque la dimensión es toda
// ceros). No son "los techos": son el piso que evita una división por cero.
const TECHO_SALDO_MINIMO = 1;
const TECHO_DIAS_MINIMO = 1;

/**
 * Percentil 95 por RANGO MÁS CERCANO (nearest-rank): el valor de la posición
 * ceil(0.95·n) del arreglo ordenado. Sin interpolación, así el techo es siempre
 * un valor REALMENTE observado en el dataset y no un punto inventado entre dos.
 */
function percentil95(valores: number[]): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.ceil(0.95 * orden.length) - 1);
  return orden[i];
}

function accionPorRegla(diasMax: number, enDisputa: boolean): string {
  // Cascada conceptual del Paso 3 (M5): disputa → resolver; luego severidad por días.
  // Umbrales FICTICIOS de demo, pendientes de proceso real de cobranza.
  if (enDisputa) return "resolver disputa";
  if (diasMax > 90) return "evaluar escalamiento (umbral ficticio)";
  if (diasMax > 30) return "llamar al cliente";
  if (diasMax > 0) return "enviar recordatorio";
  return "sin acción — al día";
}

/**
 * Worklist de prioridad SIMULADA.
 *
 * Se arma en DOS PASADAS, y el orden importa:
 *   1ª — se construyen todas las filas con su saldo y sus días de atraso máximo.
 *   2ª — recién con la distribución completa a la vista se calcula el percentil
 *        95 de cada dimensión, y ése es el techo de normalización.
 *
 * Por qué así: los techos anteriores ($5,000 y 120 días) estaban calibrados
 * sobre un dataset ficticio EN DÓLARES. Aplicados a los quetzales reales,
 * saturaban a 55 de 111 cuentas en el techo de saldo y a 51 de 111 en el de
 * días, y dejaban 23 cuentas empatadas en score 100 — un score que no ordena
 * nada. Un techo derivado del propio dataset se adapta solo, sea demo o real.
 */
export function prioridadSimulada(dataset: Dataset, fechaCorte: string): FilaPrioridad[] {
  // ── 1ª pasada: los hechos por cliente, todavía sin score. ──
  const crudas: Omit<FilaPrioridad, "scoreSimulado">[] = [];
  for (const cliente of dataset.clientes) {
    const facturasCliente = dataset.facturas.filter(
      (f) => f.id_cliente === cliente.id_cliente
    );
    let saldoTotal = 0;
    let diasMax = 0;
    let enDisputa = false;
    for (const f of facturasCliente) {
      const estado = estadoFacturaDerivado(f, dataset.pagos, dataset.notasCredito, dataset.disputas);
      if (estado === "pagada" || estado === "anulada") continue;
      const saldo = saldoPendiente(f, dataset.pagos, dataset.notasCredito);
      saldoTotal += saldo;
      if (estado === "disputada") enDisputa = true;
      if (f.fecha_vencimiento) {
        const dias = diasAtraso(fechaCorte, f.fecha_vencimiento);
        if (dias > diasMax) diasMax = dias;
      }
    }
    if (saldoTotal <= 0) continue;

    crudas.push({
      idCliente: cliente.id_cliente,
      nombreCliente: cliente.nombre_cliente,
      saldoTotal: Math.round(saldoTotal * 100) / 100,
      diasMaxAtraso: Math.max(diasMax, 0),
      enDisputa,
      accionSugerida: accionPorRegla(diasMax, enDisputa),
    });
  }

  // ── Techos: percentil 95 OBSERVADO, no constante heredada. ──
  // Con 0 o 1 fila, o si el p95 sale 0 (dimensión toda en ceros), el p95 no
  // sirve de divisor: se cae al mínimo de emergencia para no dividir por cero.
  const techoSaldo = Math.max(percentil95(crudas.map((f) => f.saldoTotal)), TECHO_SALDO_MINIMO);
  const techoDias = Math.max(percentil95(crudas.map((f) => f.diasMaxAtraso)), TECHO_DIAS_MINIMO);

  // ── 2ª pasada: ahora sí, el score. ──
  const filas: FilaPrioridad[] = crudas.map((f) => {
    const nSaldo = Math.min(f.saldoTotal / techoSaldo, 1);
    const nDias = Math.min(Math.max(f.diasMaxAtraso, 0) / techoDias, 1);
    let score = Math.round((nSaldo * 0.5 + nDias * 0.5) * 100);
    // Despriorización estructural de cuentas en disputa (concepto del Paso 3).
    if (f.enDisputa) score = Math.round(score * 0.5);
    return { ...f, scoreSimulado: score };
  });

  // ── Orden con DESEMPATE EXPLÍCITO. ──
  // Antes el sort era sólo por score, y con 23 cuentas empatadas en 100 el
  // "líder" que mostraba la página era el primero de esos 23 según el orden
  // accidental de la tabla de clientes — no un líder, un accidente.
  // A igual score decide el MAYOR SALDO; a igual saldo, MÁS DÍAS; y como
  // último recurso el idCliente, para que el orden sea determinista siempre.
  return filas.sort(
    (a, b) =>
      b.scoreSimulado - a.scoreSimulado ||
      b.saldoTotal - a.saldoTotal ||
      b.diasMaxAtraso - a.diasMaxAtraso ||
      a.idCliente.localeCompare(b.idCliente)
  );
}

// ---------------------------------------------------------------------------
// Forecast simulado (M4 — Decisión B: SOLO simulación)
// ---------------------------------------------------------------------------

export const SUPUESTOS_FORECAST = [
  "No existe histórico de cobro real: los desplazamientos de cobro por escenario son INVENTADOS para esta demo.",
  "Escenario base: cada factura abierta se cobra 30 días después de su vencimiento (o de la fecha de corte si ya venció). Optimista: 10 días. Pesimista: 60 días, y las disputadas no se cobran dentro del horizonte.",
  "Horizonte fijo de 13 semanas (91 días) desde la fecha de corte.",
  "Ningún punto de estas curvas es una proyección real de caja — es una ilustración mecánica del patrón visual de 3 bandas (optimista/base/pesimista).",
];

export interface PuntoForecast {
  semana: number;
  optimista: number;
  base: number;
  pesimista: number;
}

const HORIZONTE_SEMANAS = 13;

function diasHastaCobroSimulado(
  factura: Factura,
  fechaCorte: string,
  desplazamiento: number
): number {
  if (!factura.fecha_vencimiento) return Infinity;
  const atraso = diasAtraso(fechaCorte, factura.fecha_vencimiento);
  if (atraso >= 0) return desplazamiento; // ya vencida: se "cobra" a N días de la fecha de corte
  return -atraso + desplazamiento; // por vencer: N días después de su vencimiento
}

export function forecastSimulado(dataset: Dataset, fechaCorte: string): PuntoForecast[] {
  const abiertas = dataset.facturas.filter((f) => {
    const estado = estadoFacturaDerivado(f, dataset.pagos, dataset.notasCredito, dataset.disputas);
    return estado === "abierta" || estado === "disputada";
  });

  const escenarios = { optimista: 10, base: 30, pesimista: 60 } as const;
  const puntos: PuntoForecast[] = [];

  for (let semana = 1; semana <= HORIZONTE_SEMANAS; semana++) {
    const diasHorizonte = semana * 7;
    const acumulado = { optimista: 0, base: 0, pesimista: 0 };

    for (const f of abiertas) {
      const saldo = saldoPendiente(f, dataset.pagos, dataset.notasCredito);
      const estado = estadoFacturaDerivado(f, dataset.pagos, dataset.notasCredito, dataset.disputas);
      (Object.keys(escenarios) as (keyof typeof escenarios)[]).forEach((esc) => {
        // Pesimista: las disputadas no se cobran dentro del horizonte (supuesto ficticio).
        if (esc === "pesimista" && estado === "disputada") return;
        const dias = diasHastaCobroSimulado(f, fechaCorte, escenarios[esc]);
        if (dias <= diasHorizonte) acumulado[esc] += saldo;
      });
    }

    puntos.push({
      semana,
      optimista: Math.round(acumulado.optimista),
      base: Math.round(acumulado.base),
      pesimista: Math.round(acumulado.pesimista),
    });
  }
  return puntos;
}
