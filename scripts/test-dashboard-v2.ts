import fixture from "../fixtures/dashboard-v2.json";
import controlesOdoo from "../fixtures/cifras-odoo.json";

const modulos = ["resumen", "ventas", "aging", "inventario", "forecast", "prioritarios", "seguimiento", "datos"];
const errores: string[] = [];

if (fixture.coverage.complete + fixture.coverage.partial + fixture.coverage.blocked !== fixture.coverage.total) {
  errores.push("La cobertura V2 no suma el total declarado.");
}

const keys = fixture.metrics.map((m) => m.key);
if (new Set(keys).size !== keys.length) errores.push("Hay metric keys repetidas.");

for (const modulo of modulos) {
  const metricas = fixture.metrics.filter((m) => m.module === modulo);
  const insights = fixture.insights.filter((i) => i.module === modulo);
  if (metricas.length < 4) errores.push(`${modulo}: necesita al menos cuatro KPIs.`);
  if (insights.length < 2) errores.push(`${modulo}: necesita al menos dos hallazgos de agentes.`);
}

for (const metrica of fixture.metrics) {
  if (!metrica.definition || !metrica.sourceModel || !metrica.sourceFilter || !metrica.action) {
    errores.push(`${metrica.key}: trazabilidad incompleta.`);
  }
  if (metrica.status === "blocked" && metrica.numericValue !== null) {
    errores.push(`${metrica.key}: un KPI bloqueado no puede publicar valor numérico.`);
  }
}

const controlUnidades = controlesOdoo.cifras.inventario_unidades_totales;
const controlValor = controlesOdoo.cifras.inventario_valor_costo_total;
const resumenInventario = fixture.metrics.find((m) => m.key === "resumen_inventario");
const inventarioUnidades = fixture.metrics.find((m) => m.key === "inventario_unidades");
const inventarioValor = fixture.metrics.find((m) => m.key === "inventario_valor");
const inventarioDias = fixture.metrics.find((m) => m.key === "inventario_dias");
const inventarioOverstock = fixture.metrics.find((m) => m.key === "inventario_overstock");

if (resumenInventario?.numericValue !== controlValor.valor || !resumenInventario.comparison.includes(String(controlUnidades.valor.toLocaleString("en-US")))) {
  errores.push("resumen_inventario: debe coincidir con los controles Odoo locales de valor y unidades.");
}
if (!resumenInventario?.comparison.includes(controlValor.fecha_captura ?? "") || resumenInventario.comparison.includes("240")) {
  errores.push("resumen_inventario: debe declarar el corte 2026-08-19 y no mezclar los 240 días no reproducibles.");
}
if (inventarioUnidades?.numericValue !== controlUnidades.valor || inventarioValor?.numericValue !== controlValor.valor) {
  errores.push("inventario: existencia y valoración deben coincidir con sus dos controles Odoo independientes.");
}
for (const metrica of [inventarioDias, inventarioOverstock]) {
  if (!metrica || metrica.status !== "blocked" || metrica.numericValue !== null) {
    errores.push(`${metrica?.key ?? "inventario bloqueado"}: una cifra no reproducible debe quedar bloqueada y sin valor numérico.`);
  }
}

for (const accion of fixture.actions) {
  if (!accion.owner || !accion.dueLabel || accion.modules.length === 0) {
    errores.push(`${accion.key}: acción sin responsable, fecha o módulo.`);
  }
}

if (errores.length) {
  console.error(errores.join("\n"));
  process.exit(1);
}

console.log(`Dashboard V2: ${fixture.metrics.length} KPIs, ${fixture.actions.length} acciones y ${fixture.insights.length} hallazgos validados.`);
