// Carga el Dataset REAL de Benserca 18 (clientes, facturas, pagos) desde el
// proyecto Supabase dedicado (jfvmuemyjcdesnoqeaix — separado del canvas de
// DataFlow), poblado por scripts/importar-*-odoo.mjs. La clave usada acá es
// la publishable (anon) — pensada para vivir en el navegador, mismo patrón
// que ya usan esos scripts.
//
// Decisión de mapeo importante — por qué NO alcanza con copiar los campos
// tal cual:
//
// saldoPendiente() (lib/calculos.ts) calcula el saldo de una factura como
// monto_original − pagos APLICADOS ligados a esa factura − notas de crédito
// aplicadas ligadas a esa factura. Los pagos reales importados
// (scripts/importar-pagos-odoo.mjs) tienen id_factura null a propósito: Odoo
// no expone ese vínculo en un export de lista. Sin arreglo, saldoPendiente()
// vería CERO pagos ligados a cualquier factura y trataría cada una como
// 100% pendiente — aunque 2747 de 3182 ya estén "Pagado" según Odoo.
//
// El arreglo: facturas.saldo_pendiente_odoo (columna agregada este mismo día
// — ver _esquema-cxc-real.sql) es el "Importe adeudado" que ODOO YA
// CALCULÓ por factura. La diferencia (monto_original − saldo_pendiente_odoo)
// se representa acá como una NotaCredito sintética "aplicada", ligada a esa
// factura por id_factura. Así saldoPendiente() la resta exactamente igual
// que restaría un pago real — sin tocar el motor de cálculo existente, y SIN
// tocar monto_original (que debe seguir siendo el monto ORIGINAL real de la
// factura: Ventas/Rentabilidad lo necesitan así).
//
// Los pagos reales se cargan con estado_aplicacion "aplicado" (no
// "no_aplicado", que es como está guardado en Supabase): en Odoo sí fueron
// pagos aplicados de verdad (posted), sólo que acá no sabemos a qué factura.
// efectividadCobro() (lib/kpis.ts) sólo filtra por fecha + monto +
// estado_aplicacion — con "aplicado" ve cobros reales en vez de cero. Esto
// NO duplica el saldo de ninguna factura: saldoPendiente() sólo resta un
// pago cuando p.id_factura === factura.id_factura, y acá id_factura es
// siempre null — nunca engancha con ninguna factura puntual.
//
// Verificado (2026-08-19): facturas.saldo_pendiente_odoo sumado + el import
// de saldos_odoo (reporte "Vencido por cobrar" de Odoo) cuadran al centavo
// contra el total que Odoo declara, una vez se descuentan los pagos sin
// aplicar a factura específica. Ver mensaje de esa fecha para el detalle.
//
// Paso 11 (2026-08-20) — productos/ventas/venta_lineas/movimientos_inventario:
// a diferencia de pagos, acá SÍ hay líneas reales (sale.order.line, extraído
// por API directa de Odoo — ese modelo no tiene vista de lista en ningún
// menú, así que no hay export nativo). Con líneas reales, ventasConTotal()
// calcula margen real, no un valor inventado — no hizo falta ningún caso
// especial "sin desglose" en lib/cadena.ts.

import type {
  Cliente,
  Dataset,
  Factura,
  MovimientoInventario,
  NotaCredito,
  Pago,
  Producto,
  TipoMovimientoInventario,
  Venta,
  VentaLinea,
} from "./types";

const SUPABASE_URL = "https://jfvmuemyjcdesnoqeaix.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";
const TAMANO_PAGINA = 1000; // límite por defecto de PostgREST por respuesta

async function traerTodo<T>(tabla: string, columnas = "*"): Promise<T[]> {
  const filas: T[] = [];
  let desde = 0;
  for (;;) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=${columnas}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${desde}-${desde + TAMANO_PAGINA - 1}`,
      },
    });
    if (!resp.ok) {
      throw new Error(`No se pudo cargar "${tabla}" desde Supabase (HTTP ${resp.status}).`);
    }
    const pagina = (await resp.json()) as T[];
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }
  return filas;
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface FilaClienteSupabase {
  id_cliente: string;
  nombre_cliente: string;
  identificacion_fiscal: string | null;
  estado_cliente: "activo" | "inactivo";
  condiciones_pago_default_id: string | null;
  fecha_creacion: string;
}

interface FilaFacturaSupabase {
  id_factura: string;
  id_cliente: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  monto_original: number;
  moneda_id: string;
  estado_factura: "abierta" | "pagada" | "anulada" | "disputada";
  id_venta: string | null;
  saldo_pendiente_odoo: number | null;
}

interface FilaPagoSupabase {
  id_pago: string;
  id_factura: string | null;
  id_cliente: string;
  fecha_pago: string;
  monto_pago: number;
  moneda_id: string;
  referencia_pago: string | null;
}

interface FilaProductoSupabase {
  id_producto: string;
  sku: string;
  nombre_producto: string;
  costo_unitario: number;
  precio_unitario: number;
  stock_minimo: number;
}

interface FilaVentaSupabase {
  id_venta: string;
  id_cliente: string | null;
  fecha_venta: string;
}

interface FilaVentaLineaSupabase {
  id_linea: string;
  id_venta: string;
  id_producto: string;
  cantidad: number;
  precio_unitario: number;
}

interface FilaMovimientoSupabase {
  id_movimiento: string;
  id_producto: string;
  fecha: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  id_venta: string | null;
  motivo: string | null;
}

export async function cargarDatasetReal(): Promise<Dataset> {
  const [clientesRaw, facturasRaw, pagosRaw, productosRaw, ventasRaw, ventaLineasRaw, movimientosRaw] =
    await Promise.all([
      traerTodo<FilaClienteSupabase>("clientes"),
      traerTodo<FilaFacturaSupabase>("facturas"),
      traerTodo<FilaPagoSupabase>("pagos"),
      traerTodo<FilaProductoSupabase>("productos"),
      traerTodo<FilaVentaSupabase>("ventas"),
      traerTodo<FilaVentaLineaSupabase>("venta_lineas"),
      traerTodo<FilaMovimientoSupabase>("movimientos_inventario"),
    ]);

  const clientes: Cliente[] = clientesRaw.map((c) => ({
    id_cliente: c.id_cliente,
    nombre_cliente: c.nombre_cliente,
    identificacion_fiscal: c.identificacion_fiscal ?? undefined,
    estado_cliente: c.estado_cliente,
    condiciones_pago_default_id: c.condiciones_pago_default_id ?? undefined,
    fecha_creacion: c.fecha_creacion,
  }));

  const facturas: Factura[] = facturasRaw.map((f) => ({
    id_factura: f.id_factura,
    id_cliente: f.id_cliente,
    numero_factura: f.numero_factura,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    monto_original: Number(f.monto_original),
    moneda_id: f.moneda_id,
    estado_factura: f.estado_factura,
    id_venta: f.id_venta ?? undefined,
  }));

  const notasCredito: NotaCredito[] = [];
  for (const f of facturasRaw) {
    if (f.saldo_pendiente_odoo === null) continue;
    const yaReconciliado = redondear2(Number(f.monto_original) - Number(f.saldo_pendiente_odoo));
    if (yaReconciliado > 0) {
      notasCredito.push({
        id_nota_credito: `REC-${f.id_factura}`,
        id_factura: f.id_factura,
        id_cliente: f.id_cliente,
        fecha_emision: f.fecha_emision,
        monto_nota_credito: yaReconciliado,
        moneda_id: f.moneda_id,
        motivo: "Conciliación Odoo: saldo ya reducido según \"Importe adeudado\" (pagos/créditos aplicados en Odoo, sin desglose por factura en este export)",
        estado_nota_credito: "aplicada",
      });
    }
  }

  const pagos: Pago[] = pagosRaw.map((p) => ({
    id_pago: p.id_pago,
    id_factura: p.id_factura,
    id_cliente: p.id_cliente,
    fecha_pago: p.fecha_pago,
    monto_pago: Number(p.monto_pago),
    moneda_id: p.moneda_id,
    estado_aplicacion: "aplicado",
    referencia_pago: p.referencia_pago ?? undefined,
  }));

  const productos: Producto[] = productosRaw.map((p) => ({
    id_producto: p.id_producto,
    sku: p.sku,
    nombre_producto: p.nombre_producto,
    costo_unitario: Number(p.costo_unitario),
    precio_unitario: Number(p.precio_unitario),
    stock_minimo: Number(p.stock_minimo),
  }));

  // Ventas con id_cliente null (pedido sin socio en Odoo, no visto en la
  // práctica pero el campo es nullable en el esquema) se descartan acá: Venta
  // exige id_cliente string, y no se inventa un cliente para tapar el hueco.
  const ventas: Venta[] = ventasRaw
    .filter((v): v is FilaVentaSupabase & { id_cliente: string } => v.id_cliente !== null)
    .map((v) => ({
      id_venta: v.id_venta,
      id_cliente: v.id_cliente,
      fecha_venta: v.fecha_venta,
    }));
  const idsVentaValidos = new Set(ventas.map((v) => v.id_venta));

  const ventaLineas: VentaLinea[] = ventaLineasRaw
    .filter((l) => idsVentaValidos.has(l.id_venta))
    .map((l) => ({
      id_linea: l.id_linea,
      id_venta: l.id_venta,
      id_producto: l.id_producto,
      cantidad: Number(l.cantidad),
      precio_unitario: Number(l.precio_unitario),
    }));

  const movimientosInventario: MovimientoInventario[] = movimientosRaw.map((m) => ({
    id_movimiento: m.id_movimiento,
    id_producto: m.id_producto,
    fecha: m.fecha,
    tipo: m.tipo,
    cantidad: Number(m.cantidad),
    id_venta: m.id_venta,
    motivo: m.motivo ?? undefined,
  }));

  return {
    clientes,
    facturas,
    pagos,
    notasCredito,
    disputas: [],
    condicionesPago: [],
    fuente: "odoo-real",
    productos,
    ventas,
    ventaLineas,
    movimientosInventario,
  };
}
