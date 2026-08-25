// Importación CSV del módulo M6 — implementación PROPIA (parser, auto-detección
// de columnas y normalización de formatos). Patrón conceptual tomado de la
// referencia funcional (auto-detección + mapeo editable + reporte de filas
// descartadas), reconstruido desde cero — sin copiar código.
//
// Regla innegociable (Paso 3/6): una fila sin fecha de vencimiento se conserva
// con fecha null (queda FUERA del aging y se reporta) — NUNCA se inventa fecha.

import type { Cliente, Dataset, Factura } from "./types";

export type CampoDestino =
  | "numero_factura"
  | "nombre_cliente"
  | "fecha_emision"
  | "fecha_vencimiento"
  | "monto_original"
  | "ignorar";

export type OrdenFecha = "auto" | "DMY" | "MDY";

const PALABRAS_CLAVE: Record<Exclude<CampoDestino, "ignorar">, string[]> = {
  numero_factura: ["factura", "invoice", "folio", "numero", "número", "no.", "num"],
  nombre_cliente: ["cliente", "customer", "account", "razon", "razón", "nombre"],
  fecha_emision: ["emision", "emisión", "issue", "invoice date", "fecha factura", "emitida"],
  fecha_vencimiento: ["vencimiento", "due", "vence", "expira"],
  monto_original: ["monto", "importe", "amount", "total", "balance", "saldo"],
};

export interface ResultadoParseo {
  encabezados: string[];
  filas: string[][];
  separador: string;
}

export function parsearCSV(texto: string): ResultadoParseo {
  const lineas = texto.replace(/^﻿/, "").split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (lineas.length === 0) throw new Error("El archivo está vacío.");
  const primera = lineas[0];
  const candidatos = [",", ";", "\t"];
  const separador = candidatos.reduce((mejor, sep) =>
    primera.split(sep).length > primera.split(mejor).length ? sep : mejor
  );
  const dividir = (linea: string): string[] => {
    const celdas: string[] = [];
    let actual = "";
    let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; }
        else enComillas = !enComillas;
      } else if (c === separador && !enComillas) {
        celdas.push(actual); actual = "";
      } else actual += c;
    }
    celdas.push(actual);
    return celdas.map((s) => s.trim());
  };
  const encabezados = dividir(lineas[0]);
  const filas = lineas.slice(1).map(dividir);
  if (encabezados.length < 2) {
    throw new Error("No se detectaron columnas suficientes — verificá el separador del archivo.");
  }
  return { encabezados, filas, separador };
}

/** Propone un mapeo automático encabezado → campo destino, editable por el usuario. */
export function autoMapear(encabezados: string[]): CampoDestino[] {
  const usados = new Set<CampoDestino>();
  return encabezados.map((enc) => {
    const bajo = enc.toLowerCase();
    for (const campo of Object.keys(PALABRAS_CLAVE) as Exclude<CampoDestino, "ignorar">[]) {
      if (usados.has(campo)) continue;
      if (PALABRAS_CLAVE[campo].some((p) => bajo.includes(p))) {
        usados.add(campo);
        return campo;
      }
    }
    return "ignorar";
  });
}

/** Normaliza montos en formato europeo (1.234,56) o estadounidense (1,234.56). */
export function normalizarMonto(crudo: string): number | null {
  const limpio = crudo.replace(/[^0-9.,-]/g, "");
  if (limpio === "") return null;
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normalizado: string;
  if (ultimaComa > ultimoPunto) {
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    normalizado = limpio.replace(/,/g, "");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Detecta orden de fecha inspeccionando valores: un componente > 12 delata el día. */
export function detectarOrdenFecha(valores: string[]): OrdenFecha {
  for (const v of valores) {
    const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) continue;
    if (Number(m[1]) > 12) return "DMY";
    if (Number(m[2]) > 12) return "MDY";
  }
  return "auto"; // ambiguo — el usuario puede forzarlo
}

export function normalizarFecha(crudo: string, orden: OrdenFecha): string | null {
  const v = crudo.trim();
  if (v === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // ISO directo
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  let dia: number, mes: number;
  if (orden === "DMY") { dia = a; mes = b; }
  else if (orden === "MDY") { mes = a; dia = b; }
  else {
    if (a > 12) { dia = a; mes = b; }
    else if (b > 12) { mes = a; dia = b; }
    else { dia = a; mes = b; } // ambiguo sin override: se asume DMY y se reporta como supuesto
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export interface FilaDescartada {
  numeroLinea: number;
  motivo: string;
}

export interface ResultadoImportacion {
  dataset: Dataset;
  descartadas: FilaDescartada[];
  sinFechaVencimiento: number;
  totalCargadas: number;
}

/**
 * Convierte filas CSV mapeadas en un Dataset de solo facturas (sin pagos/notas/
 * disputas — un CSV de cartera no trae esas entidades; el saldo = monto original).
 */
export function construirDataset(
  parseo: ResultadoParseo,
  mapeo: CampoDestino[],
  ordenFecha: OrdenFecha
): ResultadoImportacion {
  const idx = (campo: CampoDestino) => mapeo.indexOf(campo);
  const iNombre = idx("nombre_cliente");
  const iMonto = idx("monto_original");
  const iFactura = idx("numero_factura");
  const iEmision = idx("fecha_emision");
  const iVence = idx("fecha_vencimiento");

  if (iNombre === -1 || iMonto === -1) {
    throw new Error(
      "El mapeo necesita al menos las columnas de nombre de cliente y monto."
    );
  }

  const clientesPorNombre = new Map<string, Cliente>();
  const facturas: Factura[] = [];
  const descartadas: FilaDescartada[] = [];
  const numerosVistos = new Set<string>();
  let sinFechaVencimiento = 0;

  parseo.filas.forEach((fila, i) => {
    const numeroLinea = i + 2; // +1 por el encabezado, +1 por índice 0
    const nombre = (fila[iNombre] ?? "").trim();
    if (nombre === "") {
      descartadas.push({ numeroLinea, motivo: "sin nombre de cliente" });
      return;
    }
    const monto = normalizarMonto(fila[iMonto] ?? "");
    if (monto === null) {
      descartadas.push({ numeroLinea, motivo: "monto ilegible" });
      return;
    }

    let cliente = clientesPorNombre.get(nombre);
    if (!cliente) {
      cliente = {
        id_cliente: `IMP-CLI-${clientesPorNombre.size + 1}`,
        nombre_cliente: nombre,
        estado_cliente: "activo",
        fecha_creacion: "1970-01-01",
      };
      clientesPorNombre.set(nombre, cliente);
    }

    const numeroFactura =
      iFactura !== -1 && (fila[iFactura] ?? "").trim() !== ""
        ? fila[iFactura].trim()
        : `IMP-${numeroLinea}`;
    const claveUnica = `${cliente.id_cliente}|${numeroFactura}`;
    if (numerosVistos.has(claveUnica)) {
      descartadas.push({
        numeroLinea,
        motivo: `posible duplicado: (${nombre}, ${numeroFactura}) ya cargado`,
      });
      return;
    }
    numerosVistos.add(claveUnica);

    const fechaVencimiento =
      iVence !== -1 ? normalizarFecha(fila[iVence] ?? "", ordenFecha) : null;
    if (fechaVencimiento === null) sinFechaVencimiento++;
    const fechaEmision =
      (iEmision !== -1 ? normalizarFecha(fila[iEmision] ?? "", ordenFecha) : null) ??
      "1970-01-01";

    facturas.push({
      id_factura: `IMP-FAC-${facturas.length + 1}`,
      id_cliente: cliente.id_cliente,
      numero_factura: numeroFactura,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      monto_original: monto,
      moneda_id: "USD",
      estado_factura: "abierta",
    });
  });

  return {
    dataset: {
      fuente: "csv-importado",
      clientes: [...clientesPorNombre.values()],
      facturas,
      pagos: [],
      notasCredito: [],
      disputas: [],
      condicionesPago: [],
    },
    descartadas,
    sinFechaVencimiento,
    totalCargadas: facturas.length,
  };
}
