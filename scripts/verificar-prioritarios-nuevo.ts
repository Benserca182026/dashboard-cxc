// Verifica el output real de construirPrioritariosB18() ya con los cambios
// aplicados -- imprime las 16 tarjetas (4 categorías x 4 roles) tal como las
// vería el molde. npx tsx scripts/verificar-prioritarios-nuevo.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { construirPrioritariosB18 } from "../lib/agentes-prioritarios-b18";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const dataset = await cargarDatasetReal();
  const contrato = construirPrioritariosB18(dataset, FECHA_CORTE_DATOS_REALES, [], fmt);
  for (const categoria of contrato.categorias) {
    console.log("=".repeat(78));
    console.log(`${categoria.sigla} · ${categoria.nombre}`);
    console.log(`problema (categoría): ${categoria.problema}`);
    console.log("=".repeat(78));
    for (const t of categoria.tarjetas) {
      console.log(`\n[${t.id}] grafica=${t.grafica} donaPct=${t.donaPct ?? "—"}`);
      console.log(`  kpiTexto: ${t.kpiTexto}`);
      console.log(`  etiqueta: ${t.etiqueta}`);
      console.log(`  resumen: ${t.resumen}`);
      console.log(`  problema: ${t.problema}`);
      console.log(`  accion: ${t.accion}`);
    }
    console.log("");
  }
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
