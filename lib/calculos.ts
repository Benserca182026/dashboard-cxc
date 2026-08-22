// Lógica de negocio del prototipo.
// Fuente: paso-4-modelo-datos.md (saldo derivado, sincronización factura↔disputa)
// y paso-6-aging.md (fórmula, buckets, exclusiones, fecha de corte paramétrica).
//
// ⚠️ La fórmula de aging y sus convenciones de borde son PROPUESTA PENDIENTE DE
// VALIDACIÓN POR FINANZAS (Paso 6, secciones 1 y 8) — este código las implementa
// para el prototipo, no las convierte en aprobadas.

import type {
  BucketAging,
  Dataset,
  Disputa,
  EstadoFactura,
  Factura,
  NotaCredito,
  Pago,
} from "./types";

const MS_POR_DIA = 86_400_000;

/** Suma de pagos APLICADOS a una factura (los no aplicados no reducen saldo). */
export function pagosAplicados(factura: Factura, pagos: Pago[]): number {
  return pagos
    .filter(
      (p) =>
        p.id_factura === factura.id_factura &&
        (p.estado_aplicacion === "aplicado" || p.estado_aplicacion === "parcial")
    )
    .reduce((suma, p) => suma + p.monto_pago, 0);
}

/** Suma de notas de crédito APLICADAS a una factura — restan, nunca suman (Paso 4 §4). */
export function notasAplicadas(factura: Factura, notas: NotaCredito[]): number {
  return notas
    .filter(
      (n) =>
        n.id_factura === factura.id_factura &&
        n.estado_nota_credito === "aplicada"
    )
    .reduce((suma, n) => suma + n.monto_nota_credito, 0);
}

/** Campo DERIVADO (Paso 4 §3): saldo = monto original − pagos aplicados − notas de crédito aplicadas. Nunca negativo. */
export function saldoPendiente(
  factura: Factura,
  pagos: Pago[],
  notas: NotaCredito[]
): number {
  const saldo =
    factura.monto_original -
    pagosAplicados(factura, pagos) -
    notasAplicadas(factura, notas);
  return Math.max(0, redondear2(saldo));
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Una disputa está "activa" cuando su estado es abierta o en_revision (Paso 4 §2.1). */
export function disputaActiva(d: Disputa): boolean {
  return d.estado_disputa === "abierta" || d.estado_disputa === "en_revision";
}

/**
 * Estado operativo derivado de la factura (Paso 4 §2.1):
 * - estado_disputa es la fuente de verdad; `disputada` es un resumen derivado, excluyente de `abierta`.
 * - Una disputa sobre factura ya `pagada`/`anulada` NO cambia el estado ni reabre saldo.
 * - Sin disputas activas: saldo 0 → pagada; saldo > 0 → abierta.
 */
export function estadoFacturaDerivado(
  factura: Factura,
  pagos: Pago[],
  notas: NotaCredito[],
  disputas: Disputa[]
): EstadoFactura {
  if (factura.estado_factura === "anulada") return "anulada";
  const saldo = saldoPendiente(factura, pagos, notas);
  if (saldo === 0) return "pagada";
  const tieneDisputaActiva = disputas.some(
    (d) => d.id_factura === factura.id_factura && disputaActiva(d)
  );
  if (tieneDisputaActiva) return "disputada";
  return "abierta";
}

/** Días de atraso = Fecha de corte − Fecha de vencimiento (plan maestro, Fase 3). */
export function diasAtraso(fechaCorte: string, fechaVencimiento: string): number {
  const corte = Date.parse(fechaCorte + "T00:00:00Z");
  const vence = Date.parse(fechaVencimiento + "T00:00:00Z");
  return Math.round((corte - vence) / MS_POR_DIA);
}

/**
 * Clasificación en bucket (Paso 6 §1) — rangos cerrados, mutuamente excluyentes:
 * actual ≤ 0 · 1-30 · 31-60 · 61-90 · 90+ (≥ 91).
 * Convención "día 0 → actual": SUPUESTO propio pendiente de confirmar con Finanzas (Paso 6 §8).
 */
export function bucketDeDias(dias: number): BucketAging {
  if (dias <= 0) return "actual";
  if (dias <= 30) return "1-30";
  if (dias <= 60) return "31-60";
  if (dias <= 90) return "61-90";
  return "90+";
}

export interface FacturaClasificada {
  factura: Factura;
  saldo: number;
  estado: EstadoFactura;
  dias: number;
  bucket: BucketAging;
  /** true si la fecha de corte es anterior a la fecha de emisión (advertencia, no bloqueo — Paso 6 §2). */
  advertenciaCorteAnterior: boolean;
}

export interface FacturaExcluida {
  factura: Factura;
  saldo: number;
  motivo: "pagada" | "anulada" | "sin_fecha_vencimiento";
}

export interface ResultadoAging {
  clasificadas: FacturaClasificada[];
  excluidas: FacturaExcluida[];
  totalesPorBucket: Record<BucketAging, number>;
  totalClasificado: number;
  /** Saldo con deuda real pero no clasificable (sin fecha de vencimiento) — se reporta, nunca se inventa fecha. */
  saldoNoClasificable: number;
}

/**
 * Aging completo (Paso 6). Reglas:
 * - Solo facturas con saldo > 0 entran a buckets; pagadas/anuladas se excluyen con motivo.
 * - Sin fecha de vencimiento → excluida y reportada (NUNCA se genera una fecha).
 * - Disputadas con saldo > 0 SÍ entran al aging por fecha (el aging clasifica, M3 despriorizará).
 * - La fecha de corte es SIEMPRE un parámetro explícito — nunca "hoy" implícito.
 */
export function calcularAging(dataset: Dataset, fechaCorte: string): ResultadoAging {
  const clasificadas: FacturaClasificada[] = [];
  const excluidas: FacturaExcluida[] = [];
  const totalesPorBucket: Record<BucketAging, number> = {
    actual: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  let saldoNoClasificable = 0;

  for (const factura of dataset.facturas) {
    const saldo = saldoPendiente(factura, dataset.pagos, dataset.notasCredito);
    const estado = estadoFacturaDerivado(
      factura,
      dataset.pagos,
      dataset.notasCredito,
      dataset.disputas
    );

    if (estado === "pagada" || estado === "anulada") {
      excluidas.push({ factura, saldo, motivo: estado });
      continue;
    }
    if (!factura.fecha_vencimiento) {
      excluidas.push({ factura, saldo, motivo: "sin_fecha_vencimiento" });
      saldoNoClasificable = redondear2(saldoNoClasificable + saldo);
      continue;
    }

    const dias = diasAtraso(fechaCorte, factura.fecha_vencimiento);
    const bucket = bucketDeDias(dias);
    const advertenciaCorteAnterior =
      Date.parse(fechaCorte) < Date.parse(factura.fecha_emision);

    clasificadas.push({ factura, saldo, estado, dias, bucket, advertenciaCorteAnterior });
    totalesPorBucket[bucket] = redondear2(totalesPorBucket[bucket] + saldo);
  }

  const totalClasificado = redondear2(
    (Object.values(totalesPorBucket) as number[]).reduce((a, b) => a + b, 0)
  );

  return { clasificadas, excluidas, totalesPorBucket, totalClasificado, saldoNoClasificable };
}

/** Formato de moneda para la UI (es-MX genérico; los montos son ficticios). */
// El dataset demo-ficticio usa USD (ver lib/datos.ts); los datos reales de
// Benserca 18 vienen en GTQ (Odoo así lo declara en moneda_id, verificado en
// el 100% de la muestra real). Sin este parámetro, cada monto real se
// mostraba con "$" como si fuera dólares — correcto en magnitud, engañoso en
// la moneda.
//
// `moneda` NO tiene default, y es deliberado. Un default correcto sigue
// permitiendo el olvido silencioso: quien no pasa moneda no se entera de
// nada y la pantalla miente sin avisar. Un parámetro obligatorio convierte
// ese olvido en un error de compilación. Se pasa de confiar en la memoria
// del programador a confiar en la máquina.
export function fmtMoneda(n: number, moneda: "USD" | "GTQ"): string {
  return n.toLocaleString(moneda === "GTQ" ? "es-GT" : "en-US", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  });
}

/**
 * Resuelve el nombre de un cliente a partir de su id.
 *
 * Cuando el id NO resuelve, esta función NO devuelve el id crudo: devuelve un
 * texto que DECLARA el fallo de resolución. El patrón anterior
 * (`...?.nombre_cliente ?? id`) hacía que la pantalla imprimiera "CLI-004" en
 * la columna «cliente», indistinguible de un nombre real — un id disfrazado
 * de nombre. Un fallo de resolución tiene que verse como lo que es, no
 * confundirse con un dato.
 */
export function nombreDeCliente(
  clientes: { id_cliente: string; nombre_cliente: string }[],
  id: string
): string {
  return (
    clientes.find((c) => c.id_cliente === id)?.nombre_cliente ??
    `cliente no identificado (${id})`
  );
}
