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
  "Techos de normalización: $5,000 y 120 días — arbitrarios de esta demo.",
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

const TECHO_SALDO = 5000;
const TECHO_DIAS = 120;

function accionPorRegla(diasMax: number, enDisputa: boolean): string {
  // Cascada conceptual del Paso 3 (M5): disputa → resolver; luego severidad por días.
  // Umbrales FICTICIOS de demo, pendientes de proceso real de cobranza.
  if (enDisputa) return "resolver disputa";
  if (diasMax > 90) return "evaluar escalamiento (umbral ficticio)";
  if (diasMax > 30) return "llamar al cliente";
  if (diasMax > 0) return "enviar recordatorio";
  return "sin acción — al día";
}

export function prioridadSimulada(dataset: Dataset, fechaCorte: string): FilaPrioridad[] {
  const filas: FilaPrioridad[] = [];
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

    const nSaldo = Math.min(saldoTotal / TECHO_SALDO, 1);
    const nDias = Math.min(Math.max(diasMax, 0) / TECHO_DIAS, 1);
    let score = Math.round((nSaldo * 0.5 + nDias * 0.5) * 100);
    // Despriorización estructural de cuentas en disputa (concepto del Paso 3).
    if (enDisputa) score = Math.round(score * 0.5);

    filas.push({
      idCliente: cliente.id_cliente,
      nombreCliente: cliente.nombre_cliente,
      saldoTotal: Math.round(saldoTotal * 100) / 100,
      diasMaxAtraso: Math.max(diasMax, 0),
      enDisputa,
      scoreSimulado: score,
      accionSugerida: accionPorRegla(diasMax, enDisputa),
    });
  }
  return filas.sort((a, b) => b.scoreSimulado - a.scoreSimulado);
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
