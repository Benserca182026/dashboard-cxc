// Dataset DEMO — transcripción exacta de paso-5-datos-ficticios.md.
// TODOS los datos son FICTICIOS: nombres, montos, fechas e identificadores
// no corresponden a ninguna empresa ni persona real.
// Total de control autoritativo del dataset (Paso 5): saldo pendiente = $7,700.00 USD.

import type { Dataset } from "./types";

export const FECHA_CORTE_DEFAULT = "2026-08-10";

export const datosDemo: Dataset = {
  fuente: "demo-ficticio",
  condicionesPago: [
    { id_condicion_pago: "CP-01", nombre: "Net 30 (ficticio)", dias_credito: 30 },
  ],
  clientes: [
    { id_cliente: "CLI-001", nombre_cliente: "Comercializadora Ficticia Alfa", identificacion_fiscal: "FICT-RFC-001", estado_cliente: "activo", condiciones_pago_default_id: "CP-01", fecha_creacion: "2026-01-10" },
    { id_cliente: "CLI-002", nombre_cliente: "Distribuidora Ficticia Beta", identificacion_fiscal: "FICT-RFC-002", estado_cliente: "activo", condiciones_pago_default_id: "CP-01", fecha_creacion: "2026-01-15" },
    { id_cliente: "CLI-003", nombre_cliente: "Servicios Ficticios Gamma", identificacion_fiscal: "FICT-RFC-003", estado_cliente: "activo", condiciones_pago_default_id: "CP-01", fecha_creacion: "2026-02-01" },
    { id_cliente: "CLI-004", nombre_cliente: "Grupo Ficticio Delta", identificacion_fiscal: "FICT-RFC-004", estado_cliente: "activo", condiciones_pago_default_id: "CP-01", fecha_creacion: "2026-02-05" },
  ],
  facturas: [
    { id_factura: "FAC-1001", id_venta: "VTA-9001", id_cliente: "CLI-001", numero_factura: "DEMO-1001", fecha_emision: "2026-07-01", fecha_vencimiento: "2026-09-01", monto_original: 1000.0, moneda_id: "USD", estado_factura: "abierta" },
    { id_factura: "FAC-1002", id_venta: "VTA-9002", id_cliente: "CLI-001", numero_factura: "DEMO-1002", fecha_emision: "2026-05-01", fecha_vencimiento: "2026-06-01", monto_original: 2000.0, moneda_id: "USD", estado_factura: "abierta" },
    { id_factura: "FAC-1003", id_venta: "VTA-9003", id_cliente: "CLI-002", numero_factura: "DEMO-1003", fecha_emision: "2026-06-01", fecha_vencimiento: "2026-07-01", monto_original: 1500.0, moneda_id: "USD", estado_factura: "abierta" },
    { id_factura: "FAC-1004", id_venta: "VTA-9004", id_cliente: "CLI-002", numero_factura: "DEMO-1004", fecha_emision: "2026-04-01", fecha_vencimiento: "2026-05-01", monto_original: 800.0, moneda_id: "USD", estado_factura: "abierta" },
    { id_factura: "FAC-1005", id_venta: "VTA-9005", id_cliente: "CLI-003", numero_factura: "DEMO-1005", fecha_emision: "2026-07-15", fecha_vencimiento: "2026-08-15", monto_original: 3000.0, moneda_id: "USD", estado_factura: "abierta" },
    { id_factura: "FAC-1006", id_venta: "VTA-9006", id_cliente: "CLI-004", numero_factura: "DEMO-1006", fecha_emision: "2026-06-10", fecha_vencimiento: "2026-07-10", monto_original: 1200.0, moneda_id: "USD", estado_factura: "abierta" },
  ],
  pagos: [
    { id_pago: "PAG-2001", id_factura: "FAC-1003", id_cliente: "CLI-002", fecha_pago: "2026-07-20", monto_pago: 500.0, moneda_id: "USD", estado_aplicacion: "parcial", referencia_pago: "DEMO-REF-2001" },
    { id_pago: "PAG-2002", id_factura: "FAC-1004", id_cliente: "CLI-002", fecha_pago: "2026-05-20", monto_pago: 800.0, moneda_id: "USD", estado_aplicacion: "aplicado", referencia_pago: "DEMO-REF-2002" },
  ],
  notasCredito: [
    { id_nota_credito: "NC-3001", id_factura: "FAC-1005", id_cliente: "CLI-003", fecha_emision: "2026-07-20", monto_nota_credito: 500.0, moneda_id: "USD", motivo: "Ajuste comercial ficticio", estado_nota_credito: "aplicada" },
  ],
  // ── Paso 11 · cadena Ventas e Inventario ──
  // Regla de coherencia: el total de líneas de cada venta = monto_original de su
  // factura, y cada salida de inventario lleva el id_venta que la produjo.
  // Total vendido = total facturado = $9,500.00 (cuadre por construcción).
  productos: [
    { id_producto: "PRD-A", sku: "FIC-A", nombre_producto: "Producto Ficticio Alfa", costo_unitario: 60, precio_unitario: 100, stock_minimo: 20 },
    { id_producto: "PRD-B", sku: "FIC-B", nombre_producto: "Producto Ficticio Beta", costo_unitario: 150, precio_unitario: 250, stock_minimo: 5 },
    { id_producto: "PRD-C", sku: "FIC-C", nombre_producto: "Producto Ficticio Gamma", costo_unitario: 22, precio_unitario: 40, stock_minimo: 15 },
    { id_producto: "PRD-D", sku: "FIC-D", nombre_producto: "Producto Ficticio Delta", costo_unitario: 320, precio_unitario: 500, stock_minimo: 3 },
  ],
  ventas: [
    { id_venta: "VTA-9001", id_cliente: "CLI-001", fecha_venta: "2026-07-01" },
    { id_venta: "VTA-9002", id_cliente: "CLI-001", fecha_venta: "2026-05-01" },
    { id_venta: "VTA-9003", id_cliente: "CLI-002", fecha_venta: "2026-06-01" },
    { id_venta: "VTA-9004", id_cliente: "CLI-002", fecha_venta: "2026-04-01" },
    { id_venta: "VTA-9005", id_cliente: "CLI-003", fecha_venta: "2026-07-15" },
    { id_venta: "VTA-9006", id_cliente: "CLI-004", fecha_venta: "2026-06-10" },
  ],
  ventaLineas: [
    { id_linea: "LIN-1", id_venta: "VTA-9001", id_producto: "PRD-A", cantidad: 10, precio_unitario: 100 },
    { id_linea: "LIN-2", id_venta: "VTA-9002", id_producto: "PRD-B", cantidad: 8, precio_unitario: 250 },
    { id_linea: "LIN-3", id_venta: "VTA-9003", id_producto: "PRD-C", cantidad: 25, precio_unitario: 40 },
    { id_linea: "LIN-4", id_venta: "VTA-9003", id_producto: "PRD-A", cantidad: 5, precio_unitario: 100 },
    { id_linea: "LIN-5", id_venta: "VTA-9004", id_producto: "PRD-C", cantidad: 20, precio_unitario: 40 },
    { id_linea: "LIN-6", id_venta: "VTA-9005", id_producto: "PRD-D", cantidad: 6, precio_unitario: 500 },
    { id_linea: "LIN-7", id_venta: "VTA-9006", id_producto: "PRD-A", cantidad: 12, precio_unitario: 100 },
  ],
  movimientosInventario: [
    { id_movimiento: "MOV-1", id_producto: "PRD-A", fecha: "2026-03-01", tipo: "entrada", cantidad: 60, id_venta: null, motivo: "Compra inicial ficticia" },
    { id_movimiento: "MOV-2", id_producto: "PRD-B", fecha: "2026-03-01", tipo: "entrada", cantidad: 20, id_venta: null, motivo: "Compra inicial ficticia" },
    { id_movimiento: "MOV-3", id_producto: "PRD-C", fecha: "2026-03-01", tipo: "entrada", cantidad: 50, id_venta: null, motivo: "Compra inicial ficticia" },
    { id_movimiento: "MOV-4", id_producto: "PRD-D", fecha: "2026-03-01", tipo: "entrada", cantidad: 10, id_venta: null, motivo: "Compra inicial ficticia" },
    { id_movimiento: "MOV-5", id_producto: "PRD-A", fecha: "2026-07-01", tipo: "salida", cantidad: -10, id_venta: "VTA-9001", motivo: "Venta" },
    { id_movimiento: "MOV-6", id_producto: "PRD-B", fecha: "2026-05-01", tipo: "salida", cantidad: -8, id_venta: "VTA-9002", motivo: "Venta" },
    { id_movimiento: "MOV-7", id_producto: "PRD-C", fecha: "2026-06-01", tipo: "salida", cantidad: -25, id_venta: "VTA-9003", motivo: "Venta" },
    { id_movimiento: "MOV-8", id_producto: "PRD-A", fecha: "2026-06-01", tipo: "salida", cantidad: -5, id_venta: "VTA-9003", motivo: "Venta" },
    { id_movimiento: "MOV-9", id_producto: "PRD-C", fecha: "2026-04-01", tipo: "salida", cantidad: -20, id_venta: "VTA-9004", motivo: "Venta" },
    { id_movimiento: "MOV-10", id_producto: "PRD-D", fecha: "2026-07-15", tipo: "salida", cantidad: -6, id_venta: "VTA-9005", motivo: "Venta" },
    { id_movimiento: "MOV-11", id_producto: "PRD-A", fecha: "2026-06-10", tipo: "salida", cantidad: -12, id_venta: "VTA-9006", motivo: "Venta" },
  ],
  disputas: [
    { id_disputa: "DIS-4001", id_factura: "FAC-1006", id_cliente: "CLI-004", fecha_apertura: "2026-07-15", fecha_resolucion: null, motivo_disputa: "Discrepancia de precio ficticia", monto_disputado: 1200.0, estado_disputa: "abierta" },
  ],
};

// Gestiones de cobranza semilla (Paso 5) — el módulo M5 agrega más, solo en localStorage.
import type { GestionCobranza } from "./types";

export const gestionesSemilla: GestionCobranza[] = [
  {
    id_gestion: "GES-5001", id_cliente: "CLI-004", id_factura: "FAC-1006",
    responsable: "Agente Ficticio 1", fecha_hora: "2026-07-16T09:00",
    tipo_gestion: "llamada", resultado: "Cliente reporta discrepancia de precio (dato ficticio)",
    proxima_accion: "resolver disputa", fecha_proxima_accion: "2026-07-25",
    sla_estado: "en_plazo", creado_por: "sistema_demo", fecha_creacion: "2026-07-16T09:00",
  },
  {
    id_gestion: "GES-5002", id_cliente: "CLI-002", id_factura: "FAC-1003",
    responsable: "Agente Ficticio 2", fecha_hora: "2026-07-22T10:30",
    tipo_gestion: "email", resultado: "Cliente promete pago parcial (dato ficticio)",
    proxima_accion: "seguimiento promesa de pago", fecha_proxima_accion: "2026-08-05",
    sla_estado: "en_plazo", creado_por: "sistema_demo", fecha_creacion: "2026-07-22T10:30",
  },
];
