#!/usr/bin/env node
// Importa pagos exportados de Odoo (Contabilidad -> Clientes -> Pagos,
// modelo account.payment) hacia Supabase. Script gemelo de
// importar-facturas-odoo.mjs — misma filosofía de validación (lib/csv.ts:
// fecha ambigua se declara, monto no numérico se descarta con motivo), y
// usa la MISMA función idClienteDesdeNombre (importada de
// lib-importacion-odoo.mjs, no redefinida) para que un cliente que aparece
// en el archivo de facturas y en el de pagos caiga en el mismo id_cliente.
//
// Uso:
//   node scripts/importar-pagos-odoo.mjs "C:\ruta\a\pagos-odoo.xlsx"
//
// Columnas esperadas en la hoja 1 (exactamente como las exporta Odoo):
//   Fecha | Número | Diario | Método de pago | Cliente | Importe | Estado
//
// Notas de mapeo (deliberadas, no accidentales):
//   - referencia_pago guarda el valor de "Número" TAL CUAL. Es probable que
//     sea el mismo texto que el número de factura (así se vio en Odoo),
//     pero NO se asume ese vínculo acá: id_factura queda en null para
//     TODOS los pagos. Conectar pago <-> factura es un paso aparte,
//     deliberadamente no resuelto por este script.
//   - "Diario" y "Método de pago" se leen (para el mapeo de columnas) pero
//     no tienen campo destino en Pago (ver lib/types.ts) — no se guardan.
//   - estado_aplicacion se deja "no_aplicado" para TODAS las filas, porque
//     id_factura es null: no tiene sentido declarar un pago "aplicado" sin
//     saber a qué factura se aplicó. Cuando el paso de conciliación
//     factura<->pago exista, ahí se actualiza a "aplicado"/"parcial".

import { basename } from "node:path";
import {
  leerXlsxHoja1,
  autoMapearEncabezados,
  normalizarMonto,
  interpretarColumnaFechas,
  idClienteDesdeNombre,
  idPagoDesdeNumero,
  subirEnLotes,
} from "./lib-importacion-odoo.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://jfvmuemyjcdesnoqeaix.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";

const PALABRAS_CLAVE = {
  numero_pago: ["número", "numero"],
  nombre_cliente: ["cliente"],
  fecha_pago: ["fecha"],
  monto_pago: ["importe", "monto"],
  estado_odoo: ["estado"],
};

function main() {
  const rutaArchivo = process.argv[2];
  if (!rutaArchivo) {
    console.error("Uso: node scripts/importar-pagos-odoo.mjs <ruta-al-xlsx-de-pagos>");
    process.exit(1);
  }

  console.log(`Leyendo ${basename(rutaArchivo)}...`);
  const { encabezados, filas } = leerXlsxHoja1(rutaArchivo);
  const mapeo = autoMapearEncabezados(encabezados, PALABRAS_CLAVE);

  const idx = (campo) => mapeo.indexOf(campo);
  const iNumero = idx("numero_pago");
  const iCliente = idx("nombre_cliente");
  const iFecha = idx("fecha_pago");
  const iImporte = idx("monto_pago");
  const iEstado = idx("estado_odoo");

  console.log(
    "Mapeo detectado:",
    encabezados.map((e, i) => `${e} -> ${mapeo[i]}`).join(" | ")
  );

  if (iNumero === -1 || iCliente === -1 || iFecha === -1 || iImporte === -1) {
    console.error(
      "No se pudieron detectar todas las columnas requeridas (Número, Cliente, Fecha, Importe). " +
        "Revisá los encabezados del archivo — no se asume ningún mapeo por defecto."
    );
    process.exit(1);
  }

  const fechasPago = interpretarColumnaFechas(filas.map((f) => f[iFecha] ?? ""));

  const clientesPorId = new Map();
  const pagos = [];
  const descartadas = [];
  const vistos = new Set(); // dedupe: mismo id_pago dentro de este archivo
  const estadosOdooVistos = new Map();

  filas.forEach((fila, i) => {
    const numeroLinea = i + 2;
    const nombre = String(fila[iCliente] ?? "").trim();
    const numero = String(fila[iNumero] ?? "").trim();
    const estadoOdooTexto = iEstado !== -1 ? String(fila[iEstado] ?? "").trim() : "";

    if (nombre === "") {
      descartadas.push({ numeroLinea, motivo: "sin nombre de cliente" });
      return;
    }
    if (numero === "") {
      descartadas.push({ numeroLinea, motivo: "sin número de pago" });
      return;
    }

    const monto = normalizarMonto(fila[iImporte] ?? "");
    if (monto === null) {
      descartadas.push({ numeroLinea, motivo: `monto ilegible en "Importe": "${fila[iImporte]}"` });
      return;
    }

    const fechaPago = fechasPago[i];
    if (fechaPago === null) {
      descartadas.push({
        numeroLinea,
        motivo: `fecha de pago ilegible o ambigua: "${fila[iFecha]}" (no se inventa)`,
      });
      return;
    }

    const idCliente = idClienteDesdeNombre(nombre);
    const idPago = idPagoDesdeNumero(numero);
    if (vistos.has(idPago)) {
      descartadas.push({
        numeroLinea,
        motivo: `posible duplicado: número de pago "${numero}" ya cargado en este archivo`,
      });
      return;
    }
    vistos.add(idPago);

    if (!clientesPorId.has(idCliente)) {
      clientesPorId.set(idCliente, {
        id_cliente: idCliente,
        nombre_cliente: nombre,
        estado_cliente: "activo",
        fecha_creacion: fechaPago,
      });
    }

    if (estadoOdooTexto !== "") {
      estadosOdooVistos.set(estadoOdooTexto, (estadosOdooVistos.get(estadoOdooTexto) ?? 0) + 1);
    }

    pagos.push({
      id_pago: idPago,
      id_factura: null, // deliberado: la conciliación pago<->factura es un paso aparte
      id_cliente: idCliente,
      fecha_pago: fechaPago,
      monto_pago: monto,
      moneda_id: "GTQ",
      estado_aplicacion: "no_aplicado", // deliberado: no se declara "aplicado" sin id_factura
      referencia_pago: numero, // "Número" tal cual — probablemente el mismo texto que numero_factura
    });
  });

  const clientes = [...clientesPorId.values()];

  console.log("");
  console.log("=== Resumen de la transformación (nada subido todavía) ===");
  console.log(`Filas leídas: ${filas.length}`);
  console.log(`Clientes únicos detectados: ${clientes.length}`);
  console.log(`Pagos listos para subir: ${pagos.length}`);
  console.log(`Filas descartadas: ${descartadas.length}`);
  for (const d of descartadas) console.log(`  - línea ${d.numeroLinea}: ${d.motivo}`);
  if (estadosOdooVistos.size > 0) {
    console.log('Valores de "Estado" vistos en Odoo (informativo, no se mapea a estado_aplicacion):');
    for (const [estado, n] of estadosOdooVistos) console.log(`  - "${estado}": ${n}`);
  }

  if (pagos.length === 0) {
    console.log("Nada para subir — no se hizo ninguna llamada a Supabase.");
    return;
  }

  console.log("");
  console.log(`Subiendo a ${SUPABASE_URL} ...`);
  console.log(
    "Nota: los clientes de este archivo se re-envían con merge-duplicates — si ya existen " +
      "(por ejemplo, cargados por importar-facturas-odoo.mjs) esto no los duplica ni los pisa con datos distintos."
  );
  return (async () => {
    const rClientes = await subirEnLotes("clientes", clientes, {
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_ANON_KEY,
    });
    const rPagos = await subirEnLotes("pagos", pagos, {
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_ANON_KEY,
    });

    console.log("");
    console.log("=== Resumen final ===");
    console.log(
      `clientes: ${rClientes.insertados}/${rClientes.filasEnviadas} filas enviadas en ${rClientes.lotes} lote(s)` +
        (rClientes.errores.length ? ` — ${rClientes.errores.length} lote(s) con error` : "")
    );
    console.log(
      `pagos: ${rPagos.insertados}/${rPagos.filasEnviadas} filas enviadas en ${rPagos.lotes} lote(s)` +
        (rPagos.errores.length ? ` — ${rPagos.errores.length} lote(s) con error` : "")
    );
    if (rClientes.errores.length || rPagos.errores.length) {
      console.log("Revisá los errores impresos arriba antes de reintentar.");
      process.exitCode = 1;
    }
  })();
}

main();
