// Librería compartida por importar-facturas-odoo.mjs e importar-pagos-odoo.mjs.
//
// Por qué existe este archivo: los dos scripts deben generar el MISMO
// id_cliente para el mismo nombre de cliente (para que un cliente que
// aparece en el archivo de facturas y en el de pagos caiga en la misma fila
// de `clientes`). La única forma de garantizar eso es que ambos llamen a la
// MISMA función — así que vive acá una sola vez, no copiada dos veces.
//
// También vive acá: el lector mínimo de XLSX (sin librerías — ver nota más
// abajo), y la normalización de fecha/monto, que replica el PATRÓN de
// lib/csv.ts (fecha ambigua se declara y nunca se inventa, monto no
// numérico se descarta con motivo) adaptado a datos que salen de celdas
// XLSX en vez de texto CSV.

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// ─────────────────────────────────────────────────────────────────────────
// Lector mínimo de XLSX: un .xlsx es un ZIP. En vez de agregar una
// dependencia nueva al proyecto, se lee el ZIP a mano (igual que se hizo ya
// en este proyecto para inspeccionar los XLSX exportados de Odoo) y se
// extraen sólo las dos partes que hacen falta: xl/sharedStrings.xml (el
// catálogo de textos) y xl/worksheets/sheet1.xml (la primera — y única,
// en un export de lista de Odoo — hoja).
// ─────────────────────────────────────────────────────────────────────────

function leerEntradaZip(buf, nombreArchivo) {
  const EOCD_SIG = 0x06054b50;
  let eocdPos = -1;
  const minPos = Math.max(0, buf.length - 65557); // 22 (EOCD) + 65535 (comentario máx.)
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocdPos = i; break; }
  }
  if (eocdPos === -1) {
    throw new Error("No parece un archivo .xlsx válido (no se encontró el fin de directorio ZIP).");
  }

  const numEntradas = buf.readUInt16LE(eocdPos + 10);
  let offsetCentral = buf.readUInt32LE(eocdPos + 16);

  for (let i = 0; i < numEntradas; i++) {
    const sig = buf.readUInt32LE(offsetCentral);
    if (sig !== 0x02014b50) {
      throw new Error("Directorio central del ZIP corrupto o formato no soportado.");
    }
    const metodo = buf.readUInt16LE(offsetCentral + 10);
    const compSize = buf.readUInt32LE(offsetCentral + 20);
    const nombreLen = buf.readUInt16LE(offsetCentral + 28);
    const extraLen = buf.readUInt16LE(offsetCentral + 30);
    const comentarioLen = buf.readUInt16LE(offsetCentral + 32);
    const offsetLocal = buf.readUInt32LE(offsetCentral + 42);
    const nombre = buf.toString("utf8", offsetCentral + 46, offsetCentral + 46 + nombreLen);

    if (nombre === nombreArchivo) {
      const sigLocal = buf.readUInt32LE(offsetLocal);
      if (sigLocal !== 0x04034b50) {
        throw new Error(`Header local del ZIP corrupto para ${nombreArchivo}.`);
      }
      const nombreLenLocal = buf.readUInt16LE(offsetLocal + 26);
      const extraLenLocal = buf.readUInt16LE(offsetLocal + 28);
      const dataStart = offsetLocal + 30 + nombreLenLocal + extraLenLocal;
      const datosComprimidos = buf.subarray(dataStart, dataStart + compSize);
      if (metodo === 0) return datosComprimidos.toString("utf8"); // sin comprimir
      if (metodo === 8) return inflateRawSync(datosComprimidos).toString("utf8"); // deflate
      throw new Error(`Método de compresión ZIP no soportado (${metodo}) para ${nombreArchivo}.`);
    }

    offsetCentral += 46 + nombreLen + extraLen + comentarioLen;
  }
  return null; // la entrada no existe (ej.: sharedStrings.xml si la hoja no usa strings compartidos)
}

function decodificarEntidadesXml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function parsearSharedStrings(xml) {
  if (!xml) return [];
  const textos = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml))) {
    const partes = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) =>
      decodificarEntidadesXml(t[1])
    );
    textos.push(partes.join(""));
  }
  return textos;
}

function colALetraANumero(letras) {
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function parsearHoja(xml, sharedStrings) {
  if (!xml) throw new Error("No se encontró xl/worksheets/sheet1.xml dentro del .xlsx.");
  const filas = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let mRow;
  while ((mRow = rowRegex.exec(xml))) {
    const filaXml = mRow[1];
    const celdas = [];
    // La forma autocerrada (celda vacía) va PRIMERA en la alternancia. Si va
    // segunda, "[^>]*>" de la forma abierta matchea de más: como "/" no es
    // ">", el "[^>]*" se traga el "/" de un "<c .../>" y el regex queda
    // esperando un "</c>" que en realidad pertenece a la SIGUIENTE celda —
    // fusionando dos celdas en una y corriendo todo lo que sigue un lugar.
    // Bug real, encontrado con datos reales: una celda vacía en Odoo antes
    // de un importe hacía que el importe apareciera en la columna anterior.
    const cellRegex = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let mCell;
    let indiceSecuencial = 0;
    while ((mCell = cellRegex.exec(filaXml))) {
      const esAutocerrada = mCell[1] !== undefined;
      const attrs = esAutocerrada ? mCell[1] : mCell[2] ?? "";
      const contenido = esAutocerrada ? "" : mCell[3] ?? "";
      const ref = /r="([A-Z]+)\d+"/.exec(attrs);
      const columna = ref ? colALetraANumero(ref[1]) : indiceSecuencial;
      indiceSecuencial = columna + 1;
      const tipo = /t="([^"]+)"/.exec(attrs)?.[1] ?? "n";

      let valor = "";
      if (tipo === "inlineStr") {
        valor = decodificarEntidadesXml(/<t\b[^>]*>([\s\S]*?)<\/t>/.exec(contenido)?.[1] ?? "");
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(contenido);
        const crudo = vMatch ? vMatch[1] : "";
        if (tipo === "s") {
          valor = sharedStrings[Number(crudo)] ?? "";
        } else if (tipo === "str" || tipo === "b" || tipo === "e") {
          valor = decodificarEntidadesXml(crudo);
        } else {
          valor = crudo; // numérico u serial de fecha — se interpreta en el llamador
        }
      }
      while (celdas.length < columna) celdas.push("");
      celdas[columna] = valor;
    }
    filas.push(celdas);
  }
  return filas;
}

/**
 * Lee la hoja 1 de un .xlsx y devuelve encabezados + filas (todo como texto
 * crudo de celda — la interpretación de fecha/monto queda para el llamador,
 * que sabe qué columna es cuál).
 */
export function leerXlsxHoja1(rutaArchivo) {
  const buf = readFileSync(rutaArchivo);
  const sharedXml = leerEntradaZip(buf, "xl/sharedStrings.xml");
  const hojaXml = leerEntradaZip(buf, "xl/worksheets/sheet1.xml");
  const sharedStrings = parsearSharedStrings(sharedXml);
  const filas = parsearHoja(hojaXml, sharedStrings);
  if (filas.length === 0) throw new Error("La hoja 1 del .xlsx está vacía.");
  const [encabezados, ...datos] = filas;
  return { encabezados, filas: datos };
}

// ─────────────────────────────────────────────────────────────────────────
// Auto-mapeo de columnas por palabra clave — mismo patrón que
// lib/csv.ts::autoMapear: primer encabezado que matchea una palabra clave
// se queda con ese campo, campos ya usados no se repiten.
// ─────────────────────────────────────────────────────────────────────────

export function autoMapearEncabezados(encabezados, palabrasClave) {
  const usados = new Set();
  return encabezados.map((enc) => {
    const bajo = (enc ?? "").toLowerCase();
    for (const campo of Object.keys(palabrasClave)) {
      if (usados.has(campo)) continue;
      if (palabrasClave[campo].some((p) => bajo.includes(p))) {
        usados.add(campo);
        return campo;
      }
    }
    return "ignorar";
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Monto — mismo algoritmo que lib/csv.ts::normalizarMonto (formato europeo
// 1.234,56 vs estadounidense 1,234.56). Sirve igual para celdas numéricas
// XLSX (que ya vienen limpias, sin separador de miles) que para texto.
// ─────────────────────────────────────────────────────────────────────────

export function normalizarMonto(crudo) {
  const limpio = String(crudo ?? "").replace(/[^0-9.,-]/g, "");
  if (limpio === "") return null;
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normalizado;
  if (ultimaComa > ultimoPunto) {
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    normalizado = limpio.replace(/,/g, "");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ─────────────────────────────────────────────────────────────────────────
// Fecha — mismo espíritu que lib/csv.ts::normalizarFecha/detectarOrdenFecha,
// extendido para reconocer también el serial numérico de fecha de Excel
// (días desde 1899-12-30), que es como Odoo suele exportar columnas de
// fecha reales a XLSX. Fecha ilegible o ambigua sin poder resolverse => null
// (se declara aparte, NUNCA se inventa).
// ─────────────────────────────────────────────────────────────────────────

function pareceSoloNumero(v) {
  return /^\d+(\.\d+)?$/.test(v.trim());
}

function excelSerialAIso(crudo) {
  const dias = Math.round(Number(crudo));
  if (!Number.isFinite(dias) || dias <= 0) return null;
  const epoch = Date.UTC(1899, 11, 30); // día "0" del sistema de fechas de Excel
  const d = new Date(epoch + dias * 86400000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function detectarOrdenFecha(valoresTexto) {
  for (const v of valoresTexto) {
    const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) continue;
    if (Number(m[1]) > 12) return "DMY";
    if (Number(m[2]) > 12) return "MDY";
  }
  return "auto";
}

function normalizarFechaTexto(crudo, orden) {
  const v = crudo.trim();
  if (v === "") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); // ISO directo (o con hora pegada)
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  let anio = Number(m[3]);
  if (anio < 100) anio += 2000;
  let dia, mes;
  if (orden === "DMY") { dia = a; mes = b; }
  else if (orden === "MDY") { mes = a; dia = b; }
  else if (a > 12) { dia = a; mes = b; }
  else if (b > 12) { mes = a; dia = b; }
  else { dia = a; mes = b; } // ambiguo sin override: se asume DMY, igual que csv.ts
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Interpreta una COLUMNA completa de fechas de una sola pasada: decide una
 * vez el orden día/mes (igual que detectarOrdenFecha en csv.ts, mirando
 * todos los valores de texto de la columna) y por cada celda decide si es
 * un serial de Excel o texto. Devuelve un array paralelo de "YYYY-MM-DD" o
 * null.
 */
export function interpretarColumnaFechas(valoresCrudos) {
  const textuales = valoresCrudos
    .map((v) => String(v ?? ""))
    .filter((v) => v.trim() !== "" && !pareceSoloNumero(v));
  const orden = detectarOrdenFecha(textuales);
  return valoresCrudos.map((crudo) => {
    const v = String(crudo ?? "").trim();
    if (v === "") return null;
    if (pareceSoloNumero(v)) return excelSerialAIso(v);
    return normalizarFechaTexto(v, orden);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Generación estable de ids. CRÍTICO: idClienteDesdeNombre es la MISMA
// función que usan importar-facturas-odoo.mjs e importar-pagos-odoo.mjs
// (la importan de acá, no la redefinen) — así el mismo nombre de cliente
// siempre cae en el mismo id_cliente sin importar de qué archivo salió.
// ─────────────────────────────────────────────────────────────────────────

export function normalizarTexto(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos (marcas diacriticas combinantes)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Hash FNV-1a de 32 bits: determinista — el mismo texto da siempre el mismo resultado. */
export function hashEstable(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(7, "0");
}

function slug(s) {
  return normalizarTexto(s).replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function idClienteDesdeNombre(nombre) {
  return `CLI-${hashEstable(normalizarTexto(nombre))}`;
}

export function idFacturaDesdeNumero(numero) {
  return `FAC-${slug(numero)}`;
}

export function idPagoDesdeNumero(numero) {
  return `PAG-${slug(numero)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Subida a Supabase por REST, en lotes, con la clave publishable (anon).
// Prefer: resolution=merge-duplicates hace upsert por la primary key de la
// tabla (id_cliente / id_factura / id_pago) sin necesitar service_role.
// ─────────────────────────────────────────────────────────────────────────

export async function subirEnLotes(tabla, filas, { supabaseUrl, apiKey, tamanoLote = 150, onConflict } = {}) {
  const resultado = { tabla, filasEnviadas: filas.length, insertados: 0, lotes: 0, errores: [] };
  const url = `${supabaseUrl}/rest/v1/${tabla}${onConflict ? `?on_conflict=${onConflict}` : ""}`;
  for (let i = 0; i < filas.length; i += tamanoLote) {
    const lote = filas.slice(i, i + tamanoLote);
    resultado.lotes++;
    let resp;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(lote),
      });
    } catch (e) {
      resultado.errores.push({ lote: resultado.lotes, status: null, detalle: String(e) });
      console.error(`  x Lote ${resultado.lotes} de ${tabla}: error de red — ${e}`);
      break;
    }
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      resultado.errores.push({ lote: resultado.lotes, status: resp.status, detalle: texto });
      console.error(`  x Lote ${resultado.lotes} de ${tabla} fallo (HTTP ${resp.status}): ${texto}`);
      break; // no seguimos subiendo lotes de esta tabla si uno falla — son datos financieros reales
    }
    resultado.insertados += lote.length;
    console.log(`  ok Lote ${resultado.lotes} de ${tabla}: ${lote.length} filas`);
  }
  return resultado;
}
