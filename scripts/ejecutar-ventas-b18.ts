// Ejecuta la query real (no una versión resumida) contra el dataset real de
// Odoo/Supabase para el mapa B18 de /ventas, y vuelca CADA sub-KPI de los 4
// agentes (Dependencia, Consistencia, Ritmo, Calidad) para cada uno de los 6
// alcances (Todo el período, 2022-2026) — no sólo lo que se ve en pantalla.
// Mismo patrón que ejecutar-clientes.ts, ejecutar-cuadro-mando.ts, etc.
// Se corre con: npx tsx scripts/ejecutar-ventas-b18.ts
import { cargarDatasetReal, FECHA_CORTE_DATOS_REALES } from "../lib/datosReales";
import { construirMapaVentasB18 } from "../lib/agentes-ventas-b18";

const fmt = (n: number) => `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const dataset = await cargarDatasetReal();

  console.log("=".repeat(78));
  console.log(`DATASET: fuente=${dataset.fuente} · FECHA_CORTE_DATOS_REALES=${FECHA_CORTE_DATOS_REALES}`);
  console.log(`ventas totales en el dataset: ${(dataset.ventas ?? []).length}`);
  console.log("=".repeat(78));

  const mapa = construirMapaVentasB18(dataset, fmt);
  console.log(`\nCorte: ${mapa.corte} · Declaración: ${mapa.declaracion}`);
  console.log(`Alcances disponibles: ${mapa.alcances.map((a) => a.etiqueta).join(", ")}\n`);

  for (const alcance of mapa.alcances) {
    console.log("=".repeat(78));
    console.log(`ALCANCE: ${alcance.etiqueta}  (parcial=${alcance.parcial}, sinComparacion=${alcance.sinComparacion}, comparacionRecortada=${alcance.comparacionRecortada})`);
    console.log(`resumen: ${alcance.resumen}`);
    if (alcance.aviso) console.log(`aviso: ${alcance.aviso}`);
    console.log("-".repeat(78));
    for (const sub of alcance.subKpis) {
      console.log(`\n[${sub.id.toUpperCase()}] ${sub.etiqueta}`);
      console.log(`  titulo:     ${sub.titulo}`);
      if (sub.badge) console.log(`  badge:      ${sub.badge.texto} · ${sub.badge.comparativo}`);
      console.log(`  veredicto:  ${sub.veredicto}`);
      console.log(`  detalle:    ${sub.detalle}`);
      console.log(`  robustez:   ${sub.robustez}`);
      if (sub.aviso) console.log(`  aviso:      ${sub.aviso}`);
      if (sub.estadisticas) for (const e of sub.estadisticas) console.log(`  estad.      ${e.etiqueta}: ${e.valor}`);
      if (sub.serie) console.log(`  serie:      ${sub.serie.map((p) => `${p.etiqueta}=${p.texto}`).join(" · ")}`);
    }
    console.log("");
  }

  console.log("=".repeat(78));
  console.log("ESTACIONALIDAD (mismo mes, todos los años)");
  console.log("-".repeat(78));
  for (const fila of mapa.estacionalidad.filas) {
    const celdas = fila.celdas.map((c) => (c.observado ? `${c.anio}=${fmt(c.valor ?? 0)}${c.parcial ? "(parcial)" : ""}` : `${c.anio}=sin dato`));
    console.log(`${fila.etiqueta}: ${celdas.join(" · ")}`);
  }

  // Aritmética cruda mes a mes de 2023 y 2024, para mostrar de dónde sale
  // literalmente el "9 de 12" de Consistencia: monto de cada mes, monto del
  // mismo mes un año antes, y el % que resulta — el mismo cálculo que hace
  // subKpiConsistencia, pero visible línea por línea en vez de resumido.
  console.log("\n" + "=".repeat(78));
  console.log("ARITMÉTICA MES A MES: 2024 contra 2023 (para explicar el '9 de 12')");
  console.log("-".repeat(78));
  const meses2023 = new Map((mapa.mesesPorAnio["2023"] ?? []).map((m) => [m.mes, m]));
  const meses2024 = mapa.mesesPorAnio["2024"] ?? [];
  for (const mActual of meses2024) {
    const mPrevio = meses2023.get(mActual.mes);
    if (!mPrevio) { console.log(`${mActual.etiqueta}: sin mismo mes de 2023 en el histórico`); continue; }
    const variacion = mPrevio.valor > 0 ? ((mActual.valor - mPrevio.valor) / mPrevio.valor) * 100 : null;
    const signo = variacion === null ? "?" : variacion >= 0 ? "ARRIBA" : "ABAJO";
    console.log(
      `${mActual.etiqueta}: ${fmt(mActual.valor)} (2024, ${mActual.pedidos} pedidos) vs ${fmt(mPrevio.valor)} (2023, ${mPrevio.pedidos} pedidos)` +
      ` → (${fmt(mActual.valor)} − ${fmt(mPrevio.valor)}) ÷ ${fmt(mPrevio.valor)} = ${variacion === null ? "sin base" : `${variacion.toFixed(2)}%`} → ${signo}`
    );
  }
}

main().catch((error) => {
  console.error("ERROR:", error);
  process.exitCode = 1;
});
