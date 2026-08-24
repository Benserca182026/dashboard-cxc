"use client";

// Recorrido argumental — traduce la gramática visual del CRM de referencia
// (RonDesignLab, dribbble.com/shots/24659454) a nuestra materia.
//
// LO QUE FALTABA Y AHORA ESTÁ: la referencia tiene TRES capas, no dos.
//   página (gris, la base)  →  panel de columna (lámina fría translúcida)
//   →  tarjeta (blanca sólida)
// Yo tenía sólo página → tarjeta, y por eso se veía plano por más que le
// subiera la transparencia: la sensación de vidrio no nace de la opacidad de
// una capa, nace de ver una lámina A TRAVÉS de otra. Sin la capa del medio no
// hay nada que atravesar.
//
// Segundo cambio de fondo: sus tarjetas llevan un RÓTULO de 2-4 palabras
// ("Identify Issue Category"), no una frase. La frase larga y el porqué se
// fueron a un panel de detalle fijo — nada se infla al abrirse, como en la
// referencia, donde ninguna tarjeta crece.
//
// Lo que NO se copió, y por qué:
//   · Los avatares de la referencia son FOTOS de personas. Acá son monogramas:
//     todos los datos son ficticios y no corresponde poner caras reales.
//   · Sus conectores se RAMIFICAN (uno a varios). El nuestro es una cadena
//     lineal de premisas; dibujar ramas sería mentir sobre la forma del dato.
//   · No hay botones "+": serían adornos que no hacen nada.

import { useState } from "react";
import type { Argumento, Etapa } from "@/lib/argumento";
import { fuenteReferencia } from "@/lib/fuente";
import { AccionesVista } from "@/components/Encabezado";
import { FICHA_GAP_PX, FICHA_PX, NUM_AGENTES } from "@/components/Agentes";

/** Íconos chicos al pie de la tarjeta, en su PROPIA fila — antes se montaban
 *  sobre el título. Significan algo: el doble check marca que la etapa está
 *  derivada y cubierta por las pruebas; el calendario, que depende del corte. */
function IconosTarjeta({ oscuro }: { oscuro?: boolean }) {
  const c = oscuro ? "rgba(255,255,255,.42)" : "#b9bcc2";
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <path d="M1 5.2 L3.4 7.6 L8 2.4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.6 5.6 L7.4 7.6 L12.4 2" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="0.6" y="1.8" width="10.8" height="9.6" rx="2" stroke={c} strokeWidth="1.1" />
        <path d="M3.4 0.6 V3 M8.6 0.6 V3 M0.6 4.9 H11.4" stroke={c} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Monograma circular con anillo fino y badge — el equivalente honesto de la
 *  foto con anillo de la referencia, sin usar la cara de nadie. */
function Avatar({ marca, badge, oscuro }: { marca: string; badge?: number; oscuro?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white"
        style={{
          backgroundColor: oscuro ? "#2b2e35" : "#3f4249",
          boxShadow: oscuro
            ? "0 0 0 2px #16181d, 0 0 0 3px rgba(255,255,255,.22)"
            : "0 0 0 2px #ffffff, 0 0 0 3px rgba(22,24,29,.10)",
        }}
      >
        {marca}
      </span>
      {badge !== undefined && (
        <span
          className="absolute -bottom-1 -right-1 grid h-[15px] w-[15px] place-items-center rounded-full text-[9px] font-bold"
          style={
            oscuro
              ? { background: "#16181d", color: "#ffffff", boxShadow: "0 0 0 1px rgba(255,255,255,.30)" }
              : { background: "#ffffff", color: "#5b5e64", boxShadow: "0 0 0 1px rgba(22,24,29,.14)" }
          }
        >
          {badge}
        </span>
      )}
    </span>
  );
}

function Barras({ barras }: { barras: NonNullable<Etapa["barras"]> }) {
  const max = Math.max(1, ...barras.map((b) => Math.abs(b.valor)));
  return (
    <div className="space-y-1.5">
      {barras.map((b) => (
        <div key={b.etiqueta} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 truncate text-[10px] text-[#a0a2a6]">{b.etiqueta}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e2e4e8]">
            <span
              className="block h-full rounded-full transition-all duration-700"
              style={{
                width: `${(Math.abs(b.valor) / max) * 100}%`,
                backgroundColor: b.destacada ? "#3f4249" : "#cbcdd2",
              }}
            />
          </span>
          <span
            className="w-16 shrink-0 text-right text-[10px] font-semibold tabular-nums"
            style={{ color: b.destacada ? "#16181d" : "#a0a2a6" }}
          >
            {b.valor.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Geometría del mordisco de la franja. Se calcula a partir del grupo de
   fichas — cuatro de 44 px con 8 px de aire entre ellas, más 14 px de holgura
   a cada lado — para que el hueco siga al grupo si mañana hay cinco agentes.
   El SVG se genera acá porque el ancho es dinámico y CSS no puede interpolar
   una variable dentro de un data URI. */
/* La cápsula se dibuja al DOBLE de alto y se sube la mitad: así sólo entra su
   mitad inferior, y los extremos llegan al borde con tangente horizontal en
   vez de cortarlo en pico. Los picos que se veían eran eso: una cápsula
   entera cortando el borde recto con tangente casi vertical. */
const MUESCA_PROF = 46;
const MUESCA_H = MUESCA_PROF * 2;
const MUESCA_Y = -MUESCA_PROF;
const MUESCA_W = NUM_AGENTES * FICHA_PX + (NUM_AGENTES - 1) * FICHA_GAP_PX + 110;
const MUESCA_SVG =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' ` +
  `width='${MUESCA_W}' height='${MUESCA_H}'%3E%3Crect width='${MUESCA_W}' ` +
  `height='${MUESCA_H}' rx='${MUESCA_H / 2}' fill='%23000'/%3E%3C/svg%3E")`;

/** Un KPI de cartera, alojado al pie de su tarjeta. Antes vivían en una fila
 *  propia arriba de la página; ahí eran cuatro números sin conversación. Acá
 *  cada uno queda junto a la etapa que lo interroga. */
export interface KpiPie {
  etiqueta: string;
  valor: string;
  nota?: string;
  /** Proporción que dibuja el anillo. Lo esperable es 0–100, pero NO se
   *  fuerza: si la fórmula produce −113.8 el anillo lo muestra como −113.8 %
   *  y se marca fuera de escala. Recortar el número escondía el problema. */
  pct?: number;
  /** Advertencia sobre la PROCEDENCIA de la cifra: qué le falta al dato para
   *  ser lo que su etiqueta promete. Se imprime junto al valor, siempre
   *  visible, porque un número contaminado sin rótulo se lee como bueno. */
  advertencia?: string;
}

/** Anillo de proporción. El mismo en las cuatro tarjetas, porque las cuatro
 *  afirman una parte de un todo — cambiar de forma en cada una obligaría a
 *  releer el gráfico cada vez.
 *
 *  EL CLAMP SE FUE DEL NÚMERO. Antes esta función hacía
 *  `Math.max(0, Math.min(100, pct))` y usaba ese resultado para las DOS cosas:
 *  el arco y la cifra del centro. Consecuencia: un −113.8% se leía "0%", es
 *  decir, un déficit mayor que el total se mostraba como si no pasara nada.
 *  Ahora el recorte es SÓLO del dibujo — un anillo no puede dar más de una
 *  vuelta ni girar al revés — y el número del centro se imprime tal cual, con
 *  su signo. Cuando el valor se sale de 0–100 el anillo se marca (trazo
 *  punteado + color de alarma) para que no se confunda un arco lleno "real"
 *  con uno recortado, y aparece el rótulo "fuera de escala" bajo la cifra. */
function Anillo({ pct, oscuro }: { pct: number; oscuro?: boolean }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const finito = Number.isFinite(pct);
  /** Sólo para DIBUJAR: el arco vive obligadamente entre 0 y 100. */
  const cubierto = finito ? Math.max(0, Math.min(100, pct)) : 0;
  /** El número NO se recorta. Los que caen en rango se siguen viendo como
   *  antes (entero); los que se salen conservan el decimal, porque ahí la
   *  magnitud exacta es justamente la noticia (−113.8, no "−114"). */
  const enRango = finito && pct >= 0 && pct <= 100;
  const texto = !finito
    ? "s/d"
    : enRango
      ? `${Math.round(pct)}%`
      : `${pct.toFixed(1)}%`;
  // El círculo interior mide ~52 px de ancho útil: una cifra larga con signo
  // no entra a 16 px. Se achica en vez de desbordar la tarjeta.
  const tam = texto.length <= 4 ? 16 : texto.length <= 6 ? 13 : 11;
  const alarma = oscuro ? "#ffb4a8" : "#c0392b";
  return (
    <svg
      width="78"
      height="78"
      viewBox="0 0 78 78"
      role="img"
      aria-label={`${texto}${enRango ? "" : " — fuera de la escala 0–100 %; el anillo está recortado"}`}
      className="shrink-0"
    >
      <circle
        cx="39"
        cy="39"
        r={R}
        fill="none"
        stroke={oscuro ? "rgba(255,255,255,.16)" : "#e6eaf1"}
        strokeWidth="8"
      />
      <circle
        cx="39"
        cy="39"
        r={R}
        fill="none"
        stroke={enRango ? (oscuro ? "#ffffff" : "#3f4249") : alarma}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={
          enRango
            ? `${(C * cubierto) / 100} ${C}`
            : // Recortado: el trazo punteado avisa que lo que se ve no es la
              // medida completa. Si el valor es negativo no hay arco que
              // dibujar, y queda sólo el aro de fondo con el número en rojo.
              `3 4`
        }
        transform="rotate(-90 39 39)"
        opacity={enRango ? 1 : cubierto === 0 ? 0.35 : 1}
      />
      <text
        x="39"
        y={enRango ? 43 : 39}
        textAnchor="middle"
        fontSize={tam}
        fontWeight="700"
        fill={enRango ? (oscuro ? "#ffffff" : "#16181d") : alarma}
      >
        {texto}
      </text>
      {!enRango && (
        <text
          x="39"
          y="51"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          letterSpacing="0.04em"
          fill={alarma}
        >
          FUERA DE ESCALA
        </text>
      )}
    </svg>
  );
}

/** Una columna = la tarjeta y su etiqueta. La lámina intermedia se quitó: con
 *  ella cada tarjeta arrastraba un marco pálido que se leía como un borde
 *  invisible mal recortado. Ahora la tarjeta se apoya directo sobre el
 *  lienzo, que ya tiene el degradado. */
function Columna({ etapa, indice, activa, onElegir, kpi }: {
  etapa: Etapa; indice: number; activa: boolean; onElegir: () => void; kpi?: KpiPie;
}) {
  const esConclusion = etapa.tipo === "conclusion";
  return (
    <div
      className="entrada-suave flex min-w-0 flex-1 flex-col px-1.5"
      style={{ animationDelay: `${indice * 90}ms` }}
    >
      <button
        onClick={onElegir}
        aria-pressed={activa}
        className={`flex min-h-[212px] w-full flex-1 flex-col p-5 text-left transition ${
          esConclusion ? "tarjeta-oscura" : "tarjeta-calada"
        }`}
        style={activa ? { transform: "translateY(-2px)" } : undefined}
      >
        {/* Círculo y rótulo, nada más. La frase larga que había acá se fue: en
            la referencia la tarjeta lleva un rótulo de dos o tres palabras y
            punto. Lo que antes se contaba con texto ahora lo dice el anillo. */}
        <span className="flex items-center gap-3">
          <Avatar marca={esConclusion ? "→" : String(indice + 1)} badge={etapa.barras?.length} oscuro={esConclusion} />
          <span
            className={`texto-titulo min-w-0 flex-1 text-[14px] leading-[1.3] ${esConclusion ? "text-white" : ""}`}
          >
            {etapa.rotulo}
          </span>
        </span>

        {/* El gráfico, en el lugar donde estaba el párrafo. Mismo anillo en las
            cuatro tarjetas: la forma no cambia, sólo cuánto se llena. */}
        {kpi?.pct !== undefined && (
          <span className="my-auto flex items-center gap-3 pt-3">
            <Anillo pct={kpi.pct} oscuro={esConclusion} />
            <span className="min-w-0 flex-1">
              <span
                className="block text-[9px] font-semibold uppercase leading-tight tracking-[0.08em]"
                style={{ color: esConclusion ? "rgba(255,255,255,.5)" : "#a0a2a6" }}
              >
                {kpi.etiqueta}
              </span>
              <span
                className={`mt-0.5 block text-[17px] font-bold tabular-nums leading-none ${
                  esConclusion ? "text-white" : "text-tinta"
                }`}
              >
                {kpi.valor}
              </span>
              {kpi.advertencia && (
                <span
                  className="mt-1 block text-[9px] font-semibold leading-[1.35]"
                  style={{ color: esConclusion ? "#ffb4a8" : "#c0392b" }}
                >
                  ⚠ {kpi.advertencia}
                </span>
              )}
            </span>
          </span>
        )}

        {/* Íconos anclados al pie, alineados con el texto. */}
        <span className="mt-auto flex items-center justify-end pt-3">
          <IconosTarjeta oscuro={esConclusion} />
        </span>
      </button>
      <p className="etiqueta-fase mt-2.5 px-1 pb-0.5">{etapa.fase}</p>
    </div>
  );
}

/** Línea recta y fina con un nodito en cada extremo, como los de la referencia
 *  (antes era una onda, que ahí no existe). */
function Conector() {
  return (
    <div className="hidden shrink-0 items-center self-start pt-[7.35rem] lg:flex" aria-hidden>
      <svg width="34" height="10" viewBox="0 0 34 10" fill="none">
        <line x1="3" y1="5" x2="31" y2="5" stroke="#ccd7e8" strokeWidth="1" />
        <circle cx="3" cy="5" r="2.6" fill="#fff" stroke="#b9c7dd" strokeWidth="1" />
        <circle cx="31" cy="5" r="2.6" fill="#fff" stroke="#b9c7dd" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function RecorridoArgumental({ arg, agentes, kpis = [], rotulo = "El caso de la cartera" }: {
  arg: Argumento; agentes?: React.ReactNode; kpis?: KpiPie[];
  /** Rótulo de la franja. Sin valor sigue diciendo lo de siempre: la página 1
   *  no cambia y cada módulo puede nombrar su propio caso. */
  rotulo?: string;
}) {
  const inicial = arg.etapas.find((e) => e.tipo === "hallazgo") ?? arg.etapas.at(-1)!;
  const [elegida, setElegida] = useState<string>(inicial.id);
  const etapa = arg.etapas.find((e) => e.id === elegida) ?? inicial;

  return (
    <section
      className={`${fuenteReferencia.variable} lienzo-referencia`}
      style={
        {
          // El mordisco es de ESTE panel, el mismo que contiene las tarjetas.
          // Antes lo llevaba una banda interior que era un segundo rectángulo
          // dibujado encima; esa caja se eliminó.
          "--muesca": MUESCA_SVG,
          "--muesca-w": `${MUESCA_W}px`,
          "--muesca-h": `${MUESCA_H}px`,
          "--muesca-y": `${MUESCA_Y}px`,
        } as React.CSSProperties
      }
    >
      {/* La fila del panel: rótulo a la izquierda, fichas asomándose por el
          mordisco en el centro, acciones a la derecha. Ya no es una caja: es
          sólo una fila que alinea. */}
      <div className="franja-panel flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="texto-titulo shrink-0 text-[14.5px] leading-tight">{rotulo}</p>

        {agentes && <div className="flex min-w-0 flex-1 justify-center">{agentes}</div>}

        <AccionesVista />
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="texto-dato max-w-2xl text-[11.5px] leading-relaxed">
          <span className="texto-titulo">{arg.titular} · {arg.valorTitular}.</span>{" "}
          <span className="texto-titulo">Lectura ingenua:</span> {arg.lecturaIngenua}
        </p>
        <span
          className="shrink-0 rounded-pastilla px-3 py-1.5 text-[11px] font-semibold"
          style={{ background: "#fff", color: "#5b5e64", boxShadow: "0 1px 2px rgba(22,24,29,.06)" }}
        >
          {arg.sinHallazgo ? "sin caso puntual" : "hay un caso puntual"}
        </span>
      </div>

      {/* Fila de columnas: todas de la misma altura, alineadas. */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {arg.etapas.map((e, i) => (
          <div key={e.id} className="flex min-w-0 flex-1 lg:contents">
            <Columna
              etapa={e}
              indice={i}
              activa={e.id === elegida}
              onElegir={() => setElegida(e.id)}
              kpi={kpis[i]}
            />
            {i < arg.etapas.length - 1 && <Conector />}
          </div>
        ))}
      </div>    </section>
  );
}

/** El mismo envoltorio del panel de arriba, para reutilizarlo en los bloques
 *  de abajo: lienzo con degradado, mordisco en el borde superior y las fichas
 *  de agentes asomadas en él. Así los tres bloques de la página son la misma
 *  pieza con distinto contenido, que es lo que hace la referencia. */
export function LienzoConAgentes({
  titulo,
  agentes,
  children,
}: {
  titulo: string;
  agentes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${fuenteReferencia.variable} lienzo-referencia`}
      style={
        {
          "--muesca": MUESCA_SVG,
          "--muesca-w": `${MUESCA_W}px`,
          "--muesca-h": `${MUESCA_H}px`,
          "--muesca-y": `${MUESCA_Y}px`,
        } as React.CSSProperties
      }
    >
      {/* Las fichas van centradas respecto al PANEL, no al espacio que sobra a
          la derecha del título. Por eso el título se saca del flujo: si compite
          por el ancho, el centro del grupo se corre a un lado. */}
      <div className="franja-panel flex flex-col">
        <div className="flex justify-center">{agentes}</div>
        {/* El título baja debajo de las fichas en vez de compartir renglón: en
            media pantalla no cabían los dos y el rótulo quedaba tapado. Las
            fichas mandan porque tienen que caer dentro del mordisco. */}
        <p className="texto-titulo mt-1 text-[14.5px] leading-tight">{titulo}</p>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
