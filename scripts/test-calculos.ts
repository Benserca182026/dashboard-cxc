// Pruebas de la lógica de cálculo contra los TOTALES DE CONTROL documentados
// en paso-5-datos-ficticios.md (dataset base, $7,700.00) y paso-6-aging.md
// (casos límite de bucket y fixture extendido, $7,708.00 clasificable).
// Ejecutar con: npm test

import assert from "node:assert/strict";
import { datosDemo, FECHA_CORTE_DEFAULT } from "../lib/datos";
import {
  bucketDeDias,
  calcularAging,
  diasAtraso,
  estadoFacturaDerivado,
  saldoPendiente,
} from "../lib/calculos";
import type { Dataset, Factura } from "../lib/types";

let pruebas = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  pruebas++;
  console.log(`  ✅ ${nombre}`);
}

console.log("\n— Paso 5: saldos por factura (sección 4 del documento) —");

const f = (id: string): Factura =>
  datosDemo.facturas.find((x) => x.id_factura === id)!;
const saldo = (id: string) =>
  saldoPendiente(f(id), datosDemo.pagos, datosDemo.notasCredito);

prueba("FAC-1001 saldo 1000.00 (sin pagos ni notas)", () =>
  assert.equal(saldo("FAC-1001"), 1000)
);
prueba("FAC-1003 saldo 1000.00 (pago parcial de 500 resta)", () =>
  assert.equal(saldo("FAC-1003"), 1000)
);
prueba("FAC-1004 saldo 0.00 (pago completo)", () =>
  assert.equal(saldo("FAC-1004"), 0)
);
prueba("FAC-1005 saldo 2500.00 (nota de crédito RESTA, no suma)", () =>
  assert.equal(saldo("FAC-1005"), 2500)
);

console.log("\n— Paso 4 §2.1: estados derivados —");

const estado = (id: string) =>
  estadoFacturaDerivado(f(id), datosDemo.pagos, datosDemo.notasCredito, datosDemo.disputas);

prueba("FAC-1004 derivada a `pagada` (saldo 0 tras recálculo)", () =>
  assert.equal(estado("FAC-1004"), "pagada")
);
prueba("FAC-1006 derivada a `disputada` (DIS-4001 activa es fuente de verdad)", () =>
  assert.equal(estado("FAC-1006"), "disputada")
);
prueba("FAC-1002 permanece `abierta`", () => assert.equal(estado("FAC-1002"), "abierta"));

console.log("\n— Paso 5 §5: totales de control del dataset base —");

const aging = calcularAging(datosDemo, FECHA_CORTE_DEFAULT);

prueba("Saldo total clasificado = $7,700.00 (total autoritativo)", () =>
  assert.equal(aging.totalClasificado, 7700)
);
prueba("Bucket actual = $3,500.00 (FAC-1001 + FAC-1005)", () =>
  assert.equal(aging.totalesPorBucket["actual"], 3500)
);
prueba("Bucket 1-30 = $0.00", () => assert.equal(aging.totalesPorBucket["1-30"], 0));
prueba("Bucket 31-60 = $2,200.00 (FAC-1003 + FAC-1006)", () =>
  assert.equal(aging.totalesPorBucket["31-60"], 2200)
);
prueba("Bucket 61-90 = $2,000.00 (FAC-1002, 70 días)", () =>
  assert.equal(aging.totalesPorBucket["61-90"], 2000)
);
prueba("Bucket 90+ = $0.00", () => assert.equal(aging.totalesPorBucket["90+"], 0));
prueba("FAC-1004 excluida del aging con motivo `pagada`", () => {
  const ex = aging.excluidas.find((e) => e.factura.id_factura === "FAC-1004");
  assert.ok(ex && ex.motivo === "pagada");
});
prueba("Disputada FAC-1006 SÍ entra al aging (bucket 31-60, 31 días)", () => {
  const c = aging.clasificadas.find((x) => x.factura.id_factura === "FAC-1006");
  assert.ok(c && c.bucket === "31-60" && c.dias === 31 && c.estado === "disputada");
});

console.log("\n— Paso 6 §3.2: bordes exactos de bucket (DEMO-1007 a DEMO-1013) —");

const bordes: Array<[string, number, string]> = [
  ["2026-08-10", 0, "actual"],
  ["2026-07-11", 30, "1-30"],
  ["2026-07-10", 31, "31-60"],
  ["2026-06-11", 60, "31-60"],
  ["2026-06-10", 61, "61-90"],
  ["2026-05-12", 90, "61-90"],
  ["2026-05-11", 91, "90+"],
];
for (const [vence, diasEsperados, bucketEsperado] of bordes) {
  prueba(`vence ${vence} → ${diasEsperados} días → bucket ${bucketEsperado}`, () => {
    const dias = diasAtraso(FECHA_CORTE_DEFAULT, vence);
    assert.equal(dias, diasEsperados);
    assert.equal(bucketDeDias(dias), bucketEsperado);
  });
}

console.log("\n— Paso 6 §4: fixture extendido (16 facturas, conciliación) —");

// Se reconstruye el fixture del Paso 6: dataset base + 10 facturas DEMO.
const facturaLimite = (id: string, vence: string | null, monto = 1): Factura => ({
  id_factura: id,
  id_cliente: "CLI-001",
  numero_factura: id,
  fecha_emision: "2026-04-01",
  fecha_vencimiento: vence,
  monto_original: monto,
  moneda_id: "USD",
  estado_factura: "abierta",
});

const fixture: Dataset = {
  ...datosDemo,
  facturas: [
    ...datosDemo.facturas,
    facturaLimite("DEMO-1007", "2026-08-10"),
    facturaLimite("DEMO-1008", "2026-07-11"),
    facturaLimite("DEMO-1009", "2026-07-10"),
    facturaLimite("DEMO-1010", "2026-06-11"),
    facturaLimite("DEMO-1011", "2026-06-10"),
    facturaLimite("DEMO-1012", "2026-05-12"),
    facturaLimite("DEMO-1013", "2026-05-11"),
    facturaLimite("DEMO-1014", null), // sin fecha: excluida, saldo 1.00 reportado
    { ...facturaLimite("DEMO-1015", "2026-06-01", 500) }, // se paga completa abajo
    { ...facturaLimite("DEMO-1016", "2026-10-01"), fecha_emision: "2026-09-01" },
  ],
  pagos: [
    ...datosDemo.pagos,
    {
      id_pago: "PAG-DEMO-1015",
      id_factura: "DEMO-1015",
      id_cliente: "CLI-001",
      fecha_pago: "2026-06-05",
      monto_pago: 500,
      moneda_id: "USD",
      estado_aplicacion: "aplicado",
    },
  ],
  disputas: [
    ...datosDemo.disputas,
    // DIS-4002: disputa ACTIVA sobre factura ya pagada — no debe reabrirla.
    {
      id_disputa: "DIS-4002",
      id_factura: "DEMO-1015",
      id_cliente: "CLI-001",
      fecha_apertura: "2026-07-01",
      fecha_resolucion: null,
      motivo_disputa: "Reclamo ficticio posterior al pago",
      monto_disputado: 500,
      estado_disputa: "abierta",
    },
  ],
};

const agingFixture = calcularAging(fixture, FECHA_CORTE_DEFAULT);

prueba("Suma de buckets del fixture = $7,708.00 (Paso 6 §4.4)", () =>
  assert.equal(agingFixture.totalClasificado, 7708)
);
prueba("Saldo no clasificable = $1.00 — exactamente DEMO-1014 (Paso 6 §4.2)", () => {
  assert.equal(agingFixture.saldoNoClasificable, 1);
  const ex = agingFixture.excluidas.find((e) => e.factura.id_factura === "DEMO-1014");
  assert.ok(ex && ex.motivo === "sin_fecha_vencimiento" && ex.saldo === 1);
});
prueba("Saldo total del fixture = $7,709.00 (clasificado + no clasificable)", () =>
  assert.equal(agingFixture.totalClasificado + agingFixture.saldoNoClasificable, 7709)
);
prueba("DEMO-1015: pagada + disputa activa NO la reintroduce al aging (Paso 4 §2.1)", () => {
  const ex = agingFixture.excluidas.find((e) => e.factura.id_factura === "DEMO-1015");
  assert.ok(ex && ex.motivo === "pagada" && ex.saldo === 0);
});
prueba("DEMO-1016: clasifica en `actual` CON advertencia de corte anterior a emisión", () => {
  const c = agingFixture.clasificadas.find((x) => x.factura.id_factura === "DEMO-1016");
  assert.ok(c && c.bucket === "actual" && c.advertenciaCorteAnterior);
});
prueba("Bucket actual del fixture = $3,502.00 (Paso 6 §4.4)", () =>
  assert.equal(agingFixture.totalesPorBucket["actual"], 3502)
);
prueba("Bucket 31-60 del fixture = $2,202.00", () =>
  assert.equal(agingFixture.totalesPorBucket["31-60"], 2202)
);
prueba("Bucket 61-90 del fixture = $2,002.00", () =>
  assert.equal(agingFixture.totalesPorBucket["61-90"], 2002)
);

console.log("\n— Parametrización de fecha de corte (Paso 6 §6) —");

prueba("FAC-1002 con corte 2026-09-15 → 106 días → bucket 90+", () => {
  const dias = diasAtraso("2026-09-15", "2026-06-01");
  assert.equal(dias, 106);
  assert.equal(bucketDeDias(dias), "90+");
});

console.log(`\n${pruebas} pruebas pasaron. Totales de control de Pasos 5 y 6 verificados.\n`);
