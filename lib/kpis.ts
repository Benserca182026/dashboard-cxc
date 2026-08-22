// KPIs de gestión de cobranza — Paso 7 del plan maestro.
//
// Archivo NUEVO a propósito: lib/calculos.ts contiene la lógica ya verificada
// contra los totales de control de los Pasos 5 y 6, y no se toca. Esta capa
// deriva encima de ella y se prueba con scripts/test-kpis.ts.
//
// ⚠️ Las cuatro fórmulas son PROPUESTA PENDIENTE DE VALIDACIÓN POR FINANZAS,
// igual que el aging: este código las implementa para el prototipo, no las
// convierte en aprobadas. Cada función declara su supuesto en el comentario.
//
// Regla de trazabilidad (transversal al proyecto): ningún KPI sin camino de
// vuelta al hecho. Cada función devuelve, junto al número, el DESGLOSE de las
// facturas o pagos que lo componen, para que la UI pueda abrirlo.

import { calcularAging, nombreDeCliente, pagosAplicados, saldoPendiente, type FacturaClasificada } from "./calculos";
import type { Dataset } from "./types";

const MS_POR_DIA = 86_400_000;
const redondear2 = (n: number) => Math.round(n * 100) / 100;
const restarDias = (fechaISO: string, dias: number) =>
  new Date(Date.parse(fechaISO + "T00:00:00Z") - dias * MS_POR_DIA)
    .toISOString()
    .slice(0, 10);

// ── 1 · DSO — días de venta en calle ────────────────────────────────────────

export interface ResultadoDso {
  /** null cuando no hubo facturación en la ventana (división imposible: se reporta, no se inventa). */
  dso: number | null;
  ventanaDias: number;
  desde: string;
  hasta: string;
  carteraPendiente: number;
  facturadoVentana: number;
  /** Desglose: las facturas emitidas dentro de la ventana, con su monto. */
  facturasVentana: { id_factura: string; numero: string; fecha_emision: string; monto: number }[];
}

/**
 * DSO (método simple): cartera pendiente ÷ facturado en la ventana × días de la ventana.
 * SUPUESTO (pendiente Finanzas): ventana de 90 días hacia atrás desde el corte,
 * facturación por fecha de emisión, anuladas excluidas. Un DSO mayor que la
 * ventana señala cartera vieja respecto de la facturación reciente — se muestra,
 * no se recorta.
 */
export function calcularDso(dataset: Dataset, fechaCorte: string, ventanaDias = 90): ResultadoDso {
  const desde = restarDias(fechaCorte, ventanaDias);
  const aging = calcularAging(dataset, fechaCorte);
  const carteraPendiente = redondear2(aging.totalClasificado + aging.saldoNoClasificable);

  const facturasVentana = dataset.facturas
    .filter(
      (f) =>
        f.estado_factura !== "anulada" &&
        f.fecha_emision > desde &&
        f.fecha_emision <= fechaCorte
    )
    .map((f) => ({
      id_factura: f.id_factura,
      numero: f.numero_factura,
      fecha_emision: f.fecha_emision,
      monto: f.monto_original,
    }));

  const facturadoVentana = redondear2(facturasVentana.reduce((s, f) => s + f.monto, 0));
  const dso =
    facturadoVentana > 0
      ? redondear2((carteraPendiente / facturadoVentana) * ventanaDias)
      : null;

  return { dso, ventanaDias, desde, hasta: fechaCorte, carteraPendiente, facturadoVentana, facturasVentana };
}

// ── 2 · Antigüedad promedio ponderada por monto ─────────────────────────────

export interface ResultadoAntiguedad {
  /** null cuando no hay facturas clasificadas. */
  ponderada: number | null;
  /** Promedio simple, mostrado JUNTO a la ponderada para hacer visible el sesgo que corrige. */
  simple: number | null;
  totalPonderado: number;
  saldoTotal: number;
  /** Desglose: cada factura clasificada con su saldo, sus días y su aporte saldo×días. */
  filas: { id_factura: string; numero: string; saldo: number; dias: number; diasComputados: number; aporte: number }[];
}

/**
 * Antigüedad ponderada = Σ(saldo × días de atraso) ÷ Σ(saldo), sobre las
 * facturas CLASIFICADAS del aging (mismas exclusiones que el Paso 6).
 * SUPUESTO (pendiente Finanzas): las no vencidas computan 0 días — miden
 * atraso, no plazo restante; un valor negativo "rejuvenecería" la cartera.
 * Por qué ponderada: veinte facturas chicas vencidas pesan menos que una
 * grande, y el promedio simple dice lo contrario.
 */
export function antiguedadPonderada(dataset: Dataset, fechaCorte: string): ResultadoAntiguedad {
  const aging = calcularAging(dataset, fechaCorte);
  const filas = aging.clasificadas.map((c: FacturaClasificada) => {
    const diasComputados = Math.max(0, c.dias);
    return {
      id_factura: c.factura.id_factura,
      numero: c.factura.numero_factura,
      saldo: c.saldo,
      dias: c.dias,
      diasComputados,
      aporte: redondear2(c.saldo * diasComputados),
    };
  });

  const saldoTotal = redondear2(filas.reduce((s, x) => s + x.saldo, 0));
  const totalPonderado = redondear2(filas.reduce((s, x) => s + x.aporte, 0));
  const ponderada = saldoTotal > 0 ? redondear2(totalPonderado / saldoTotal) : null;
  const simple =
    filas.length > 0
      ? redondear2(filas.reduce((s, x) => s + x.diasComputados, 0) / filas.length)
      : null;

  return { ponderada, simple, totalPonderado, saldoTotal, filas };
}

// ── 3 · Efectividad de cobro ────────────────────────────────────────────────

export interface ResultadoEfectividad {
  /** null cuando nada vencía en la ventana (0/0 se reporta, no se disfraza de 0% ni de 100%). */
  efectividadPct: number | null;
  /**
   * Efectividad por cohorte: sólo cuenta, por cada factura que vencía en la
   * ventana, lo que ESA factura cobró (sin importar cuándo se pagó), topado a
   * su propio monto. A diferencia de efectividadPct — que compara dos
   * poblaciones sin cruzarlas (caja recibida en el período) — ésta mide
   * cobrabilidad real de lo que venció, factura por factura. null en el mismo
   * caso 0/0 que efectividadPct.
   */
  efectividadCohortePct: number | null;
  ventanaDias: number;
  desde: string;
  hasta: string;
  montoQueVencia: number;
  cobradoVentana: number;
  /** Suma, por factura que vencía, de lo cobrado a esa factura (topado a su monto original). */
  cobradoCohorte: number;
  facturasQueVencian: { id_factura: string; numero: string; fecha_vencimiento: string; monto: number }[];
  pagosVentana: { id_pago: string; id_factura: string | null; fecha_pago: string; monto: number }[];
}

/**
 * Efectividad = cobrado en la ventana ÷ monto que vencía en la ventana.
 * SUPUESTO (pendiente Finanzas): ventana de 60 días hasta el corte; "vencía" =
 * facturas no anuladas con vencimiento dentro de la ventana, por monto
 * original; "cobrado" = pagos aplicados o parciales por fecha de pago. Es el
 * único KPI que mide la GESTIÓN y no el estado: los demás dicen cómo está la
 * cartera; éste, si el trabajo de cobrar está funcionando.
 */
export function efectividadCobro(dataset: Dataset, fechaCorte: string, ventanaDias = 60): ResultadoEfectividad {
  const desde = restarDias(fechaCorte, ventanaDias);

  const facturasQueVencian = dataset.facturas
    .filter(
      (f) =>
        f.estado_factura !== "anulada" &&
        f.fecha_vencimiento !== null &&
        f.fecha_vencimiento > desde &&
        f.fecha_vencimiento <= fechaCorte
    )
    .map((f) => ({
      id_factura: f.id_factura,
      numero: f.numero_factura,
      fecha_vencimiento: f.fecha_vencimiento as string,
      monto: f.monto_original,
    }));

  const pagosVentana = dataset.pagos
    .filter(
      (p) =>
        (p.estado_aplicacion === "aplicado" || p.estado_aplicacion === "parcial") &&
        p.fecha_pago > desde &&
        p.fecha_pago <= fechaCorte
    )
    .map((p) => ({ id_pago: p.id_pago, id_factura: p.id_factura, fecha_pago: p.fecha_pago, monto: p.monto_pago }));

  const montoQueVencia = redondear2(facturasQueVencian.reduce((s, f) => s + f.monto, 0));
  const cobradoVentana = redondear2(pagosVentana.reduce((s, p) => s + p.monto, 0));
  const efectividadPct =
    montoQueVencia > 0 ? redondear2((cobradoVentana / montoQueVencia) * 100) : null;

  // Cohorte: mismo filtro de "qué vencía", pero por cada factura se suma lo
  // que a ELLA se le cobró (cualquier fecha de pago), topado a su propio
  // monto — así un pago que cancela una factura vieja no infla el número de
  // lo que venció ahora.
  const facturasQueVencianCompletas = dataset.facturas.filter(
    (f) =>
      f.estado_factura !== "anulada" &&
      f.fecha_vencimiento !== null &&
      f.fecha_vencimiento > desde &&
      f.fecha_vencimiento <= fechaCorte
  );
  const cobradoCohorte = redondear2(
    facturasQueVencianCompletas.reduce(
      (s, f) => s + Math.min(pagosAplicados(f, dataset.pagos), f.monto_original),
      0
    )
  );
  const efectividadCohortePct =
    montoQueVencia > 0 ? redondear2((cobradoCohorte / montoQueVencia) * 100) : null;

  return {
    efectividadPct,
    efectividadCohortePct,
    ventanaDias,
    desde,
    hasta: fechaCorte,
    montoQueVencia,
    cobradoVentana,
    cobradoCohorte,
    facturasQueVencian,
    pagosVentana,
  };
}

// ── 4 · Concentración del riesgo por cliente ────────────────────────────────

export interface ResultadoConcentracion {
  /** null cuando no hay saldo. */
  mayorPct: number | null;
  mayorCliente: { id_cliente: string; nombre: string; saldo: number } | null;
  saldoTotal: number;
  /** Desglose completo: saldo por cliente, de mayor a menor, con su porcentaje. */
  porCliente: { id_cliente: string; nombre: string; saldo: number; pct: number }[];
}

/**
 * Concentración = mayor saldo por cliente ÷ saldo total pendiente.
 * Incluye el saldo no clasificable (la deuda sin fecha sigue siendo riesgo del
 * cliente que la debe). Mide dependencia: qué parte de la cartera desaparece
 * si UN cliente deja de pagar.
 */
export function concentracionRiesgo(dataset: Dataset, fechaCorte: string): ResultadoConcentracion {
  void fechaCorte; // la concentración no depende del corte, pero mantiene la firma común
  const porClienteMap = new Map<string, number>();
  for (const f of dataset.facturas) {
    if (f.estado_factura === "anulada") continue;
    const saldo = saldoPendiente(f, dataset.pagos, dataset.notasCredito);
    if (saldo <= 0) continue;
    porClienteMap.set(f.id_cliente, redondear2((porClienteMap.get(f.id_cliente) ?? 0) + saldo));
  }

  const saldoTotal = redondear2([...porClienteMap.values()].reduce((a, b) => a + b, 0));
  const nombre = (id: string) =>
    nombreDeCliente(dataset.clientes, id);

  const porCliente = [...porClienteMap.entries()]
    .map(([id_cliente, saldo]) => ({
      id_cliente,
      nombre: nombre(id_cliente),
      saldo,
      pct: saldoTotal > 0 ? redondear2((saldo / saldoTotal) * 100) : 0,
    }))
    .sort((a, b) => b.saldo - a.saldo);

  const mayor = porCliente[0] ?? null;
  return {
    mayorPct: mayor ? mayor.pct : null,
    mayorCliente: mayor ? { id_cliente: mayor.id_cliente, nombre: mayor.nombre, saldo: mayor.saldo } : null,
    saldoTotal,
    porCliente,
  };
}
