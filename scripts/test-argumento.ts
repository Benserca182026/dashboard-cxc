// Pruebas del motor de argumentación (rediseño demostrativo).
// Lo que se verifica NO es que "se vea bien", sino que el argumento se DERIVE
// de los datos y no esté escrito: si los datos cambian, la conclusión cambia.
//
// Cuentas de referencia (dataset demo, corte 2026-08-10):
//   Cartera $7,700 · al día $3,500 (45.45%) · tramo 61-90 = $2,000
//   FAC-1002 saldo $2,000, 70 días → es el 100% del tramo 61-90
//   Alfa (CLI-001) $3,000 = 38.96% de la cartera

import assert from "node:assert/strict";
import { datosDemo, FECHA_CORTE_DEFAULT } from "../lib/datos";
import { argumentoDso, argumentoInventario, UMBRALES } from "../lib/argumento";
import type { Dataset } from "../lib/types";

let pruebas = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  pruebas++;
  console.log(`  ✅ ${nombre}`);
}

console.log("\n— Rediseño · argumento del DSO —");

const arg = argumentoDso(datosDemo, FECHA_CORTE_DEFAULT);

prueba("el titular es el DSO calculado, no un texto fijo", () => {
  assert.equal(arg.valorTitular, "103.43 d");
});

prueba("etapa 1 detecta que el 45% al día DESMIENTE lo sistémico", () => {
  const e1 = arg.etapas[0];
  assert.equal(e1.tipo, "objecion");
  assert.ok(e1.titulo.includes("45"), `titulo fue: ${e1.titulo}`);
});

prueba("etapa 2 encuentra a Alfa con 38.96% (sobre el umbral de 35%)", () => {
  const e2 = arg.etapas[1];
  assert.ok(e2.titulo.includes("Alfa"), `titulo fue: ${e2.titulo}`);
  assert.ok(e2.titulo.includes("38.96"));
});

prueba("etapa 3 DESCUBRE que el tramo 61-90 es una sola factura (FAC-1002 = 100%)", () => {
  const e3 = arg.etapas.find((e) => e.tipo === "hallazgo");
  assert.ok(e3, "no encontró el hallazgo");
  assert.ok(e3!.titulo.includes("61-90"), `titulo fue: ${e3!.titulo}`);
  assert.ok(e3!.dato.includes("DEMO-1002"), `dato fue: ${e3!.dato}`);
  assert.ok(e3!.dato.includes("70 días"));
});

prueba("la conclusión termina en un ACTO concreto sobre esa factura", () => {
  assert.ok(arg.accion.includes("DEMO-1002"), `accion fue: ${arg.accion}`);
  assert.equal(arg.sinHallazgo, false);
});

prueba("las barras de la etapa del hallazgo destacan la factura dominante", () => {
  const e3 = arg.etapas.find((e) => e.tipo === "hallazgo")!;
  const destacadas = (e3.barras ?? []).filter((b) => b.destacada);
  assert.equal(destacadas.length, 1);
  assert.equal(destacadas[0].etiqueta, "DEMO-1002");
});

console.log("\n— La conclusión NEGATIVA: el argumento no siempre acusa —");

// Dataset donde el atraso está repartido: sin cliente dominante ni tramo dominado.
// Si el motor igual "encontrara" un culpable, sería una plantilla, no un argumento.
prueba("cartera repartida → NO inventa culpable, concluye en negativo", () => {
  const base = datosDemo.facturas[0];
  const repartido: Dataset = {
    ...datosDemo,
    pagos: [],
    notasCredito: [],
    disputas: [],
    clientes: datosDemo.clientes,
    facturas: [
      // ocho facturas iguales, repartidas entre los cuatro clientes y dos tramos
      ...Array.from({ length: 8 }, (_, i) => ({
        ...base,
        id_factura: `EQ-${i}`,
        numero_factura: `EQ-${i}`,
        id_cliente: datosDemo.clientes[i % 4].id_cliente,
        monto_original: 1000,
        fecha_emision: "2026-05-01",
        fecha_vencimiento: i % 2 === 0 ? "2026-07-05" : "2026-07-01",
      })),
    ],
  };
  const a = argumentoDso(repartido, FECHA_CORTE_DEFAULT);
  assert.equal(a.sinHallazgo, true, "debería concluir sin hallazgo");
  assert.ok(!a.etapas.some((e) => e.tipo === "hallazgo"), "no debe haber etapa de hallazgo");
  assert.ok(/repartido/i.test(a.etapas.at(-1)!.titulo), `conclusión fue: ${a.etapas.at(-1)!.titulo}`);
});

prueba("los umbrales están declarados y son discutibles, no mágicos", () => {
  assert.equal(UMBRALES.concentracionAlta, 35);
  assert.equal(UMBRALES.dominanciaTramo, 60);
  assert.equal(UMBRALES.alDiaSano, 40);
});

console.log("\n— Rediseño · argumento del inventario —");

const inv = argumentoInventario(datosDemo)!;

prueba("el titular es el valor a costo derivado ($5,170)", () => {
  assert.ok(inv.valorTitular.includes("5,170"), `fue: ${inv.valorTitular}`);
});

prueba("descubre FIC-C como el crítico: bajo mínimo Y el más demandado", () => {
  const h = inv.etapas.find((e) => e.tipo === "hallazgo");
  assert.ok(h, "no encontró hallazgo de inventario");
  assert.ok(h!.titulo.includes("FIC-C"), `titulo fue: ${h!.titulo}`);
  assert.ok(inv.accion.includes("FIC-C"));
});

prueba("sin cadena del Paso 11 → devuelve null en vez de inventar", () => {
  const soloCxc: Dataset = { ...datosDemo, productos: [], movimientosInventario: [] };
  assert.equal(argumentoInventario(soloCxc), null);
});

console.log(`\n${pruebas} pruebas del rediseño demostrativo pasaron. El argumento se deriva, no se escribe.\n`);
