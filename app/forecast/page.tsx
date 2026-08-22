"use client";

// M4 — Forecast (Decisión B: SOLO simulación con datos ficticios).
//
// Reestructuración (M6): mismo esqueleto de "/" y "/aging". De arriba abajo:
// Encabezado con menú interno y BarraUsuario → el motor de argumentación
// propio de este módulo (argumentoForecast, con los agentes AGENTES_FORECAST
// asomados en el mordisco — cada uno insiste en que esto es SIMULACIÓN, nunca
// dato real) → los tres escenarios y la curva, envueltos en el mismo
// LienzoConAgentes del resto.
//
// SOLO cambia la presentación de la página. Curvas (mismos puntos de datos),
// importes, horizonte de 13 semanas, escenarios, cálculos (lib/simulados.ts) y
// todos los avisos de simulación/Finanzas permanecen intactos. La suavización
// de línea es interpolación monótona (Fritsch–Carlson): pasa exactamente por
// cada punto semanal y no crea subidas/bajadas falsas entre puntos.

import { SkeletonPagina } from "@/components/Basicos";
import { BannerFicticioPremium } from "@/components/ResumenPremium";
import { fmtMoneda } from "@/lib/calculos";
import { forecastSimulado, SUPUESTOS_FORECAST } from "@/lib/simulados";
import { argumentoForecast } from "@/lib/argumento";
import { useApp } from "@/lib/store";
import { useRef, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_FORECAST, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";

const ANCHO = 760;
const ALTO = 330;
const M_IZQ = 58;
const M_DER = 92;
const M_SUP = 30;
const M_INF = 44;

type ClaveSerie = "optimista" | "base" | "pesimista";

const SERIES: {
  clave: ClaveSerie;
  etiqueta: string;
  linea: string;
  gradiente: string;
  chipFondo: string;
  glifo: string;
}[] = [
  {
    clave: "optimista",
    etiqueta: "Optimista",
    linea: "#f4756b",
    gradiente: "linear-gradient(135deg,#ffe0cd 0%,#ffd0d8 55%,#f6c9ee 100%)",
    chipFondo: "rgba(255,255,255,0.55)",
    glifo: "↗",
  },
  {
    clave: "base",
    etiqueta: "Base",
    linea: "#8b7cf6",
    gradiente: "linear-gradient(135deg,#ded4fc 0%,#d2d3fc 55%,#c7ddfd 100%)",
    chipFondo: "rgba(255,255,255,0.55)",
    glifo: "→",
  },
  {
    clave: "pesimista",
    etiqueta: "Pesimista",
    linea: "#2fbfae",
    gradiente: "linear-gradient(135deg,#c9f5e9 0%,#c9ecf6 55%,#cadffd 100%)",
    chipFondo: "rgba(255,255,255,0.55)",
    glifo: "↘",
  },
];

const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-escenarios", etiqueta: "Escenarios" },
  { id: "sec-curva", etiqueta: "Curva" },
];

/**
 * Ruta SVG suave por interpolación cúbica monótona (Fritsch–Carlson).
 * Pasa exactamente por todos los puntos y no sobrepasa los valores reales —
 * en una serie acumulada nunca dibuja descensos que no existen en los datos.
 */
function rutaMonotona(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const pend: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    pend.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  }
  const m: number[] = [pend[0]];
  for (let i = 1; i < n - 1; i++) {
    if (pend[i - 1] * pend[i] <= 0) m.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / pend[i - 1] + w2 / pend[i]));
    }
  }
  m.push(pend[n - 2]);
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + m[i] * h} ${pts[i + 1].x - h},${
      pts[i + 1].y - m[i + 1] * h
    } ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

export default function PaginaForecast() {
  const { dataset, cargando, fechaCorte } = useApp();
  const moneda = dataset.fuente === "odoo-real" ? "GTQ" : "USD";
  const fmt = (n: number) => fmtMoneda(n, moneda);
  const [serieActiva, setSerieActiva] = useState<ClaveSerie | null>(null);
  const [semanaHover, setSemanaHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (cargando) return <SkeletonPagina />;

  const puntos = forecastSimulado(dataset, fechaCorte);
  const maximo = Math.max(...puntos.map((p) => p.optimista), 1);
  const ultimo = puntos[puntos.length - 1];

  const x = (semana: number) =>
    M_IZQ + ((semana - 1) / (puntos.length - 1)) * (ANCHO - M_IZQ - M_DER);
  const y = (v: number) => ALTO - M_INF - (v / maximo) * (ALTO - M_SUP - M_INF);

  const rutas = SERIES.map((s) => ({
    ...s,
    d: rutaMonotona(puntos.map((p) => ({ x: x(p.semana), y: y(p[s.clave]) }))),
  }));

  const finales = SERIES.map((s) => ({ ...s, yFin: y(ultimo[s.clave]) })).sort(
    (a, b) => a.yFin - b.yFin
  );
  for (let i = 1; i < finales.length; i++) {
    if (finales[i].yFin - finales[i - 1].yFin < 16) {
      finales[i].yFin = finales[i - 1].yFin + 16;
    }
  }

  const opacidad = (clave: ClaveSerie) =>
    serieActiva === null || serieActiva === clave ? 1 : 0.18;

  const moverCursor = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xVista = ((e.clientX - rect.left) / rect.width) * ANCHO;
    if (xVista < M_IZQ - 10 || xVista > ANCHO - M_DER + 10) {
      setSemanaHover(null);
      return;
    }
    const fr =
      ((xVista - M_IZQ) / (ANCHO - M_IZQ - M_DER)) * (puntos.length - 1) + 1;
    setSemanaHover(Math.min(puntos.length, Math.max(1, Math.round(fr))));
  };

  const pHover = semanaHover ? puntos[semanaHover - 1] : null;

  // ── Las cifras de los cuatro anillos — las mismas que arma el argumento. ──
  const spread = ultimo.optimista - ultimo.pesimista;
  const pctSpread = ultimo.base > 0 ? (spread / ultimo.base) * 100 : 0;
  const mitad = ultimo.base / 2;
  const semanaMitad = ultimo.base > 0 ? puntos.find((p) => p.base >= mitad)?.semana ?? null : null;

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". La
          etiqueta "(simulado)" no se oculta ni acá ni en el riel lateral. */}
      <Encabezado titulo="Forecast de cobro (simulado)" secciones={SECCIONES} dataset={dataset} modulo="forecast" />

      {/* El motor de argumentación del módulo: el propio simulacro contado en
          cuatro etapas. La lectura ingenua y cada etapa insisten en que esto
          es SIMULACIÓN, nunca una proyección de caja real. */}
      <section id="sec-argumento" className="scroll-mt-24">
        <RecorridoArgumental
          rotulo="El caso del forecast"
          arg={argumentoForecast(dataset, fechaCorte)}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_FORECAST} />}
          kpis={[
            {
              etiqueta: "base semana 13 · del optimista",
              valor: fmt(ultimo.base),
              pct: ultimo.optimista > 0 ? (ultimo.base / ultimo.optimista) * 100 : 0,
            },
            {
              etiqueta: "brecha optimista−pesimista · del base",
              valor: fmt(spread),
              pct: pctSpread,
            },
            {
              etiqueta: "semana del punto medio · de 13",
              valor: semanaMitad !== null ? `semana ${semanaMitad}` : "—",
              pct: semanaMitad !== null ? (semanaMitad / 13) * 100 : 0,
            },
            {
              etiqueta: "pesimista · del optimista",
              valor: fmt(ultimo.pesimista),
              pct: ultimo.optimista > 0 ? (ultimo.pesimista / ultimo.optimista) * 100 : 0,
            },
          ]}
        />
      </section>

      {/* Los tres escenarios: mismos supuestos declarados, mismas tarjetas
          gradiente de siempre. */}
      <section id="sec-escenarios" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Los tres escenarios (simulados)"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_FORECAST} />}
        >
          <p className="flex items-center gap-2.5 text-[11.5px] font-semibold text-simulado">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-simulado" />
            SIMULACIÓN — pendiente de validación por Finanzas
          </p>
          <ul className="mt-2.5 grid gap-x-8 gap-y-1.5 pl-5 text-[10.5px] leading-relaxed text-[#85878c] sm:grid-cols-2">
            {SUPUESTOS_FORECAST.map((s, i) => (
              <li key={i} className="list-disc marker:text-[#c6cad2]">
                {s}
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {SERIES.map((s, i) => (
              <article
                key={s.clave}
                tabIndex={0}
                onMouseEnter={() => setSerieActiva(s.clave)}
                onMouseLeave={() => setSerieActiva(null)}
                onFocus={() => setSerieActiva(s.clave)}
                onBlur={() => setSerieActiva(null)}
                style={{ animationDelay: `${i * 90}ms` }}
                className="tarjeta-calada entrada-suave group p-6 outline-none transition duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-tinta/30"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold leading-snug text-tinta">
                    {s.etiqueta}
                    <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-tinta/50">
                      simulado
                    </span>
                  </p>
                  <span
                    aria-hidden
                    style={{ background: s.chipFondo }}
                    className="grid h-9 w-9 place-items-center rounded-pastilla text-base text-tinta/80"
                  >
                    {s.glifo}
                  </span>
                </div>
                <p className="mt-7 text-[1.9rem] font-bold leading-none tabular-nums tracking-tight text-tinta">
                  {fmt(ultimo[s.clave])}
                </p>
                <p className="mt-2 text-xs font-medium text-tinta/60">
                  cobro acumulado · 13 semanas
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4">
            <BannerFicticioPremium fuente={dataset.fuente} />
          </div>
        </LienzoConAgentes>
      </section>

      {/* La curva: mismas tres bandas, mismo indicador flotante al pasar el
          mouse, sin cambios de comportamiento. */}
      <section id="sec-curva" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Cobro acumulado simulado"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_FORECAST} />}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-[11.5px] leading-snug text-[#85878c]">
              Tres bandas ilustrativas por escenario — no una proyección real
            </p>
            <div className="flex flex-wrap gap-2">
              {SERIES.map((s) => (
                <button
                  key={s.clave}
                  type="button"
                  onMouseEnter={() => setSerieActiva(s.clave)}
                  onMouseLeave={() => setSerieActiva(null)}
                  onFocus={() => setSerieActiva(s.clave)}
                  onBlur={() => setSerieActiva(null)}
                  className="flex items-center gap-2 rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-tinta/80 shadow-flotante outline-none transition hover:shadow-flotanteAlta"
                  style={
                    serieActiva === s.clave
                      ? { boxShadow: `0 0 0 2px ${s.linea}` }
                      : undefined
                  }
                >
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.linea }}
                  />
                  {s.etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-4">
            {pHover && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-2xl bg-white px-4 py-2.5 shadow-[0_12px_32px_-10px_rgba(15,23,42,0.35)] ring-1 ring-[rgba(22,24,29,.07)]"
                style={{ left: `${(x(pHover.semana) / ANCHO) * 100}%`, top: "-6px" }}
              >
                <p className="text-center text-xs font-bold text-tinta">
                  Semana {pHover.semana}
                </p>
                <div className="mt-1 space-y-0.5">
                  {SERIES.map((s) => (
                    <p
                      key={s.clave}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-tintaSuave"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: s.linea }}
                      />
                      {s.etiqueta}:{" "}
                      <span className="tabular-nums text-tinta">
                        {fmt(pHover[s.clave])}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <svg
              ref={svgRef}
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              className="w-full"
              role="img"
              aria-label="Curvas simuladas de cobro acumulado: optimista, base y pesimista"
              onMouseMove={moverCursor}
              onMouseLeave={() => setSemanaHover(null)}
            >
              <defs>
                <pattern id="puntosFondo" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="1.6" cy="1.6" r="1.3" fill="#e2e8f0" />
                </pattern>
              </defs>
              <rect
                x={M_IZQ}
                y={M_SUP}
                width={ANCHO - M_IZQ - M_DER}
                height={ALTO - M_SUP - M_INF}
                fill="url(#puntosFondo)"
                opacity="0.5"
              />
              {[0.5, 1].map((f) => (
                <g key={f}>
                  <line
                    x1={M_IZQ}
                    y1={y(maximo * f)}
                    x2={ANCHO - M_DER}
                    y2={y(maximo * f)}
                    stroke="#e2e8f0"
                    strokeDasharray="1 7"
                    strokeLinecap="round"
                  />
                  <text
                    x={M_IZQ - 10}
                    y={y(maximo * f) + 3.5}
                    fontSize="10"
                    fill="#94a3b8"
                    textAnchor="end"
                  >
                    {fmt(maximo * f)}
                  </text>
                </g>
              ))}

              {pHover && (
                <line
                  x1={x(pHover.semana)}
                  y1={M_SUP}
                  x2={x(pHover.semana)}
                  y2={ALTO - M_INF}
                  stroke="#cbd5e1"
                  strokeDasharray="3 4"
                />
              )}

              {rutas.map((s) => (
                <g
                  key={s.clave}
                  style={{ opacity: opacidad(s.clave), transition: "opacity 160ms" }}
                >
                  <path
                    d={s.d}
                    fill="none"
                    stroke={s.linea}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={x(ultimo.semana)}
                    cy={y(ultimo[s.clave])}
                    r="4.5"
                    fill="#ffffff"
                    stroke={s.linea}
                    strokeWidth="2.5"
                  />
                  {pHover && (
                    <circle
                      cx={x(pHover.semana)}
                      cy={y(pHover[s.clave])}
                      r="5"
                      fill="#ffffff"
                      stroke={s.linea}
                      strokeWidth="2.5"
                    />
                  )}
                </g>
              ))}

              {finales.map((s) => (
                <text
                  key={s.clave}
                  x={ANCHO - M_DER + 14}
                  y={s.yFin + 4}
                  fontSize="11"
                  fontWeight="700"
                  fill={s.linea}
                  style={{ opacity: opacidad(s.clave), transition: "opacity 160ms" }}
                >
                  {s.etiqueta}
                </text>
              ))}

              {puntos.map((p) => (
                <text
                  key={p.semana}
                  x={x(p.semana)}
                  y={ALTO - M_INF + 20}
                  fontSize="10"
                  fill={semanaHover === p.semana ? "#334155" : "#94a3b8"}
                  fontWeight={semanaHover === p.semana ? 700 : 400}
                  textAnchor="middle"
                >
                  {p.semana}
                </text>
              ))}
              <text
                x={M_IZQ + (ANCHO - M_IZQ - M_DER) / 2}
                y={ALTO - 4}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="middle"
              >
                semana
              </text>
            </svg>
          </div>

          <div className="mt-2 flex justify-end">
            <div className="text-right">
              <p className="text-4xl font-bold tabular-nums tracking-tight text-tinta">
                {fmt(ultimo.base)}
              </p>
              <p className="text-xs font-medium text-tintaSuave">
                escenario base · semana 13 · simulado
              </p>
            </div>
          </div>
        </LienzoConAgentes>
      </section>
    </div>
  );
}
