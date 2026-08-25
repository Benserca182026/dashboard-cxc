import assert from "node:assert/strict";
import { analiticaInventario } from "../lib/commercial-operacion";
import type { Dataset, MovimientoInventario, Producto } from "../lib/types";

const productosCandidatos: Producto[] = Array.from({ length: 13 }, (_, indice) => ({
  id_producto: `C-${indice + 1}`,
  sku: `C-${indice + 1}`,
  nombre_producto: `Candidato ${indice + 1}`,
  costo_unitario: 1,
  precio_unitario: 2,
  stock_minimo: 0,
}));

const productosSalida: Producto[] = Array.from({ length: 12 }, (_, indice) => ({
  id_producto: `S-${indice + 1}`,
  sku: `S-${indice + 1}`,
  nombre_producto: `Salida ${indice + 1}`,
  costo_unitario: 1,
  precio_unitario: 2,
  stock_minimo: 0,
}));

const productoSinCosto: Producto = {
  id_producto: "S-0",
  sku: "S-0",
  nombre_producto: "Salida sin costo",
  costo_unitario: 0,
  precio_unitario: 2,
  stock_minimo: 0,
};

const entradas: MovimientoInventario[] = productosCandidatos.map((producto, indice) => ({
  id_movimiento: `E-${indice + 1}`,
  id_producto: producto.id_producto,
  fecha: "2026-08-01",
  tipo: "entrada",
  cantidad: 1,
  id_venta: null,
  ubicacion_desde: "Partner Locations/Vendors",
  ubicacion_hasta: "NAC/Stock",
}));

const salidas: MovimientoInventario[] = [...productosSalida, productoSinCosto].map((producto, indice) => ({
  id_movimiento: `S-${indice + 1}`,
  id_producto: producto.id_producto,
  fecha: "2026-08-02",
  tipo: "salida",
  cantidad: -1,
  id_venta: null,
  ubicacion_desde: "NAC/Stock",
  ubicacion_hasta: "Partner Locations/Customers",
}));

const dataset: Dataset = {
  clientes: [],
  facturas: [],
  pagos: [],
  notasCredito: [],
  disputas: [],
  condicionesPago: [],
  fuente: "odoo-real",
  productos: [...productosCandidatos, ...productosSalida, productoSinCosto],
  ventas: [],
  ventaLineas: [],
  movimientosInventario: [...entradas, ...salidas],
};

const resultado = analiticaInventario(dataset);

assert.equal(resultado.candidatosSinSalida, 13, "debe contar la población completa, no sólo el Top 10");
assert.equal(resultado.entradasSinSalida.length, 13, "el helper debe conservar todos los candidatos para agentes y denominadores");
assert.equal(resultado.valorEntradasSinSalida, 13, "el denominador debe cubrir los 13 candidatos");
assert.equal(resultado.productosConSalidaValorizada, 12, "el producto sin costo no puede fingir valor");
assert.equal(
  resultado.distribucionAbc.A + resultado.distribucionAbc.B + resultado.distribucionAbc.C,
  resultado.productosConSalidaValorizada,
  "el ABC debe clasificar toda la población valorizable"
);
assert.equal(resultado.movimientosSalidaSinCosto, 1, "los movimientos con costo cero deben quedar audibles");
assert.equal(resultado.unidadesSalidaSinCosto, 1, "las unidades con costo cero deben quedar audibles");
assert.equal(resultado.salidasSinVenta, resultado.movimientosSalida, "el vínculo de venta ausente debe conservarse como control");
assert.equal(resultado.movimientosConUbicacion, entradas.length + salidas.length, "el adaptador no debe perder ubicaciones presentes");

console.log("Inventario comercial: población, denominadores, ABC, costos y ubicaciones verificados.");
