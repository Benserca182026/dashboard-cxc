// Verifica el output real de construirAgingB18() ya con los cambios
// aplicados -- imprime las 16 tarjetas (4 categorias x 4 roles) tal como las
// veria el molde. Mismo patron que scripts/verificar-prioritarios-nuevo.ts.
//   npx tsx scripts/verificar-aging-nuevo.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { construirAgingB18 } from "../lib/agentes-aging-b18";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const dataset = await cargarDatasetReal();
  const contrato = construirAgingB18(dataset, FECHA_CORTE_DATOS_REALES, [], fmt);
  for (const categoria of contrato.categorias) {
    console.log("=".repeat(78));
    console.log(`${categoria.sigla} · ${categoria.nombre}`);
    console.log(`problema (categoria): ${categoria.problema}`);
    console.log(`cobertura: ${categoria.cobertura.toFixed(2)}% -- ${categoria.coberturaEtiqueta}`);
    console.log("=".repeat(78));
    for (const t of categoria.tarjetas) {
      console.log(`\n[${t.id}] grafica=${t.grafica} donaPct=${t.donaPct ?? "-"}`);
      console.log(`  kpiTexto: ${t.kpiTexto}`);
      console.log(`  etiqueta: ${t.etiqueta}`);
      console.log(`  resumen: ${t.resumen}`);
      console.log(`  problema: ${t.problema}`);
      console.log(`  accion: ${t.accion}`);
    }
    console.log("");
  }
  console.log("=".repeat(78));
  console.log("RESUMEN B18 INTEGRAL");
  console.log("=".repeat(78));
  contrato.resumen.kpis.forEach((k) => console.log(`  ${k.etiqueta}: ${k.valor} (${k.nota})`));
  console.log(`  pie: ${contrato.resumen.pie}`);
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
