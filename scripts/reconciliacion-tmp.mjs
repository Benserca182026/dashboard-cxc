import { leerXlsxHoja1 } from "./lib-importacion-odoo.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

const headersBase = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

async function fetchAllRows(table, select, extraQuery = "") {
  let all = [];
  let start = 0;
  const pageSize = 1000;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${extraQuery}`;
    const res = await fetch(url, {
      headers: {
        ...headersBase,
        Range: `${start}-${start + pageSize - 1}`,
        Prefer: "count=exact",
      },
    });
    const contentRange = res.headers.get("content-range");
    const rows = await res.json();
    if (!Array.isArray(rows)) {
      console.error("ERROR response", table, rows);
      break;
    }
    all = all.concat(rows);
    if (rows.length < pageSize) break;
    start += pageSize;
    if (start > 20000) break; // safety
  }
  return all;
}

async function main() {
  // (a) sum saldo_pendiente_odoo of ALL non-null facturas
  const facturas = await fetchAllRows(
    "facturas",
    "id_factura,numero_factura,id_cliente,saldo_pendiente_odoo,monto_original,estado_factura",
    "&saldo_pendiente_odoo=not.is.null"
  );
  const sumSaldoFacturas = facturas.reduce((acc, f) => acc + Number(f.saldo_pendiente_odoo), 0);
  console.log("Facturas con saldo_pendiente_odoo no nulo:", facturas.length);
  console.log("Suma saldo_pendiente_odoo (a):", sumSaldoFacturas.toFixed(2));

  // also get total count of facturas table for sanity
  const allFacturasCountRes = await fetch(`${SUPABASE_URL}/rest/v1/facturas?select=id_factura`, {
    headers: { ...headersBase, Range: "0-0", Prefer: "count=exact" },
  });
  const cr = allFacturasCountRes.headers.get("content-range");
  console.log("content-range facturas (total count):", cr);

  // (b) saldos_odoo where tramo='total'
  const saldosTotal = await fetchAllRows("saldos_odoo", "id_cliente,tramo,monto,fecha_corte", "&tramo=eq.total");
  const sumSaldosTotal = saldosTotal.reduce((acc, s) => acc + Number(s.monto), 0);
  console.log("Filas saldos_odoo tramo=total:", saldosTotal.length);
  console.log("Suma monto saldos_odoo tramo=total (b):", sumSaldosTotal.toFixed(2));

  // ALL saldos_odoo rows (to see what tramos exist)
  const allSaldos = await fetchAllRows("saldos_odoo", "tramo,monto");
  const tramoSums = {};
  for (const s of allSaldos) {
    tramoSums[s.tramo] = (tramoSums[s.tramo] || 0) + Number(s.monto);
  }
  console.log("Todos los tramos en saldos_odoo:", JSON.stringify(tramoSums, null, 2));
  console.log("Total filas saldos_odoo:", allSaldos.length);

  // pagos table - total sum, and count
  const pagos = await fetchAllRows("pagos", "id_pago,id_cliente,id_factura,monto_pago,fecha_pago,estado_aplicacion");
  const sumPagos = pagos.reduce((acc, p) => acc + Number(p.monto_pago || 0), 0);
  console.log("Filas pagos:", pagos.length);
  console.log("Suma monto_pago en pagos (c):", sumPagos.toFixed(2));

  // estado_aplicacion breakdown
  const estadoSums = {};
  const estadoCounts = {};
  for (const p of pagos) {
    const k = p.estado_aplicacion || "(null)";
    estadoSums[k] = (estadoSums[k] || 0) + Number(p.monto_pago || 0);
    estadoCounts[k] = (estadoCounts[k] || 0) + 1;
  }
  console.log("Pagos por estado_aplicacion (suma):", JSON.stringify(estadoSums, null, 2));
  console.log("Pagos por estado_aplicacion (conteo):", JSON.stringify(estadoCounts, null, 2));

  // pagos where id_factura is null (unlinked to a specific invoice) - candidate explanation
  const pagosSinFactura = pagos.filter((p) => p.id_factura === null || p.id_factura === undefined);
  const sumPagosSinFactura = pagosSinFactura.reduce((acc, p) => acc + Number(p.monto_pago || 0), 0);
  console.log("Pagos SIN id_factura (no ligados a factura puntual):", pagosSinFactura.length);
  console.log("Suma de esos pagos sin factura:", sumPagosSinFactura.toFixed(2));

  const pagosConFactura = pagos.filter((p) => p.id_factura !== null && p.id_factura !== undefined);
  const sumPagosConFactura = pagosConFactura.reduce((acc, p) => acc + Number(p.monto_pago || 0), 0);
  console.log("Pagos CON id_factura:", pagosConFactura.length, "suma:", sumPagosConFactura.toFixed(2));

  // Excel resumen vencido-por-cobrar.xlsx sum of "Total" column
  const rutaExcel = "C:/Users/juand/AppData/Local/Temp/claude/C--Users-juand/f8fe8781-28b7-4986-9aac-1f7bba873751/scratchpad/vencido-por-cobrar.xlsx";
  const { encabezados, filas } = leerXlsxHoja1(rutaExcel);
  console.log("Encabezados vencido-por-cobrar.xlsx:", JSON.stringify(encabezados));
  const idxTotal = encabezados.findIndex((h) => String(h).trim().toLowerCase() === "total");
  console.log("Indice columna Total:", idxTotal);
  let sumExcelTotal = 0;
  let filasConTotal = 0;
  for (const fila of filas) {
    const v = fila[idxTotal];
    if (v !== undefined && v !== null && v !== "") {
      const num = Number(v);
      if (!Number.isNaN(num)) {
        sumExcelTotal += num;
        filasConTotal++;
      }
    }
  }
  console.log("Filas con Total valido en excel:", filasConTotal, "de", filas.length);
  console.log("Suma columna Total del excel vencido-por-cobrar.xlsx:", sumExcelTotal.toFixed(2));

  // Print first 3 rows raw for inspection
  console.log("Primeras 3 filas del excel (raw):", JSON.stringify(filas.slice(0, 3)));

  // Difference (a) - (b)
  const diff = sumSaldoFacturas - sumSaldosTotal;
  console.log("\n=== RESUMEN ===");
  console.log("(a) suma saldo_pendiente_odoo facturas:", sumSaldoFacturas.toFixed(2));
  console.log("(b) suma saldos_odoo tramo=total:", sumSaldosTotal.toFixed(2));
  console.log("(a)-(b) diferencia:", diff.toFixed(2));
  console.log("(c) suma total pagos en Supabase:", sumPagos.toFixed(2));
  console.log("(c1) pagos sin id_factura:", sumPagosSinFactura.toFixed(2));
}

main().catch((e) => {
  console.error("FATAL ERROR", e);
  process.exit(1);
});
