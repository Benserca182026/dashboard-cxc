"use client";

// M6 — Carga y calidad de datos (paso-3-modulos-propios.md §M6).
// Import CSV client-side: nada sale del navegador. Auto-detección de columnas
// con mapeo editable, override de orden de fecha, y reporte de filas
// descartadas con motivo. Prohibido inventar fechas faltantes.
//
// Reestructuración (M6 de la reestructuración visual): mismo esqueleto de "/"
// y "/aging". De arriba abajo: Encabezado con menú interno y BarraUsuario →
// el motor de argumentación propio de este módulo (argumentoDatos, con los
// agentes AGENTES_DATOS asomados en el mordisco — la ÚNICA página cuyo
// razonamiento es sobre el propio dato, no sobre el negocio) → carga/mapeo y
// el reporte de calidad, cada uno envuelto en el mismo LienzoConAgentes del
// resto.
//
// La lógica de parseo, mapeo, validación y reporte queda intacta.

import { SkeletonPagina } from "@/components/Basicos";
import {
  autoMapear,
  construirDataset,
  detectarOrdenFecha,
  parsearCSV,
  type CampoDestino,
  type OrdenFecha,
  type ResultadoImportacion,
  type ResultadoParseo,
} from "@/lib/csv";
import { fmtMoneda } from "@/lib/calculos";
import { argumentoDatos } from "@/lib/argumento";
import { useApp } from "@/lib/store";
import { useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_DATOS, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";

const CAMPOS: { valor: CampoDestino; etiqueta: string }[] = [
  { valor: "ignorar", etiqueta: "— ignorar —" },
  { valor: "nombre_cliente", etiqueta: "Nombre de cliente *" },
  { valor: "monto_original", etiqueta: "Monto *" },
  { valor: "numero_factura", etiqueta: "Número de factura" },
  { valor: "fecha_emision", etiqueta: "Fecha de emisión" },
  { valor: "fecha_vencimiento", etiqueta: "Fecha de vencimiento" },
];

const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-carga", etiqueta: "Cargar y mapear" },
  { id: "sec-reporte", etiqueta: "Reporte de calidad" },
];

export default function PaginaDatos() {
  const { dataset, cargando, errorDatosReales, fechaCorte, reemplazarDataset, volverADemo } = useApp();
  const [parseo, setParseo] = useState<ResultadoParseo | null>(null);
  const [mapeo, setMapeo] = useState<CampoDestino[]>([]);
  const [ordenFecha, setOrdenFecha] = useState<OrdenFecha>("auto");
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");

  if (cargando) return <SkeletonPagina />;

  const alElegirArchivo = async (archivo: File | undefined) => {
    setError(null);
    setResultado(null);
    setParseo(null);
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    try {
      const texto = await archivo.text();
      const p = parsearCSV(texto);
      setParseo(p);
      setMapeo(autoMapear(p.encabezados));
      const iVence = autoMapear(p.encabezados).indexOf("fecha_vencimiento");
      if (iVence !== -1) {
        setOrdenFecha(detectarOrdenFecha(p.filas.map((f) => f[iVence] ?? "")));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const aplicar = () => {
    if (!parseo) return;
    setError(null);
    try {
      const r = construirDataset(parseo, mapeo, ordenFecha);
      if (r.totalCargadas === 0) {
        setError(
          "Ninguna fila pasó las validaciones — revisá el mapeo de columnas y el reporte de descartes."
        );
        setResultado(r);
        return;
      }
      setResultado(r);
      reemplazarDataset(r.dataset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al construir el dataset.");
    }
  };

  const claseSelect =
    "w-full rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-2 text-sm text-tinta shadow-flotante outline-none focus:border-tinta";
  const claseBotonSuave =
    "rounded-pastilla border border-white/90 bg-white/70 px-4 py-2 text-sm font-medium text-tinta/80 shadow-flotante transition hover:shadow-flotanteAlta";

  // ── Las cifras de los cuatro anillos — la misma cuenta que arma el
  //    argumento, no números sueltos. ──
  const total = dataset.facturas.length;
  const problemas = dataset.facturas.map((f) => {
    const motivos: string[] = [];
    if (!f.fecha_vencimiento) motivos.push("sin fecha de vencimiento");
    if (f.fecha_emision === "1970-01-01") motivos.push("sin fecha de emisión real");
    if (f.monto_original <= 0) motivos.push("monto no positivo");
    return { factura: f, motivos };
  });
  const conProblema = problemas.filter((p) => p.motivos.length > 0);
  const pctProblema = total > 0 ? (conProblema.length / total) * 100 : 0;
  const conteoPorMotivo = new Map<string, number>();
  for (const p of conProblema) {
    for (const m of p.motivos) conteoPorMotivo.set(m, (conteoPorMotivo.get(m) ?? 0) + 1);
  }
  const motivoDominante = [...conteoPorMotivo.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". Las
          automatizaciones de acá hablan de la calidad del dato cargado, no
          del negocio. */}
      <Encabezado titulo="Carga y calidad de datos" secciones={SECCIONES} dataset={dataset} modulo="datos" />

      {/* El motor de argumentación del módulo: la ÚNICA página cuyo caso no
          es de negocio — es sobre el propio dataset cargado. ¿Cuántas filas
          hay y cuántas sirven, cuántas tienen problema, dónde se concentran,
          y es usable el resultado? */}
      <section id="sec-argumento" className="scroll-mt-24">
        <RecorridoArgumental
          rotulo="El caso del dataset"
          arg={argumentoDatos(dataset)}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_DATOS} />}
          kpis={[
            {
              etiqueta: "limpias · del total cargado",
              valor: `${total - conProblema.length} de ${total}`,
              pct: total > 0 ? ((total - conProblema.length) / total) * 100 : 0,
            },
            {
              etiqueta: "con problema · del total cargado",
              valor: `${conProblema.length} de ${total}`,
              pct: pctProblema,
            },
            {
              etiqueta: motivoDominante ? "motivo dominante · de las filas con problema" : "sin motivo dominante",
              valor: motivoDominante ? `${motivoDominante[1]} de ${conProblema.length}` : "—",
              pct: motivoDominante && conProblema.length > 0 ? (motivoDominante[1] / conProblema.length) * 100 : 0,
            },
            {
              etiqueta: "dataset limpio · calidad general",
              valor: `${Math.round(100 - pctProblema)}% limpio`,
              pct: 100 - pctProblema,
            },
          ]}
        />
      </section>

      {/* Cargar y mapear: mismo selector de archivo, misma auto-detección de
          columnas y de orden de fecha, sin cambios de comportamiento. */}
      <section id="sec-carga" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Cargar y mapear"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_DATOS} />}
        >
          {errorDatosReales && (
            <div className="mb-4 rounded-tarjeta border-l-2 border-l-critico bg-white/70 p-4 text-sm">
              <p className="font-semibold text-critico">
                <span aria-hidden className="mr-1.5 opacity-60">▲</span>
                No se pudo cargar el dataset real de Odoo — se está mostrando demo-ficticio.
              </p>
              <p className="mt-1 text-xs text-tintaSuave">{errorDatosReales}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="pastilla-activa cursor-pointer px-5 py-2.5 text-sm font-semibold transition hover:shadow-flotanteAlta">
              Elegir archivo CSV/TSV
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => alElegirArchivo(e.target.files?.[0])}
              />
            </label>
            {nombreArchivo && (
              <span className="rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-1.5 text-sm text-tinta/80 shadow-flotante">
                {nombreArchivo}
              </span>
            )}
            <button
              onClick={() => {
                volverADemo();
                setParseo(null);
                setResultado(null);
                setError(null);
                setNombreArchivo("");
              }}
              className={`ml-auto ${claseBotonSuave}`}
            >
              Usar datos demo ficticios
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2 border-t border-[rgba(22,24,29,.07)] pt-4">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">Fuente</p>
              <p className="mt-0.5 text-sm font-semibold text-tinta">{dataset.fuente}</p>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">Facturas</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-tinta/80">{dataset.facturas.length}</p>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">Clientes</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-tinta/80">{dataset.clientes.length}</p>
            </div>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-critico">
            <span aria-hidden className="opacity-60">▲</span>
            No subas datos reales de ninguna empresa a este prototipo.
          </p>

          {error && (
            <div className="mt-4 rounded-tarjeta border-l-2 border-l-critico bg-white/70 p-5 text-center">
              <p className="text-sm font-semibold text-critico">
                <span aria-hidden className="mr-1.5 opacity-60">▲</span>
                {error}
              </p>
            </div>
          )}

          {parseo ? (
            <div className="mt-5 border-t border-[rgba(22,24,29,.07)] pt-5">
              <h3 className="text-sm font-semibold text-tinta">
                Mapeo de columnas ({parseo.encabezados.length} detectadas, separador «
                {parseo.separador === "\t" ? "tab" : parseo.separador}»)
              </h3>
              <p className="mt-0.5 text-xs text-tintaSuave">
                La detección automática es una propuesta — corregila antes de aplicar.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {parseo.encabezados.map((enc, i) => (
                  <label
                    key={i}
                    className="entrada-suave text-sm"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span className="mb-1.5 block truncate text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8b8f98]">
                      «{enc}»
                    </span>
                    <select
                      value={mapeo[i]}
                      onChange={(e) => {
                        const nuevo = [...mapeo];
                        nuevo[i] = e.target.value as CampoDestino;
                        setMapeo(nuevo);
                      }}
                      className={claseSelect}
                    >
                      {CAMPOS.map((c) => (
                        <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[rgba(22,24,29,.07)] pt-5">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8b8f98]">Orden de fecha:</span>
                  <select
                    value={ordenFecha}
                    onChange={(e) => setOrdenFecha(e.target.value as OrdenFecha)}
                    className="rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-1.5 text-sm text-tinta shadow-flotante outline-none focus:border-tinta"
                  >
                    <option value="auto">auto-detectar</option>
                    <option value="DMY">día/mes/año</option>
                    <option value="MDY">mes/día/año</option>
                  </select>
                </label>
                <button
                  onClick={aplicar}
                  className="rounded-pastilla border border-white/90 bg-white/80 px-5 py-2.5 text-sm font-semibold text-tinta shadow-flotante ring-1 ring-tinta transition hover:shadow-flotanteAlta"
                >
                  Aplicar importación ({parseo.filas.length} filas)
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-5 border-t border-[rgba(22,24,29,.07)] pt-5 text-[11.5px] text-[#a0a2a6]">
              Elegí un archivo para ver acá la propuesta de mapeo de columnas.
            </p>
          )}
        </LienzoConAgentes>
      </section>

      {/* Reporte de calidad: mismo desglose de cargadas/descartadas de
          siempre, con el motivo de cada descarte. */}
      <section id="sec-reporte" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Reporte de calidad de la carga"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_DATOS} />}
        >
          {resultado ? (
            <ul className="divide-y divide-[rgba(22,24,29,.06)] text-sm">
              <li className="py-2.5">
                ✅ Filas cargadas: <b className="tabular-nums">{resultado.totalCargadas}</b>
              </li>
              <li className="py-2.5">
                🚫 Filas descartadas:{" "}
                <b className="tabular-nums">{resultado.descartadas.length}</b>
                {resultado.descartadas.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-xs text-tintaSuave">
                    {resultado.descartadas.map((d, i) => (
                      <li key={i}>línea {d.numeroLinea}: {d.motivo}</li>
                    ))}
                  </ul>
                )}
              </li>
              <li className="py-2.5">
                ⚠️ Facturas sin fecha de vencimiento:{" "}
                <b className="tabular-nums">{resultado.sinFechaVencimiento}</b> — quedan FUERA del aging y se
                reportan ahí; nunca se les inventa una fecha.
              </li>
              {resultado.totalCargadas > 0 && (
                <li className="py-2.5">
                  Saldo total importado:{" "}
                  <b className="tabular-nums">
                    {fmtMoneda(
                      resultado.dataset.facturas.reduce((s, f) => s + f.monto_original, 0)
                    )}
                  </b>{" "}
                  (sin pagos ni notas de crédito: un CSV de cartera no trae esas
                  entidades, saldo = monto original)
                </li>
              )}
            </ul>
          ) : (
            <p className="text-[11.5px] text-[#a0a2a6]">
              Aún no se aplicó ninguna importación en esta sesión — el reporte aparece acá
              después del Paso 2.
            </p>
          )}
        </LienzoConAgentes>
      </section>
    </div>
  );
}
