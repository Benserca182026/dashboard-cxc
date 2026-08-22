// Cadena Ventas ↔ Inventario ↔ CxC — Paso 11 (alcance declarado 2026-08-15).
//
// Principio: el hecho se guarda UNA vez y todo lo demás se DERIVA.
//   existencia  = Σ movimientos                 (nunca un campo editable)
//   total venta = Σ cantidad × precio           (nunca tecleado)
//   cuadre      = vendido − facturado           (si difieren, se muestra el monto)
// Un número guardado puede contradecir a su sujeto; uno derivado, no.
//
// ⚠️ Fórmulas PENDIENTES DE VALIDACIÓN POR FINANZAS, como todo el prototipo.

import { nombreDeCliente, saldoPendiente } from "./calculos";
import type { Dataset, MovimientoInventario, Producto } from "./types";

const redondear2 = (n: number) => Math.round(n * 100) / 100;
const MS_POR_DIA = 86_400_000;
const dias = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / MS_POR_DIA);

/** El Paso 11 es opcional en el Dataset: un CSV solo-CxC no lo trae. */
export function hayCadena(d: Dataset): boolean {
  return !!(d.productos?.length && d.ventas?.length && d.ventaLineas?.length && d.movimientosInventario?.length);
}

/**
 * ¿Al menos una factura del dataset trae id_venta poblado? Si NINGUNA lo trae,
 * "ventas sin factura" no es una alarma de negocio: es que este export de Odoo
 * nunca capturó el vínculo venta↔factura. No se puede acusar a la venta de una
 * cadena rota que el propio dato es incapaz de mostrar.
 */
export function vinculoVentaFacturaDisponible(d: Dataset): boolean {
  return d.facturas.some((f) => f.id_venta);
}

// ── Inventario ──────────────────────────────────────────────────────────────

export interface FilaStock {
  producto: Producto;
  existencia: number;
  bajoMinimo: boolean;
  valorCosto: number;
  movimientos: MovimientoInventario[]; // el kardex: el desglose ES la existencia
}

export function stockPorProducto(d: Dataset): FilaStock[] {
  return (d.productos ?? []).map((p) => {
    const movimientos = (d.movimientosInventario ?? [])
      .filter((m) => m.id_producto === p.id_producto)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const existencia = movimientos.reduce((s, m) => s + m.cantidad, 0);
    return {
      producto: p,
      existencia,
      bajoMinimo: existencia <= p.stock_minimo,
      valorCosto: redondear2(existencia * p.costo_unitario),
      movimientos,
    };
  });
}

/** Salidas sin venta de origen: no son error fatal, pero se AUDITAN siempre. */
export function salidasSinVenta(d: Dataset): MovimientoInventario[] {
  return (d.movimientosInventario ?? []).filter((m) => m.tipo === "salida" && !m.id_venta);
}

// ── Ventas ──────────────────────────────────────────────────────────────────

export interface VentaConTotal {
  id_venta: string;
  id_cliente: string;
  cliente: string;
  fecha: string;
  lineas: { producto: string; sku: string; cantidad: number; precio: number; importe: number; costo: number }[];
  total: number;
  costoTotal: number;
  margen: number;
  margenPct: number | null;
  id_factura: string | null;
}

export function ventasConTotal(d: Dataset): VentaConTotal[] {
  const nombreCliente = (id: string) =>
    nombreDeCliente(d.clientes, id);
  const producto = (id: string) => (d.productos ?? []).find((p) => p.id_producto === id);

  return (d.ventas ?? [])
    .map((v) => {
      const lineas = (d.ventaLineas ?? [])
        .filter((l) => l.id_venta === v.id_venta)
        .map((l) => {
          const p = producto(l.id_producto);
          return {
            producto: p?.nombre_producto ?? l.id_producto,
            sku: p?.sku ?? "?",
            cantidad: l.cantidad,
            precio: l.precio_unitario,
            importe: redondear2(l.cantidad * l.precio_unitario),
            costo: redondear2(l.cantidad * (p?.costo_unitario ?? 0)),
          };
        });
      const total = redondear2(lineas.reduce((s, l) => s + l.importe, 0));
      const costoTotal = redondear2(lineas.reduce((s, l) => s + l.costo, 0));
      const margen = redondear2(total - costoTotal);
      return {
        id_venta: v.id_venta,
        id_cliente: v.id_cliente,
        cliente: nombreCliente(v.id_cliente),
        fecha: v.fecha_venta,
        lineas,
        total,
        costoTotal,
        margen,
        margenPct: total > 0 ? redondear2((margen / total) * 100) : null,
        id_factura: d.facturas.find((f) => f.id_venta === v.id_venta)?.id_factura ?? null,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// ── El cuadre: la alarma de la juntura ──────────────────────────────────────

export interface Cuadre {
  totalVendido: number;
  totalFacturado: number;
  /** 0 = cuadran. Distinto de 0 = el monto EXACTO del descuadre, nunca un booleano mudo. */
  diferencia: number;
  cuadra: boolean;
}

/** Vendido (Σ líneas) contra facturado (Σ monto_original, sin anuladas). Cuadran por construcción; si no, la cadena se rompió y se dice dónde. */
export function cuadreVentasFacturacion(d: Dataset): Cuadre {
  const totalVendido = redondear2(
    ventasConTotal(d).reduce((s, v) => s + v.total, 0)
  );
  const totalFacturado = redondear2(
    d.facturas.filter((f) => f.estado_factura !== "anulada").reduce((s, f) => s + f.monto_original, 0)
  );
  const diferencia = redondear2(totalVendido - totalFacturado);
  return { totalVendido, totalFacturado, diferencia, cuadra: Math.abs(diferencia) < 0.005 };
}

// ── El cruce: una operación seguida de punta a punta ────────────────────────

export interface PasoCadena {
  fecha: string;
  modulo: "Inventario" | "Ventas" | "CxC";
  hecho: string;
  monto?: string;
}

export interface CadenaFactura {
  id_factura: string;
  pasos: PasoCadena[];
  /** Días entre la entrada a bodega y el último cobro (o el corte si no hay cobro). */
  cicloDias: number | null;
  saldoHoy: number;
}

/** Reconstruye la historia completa de una factura a través de los tres módulos. */
export function cadenaDeFactura(d: Dataset, idFactura: string, fmtMoneda: (n: number) => string): CadenaFactura | null {
  const f = d.facturas.find((x) => x.id_factura === idFactura);
  if (!f) return null;
  const pasos: PasoCadena[] = [];

  const venta = (d.ventas ?? []).find((v) => v.id_venta === f.id_venta);
  const salidas = (d.movimientosInventario ?? []).filter((m) => m.id_venta === f.id_venta);
  const productosDe = new Set(salidas.map((m) => m.id_producto));
  const entradas = (d.movimientosInventario ?? []).filter(
    (m) => m.tipo === "entrada" && productosDe.has(m.id_producto)
  );

  for (const e of entradas) {
    const p = (d.productos ?? []).find((x) => x.id_producto === e.id_producto);
    pasos.push({ fecha: e.fecha, modulo: "Inventario", hecho: `entró ${p?.sku ?? e.id_producto} (+${e.cantidad})`, monto: e.motivo });
  }
  for (const s of salidas) {
    const p = (d.productos ?? []).find((x) => x.id_producto === s.id_producto);
    pasos.push({ fecha: s.fecha, modulo: "Inventario", hecho: `salió ${p?.sku ?? s.id_producto} (${s.cantidad}) por ${s.id_venta}` });
  }
  if (venta) {
    const vt = ventasConTotal(d).find((v) => v.id_venta === venta.id_venta);
    pasos.push({ fecha: venta.fecha_venta, modulo: "Ventas", hecho: `venta ${venta.id_venta}`, monto: vt ? fmtMoneda(vt.total) : undefined });
  }
  pasos.push({ fecha: f.fecha_emision, modulo: "CxC", hecho: `se facturó ${f.numero_factura}`, monto: fmtMoneda(f.monto_original) });
  if (f.fecha_vencimiento) pasos.push({ fecha: f.fecha_vencimiento, modulo: "CxC", hecho: "venció" });
  for (const p of d.pagos.filter((x) => x.id_factura === idFactura && x.estado_aplicacion !== "no_aplicado")) {
    pasos.push({ fecha: p.fecha_pago, modulo: "CxC", hecho: `cobro ${p.estado_aplicacion}`, monto: fmtMoneda(p.monto_pago) });
  }
  for (const di of d.disputas.filter((x) => x.id_factura === idFactura)) {
    pasos.push({ fecha: di.fecha_apertura, modulo: "CxC", hecho: `disputa ${di.estado_disputa}`, monto: fmtMoneda(di.monto_disputado) });
  }

  pasos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const primeraEntrada = entradas.map((e) => e.fecha).sort()[0] ?? null;
  const ultimoCobro = d.pagos
    .filter((x) => x.id_factura === idFactura && x.estado_aplicacion !== "no_aplicado")
    .map((p) => p.fecha_pago)
    .sort()
    .at(-1);

  return {
    id_factura: idFactura,
    pasos,
    cicloDias: primeraEntrada && ultimoCobro ? dias(primeraEntrada, ultimoCobro) : null,
    saldoHoy: saldoPendiente(f, d.pagos, d.notasCredito),
  };
}
