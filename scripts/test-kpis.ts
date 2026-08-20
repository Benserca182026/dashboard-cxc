// Pruebas de los KPIs de gestión (Paso 7) contra TOTALES CALCULADOS A MANO
// sobre el dataset demo del Paso 5, con corte 2026-08-10.
// Ejecutar con: npm test (encadenado tras test-calculos.ts)
//
// Cuentas manuales de referencia (corte 2026-08-10):
//   Saldos: 1001→1000 · 1002→2000 · 1003→1000 · 1004→0 · 1005→2500 · 1006→1200
//   Días:   1001→−22  · 1002→70   · 1003→40   ·          1005→−5   · 1006→31

import assert from "node:assert/strict";
import { datosDemo, FECHA_CORTE_DEFAULT } from "../lib/datos";
import {
  antiguedadPonderada,
  calcularDso,
  concentracionRiesgo,
  efectividadCobro,
} from "../lib/kpis";
import type { Dataset } from "../lib/types";

let pruebas = 0;
function prueba(nombre: string, fn: () => void) {
  fn();
  pruebas++;
  console.log(`  ✅ ${nombre}`);
}

console.log("\n— Paso 7 · DSO (ventana 90 días) —");

const dso = calcularDso(datosDemo, FECHA_CORTE_DEFAULT);
prueba("ventana = 2026-05-12 → 2026-08-10", () => {
  assert.equal(dso.desde, "2026-05-12");
  assert.equal(dso.hasta, "2026-08-10");
});
prueba("facturado en ventana = $6,700 (1001+1003+1005+1006; 1002 y 1004 emitidas antes)", () => {
  assert.equal(dso.facturadoVentana, 6700);
  assert.equal(dso.facturasVentana.length, 4);
});
prueba("cartera pendiente = $7,700 (total de control del Paso 5)", () =>
  assert.equal(dso.carteraPendiente, 7700)
);
prueba("DSO = 7700 ÷ 6700 × 90 = 103.43 días (a mano: 693000/6700)", () =>
  assert.equal(dso.dso, 103.43)
);
prueba("sin facturación en ventana → DSO null (se reporta, no se inventa)", () => {
  const vacio: Dataset = { ...datosDemo, facturas: [] };
  assert.equal(calcularDso(vacio, FECHA_CORTE_DEFAULT).dso, null);
});

console.log("\n— Paso 7 · Antigüedad ponderada por monto —");

const ant = antiguedadPonderada(datosDemo, FECHA_CORTE_DEFAULT);
prueba("aportes a mano: 2000×70 + 1000×40 + 1200×31 = 217,200 (no vencidas computan 0)", () =>
  assert.equal(ant.totalPonderado, 217200)
);
prueba("ponderada = 217200 ÷ 7700 = 28.21 días", () => assert.equal(ant.ponderada, 28.21));
prueba("simple = (0+70+40+0+31) ÷ 5 = 28.2 días", () => assert.equal(ant.simple, 28.2));

// El caso que JUSTIFICA la ponderación: una factura grande muy atrasada entre
// muchas chicas al día. El promedio simple dice "cartera joven"; el monto dice
// lo contrario. Si ambos promedios coincidieran, este caso no probaría nada.
prueba("fixture sesgo: 1×$10,000 a 100 días + 10×$100 al día → ponderada 90.91, simple 9.09", () => {
  const base = datosDemo.facturas[0];
  const fixture: Dataset = {
    ...datosDemo,
    pagos: [],
    notasCredito: [],
    disputas: [],
    facturas: [
      { ...base, id_factura: "FX-GRANDE", numero_factura: "FX-GRANDE", monto_original: 10000, fecha_vencimiento: "2026-05-02" }, // 100 días al corte
      ...Array.from({ length: 10 }, (_, i) => ({
        ...base,
        id_factura: `FX-CHICA-${i}`,
        numero_factura: `FX-CHICA-${i}`,
        monto_original: 100,
        fecha_vencimiento: "2026-08-10", // día 0 → actual
      })),
    ],
  };
  const r = antiguedadPonderada(fixture, FECHA_CORTE_DEFAULT);
  assert.equal(r.ponderada, 90.91); // 1,000,000 ÷ 11,000
  assert.equal(r.simple, 9.09);    // 100 ÷ 11
  assert.ok(r.ponderada! > r.simple! * 9, "la ponderada debe desmentir al promedio simple");
});

console.log("\n— Paso 7 · Efectividad de cobro (ventana 60 días) —");

const efe = efectividadCobro(datosDemo, FECHA_CORTE_DEFAULT);
prueba("ventana = 2026-06-11 → 2026-08-10", () => assert.equal(efe.desde, "2026-06-11"));
prueba("vencía en ventana = $2,700 (FAC-1003 $1,500 + FAC-1006 $1,200)", () => {
  assert.equal(efe.montoQueVencia, 2700);
  assert.equal(efe.facturasQueVencian.length, 2);
});
prueba("cobrado en ventana = $500 (PAG-2001; PAG-2002 es de mayo, queda fuera)", () =>
  assert.equal(efe.cobradoVentana, 500)
);
prueba("efectividad = 500 ÷ 2700 = 18.52%", () => assert.equal(efe.efectividadPct, 18.52));
prueba("nada vencía → null (0/0 no se disfraza de porcentaje)", () => {
  const sinVencimientos: Dataset = {
    ...datosDemo,
    facturas: datosDemo.facturas.map((f) => ({ ...f, fecha_vencimiento: "2027-01-01" })),
  };
  assert.equal(efectividadCobro(sinVencimientos, FECHA_CORTE_DEFAULT).efectividadPct, null);
});

console.log("\n— Paso 7 · Concentración del riesgo —");

const con = concentracionRiesgo(datosDemo, FECHA_CORTE_DEFAULT);
prueba("saldos por cliente a mano: Alfa 3000 · Gamma 2500 · Delta 1200 · Beta 1000", () => {
  assert.deepEqual(
    con.porCliente.map((c) => [c.id_cliente, c.saldo]),
    [["CLI-001", 3000], ["CLI-003", 2500], ["CLI-004", 1200], ["CLI-002", 1000]]
  );
});
prueba("mayor concentración = Comercializadora Ficticia Alfa con 38.96%", () => {
  assert.equal(con.mayorCliente?.id_cliente, "CLI-001");
  assert.equal(con.mayorPct, 38.96); // 3000 ÷ 7700
});
prueba("los porcentajes del desglose suman ≈100 (38.96+32.47+15.58+12.99)", () => {
  const suma = con.porCliente.reduce((s, c) => s + c.pct, 0);
  assert.ok(Math.abs(suma - 100) < 0.05, `suma=${suma}`);
});

console.log(`\n${pruebas} pruebas del Paso 7 pasaron. Fórmulas implementadas — PENDIENTES DE VALIDACIÓN POR FINANZAS.\n`);
