// Pruebas de la cadena Ventas↔Inventario↔CxC (Paso 11) contra CUENTAS A MANO.
//
// Cuentas de referencia:
//   Existencias: A 60−10−5−12=33 · B 20−8=12 · C 50−25−20=5 (≤15 BAJO) · D 10−6=4
//   Ventas: 9001=1000 · 9002=2000 · 9003=25×40+5×100=1500 · 9004=800 · 9005=3000 · 9006=1200
//   Total vendido 9,500 = total facturado 9,500 → cuadre exacto
//   Margen 9003: 1500 − (25×22 + 5×60) = 1500 − 850 = 650 (43.33%)
//   Valor inventario a costo: 33×60 + 12×150 + 5×22 + 4×320 = 5,170

import assert from "node:assert/strict";
import { datosDemo } from "../lib/datos";
import { fmtMoneda } from "../lib/calculos";
import {
  cadenaDeFactura,
  cuadreVentasFacturacion,
  hayCadena,
  salidasSinVenta,
  stockPorProducto,
  ventasConTotal,
} from "../lib/cadena";
import type { Dataset } from "../lib/types";

let pruebas = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  pruebas++;
  console.log(`  ✅ ${nombre}`);
}

console.log("\n— Paso 11 · Inventario: existencia = Σ movimientos —");

const stock = stockPorProducto(datosDemo);
const st = (id: string) => stock.find((s) => s.producto.id_producto === id)!;

prueba("PRD-A: 60 −10 −5 −12 = 33 (sobre mínimo 20)", () => {
  assert.equal(st("PRD-A").existencia, 33);
  assert.equal(st("PRD-A").bajoMinimo, false);
});
prueba("PRD-C: 50 −25 −20 = 5 → BAJO MÍNIMO (15)", () => {
  assert.equal(st("PRD-C").existencia, 5);
  assert.equal(st("PRD-C").bajoMinimo, true);
});
prueba("PRD-B 12 · PRD-D 4", () => {
  assert.equal(st("PRD-B").existencia, 12);
  assert.equal(st("PRD-D").existencia, 4);
});
prueba("valor a costo total = 1,980+1,800+110+1,280 = $5,170", () =>
  assert.equal(stock.reduce((s, x) => s + x.valorCosto, 0), 5170)
);
prueba("kardex de PRD-C: 3 movimientos que suman la existencia", () => {
  const k = st("PRD-C").movimientos;
  assert.equal(k.length, 3);
  assert.equal(k.reduce((s, m) => s + m.cantidad, 0), 5);
});
prueba("toda salida tiene su venta de origen (0 salidas huérfanas)", () =>
  assert.equal(salidasSinVenta(datosDemo).length, 0)
);

console.log("\n— Paso 11 · Ventas: total = Σ líneas, nunca tecleado —");

const ventas = ventasConTotal(datosDemo);
const vta = (id: string) => ventas.find((v) => v.id_venta === id)!;

prueba("VTA-9003: 25×$40 + 5×$100 = $1,500 (dos líneas, dos productos)", () => {
  assert.equal(vta("VTA-9003").total, 1500);
  assert.equal(vta("VTA-9003").lineas.length, 2);
});
prueba("margen VTA-9003 = 1,500 − 850 = $650 (43.33%)", () => {
  assert.equal(vta("VTA-9003").margen, 650);
  assert.equal(vta("VTA-9003").margenPct, 43.33);
});
prueba("total vendido = $9,500", () =>
  assert.equal(ventas.reduce((s, v) => s + v.total, 0), 9500)
);
prueba("cada venta apunta a su factura (VTA-9003 → FAC-1003)", () =>
  assert.equal(vta("VTA-9003").id_factura, "FAC-1003")
);

console.log("\n— Paso 11 · El cuadre: la alarma de la juntura —");

const cuadre = cuadreVentasFacturacion(datosDemo);
prueba("vendido $9,500 = facturado $9,500 → diferencia 0", () => {
  assert.equal(cuadre.totalVendido, 9500);
  assert.equal(cuadre.totalFacturado, 9500);
  assert.equal(cuadre.diferencia, 0);
  assert.ok(cuadre.cuadra);
});
prueba("cadena rota A PROPÓSITO (sin FAC-1003) → descuadre EXACTO de +$1,500", () => {
  const roto: Dataset = {
    ...datosDemo,
    facturas: datosDemo.facturas.filter((f) => f.id_factura !== "FAC-1003"),
  };
  const c = cuadreVentasFacturacion(roto);
  assert.equal(c.diferencia, 1500); // el monto, no un booleano mudo
  assert.equal(c.cuadra, false);
});
prueba("dataset solo-CxC (sin cadena) → hayCadena false, módulos avisan en vez de romper", () => {
  const soloCxc: Dataset = { ...datosDemo, productos: [], ventas: [], ventaLineas: [], movimientosInventario: [] };
  assert.equal(hayCadena(soloCxc), false);
});

console.log("\n— Paso 11 · El cruce: una operación de punta a punta —");

const cadena = cadenaDeFactura(datosDemo, "FAC-1003", fmtMoneda)!;
prueba("FAC-1003 atraviesa los tres módulos (Inventario, Ventas y CxC presentes)", () => {
  const modulos = new Set(cadena.pasos.map((p) => p.modulo));
  assert.deepEqual([...modulos].sort(), ["CxC", "Inventario", "Ventas"]);
});
prueba("ciclo: entrada 2026-03-01 → cobro 2026-07-20 = 141 días (92 bodega + 30 crédito + 19 atraso)", () =>
  assert.equal(cadena.cicloDias, 141)
);
prueba("saldo hoy de FAC-1003 = $1,000 (el mismo que CxC deriva)", () =>
  assert.equal(cadena.saldoHoy, 1000)
);
prueba("los pasos vienen ordenados por fecha (la historia se lee de corrido)", () => {
  const fechas = cadena.pasos.map((p) => p.fecha);
  assert.deepEqual(fechas, [...fechas].sort());
});

console.log(`\n${pruebas} pruebas del Paso 11 pasaron. La cadena cuadra por construcción.\n`);
