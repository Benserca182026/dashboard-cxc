import assert from "node:assert/strict";
import { analiticaVentas } from "../lib/commercial-operacion";
import { Cifra, type Dataset } from "../lib/types";

const dataset: Dataset = {
  fuente: "odoo-real",
  clientes: [
    { id_cliente: "C-GTQ", nombre_cliente: "Cliente GTQ", estado_cliente: "activo", fecha_creacion: "2026-01-01" },
    { id_cliente: "C-USD", nombre_cliente: "Cliente USD", estado_cliente: "activo", fecha_creacion: "2026-01-01" },
  ],
  facturas: [],
  pagos: [],
  notasCredito: [],
  disputas: [],
  condicionesPago: [],
  productos: [
    { id_producto: "P-GTQ", sku: "P-GTQ", nombre_producto: "Producto GTQ", costo_unitario: 1, precio_unitario: 1, stock_minimo: 0 },
    { id_producto: "P-USD", sku: "P-USD", nombre_producto: "Producto USD", costo_unitario: 1, precio_unitario: 1, stock_minimo: 0 },
  ],
  ventas: [
    { id_venta: "V-GTQ", id_cliente: "C-GTQ", fecha_venta: "2026-08-01", moneda_id: "GTQ", estado_odoo: "sale", total_referencia: Cifra.hecho(762.033) },
    { id_venta: "V-USD", id_cliente: "C-USD", fecha_venta: "2026-08-02", moneda_id: "USD", estado_odoo: "sale", total_referencia: Cifra.hecho(100) },
  ],
  ventaLineas: [
    { id_linea: "L-GTQ", id_venta: "V-GTQ", id_producto: "P-GTQ", cantidad: 1, precio_unitario: 762.033 },
    { id_linea: "L-USD", id_venta: "V-USD", id_producto: "P-USD", cantidad: 1, precio_unitario: 100 },
  ],
  movimientosInventario: [],
};

const resultado = analiticaVentas(dataset);

assert.equal(resultado.monedaPedidoDisponible, true);
assert.deepEqual(resultado.pedidosPorMoneda, { GTQ: 1, USD: 1 });
assert.deepEqual(resultado.ventaOriginalPorMoneda, { GTQ: 762.03, USD: 100 });
assert.equal(resultado.vendidoOdoo, 1524.06, "USD debe normalizarse a GTQ con la tasa declarada");
assert.equal(resultado.precioLista, 1524.07, "las líneas deben usar la moneda de su pedido");
assert.equal(resultado.topClientes[0].valor, 762.03);
assert.equal(resultado.topClientes[1].valor, 762.03);

const sinMoneda: Dataset = {
  ...dataset,
  ventas: dataset.ventas?.map((venta) => ({ ...venta, moneda_id: null })),
};
assert.equal(analiticaVentas(sinMoneda).monedaPedidoDisponible, false);

console.log("✓ moneda de ventas: GTQ y USD se normalizan sin mezclar importes crudos");
