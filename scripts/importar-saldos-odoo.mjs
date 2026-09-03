#!/usr/bin/env node
// Importa el reporte "Vencido por cobrar" (Aged Receivable) de Odoo hacia
// saldos_odoo. A diferencia de importar-facturas-odoo.mjs e
// importar-pagos-odoo.mjs, ESTO NO ES MATERIA PRIMA para reconstruir nada:
// es la respuesta YA CALCULADA por Odoo (por cliente, por tramo de
// vencimiento), que sirve para verificar que el cálculo propio de la app
// (a partir de facturas + pagos) da el mismo número. Ver nota en
// _esquema-cxc-real.sql.
//
// Uso:
//   node scripts/importar-saldos-odoo.mjs "C:\ruta\a\vencido-por-cobrar.xlsx"
//
// Formato esperado (export "resumen por cliente", colapsado — NO el
// "detalle" con las facturas individuales abajo de cada cliente): una fila
// por cliente, columnas:
//   "" (nombre) | Due Date | Amount Currency | Currency | Account |
//   Expected Date | "As of: MM/DD/YYYY" | 1 - 30 | 31 - 60 | 61 - 90 |
//   91 - 120 | Older | Total
// Las columnas Due Date/Amount Currency/Currency/Account/Expected Date sólo
// tienen datos en el export "detalle" (por factura); acá vienen vacías.

import { basename } from "node:path";
import {
  leerXlsxHoja1,
  normalizarMonto,
  idClienteDesdeNombre,
  subirEnLotes,
} from "./lib-importacion-odoo.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY;

// tramo destino -> texto que debe CONTENER el encabezado real de esa columna
const COLUMNAS_TRAMO = [
  { tramo: "actual", contiene: "as of:" },
  { tramo: "1-30", contiene: "1 - 30" },
  { tramo: "31-60", contiene: "31 - 60" },
  { tramo: "61-90", contiene: "61 - 90" },
  { tramo: "91-120", contiene: "91 - 120" },
  { tramo: "older", contiene: "older" },
  { tramo: "total", contiene: "total" },
];

function main() {
  const rutaArchivo = process.argv[2];
  if (!rutaArchivo) {
    console.error("Uso: node scripts/importar-saldos-odoo.mjs <ruta-al-xlsx-de-vencido-por-cobrar>");
    process.exit(1);
  }

  console.log(`Leyendo ${basename(rutaArchivo)}...`);
  const { encabezados, filas } = leerXlsxHoja1(rutaArchivo);
  const bajos = encabezados.map((e) => (e ?? "").toLowerCase());

  // fecha de corte: viene EN el texto del encabezado "As of: MM/DD/YYYY"
  const encabezadoCorte = encabezados.find((e) => (e ?? "").toLowerCase().startsWith("as of:"));
  const mFecha = encabezadoCorte && /as of:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(encabezadoCorte);
  if (!mFecha) {
    console.error(
      `No se pudo leer la fecha de corte del encabezado "${encabezadoCorte}". ` +
        "Se esperaba el formato 'As of: MM/DD/YYYY' (así lo exporta Odoo) — revisá el archivo."
    );
    process.exit(1);
  }
  const fechaCorte = `${mFecha[3]}-${mFecha[1].padStart(2, "0")}-${mFecha[2].padStart(2, "0")}`;

  const indices = COLUMNAS_TRAMO.map(({ tramo, contiene }) => {
    const i = bajos.findIndex((b) => b.includes(contiene));
    return { tramo, i };
  });
  const faltantes = indices.filter((x) => x.i === -1);
  if (faltantes.length > 0) {
    console.error(
      "No se encontraron todas las columnas de tramo esperadas: " +
        faltantes.map((f) => f.tramo).join(", ") +
        ". Encabezados vistos: " +
        JSON.stringify(encabezados)
    );
    process.exit(1);
  }
  console.log(`Fecha de corte detectada: ${fechaCorte}`);
  console.log(
    "Columnas de tramo:",
    indices.map(({ tramo, i }) => `${tramo}=col${i}(${encabezados[i]})`).join(" | ")
  );

  const clientesPorId = new Map();
  const saldos = [];
  const descartadas = [];

  filas.forEach((fila, i) => {
    const numeroLinea = i + 2;
    const nombre = String(fila[0] ?? "").trim();
    if (nombre === "" || nombre.toLowerCase() === "total") {
      // fila vacía, o la fila de gran total al final — no es un cliente
      return;
    }
    // Este export "resumen" es una fila por cliente. Si algún día se corre
    // por error el export "detalle" (con las facturas individuales abajo de
    // cada cliente), esas filas de factura tienen número en vez de nombre en
    // la primera columna y Due Date poblado — se descartan, no se inventa
    // a qué cliente pertenecen.
    if (String(fila[1] ?? "").trim() !== "") {
      descartadas.push({ numeroLinea, motivo: `fila de detalle (factura individual), no de cliente: "${nombre}" — usá el export resumen, no el detalle` });
      return;
    }

    const idCliente = idClienteDesdeNombre(nombre);
    if (!clientesPorId.has(idCliente)) {
      clientesPorId.set(idCliente, {
        id_cliente: idCliente,
        nombre_cliente: nombre,
        estado_cliente: "activo",
        fecha_creacion: fechaCorte, // no hay fecha de alta real del cliente en este export
      });
    }

    for (const { tramo, i: iCol } of indices) {
      const monto = normalizarMonto(fila[iCol] ?? "");
      if (monto === null) {
        descartadas.push({ numeroLinea, motivo: `monto ilegible en tramo "${tramo}" para "${nombre}": "${fila[iCol]}"` });
        continue;
      }
      saldos.push({
        id_cliente: idCliente,
        nombre_cliente_odoo: nombre,
        fecha_corte: fechaCorte,
        tramo,
        monto,
        origen: "odoo-vencido-por-cobrar",
      });
    }
  });

  const clientes = [...clientesPorId.values()];

  console.log("");
  console.log("=== Resumen de la transformación (nada subido todavía) ===");
  console.log(`Filas leídas: ${filas.length}`);
  console.log(`Clientes únicos detectados: ${clientes.length}`);
  console.log(`Filas de saldo listas para subir: ${saldos.length} (hasta 7 por cliente: 6 tramos + total)`);
  console.log(`Filas descartadas: ${descartadas.length}`);
  for (const d of descartadas) console.log(`  - línea ${d.numeroLinea}: ${d.motivo}`);

  const totalOdoo = saldos.filter((s) => s.tramo === "total").reduce((acc, s) => acc + s.monto, 0);
  console.log(`Suma de "total" declarada por Odoo (todos los clientes): ${totalOdoo.toFixed(2)}`);

  if (saldos.length === 0) {
    console.log("Nada para subir — no se hizo ninguna llamada a Supabase.");
    return;
  }

  console.log("");
  console.log(`Subiendo a ${SUPABASE_URL} ...`);
  console.log(
    "Nota: id_saldo_odoo es determinista (cliente+tramo+fecha_corte) — recargar el mismo corte " +
      "actualiza en vez de duplicar."
  );
  return (async () => {
    const rClientes = await subirEnLotes("clientes", clientes, {
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_ANON_KEY,
    });
    const rSaldos = await subirEnLotes("saldos_odoo", saldos, {
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_ANON_KEY,
      onConflict: "id_cliente,tramo,fecha_corte",
    });

    console.log("");
    console.log("=== Resumen final ===");
    console.log(
      `clientes: ${rClientes.insertados}/${rClientes.filasEnviadas} filas enviadas en ${rClientes.lotes} lote(s)` +
        (rClientes.errores.length ? ` — ${rClientes.errores.length} lote(s) con error` : "")
    );
    console.log(
      `saldos_odoo: ${rSaldos.insertados}/${rSaldos.filasEnviadas} filas enviadas en ${rSaldos.lotes} lote(s)` +
        (rSaldos.errores.length ? ` — ${rSaldos.errores.length} lote(s) con error` : "")
    );
    if (rClientes.errores.length || rSaldos.errores.length) {
      console.log("Revisá los errores impresos arriba antes de reintentar.");
      process.exitCode = 1;
    }
  })();
}

main();
