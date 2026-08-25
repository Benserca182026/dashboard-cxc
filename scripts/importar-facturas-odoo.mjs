#!/usr/bin/env node
// Importa facturas exportadas de Odoo (Contabilidad -> Clientes -> Facturas,
// modelo account.move) hacia Supabase (proyecto REAL de Benserca 18, no el
// de DataFlow). Mismo patrón de validación que lib/csv.ts (paso M6): fecha
// ilegible o ambigua se declara y NUNCA se inventa, monto no numérico se
// descarta con motivo, nada se asume en silencio.
//
// Uso:
//   node scripts/importar-facturas-odoo.mjs "C:\ruta\a\facturas-odoo.xlsx"
//
// Columnas esperadas en la hoja 1 (exactamente como las exporta Odoo):
//   Número | Serie FEL | Número F... | Cliente | Fecha de facturación |
//   Fecha de vencimiento | Total | Saldo | Estado
//
// Notas de mapeo (deliberadas, no accidentales):
//   - numero_factura viene de "Número" (el número de documento interno de
//     Odoo). "Serie FEL" y "Número F..." (fiscal FEL) no tienen campo
//     destino en Factura (ver lib/types.ts) — se leen pero no se guardan.
//   - monto_original viene de "Total" (monto original de la factura), NO
//     de "Saldo". "Saldo" tampoco se guarda: Factura no tiene ese campo —
//     el saldo pendiente lo calcula la propia app a partir de
//     facturas - pagos - notas de crédito (ver comentario en
//     _esquema-cxc-real.sql sobre saldos_odoo). Traer el Saldo de Odoo acá
//     y el saldo calculado por la app son dos cosas que deben poder
//     comparaRSE, no una que reemplace a la otra.
//   - estado_factura: se deja "abierta" por defecto (estado BASE, no el
//     operativo — ver lib/types.ts). Sólo se mapea a "anulada" cuando el
//     texto de "Estado" de Odoo dice explícitamente cancelado/anulado. No
//     se infiere "pagada" a partir de Saldo == 0: eso sería inventar una
//     regla de negocio que no se pidió. Los valores de Estado no
//     reconocidos se imprimen al final para revisión humana.

import { basename } from "node:path";
import {
  leerXlsxHoja1,
  autoMapearEncabezados,
  normalizarMonto,
  interpretarColumnaFechas,
  idClienteDesdeNombre,
  idFacturaDesdeNumero,
  subirEnLotes,
} from "./lib-importacion-odoo.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://jfvmuemyjcdesnoqeaix.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";

const PALABRAS_CLAVE = {
  // "Número" matchea primero (aparece primero en el archivo) y se queda con
  // numero_factura; "Número F..." (Número FEL) llega después, ese campo ya
  // está usado, y no matchea ningún otro -> cae en "ignorar", como debe ser.
  numero_factura: ["número", "numero"],
  // "socio" cubre el encabezado real de Odoo: "Nombre del socio a mostrar
  // en la factura." — Odoo llama "socio" (partner) al cliente en este
  // reporte, no dice literalmente "cliente". Se verificó que nombre_cliente
  // se resuelve ANTES que fecha_emision en el orden del diccionario, así
  // que esta columna se reclama aquí y no compite con la palabra "factura"
  // que también contiene (ver nota de fecha_emision abajo).
  nombre_cliente: ["cliente", "socio"],
  // El encabezado real es "Fecha de Factura/Recibo", no "facturación". Se
  // agrega "factura" acá — es seguro porque para cuando se procesa ESTA
  // columna, nombre_cliente ya reclamó la columna del socio (contiene
  // "factura" al final de su texto, pero se resuelve antes en el orden del
  // diccionario) y numero_factura no matchea "fecha" en ningún caso.
  fecha_emision: ["facturación", "facturacion", "emisión", "emision", "factura"],
  fecha_vencimiento: ["vencimiento"],
  monto_original: ["total"],
  saldo_pendiente_odoo: ["adeudado"],
  estado_odoo: ["estado"],
};

function main() {
  const rutaArchivo = process.argv[2];
  if (!rutaArchivo) {
    console.error("Uso: node scripts/importar-facturas-odoo.mjs <ruta-al-xlsx-de-facturas>");
    process.exit(1);
  }

  console.log(`Leyendo ${basename(rutaArchivo)}...`);
  const { encabezados, filas } = leerXlsxHoja1(rutaArchivo);
  const mapeo = autoMapearEncabezados(encabezados, PALABRAS_CLAVE);

  const idx = (campo) => mapeo.indexOf(campo);
  const iNumero = idx("numero_factura");
  const iCliente = idx("nombre_cliente");
  const iEmision = idx("fecha_emision");
  const iVence = idx("fecha_vencimiento");
  const iTotal = idx("monto_original");
  const iSaldoOdoo = idx("saldo_pendiente_odoo");
  const iEstado = idx("estado_odoo");

  console.log(
    "Mapeo detectado:",
    encabezados.map((e, i) => `${e} -> ${mapeo[i]}`).join(" | ")
  );

  if (iNumero === -1 || iCliente === -1 || iEmision === -1 || iTotal === -1) {
    console.error(
      "No se pudieron detectar todas las columnas requeridas (Número, Cliente, Fecha de facturación, Total). " +
        "Revisá los encabezados del archivo — no se asume ningún mapeo por defecto."
    );
    process.exit(1);
  }

  // Fechas: se interpretan por columna completa (serial de Excel o texto,
  // con orden D/M vs M/D detectado una sola vez sobre toda la columna).
  const fechasEmision = interpretarColumnaFechas(filas.map((f) => f[iEmision] ?? ""));
  const fechasVencimiento =
    iVence !== -1 ? interpretarColumnaFechas(filas.map((f) => f[iVence] ?? "")) : filas.map(() => null);

  const clientesPorId = new Map();
  const facturas = [];
  const descartadas = [];
  const vistos = new Set(); // dedupe: mismo (id_cliente, numero_factura) dentro de este archivo
  let sinFechaVencimiento = 0;
  const estadosOdooVistos = new Map();

  filas.forEach((fila, i) => {
    const numeroLinea = i + 2; // +1 encabezado, +1 índice base 1
    const nombre = String(fila[iCliente] ?? "").trim();
    const numero = String(fila[iNumero] ?? "").trim();
    const estadoOdooTexto = iEstado !== -1 ? String(fila[iEstado] ?? "").trim() : "";

    if (nombre === "") {
      descartadas.push({ numeroLinea, motivo: "sin nombre de cliente" });
      return;
    }
    if (numero === "" || numero === "/") {
      // Odoo usa "/" como número cuando la factura sigue en borrador y
      // todavía no se le asignó numeración de la secuencia fiscal. Se trata
      // igual que "sin número": no se inventa un número, y evita que varias
      // facturas en borrador de clientes distintos generen el mismo
      // id_factura (todas comparten el mismo texto "/").
      descartadas.push({ numeroLinea, motivo: "sin número de factura (Odoo aún no lo asignó — factura en borrador)" });
      return;
    }

    const monto = normalizarMonto(fila[iTotal] ?? "");
    if (monto === null) {
      descartadas.push({ numeroLinea, motivo: `monto ilegible en "Total": "${fila[iTotal]}"` });
      return;
    }

    const fechaEmision = fechasEmision[i];
    if (fechaEmision === null) {
      descartadas.push({
        numeroLinea,
        motivo: `fecha de facturación ilegible o ambigua: "${fila[iEmision]}" (no se inventa)`,
      });
      return;
    }

    const idCliente = idClienteDesdeNombre(nombre);
    const idFactura = idFacturaDesdeNumero(numero);
    const claveUnica = `${idCliente}|${numero}`;
    if (vistos.has(claveUnica)) {
      descartadas.push({
        numeroLinea,
        motivo: `posible duplicado: (${nombre}, ${numero}) ya cargado en este archivo`,
      });
      return;
    }
    vistos.add(claveUnica);

    if (!clientesPorId.has(idCliente)) {
      clientesPorId.set(idCliente, {
        id_cliente: idCliente,
        nombre_cliente: nombre,
        estado_cliente: "activo",
        fecha_creacion: fechaEmision, // no hay fecha de alta real del cliente en este export
      });
    }

    const fechaVencimiento = fechasVencimiento[i];
    if (fechaVencimiento === null) sinFechaVencimiento++;

    if (estadoOdooTexto !== "") {
      estadosOdooVistos.set(estadoOdooTexto, (estadosOdooVistos.get(estadoOdooTexto) ?? 0) + 1);
    }
    const eBajo = estadoOdooTexto.toLowerCase();
    const estadoFactura = eBajo.includes("cancel") || eBajo.includes("anula") ? "anulada" : "abierta";

    // "Importe adeudado" (saldo real ya calculado por Odoo). Verificado
    // contra el archivo real: Odoo deja esta celda EN BLANCO cuando el
    // estado es "Pagado", "Revertido" o "En proceso de pago" — blanco ahí
    // significa 0, no dato faltante (comprobado: 0 filas con esos 3 estados
    // traen un valor explícito, así que no hay caso real donde el blanco
    // conviva con un saldo distinto de 0). Para "No pagadas" un blanco SÍ es
    // un vacío real (visto en 4 filas) — no se inventa, queda null.
    const crudoSaldoOdoo = iSaldoOdoo !== -1 ? String(fila[iSaldoOdoo] ?? "").trim() : "";
    let saldoOdoo;
    if (iSaldoOdoo === -1) {
      saldoOdoo = null;
    } else if (crudoSaldoOdoo !== "") {
      saldoOdoo = normalizarMonto(crudoSaldoOdoo);
    } else if (eBajo === "pagado" || eBajo.includes("revertid") || eBajo.includes("proceso de pago")) {
      saldoOdoo = 0;
    } else {
      saldoOdoo = null;
    }

    facturas.push({
      id_factura: idFactura,
      id_cliente: idCliente,
      numero_factura: numero,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      monto_original: monto,
      moneda_id: "GTQ",
      estado_factura: estadoFactura,
      saldo_pendiente_odoo: saldoOdoo,
      origen: "odoo-facturas",
    });
  });

  const clientes = [...clientesPorId.values()];

  console.log("");
  console.log("=== Resumen de la transformación (nada subido todavía) ===");
  console.log(`Filas leídas: ${filas.length}`);
  console.log(`Clientes únicos detectados: ${clientes.length}`);
  console.log(`Facturas listas para subir: ${facturas.length}`);
  console.log(`Filas descartadas: ${descartadas.length}`);
  for (const d of descartadas) console.log(`  - línea ${d.numeroLinea}: ${d.motivo}`);
  console.log(
    `Facturas sin fecha de vencimiento (quedan fuera del aging, NO se descartan): ${sinFechaVencimiento}`
  );
  if (estadosOdooVistos.size > 0) {
    console.log('Valores de "Estado" vistos en Odoo (sólo se mapea cancelada/anulada; el resto queda "abierta"):');
    for (const [estado, n] of estadosOdooVistos) console.log(`  - "${estado}": ${n}`);
  }

  if (facturas.length === 0) {
    console.log("Nada para subir — no se hizo ninguna llamada a Supabase.");
    return;
  }

  console.log("");
  console.log(`Subiendo a ${SUPABASE_URL} ...`);
  return (async () => {
    const rClientes = await subirEnLotes("clientes", clientes, {
      supabaseUrl: SUPABASE_URL,
      apiKey: SUPABASE_ANON_KEY,
    });
    const rFacturas = await subirEnLotes("facturas", facturas, {
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
      `facturas: ${rFacturas.insertados}/${rFacturas.filasEnviadas} filas enviadas en ${rFacturas.lotes} lote(s)` +
        (rFacturas.errores.length ? ` — ${rFacturas.errores.length} lote(s) con error` : "")
    );
    if (rClientes.errores.length || rFacturas.errores.length) {
      console.log("Revisá los errores impresos arriba antes de reintentar.");
      process.exitCode = 1;
    }
  })();
}

main();
