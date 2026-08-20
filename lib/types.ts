// Modelo de datos del prototipo — transcripción directa de paso-4-modelo-datos.md.
// Todo dato que circule por estos tipos es FICTICIO en este prototipo.

export type EstadoCliente = "activo" | "inactivo";
export type EstadoFactura = "abierta" | "pagada" | "anulada" | "disputada";
export type EstadoAplicacionPago = "aplicado" | "no_aplicado" | "parcial";
export type EstadoNotaCredito = "aplicada" | "pendiente" | "anulada";
export type EstadoDisputa = "abierta" | "en_revision" | "resuelta" | "rechazada";
export type TipoGestion =
  | "llamada"
  | "email"
  | "carta"
  | "visita"
  | "escalamiento_legal"
  | "otro";
export type SlaEstado = "en_plazo" | "vencido" | "cumplido" | "no_aplica";

export interface Cliente {
  id_cliente: string;
  nombre_cliente: string;
  identificacion_fiscal?: string;
  estado_cliente: EstadoCliente;
  condiciones_pago_default_id?: string;
  fecha_creacion: string; // ISO yyyy-mm-dd
}

export interface Factura {
  id_factura: string;
  id_cliente: string;
  numero_factura: string;
  fecha_emision: string;
  /** Puede faltar en datos importados — en ese caso la factura se EXCLUYE del aging y se reporta (regla M6/Paso 6). */
  fecha_vencimiento: string | null;
  monto_original: number;
  moneda_id: string;
  /** Estado BASE registrado. El estado operativo se deriva con `estadoFacturaDerivado` (regla 2.1 del Paso 4). */
  estado_factura: EstadoFactura;
  /** Paso 11: venta que originó esta factura. Opcional para no romper datos importados solo-CxC. */
  id_venta?: string;
}

export interface Pago {
  id_pago: string;
  id_factura: string | null; // nullable: pagos no aplicados/anticipos
  id_cliente: string;
  fecha_pago: string;
  monto_pago: number;
  moneda_id: string;
  estado_aplicacion: EstadoAplicacionPago;
  referencia_pago?: string;
}

export interface NotaCredito {
  id_nota_credito: string;
  id_factura: string | null; // nullable: notas generales al cliente
  id_cliente: string;
  fecha_emision: string;
  monto_nota_credito: number;
  moneda_id: string;
  motivo?: string;
  estado_nota_credito: EstadoNotaCredito;
}

export interface Disputa {
  id_disputa: string;
  id_factura: string;
  id_cliente: string;
  fecha_apertura: string;
  fecha_resolucion: string | null;
  motivo_disputa?: string;
  monto_disputado: number;
  estado_disputa: EstadoDisputa;
}

export interface GestionCobranza {
  id_gestion: string;
  id_cliente: string;
  id_factura: string | null;
  responsable: string;
  fecha_hora: string;
  tipo_gestion: TipoGestion;
  resultado?: string;
  proxima_accion?: string;
  fecha_proxima_accion?: string;
  sla_estado: SlaEstado;
  notas?: string;
  creado_por: string;
  fecha_creacion: string;
  modificado_por?: string;
  fecha_modificacion?: string;
}

// ── Paso 11 — cadena Ventas e Inventario (alcance declarado 2026-08-15) ──
// El hecho se guarda UNA vez: una venta genera su factura (Factura.id_venta) y
// su salida de inventario (MovimientoInventario.id_venta). CxC, Ventas e
// Inventario son tres vistas de esa cadena, no tres depósitos.

export type TipoMovimientoInventario = "entrada" | "salida" | "ajuste";

export interface Producto {
  id_producto: string;
  sku: string;
  nombre_producto: string;
  costo_unitario: number;
  precio_unitario: number;
  /** Umbral de reposición. NO es el stock: la existencia SIEMPRE se deriva de los movimientos. */
  stock_minimo: number;
}

export interface Venta {
  id_venta: string;
  id_cliente: string;
  fecha_venta: string;
  /** El total NO se guarda: es Σ(cantidad × precio) de sus líneas. */
}

export interface VentaLinea {
  id_linea: string;
  id_venta: string;
  id_producto: string;
  cantidad: number;
  precio_unitario: number;
}

export interface MovimientoInventario {
  id_movimiento: string;
  id_producto: string;
  fecha: string;
  tipo: TipoMovimientoInventario;
  /** Negativa en salidas. La existencia es la suma de esta columna. */
  cantidad: number;
  /** Si nació de una venta, queda dicho cuál: el descuento es auditable. */
  id_venta: string | null;
  motivo?: string;
}

export interface CondicionPago {
  id_condicion_pago: string;
  nombre: string;
  dias_credito: number;
}

export interface Dataset {
  clientes: Cliente[];
  facturas: Factura[];
  pagos: Pago[];
  notasCredito: NotaCredito[];
  disputas: Disputa[];
  condicionesPago: CondicionPago[];
  /** Origen del dataset — para que la UI siempre declare de dónde salen los datos. */
  fuente: "demo-ficticio" | "csv-importado" | "odoo-real";
  /** Paso 11 — opcionales: un CSV solo-CxC sigue siendo un Dataset válido. */
  productos?: Producto[];
  ventas?: Venta[];
  ventaLineas?: VentaLinea[];
  movimientosInventario?: MovimientoInventario[];
}

export type BucketAging = "actual" | "1-30" | "31-60" | "61-90" | "90+";

export const BUCKETS: BucketAging[] = ["actual", "1-30", "31-60", "61-90", "90+"];
