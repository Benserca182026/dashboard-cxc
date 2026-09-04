"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type {
  AgenteVentasB18,
  AlcanceVentasB18,
  BarraSerieB18,
  LecturaAgenteVentasB18,
  MapaVentasB18,
  SlotVentasB18,
  SubKpiB18,
} from "@/lib/agentes-ventas-b18";
import type { EstacionalidadVenta } from "@/lib/lecturas-ventas-reales";

/**
 * Mapa B18 de Ventas.
 *
 * Mismo molde que la clasificación de productos —lateral de agentes, cuatro
 * roles alrededor de un reporte central, botón B18— pero con otro contenido: acá
 * los cuatro agentes contestan UNA pregunta, de dónde viene el crecimiento, y el
 * B18 abre un gráfico de barras anual que se despliega a meses.
 *
 * No se generaliza con MapaB18Producto a propósito: la lectura de ventas es una
 * serie temporal con períodos parciales, y la de productos es un reparto de SKU.
 * Parametrizar una en la otra obligaría a inventar un tipo que no describe a
 * ninguna de las dos.
 */

const pct = (valor: number) => `${valor.toFixed(2)}%`;

/**
 * Corta un párrafo justo después de su primera oración (busca ". ", nunca un
 * punto decimal porque esos van pegados a un dígito, no a un espacio) para que
 * el veredicto viva en una línea y el resto del razonamiento —el "por qué"—
 * quede detrás de un expandible en vez de siempre visible.
 *
 * Es un recorte de PRESENTACIÓN, no de cálculo: el texto completo sigue siendo
 * exactamente el que arma `lib/agentes-ventas-b18.ts`; acá sólo se decide
 * cuánto se muestra sin que alguien pulse "Ver por qué".
 */
function partirFrase(texto: string): { cabeza: string; resto: string } {
  if (!texto) return { cabeza: "", resto: "" };
  const corte = texto.indexOf(". ");
  if (corte === -1) return { cabeza: texto, resto: "" };
  return { cabeza: texto.slice(0, corte + 1), resto: texto.slice(corte + 2).trim() };
}

/** "MOTOSVENTO GT, SOCIEDAD ANONIMA" → "MOTOSVENTO GT…" para que quepa junto a la barra. */
function truncarNombre(nombre: string, limite = 14) {
  return nombre.length > limite ? `${nombre.slice(0, limite - 1)}…` : nombre;
}

/** Micrográfico de la tarjeta lateral: la serie anual, con el año parcial rayado. */
function MicroSerie({ agente }: { agente: LecturaAgenteVentasB18 }) {
  return <div className="b18-mini-pareto" aria-label={`Serie anual de ${agente.nombre}`}>
    {agente.micro.map((punto) => <i
      key={punto.etiqueta}
      className={punto.parcial ? "b18-vt-parcial" : undefined}
      style={{ height: `${Math.max(punto.alto, 10)}%`, backgroundColor: agente.color }}
    />)}
  </div>;
}

function TarjetaAgente({ agente, activa, onSeleccionar }: { agente: LecturaAgenteVentasB18; activa: boolean; onSeleccionar: () => void }) {
  return <button type="button" className={`b18-rol-card b18-rol-${agente.slot} ${activa ? "is-active" : ""}`} onClick={onSeleccionar} aria-pressed={activa} aria-label={`${agente.nombre}. Abrir serie anual y mensual`} style={{ "--b18-role": agente.color } as CSSProperties}>
    <span className="b18-connector" aria-hidden="true" />
    <div className="b18-rol-visual">
      <div className="b18-rol-heading"><span>{agente.iniciales}</span><strong>{agente.titulo}</strong></div>
      <div className="b18-rol-content"><div className="b18-rol-kpi"><strong>{agente.kpi}</strong><span>{agente.kpiEtiqueta}</span></div><MicroSerie agente={agente} /></div>
      <p className="b18-rol-resumen">{agente.senal}</p>
    </div>
  </button>;
}

/**
 * Los cuatro huecos del grid, en el orden en que el molde B18 los coloca
 * alrededor del reporte. Los sub-KPIs no tienen rol propio —no detectan ni
 * recomiendan— pero ocupan las mismas cuatro posiciones, así que heredan la
 * clase de slot para no reescribir la maquetación ni los conectores.
 */
const SLOTS_GRID: SlotVentasB18[] = ["detecta", "explica", "prioriza", "recomienda"];

/**
 * Tarjeta de sub-lectura.
 *
 * La jerarquía está DELIBERADAMENTE al revés de `TarjetaAgente`: primero el
 * dato ("+21.97% sin Top 5") y después cómo se llama la medida. Con el orden
 * contrario, cuatro rótulos genéricos parecidos entre sí tapaban cuatro cifras
 * distintas y había que leer la tarjeta entera para saber cuál era cuál.
 *
 * Sigue siendo un botón: las cuatro tarjetas del grid son la única puerta al
 * drill-down del agente, y convertirlas en texto muerto dejaría la serie anual
 * y la ficha del dato sin forma de abrirse.
 */
/**
 * Mini-gráfico de una tarjeta de sub-KPI: 2 a 6 barras desde una línea base,
 * no desde cero-abajo, porque `valor` puede ser negativo (un mes que cae) —
 * si todos los puntos son positivos (ej. TTM, dos montos) la base baja al
 * piso del recuadro en vez de quedar flotando a la mitad.
 */
function MiniSerieDivergente({ serie, color }: { serie: { etiqueta: string; valor: number; texto: string }[]; color: string }) {
  if (!serie || serie.length === 0) return null;
  const hayNegativos = serie.some((p) => p.valor < 0);
  const maximoAbs = Math.max(...serie.map((p) => Math.abs(p.valor)), 1);
  const ancho = 100, alto = 40, techo = 4;
  const base = hayNegativos ? alto / 2 : alto - techo;
  const paso = ancho / serie.length, w = Math.min(paso * 0.55, 14);
  return <svg className="b18-vt-subkpi-svg" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={serie.map((p) => `${p.etiqueta}: ${p.texto}`).join(", ")}>
    <line x1="0" y1={base} x2={ancho} y2={base} className="b18-vt-subkpi-base" />
    {serie.map((p, i) => {
      const x = paso * i + paso / 2;
      const h = Math.max((Math.abs(p.valor) / maximoAbs) * (base - techo), 1.5);
      const y = p.valor >= 0 ? base - h : base;
      return <g key={`${p.etiqueta}-${i}`}>
        <title>{`${p.etiqueta}: ${p.texto}`}</title>
        <rect x={x - w / 2} y={y} width={w} height={h} rx="1" style={{ fill: color, opacity: p.valor >= 0 ? 1 : 0.45 }} />
      </g>;
    })}
  </svg>;
}

/**
 * Dependencia de clientes: barras HORIZONTALES —los nombres son largos y una
 * barra vertical no les deja sitio— cada una con el nombre corto y el monto/%
 * pegados a su propia barra. El gráfico lleva el dato: por eso la lista de
 * texto plano que antes repetía "CLIENTE Qmonto · CLIENTE Qmonto…" debajo ya
 * no hace falta y se quita en `TarjetaSubKpi`.
 */
function BarraDependencia({ serie, color }: { serie: { etiqueta: string; valor: number; texto: string }[]; color: string }) {
  if (!serie || serie.length === 0) return null;
  const maximo = Math.max(...serie.map((p) => p.valor), 1);
  return <div className="b18-vt-subkpi-dep" role="img" aria-label={serie.map((p) => `${p.etiqueta}: ${p.texto}`).join(", ")}>
    {serie.map((p, indice) => <div key={`${p.etiqueta}-${indice}`} className="b18-vt-subkpi-dep-fila" title={`${p.etiqueta} · ${p.texto}`}>
      <span className="b18-vt-subkpi-dep-nombre">{truncarNombre(p.etiqueta)}</span>
      <span className="b18-vt-subkpi-dep-track"><i style={{ width: `${Math.max((p.valor / maximo) * 100, 6)}%`, backgroundColor: color }} /></span>
      <b className="b18-vt-subkpi-dep-valor">{p.texto}</b>
    </div>)}
  </div>;
}

/**
 * Consistencia del crecimiento: una barra POR MES con semáforo verde/rojo
 * —subió o bajó ese mes es la pregunta central de esta tarjeta, no un color
 * decorativo— y su % arriba, rotado para que quepa en una columna angosta.
 * Se dibujan TODOS los meses comparables, no sólo los últimos seis: con scroll
 * horizontal (mismo patrón que la tarjeta de Estacionalidad) el historial
 * completo entra sin comprimirse hasta volverse ilegible.
 */
function BarraConsistencia({ serie }: { serie: { etiqueta: string; valor: number; texto: string }[] }) {
  if (!serie || serie.length === 0) return null;
  const maximoAbs = Math.max(...serie.map((p) => Math.abs(p.valor)), 1);
  return <div className="b18-vt-subkpi-cons" role="img" aria-label={serie.map((p) => `${p.etiqueta}: ${p.texto}`).join(", ")}>
    {serie.map((p, indice) => {
      const alturaPx = Math.max((Math.abs(p.valor) / maximoAbs) * 44, 3);
      const sube = p.valor >= 0;
      return <div key={`${p.etiqueta}-${indice}`} className={`b18-vt-subkpi-cons-col ${sube ? "is-sube" : "is-baja"}`} title={`${p.etiqueta} · ${p.texto}`}>
        <b>{p.texto}</b>
        <i style={{ height: `${alturaPx}px` }} />
        <span>{p.etiqueta}</span>
      </div>;
    })}
  </div>;
}

/** Calidad del alcance: una barra por año, con el año y su tasa encima. */
function BarraCalidad({ serie, color }: { serie: { etiqueta: string; valor: number; texto: string }[]; color: string }) {
  if (!serie || serie.length === 0) return null;
  const maximoAbs = Math.max(...serie.map((p) => Math.abs(p.valor)), 1);
  return <div className="b18-vt-subkpi-calidad" role="img" aria-label={serie.map((p) => `${p.etiqueta}: ${p.texto}`).join(", ")}>
    {serie.map((p, indice) => {
      const alturaPx = Math.max((Math.abs(p.valor) / maximoAbs) * 44, 3);
      return <div key={`${p.etiqueta}-${indice}`} className="b18-vt-subkpi-calidad-col" title={`${p.etiqueta} · ${p.texto}`}>
        <b>{p.texto}</b>
        <i style={{ height: `${alturaPx}px`, backgroundColor: color }} />
        <span>{p.etiqueta}</span>
      </div>;
    })}
  </div>;
}

/** Elige el gráfico según qué sub-KPI es: cada uno lee mejor con una forma distinta. */
function GraficoSubKpi({ sub }: { sub: SubKpiB18 }) {
  if (!sub.serie || sub.serie.length === 0) return null;
  if (sub.id === "dependencia") return <BarraDependencia serie={sub.serie} color={sub.color} />;
  if (sub.id === "consistencia") return <BarraConsistencia serie={sub.serie} />;
  if (sub.id === "calidad") return <BarraCalidad serie={sub.serie} color={sub.color} />;
  return <MiniSerieDivergente serie={sub.serie} color={sub.color} />;
}

/**
 * Las tres tarjetas de dependencia/consistencia/calidad ya muestran el dato
 * de cada barra ENCIMA de la barra misma (`GraficoSubKpi`); la lista de texto
 * plano que había debajo ("CLIENTE Qmonto · CLIENTE Qmonto…") repetía
 * exactamente eso sin agregar nada, así que se quita para esas tres. Ritmo no
 * tiene ese patrón —su `detalle` es una nota explicativa, no una lista— y
 * conserva el suyo.
 */
const TIENE_BARRAS_ETIQUETADAS = new Set(["dependencia", "consistencia", "calidad"]);

function TarjetaSubKpi({ sub, slot, agente, onAbrir }: { sub: SubKpiB18; slot: SlotVentasB18; agente: LecturaAgenteVentasB18; onAbrir: () => void }) {
  const veredicto = partirFrase(sub.veredicto);
  const robustez = partirFrase(sub.robustez);
  const ocultarLista = Boolean(sub.serie && sub.serie.length > 0 && TIENE_BARRAS_ETIQUETADAS.has(sub.id));
  const tieneMas = Boolean(veredicto.resto || robustez.resto);
  return <div className={`b18-rol-card b18-rol-${slot} b18-vt-sub`} style={{ "--b18-role": sub.color } as CSSProperties}>
    <span className="b18-connector" aria-hidden="true" />
    {/* El botón cubre sólo la lectura —no el expandible "Ver por qué"— porque
        un <details> dentro de un <button> es HTML inválido y, peor, el click
        en el <summary> abriría el drill-down en vez de sólo desplegar texto. */}
    <button type="button" className="b18-vt-sub-boton" onClick={onAbrir} aria-label={`${sub.etiqueta}: ${sub.titulo}. Abrir la lectura completa de ${agente.nombre}`}>
      <div className="b18-rol-visual">
        <span className="b18-vt-sub-etiqueta">{sub.etiqueta}</span>
        <strong className="b18-vt-sub-titulo">{sub.titulo}</strong>
        <GraficoSubKpi sub={sub} />
        <p className="b18-vt-sub-veredicto">{veredicto.cabeza}</p>
        {ocultarLista ? null : <p className="b18-vt-sub-detalle">{sub.detalle}</p>}
        <p className="b18-vt-sub-robustez">{robustez.cabeza}</p>
      </div>
    </button>
    {tieneMas ? <details className="b18-vt-mas">
      <summary>Ver por qué</summary>
      {veredicto.resto ? <p>{veredicto.resto}</p> : null}
      {robustez.resto ? <p>{robustez.resto}</p> : null}
    </details> : null}
  </div>;
}

// ── Filtro de alcance temporal y su declaración ─────────────────────────────
//
// El filtro es el punto más peligroso de esta página, y por eso viene pegado a
// una declaración que no se puede cerrar ni esconder detrás de un tooltip.
//
// La página entera descansa en una regla: se comparan rangos de días
// equivalentes, nunca un año parcial contra uno entero. Mientras hubo un solo
// alcance, esa regla se resolvía una vez. Con seis botones, cualquiera puede
// pulsar "2023" y suponer que se está comparando 2023 completo contra 2022
// completo — cuando de 2022 el histórico sólo tiene 146 días. Por eso al lado
// del selector siempre se lee QUÉ se está comparando contra QUÉ, y cuando no
// hay comparación posible se lee el motivo en vez de un porcentaje.

function FiltroAlcance({ alcances, activo, onElegir }: { alcances: AlcanceVentasB18[]; activo: string; onElegir: (id: string) => void }) {
  return <div className="b18-vt-alcance" role="group" aria-label="Alcance temporal de las cuatro sub-lecturas">
    {alcances.map((alcance) => <button
      key={alcance.id}
      type="button"
      aria-pressed={alcance.id === activo}
      className={`${alcance.id === activo ? "is-activo" : ""} ${alcance.parcial ? "is-parcial" : ""}`}
      onClick={() => onElegir(alcance.id)}
      title={`${alcance.resumen}${alcance.aviso ? ` · ${alcance.aviso}` : ""}`}
    >
      {alcance.etiqueta}
      {alcance.parcial ? <em>parcial</em> : null}
    </button>)}
  </div>;
}

/**
 * Lo que hay que leer ANTES de mirar las cuatro tarjetas.
 *
 * Tres estados, tres colores, y ninguno es decorativo:
 *   · sin comparable → el alcance no tiene contra qué medirse (2022)
 *   · parcial o recortado → la comparación vale, pero no cubre el año entero
 *   · completo → los dos lados son años calendario enteros
 */
function DeclaracionAlcance({ alcance }: { alcance: AlcanceVentasB18 }) {
  const estado = alcance.sinComparacion
    ? "is-sinbase"
    : alcance.parcial || alcance.comparacionRecortada
      ? "is-parcial"
      : "is-completo";
  const titulo = alcance.sinComparacion
    ? `${alcance.etiqueta} · sin comparable`
    : alcance.parcial || alcance.comparacionRecortada
      ? `${alcance.etiqueta} · comparación recortada a días equivalentes`
      : `${alcance.etiqueta} · años calendario completos`;
  const icono = estado === "is-completo" ? "✓" : estado === "is-parcial" ? "✂" : "⚠";
  // Mismo texto que siempre se calculó acá — sólo se decide cuánto se ve sin
  // pulsar "Ver por qué": la primera oración es el veredicto de una línea, el
  // resto (por qué está recortado, contra qué se compara en detalle) se mueve
  // al expandible en vez de ocupar 6-7 líneas siempre visibles en el panel.
  const textoCompleto = `${alcance.aviso ? `${alcance.aviso} ` : `${alcance.etiqueta} se observa entero: ${alcance.resumen}. `}${alcance.comparacion}`;
  const { cabeza, resto } = partirFrase(textoCompleto);
  return <div className={`b18-vt-alcance-decl ${estado}`} aria-live="polite">
    <b><span className="b18-vt-alcance-icono" aria-hidden="true">{icono}</span>{titulo}</b>
    <p>{cabeza}</p>
    {resto ? <details className="b18-vt-mas">
      <summary>Ver por qué</summary>
      <p>{resto}</p>
    </details> : null}
  </div>;
}

// ── Estacionalidad: el mismo mes, todos los años ────────────────────────────
//
// Doce columnas —una por mes— y dentro de cada una, una barra por año. Es la
// única forma de separar "vendimos más" de "llegó la temporada": julio de 2026
// contra julio de 2025 y julio de 2024, no julio contra junio.
//
// EL PUNTO DELICADO SON LAS CASILLAS QUE FALTAN. 2022 sólo tiene ago-dic y 2026
// sólo ene-ago: once de las sesenta casillas nunca se observaron. Dibujarlas en
// cero diría "ese mes no vendimos", que es falso, y además hundiría el promedio
// de cada mes con un año que no existe en los datos. Van como hueco rayado, sin
// barra y sin número, y el conteo de huecos viaja en la fila.
//
// Hecho a mano con grid y elementos vacíos: no entra ninguna librería de
// gráficos por un chart de sesenta rectángulos.

const COLORES_ANIO = ["#0789e6", "#7b2bf4", "#16a34a", "#f97316", "#e11d48", "#0d9488"];

/** Cifra corta para que quepa rotada sobre una barra de 9px: Q1.2M / Q600K. */
function abreviarQ(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) return `Q${(valor / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `Q${Math.round(valor / 1000)}K`;
  return `Q${Math.round(valor)}`;
}

function Estacionalidad({ estacionalidad, fmt }: { estacionalidad: EstacionalidadVenta; fmt: (valor: number) => string }) {
  const [mesAbierto, setMesAbierto] = useState<number | null>(null);
  if (estacionalidad.filas.length === 0) return null;
  const colorDe = (anio: string) => COLORES_ANIO[estacionalidad.anios.indexOf(anio) % COLORES_ANIO.length];
  // Sin selección se muestra el mes más fuerte del histórico en vez de un panel
  // vacío: el valor exacto de cada barra tiene que poder verse siempre, no sólo
  // después de que alguien adivine que las columnas se pulsan.
  const fila = (mesAbierto !== null ? estacionalidad.filas.find((item) => item.mes === mesAbierto) : null) ?? estacionalidad.mesFuerte;

  return <section className="b18-vt-estacion" aria-label="Estacionalidad: el mismo mes comparado entre todos los años">
    <div className="b18-vt-estacion-cabecera">
      <div><span>Estacionalidad</span><strong>El mismo mes, todos los años</strong></div>
      <ul className="b18-vt-estacion-leyenda">
        {estacionalidad.anios.map((anio) => <li key={anio}><i style={{ backgroundColor: colorDe(anio) }} />{anio}</li>)}
        <li className="b18-vt-estacion-leyenda-hueco"><i />sin dato</li>
        <li className="b18-vt-estacion-leyenda-parcial"><i />parcial</li>
      </ul>
    </div>

    <div className="b18-vt-estacion-grafico">
      {estacionalidad.filas.map((item) => <button
        key={item.mes}
        type="button"
        className={`b18-vt-estacion-mes ${fila?.mes === item.mes ? "is-abierto" : ""}`}
        aria-pressed={fila?.mes === item.mes}
        onClick={() => setMesAbierto(mesAbierto === item.mes ? null : item.mes)}
        aria-label={`${item.etiqueta}: ${item.celdas.map((celda) => `${celda.anio} ${celda.valor === null ? "sin dato" : fmt(celda.valor)}${celda.parcial ? " parcial" : ""}`).join(", ")}`}
      >
        <div className="b18-vt-estacion-barras">
          {item.celdas.map((celda) => celda.observado
            ? <span key={celda.periodo} className="b18-vt-estacion-barra">
                {/* La cifra va rotada ENCIMA de su propia barra, no en una
                    lista aparte: es la misma regla que el resto de tarjetas
                    del agente — el gráfico lleva el dato. */}
                <b style={{ color: colorDe(celda.anio) }}>{abreviarQ(celda.valor ?? 0)}</b>
                <i
                  className={celda.parcial ? "is-parcial" : undefined}
                  style={{ height: `${Math.max(celda.alto, 1.5)}%`, backgroundColor: colorDe(celda.anio) }}
                  title={`${celda.periodo} · ${fmt(celda.valor ?? 0)} · ${celda.nota}`}
                />
              </span>
            // Un hueco, NO una barra de altura cero: no tiene color de año, no
            // se apoya en la línea base y no entra en ningún promedio.
            : <s key={celda.periodo} title={celda.nota} aria-hidden="true" />)}
        </div>
        <strong>{item.etiqueta}</strong>
        <small>{item.sinDato > 0 ? `${item.sinDato} sin dato` : `${item.completos} años`}</small>
      </button>)}
    </div>

    {fila ? <div className="b18-vt-estacion-detalle">
      <p>
        <b>{fila.etiqueta}</b>
        {mesAbierto === null ? <em>mes más fuerte del histórico · pulsá cualquier mes para ver el suyo</em> : <em>{fila.completos} {fila.completos === 1 ? "año observado entero" : "años observados enteros"}</em>}
      </p>
      <ul>
        {fila.celdas.map((celda) => <li key={celda.periodo} className={celda.observado ? (celda.parcial ? "is-parcial" : undefined) : "is-vacia"}>
          <i style={celda.observado ? { backgroundColor: colorDe(celda.anio) } : undefined} />
          <span>{celda.anio}</span>
          <b>{celda.valor === null ? "sin dato" : fmt(celda.valor)}</b>
          <small>{celda.nota}</small>
        </li>)}
      </ul>
      <p className="b18-vt-estacion-promedio">
        {fila.promedioCompletos === null
          ? `Ningún año observó ${fila.etiqueta} entero: no hay promedio que calcular sin mezclar meses completos con meses cortados.`
          : `Promedio de los ${fila.completos} años que observaron ${fila.etiqueta} ENTERO: ${fmt(fila.promedioCompletos)}${fila.mejor ? ` · mejor ${fila.mejor.anio} con ${fmt(fila.mejor.valor)}` : ""}. Los meses parciales y las casillas sin dato quedan fuera del promedio: promediarlos empujaría la media hacia abajo por calendario, no por negocio.`}
      </p>
    </div> : null}

    <p className="b18-vt-estacion-nota">{estacionalidad.nota}</p>
  </section>;
}

/** Barras horizontales de una serie. Marca explícitamente el período parcial. */
function Serie({ filas, color, etiqueta }: { filas: BarraSerieB18[]; color: string; etiqueta: string }) {
  if (filas.length === 0) return <p className="b18-vt-vacio">Sin períodos observados.</p>;
  return <div className="b18-vt-serie" aria-label={etiqueta}>
    {filas.map((fila) => <div key={fila.clave} className={fila.parcial ? "is-parcial" : undefined}>
      <span>{fila.etiqueta}{fila.parcial ? <em>parcial</em> : null}</span>
      <b>{fila.texto}</b>
      <i style={{ width: `${fila.ancho}%`, backgroundColor: color }} />
      <small>{fila.parcial && fila.nota ? `${fila.nota} · ` : ""}{fila.detalle}</small>
    </div>)}
  </div>;
}

function Pico({ pico, titulo }: { pico: LecturaAgenteVentasB18["picoAnual"]; titulo: string }) {
  if (!pico) return <div className="b18-vt-pico"><span>{titulo}</span><strong>Sin período completo</strong><small>Todos los períodos observados están cortados.</small></div>;
  return <div className="b18-vt-pico"><span>{titulo}</span><strong>{pico.etiqueta} · {pico.texto}</strong><small>{pico.nota}</small></div>;
}

// ── Dashboard B18: barras anuales que se despliegan a meses ─────────────────

function DashboardVentasB18({ mapa, fmt, onCerrar, onAbrirAgente }: { mapa: MapaVentasB18; fmt: (valor: number) => string; onCerrar: () => void; onAbrirAgente: (id: AgenteVentasB18) => void }) {
  const { anios, mesesPorAnio, corte, agentes, ytd } = mapa;
  const [anioAbierto, setAnioAbierto] = useState<string | null>(null);
  const maximo = Math.max(0, ...anios.map((anio) => anio.valor));
  const meses = anioAbierto ? mesesPorAnio[anioAbierto] ?? [] : [];
  const maximoMes = Math.max(0, ...meses.map((mes) => mes.valor));

  return <div className="b18-diagnostico-velo" role="presentation" onPointerDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
    <section className="b18-diagnostico b18-dashboard" role="dialog" aria-modal="true" aria-labelledby="dashboard-ventas-b18-titulo">
      <header>
        <div>
          <p>Dashboard B18 · lectura integral</p>
          <h2 id="dashboard-ventas-b18-titulo">Ventas por año</h2>
          <div className="b18-vt-declaracion"><strong>{mapa.declaracion}</strong><span>fuente {mapa.fuente} · corte {corte}</span></div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar dashboard B18">×</button>
      </header>

      {mapa.avisoMoneda ? <p className="b18-vt-aviso b18-vt-aviso-moneda"><b>Moneda</b>{mapa.avisoMoneda}</p> : null}

      <div className="b18-vt-barras-anuales" aria-label="Venta confirmada por año">
        {anios.map((anio) => <button
          key={anio.anio}
          type="button"
          className={`b18-vt-anio ${anioAbierto === anio.anio ? "is-abierto" : ""} ${anio.parcial ? "is-parcial" : ""}`}
          onClick={() => setAnioAbierto(anioAbierto === anio.anio ? null : anio.anio)}
          aria-expanded={anioAbierto === anio.anio}
          aria-label={`${anio.anio}. Abrir desglose mensual`}
        >
          <b className="b18-vt-anio-monto">{fmt(anio.valor)}</b>
          <i style={{ height: `${Math.max((anio.valor / (maximo || 1)) * 100, 6)}%` }} />
          <strong>{anio.anio}{anio.parcial ? <em>parcial</em> : null}</strong>
          <dl>
            <div><dt>Pedidos</dt><dd>{anio.pedidos.toLocaleString("es-GT")}</dd></div>
            <div><dt>Clientes</dt><dd>{anio.clientes.toLocaleString("es-GT")}</dd></div>
            <div><dt>Ticket</dt><dd>{fmt(anio.ticket)}</dd></div>
          </dl>
          {/* Un año con un pedido en otra moneda no es un total en quetzales: se
              dice en la barra misma, no sólo en el pie del modal. Va DENTRO del
              mismo <small> para no agregar una fila al grid y desalinear las
              barras entre sí. */}
          <small>
            {anio.razonParcial ?? "año calendario completo"}
            {anio.pedidosOtraMoneda > 0 ? <span className="b18-vt-anio-moneda">
              incluye {anio.pedidosOtraMoneda} {anio.pedidosOtraMoneda === 1 ? "pedido" : "pedidos"} en {anio.monedasOtras.join(" y ")} sin convertir · no es un total GTQ comparable
            </span> : null}
          </small>
        </button>)}
      </div>

      {anioAbierto ? <section className="b18-vt-meses" aria-label={`Desglose mensual de ${anioAbierto}`}>
        <div className="b18-dashboard-titulo"><span>Desglose mensual</span><h3>{anioAbierto} mes a mes</h3></div>
        <div className="b18-vt-meses-lista">
          {meses.map((mes) => <div key={mes.periodo} className={mes.parcial ? "is-parcial" : undefined}>
            <span>{mes.etiqueta}{mes.parcial ? <em>parcial</em> : null}</span>
            <b>{fmt(mes.valor)}</b>
            <i style={{ width: `${Math.max((mes.valor / (maximoMes || 1)) * 100, 3)}%` }} />
            <small>{mes.pedidos.toLocaleString("es-GT")} pedidos · {mes.clientes.toLocaleString("es-GT")} clientes · ticket {fmt(mes.ticket)}{mes.razonParcial ? ` · ${mes.razonParcial}` : ""}</small>
          </div>)}
        </div>
      </section> : <p className="b18-vt-ayuda">Pulsá un año para abrir su desglose mensual. El mes cortado por el corte queda marcado como parcial y no se compara contra un mes entero.</p>}

      {/* La estacionalidad vive acá, debajo del total por año, y no en la
          vista general: es una segunda lectura sobre los mismos años de
          arriba (mismo mes, todos los años), no un dato nuevo del agente. */}
      <Estacionalidad estacionalidad={mapa.estacionalidad} fmt={fmt} />

      <section className="b18-vt-descomposicion" aria-label="Descomposición del crecimiento">
        <div className="b18-dashboard-titulo"><span>{mapa.historia.titulo}</span><h3>{mapa.historia.resultado}</h3></div>
        <div className="b18-vt-factores">
          {mapa.historia.factores.map((factor) => <button key={factor.id} type="button" onClick={() => onAbrirAgente(factor.id)} style={{ "--b18-chip": factor.color } as CSSProperties}>
            <strong>{factor.delta}</strong><span>{factor.etiqueta}</span><small>{factor.detalle}</small>
          </button>)}
        </div>
        <p>venta = clientes × pedidos por cliente × ticket · {mapa.historia.residuo}</p>
      </section>

      <section className="b18-dashboard-problemas" aria-label="Problemas encontrados">
        <div className="b18-dashboard-titulo"><span>Problemas encontrados</span><h3>Qué revisar antes de decidir</h3></div>
        <div>{agentes.map((agente) => <button type="button" key={agente.id} onClick={() => onAbrirAgente(agente.id)}>
          <span>{agente.iniciales}</span>
          <div><strong>{agente.nombre}</strong><p>{agente.problema}</p></div>
          <b>{pct(agente.cobertura)}</b>
          <em>{agente.coberturaNombre} · Ver agente →</em>
        </button>)}</div>
      </section>

      <footer>
        {mapa.capa} · {mapa.moneda} · período {ytd ? `${ytd.actual.inicio} → ${ytd.actual.fin}` : "sin comparable"} · corte {corte} · {mapa.serie.meses.length} meses observados desde {mapa.serie.desde ?? "—"}
      </footer>
    </section>
  </div>;
}

// ── Drill-down de un agente ────────────────────────────────────────────────

type PestanaDrilldown = "anual" | "mensual" | "ficha";

function DrilldownAgente({ agente, mapa, onCerrar }: { agente: LecturaAgenteVentasB18; mapa: MapaVentasB18; onCerrar: () => void }) {
  const [pestana, setPestana] = useState<PestanaDrilldown>("anual");
  const pestanas: { id: PestanaDrilldown; nombre: string }[] = [
    { id: "anual", nombre: "Serie anual" },
    { id: "mensual", nombre: `Serie mensual ${mapa.corte.slice(0, 4)}` },
    { id: "ficha", nombre: "Ficha del dato" },
  ];

  return <div className="b18-drilldown-velo" role="presentation" onPointerDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
    <section className="b18-drilldown" role="dialog" aria-modal="true" aria-labelledby="b18-drilldown-ventas-titulo" style={{ "--b18-role": agente.color } as CSSProperties}>
      <header>
        <div>
          <p>{agente.slot.toUpperCase()} · {agente.iniciales}</p>
          <h2 id="b18-drilldown-ventas-titulo">{agente.nombre}</h2>
          <span>{agente.pregunta} · corte {mapa.corte}</span>
          <div className="b18-vt-declaracion"><strong>{mapa.declaracion}</strong></div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar lectura ampliada">×</button>
      </header>

      <div className="b18-vt-cabecera">
        <div><small>{agente.kpiEtiqueta}</small><strong>{agente.kpi}</strong></div>
        <div><small>{agente.coberturaNombre}</small><strong>{pct(agente.cobertura)}</strong><span>{agente.coberturaEtiqueta}</span></div>
      </div>

      {/* El límite de identidad no se esconde detrás de una pestaña: cambia
          cómo se lee el número que está justo arriba. */}
      {agente.notaIdentidad ? <div className="b18-vt-aviso b18-vt-aviso-identidad">
        <b>{agente.notaIdentidad.titulo}</b>
        <p>{agente.notaIdentidad.texto}</p>
        <ul>{agente.notaIdentidad.casos.map((caso) => <li key={caso}>{caso}</li>)}</ul>
      </div> : null}

      <nav className="b18-drilldown-tabs" aria-label="Secciones del agente">
        {pestanas.map((tab) => <button key={tab.id} type="button" aria-pressed={pestana === tab.id} onClick={() => setPestana(tab.id)}>{tab.nombre}</button>)}
      </nav>

      {pestana === "anual" ? <div className="b18-vt-panel">
        <Serie filas={agente.anual} color={agente.color} etiqueta={`Serie anual de ${agente.nombre}`} />
        {/* Va PEGADO a las barras, antes del pico: el año en curso siempre se ve
            más chico que el año anterior completo (todavía no termina), y el
            KPI de cabecera compara días contra días, no año contra año — si
            esta frase queda después del pico, alguien puede quedarse en la
            contradicción visual sin llegar a leerla. */}
        <p className="b18-vt-nota">{agente.hallazgo}</p>
        <Pico pico={agente.picoAnual} titulo="Pico anual" />
      </div> : null}

      {pestana === "mensual" ? <div className="b18-vt-panel">
        <Serie filas={agente.mensual} color={agente.color} etiqueta={`Serie mensual de ${agente.nombre}`} />
        <Pico pico={agente.picoMensual} titulo="Pico mensual" />
        <p className="b18-vt-nota">{agente.problema}</p>
      </div> : null}

      {pestana === "ficha" ? <div className="b18-vt-panel">
        <dl className="b18-vt-ficha">
          <div><dt>Fórmula</dt><dd>{agente.formula}</dd></div>
          <div><dt>Fuente</dt><dd>{agente.fuente}</dd></div>
          <div><dt>Capa</dt><dd>{agente.capa}</dd></div>
          <div><dt>Período</dt><dd>{agente.periodo}</dd></div>
          <div><dt>Corte</dt><dd>{mapa.corte}</dd></div>
          <div><dt>Moneda</dt><dd>{mapa.moneda}{mapa.avisoMoneda ? ` · ${mapa.avisoMoneda}` : ""}</dd></div>
          <div><dt>{agente.coberturaNombre}</dt><dd>{pct(agente.cobertura)} — {agente.coberturaEtiqueta}. {agente.coberturaExplicacion}</dd></div>
          <div><dt>Límite del dato</dt><dd>{agente.limite}</dd></div>
        </dl>
        <div className="b18-decision"><p>Siguiente decisión</p><strong>{agente.accion}</strong></div>
      </div> : null}
    </section>
  </div>;
}

// ── Mapa ───────────────────────────────────────────────────────────────────

export function MapaB18Ventas({ mapa, fmt }: { mapa: MapaVentasB18; fmt: (valor: number) => string }) {
  const [activo, setActivo] = useState<AgenteVentasB18>("venta");
  const [drilldown, setDrilldown] = useState<AgenteVentasB18 | null>(null);
  const [dashboardAbierto, setDashboardAbierto] = useState(false);
  // El alcance arranca en el primero de la lista, que es "Todo el período":
  // abrir la página muestra exactamente la misma lectura que antes de existir
  // el filtro. Elegir un año es una acción del usuario, nunca un default.
  const [alcanceId, setAlcanceId] = useState<string>(mapa.alcances[0]?.id ?? "todo");
  const { agentes, corte, historia, ytd } = mapa;
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];
  // El filtro pertenece a Evolución: es el agente que publica el número que se
  // descompone en las cuatro tarjetas. Con otro agente activo el anillo vuelve
  // a mostrar a los cuatro agentes y el selector no tendría a qué aplicarse.
  const esEvolucion = agente.id === "venta";
  const alcance = mapa.alcances.find((item) => item.id === alcanceId) ?? mapa.alcances[0] ?? null;
  const subKpis = esEvolucion && alcance ? alcance.subKpis : agente.subKpis;

  return <section className="b18-map b18-map-ventas" aria-label="Mapa comercial B18 de ventas">
    <aside className="b18-map-lateral">
      <div className="b18-map-marca">{agente.iniciales}</div><p>Agentes</p>
      <div className="b18-map-lista">{agentes.map((item) => <button key={item.id} type="button" onClick={() => setActivo(item.id)} aria-pressed={item.id === activo}><span>{item.iniciales}</span>{item.titulo}</button>)}</div>
      <div className="b18-map-status"><span>Agent status</span><b>● {agente.titulo}</b><p>{agente.senal}</p></div>
      <button type="button" className="b18-map-b18" onClick={() => setDashboardAbierto(true)} aria-label="Abrir dashboard B18: ventas por año">B<span>18</span></button>
    </aside>

    <div className="b18-map-canvas">
      <header className="b18-map-header">
        <div><p>Reporte general</p><h2>Ventas comerciales</h2></div>
        {/* La capa que se está leyendo NO es un metadato: si no se ve, el número
            se lee como venta neta y no lo es. Va en un rótulo propio, legible. */}
        <div className="b18-vt-declaracion"><strong>{mapa.declaracion}</strong><span>corte {corte}</span></div>
      </header>

      <div className="b18-map-grid">
        {/* Cuando el agente activo trae sub-lecturas, el anillo deja de repetir
            a los otros tres agentes —que ya están en el lateral y en los chips
            del centro— y muestra la descomposición del número que ese agente
            publica. La navegación no depende de estas tarjetas: sigue viva en
            la lista lateral y en los chips, así que no se pierde ningún camino. */}
        {subKpis
          ? subKpis.slice(0, 4).map((sub, indice) => <TarjetaSubKpi
              key={sub.id}
              sub={sub}
              slot={SLOTS_GRID[indice] ?? "detecta"}
              agente={agente}
              onAbrir={() => setDrilldown(agente.id)}
            />)
          : agentes.map((item) => <TarjetaAgente key={item.id} agente={item} activa={item.id === activo} onSeleccionar={() => { setActivo(item.id); setDrilldown(item.id); }} />)}

        <article className="b18-centro" aria-live="polite">
          {/* El selector va ARRIBA de todo: gobierna las cuatro tarjetas del
              anillo y el gráfico de estacionalidad, y ponerlo debajo dejaría
              que alguien leyera las cifras sin haber visto de qué alcance son. */}
          {esEvolucion && alcance ? <div className="b18-vt-alcance-bloque">
            <p className="b18-centro-eyebrow">Alcance temporal · {alcance.etiqueta}</p>
            <FiltroAlcance alcances={mapa.alcances} activo={alcance.id} onElegir={setAlcanceId} />
            <DeclaracionAlcance alcance={alcance} />
          </div> : null}

          <p className="b18-centro-eyebrow">{historia.titulo}</p>
          <h3>{historia.resultado}</h3>

          <div className="b18-vt-historia" aria-label="Descomposición del crecimiento comparable">
            {historia.factores.map((factor) => <button key={factor.id} type="button" onClick={() => { setActivo(factor.id); setDrilldown(factor.id); }} style={{ "--b18-chip": factor.color } as CSSProperties}>
              <strong>{factor.delta}</strong><span>{factor.etiqueta}</span><small>{factor.detalle}</small>
            </button>)}
          </div>
          <p className="b18-vt-identidad">venta = clientes × pedidos por cliente × ticket · {historia.residuo}</p>

          <div className="b18-centro-senales" aria-label="Las cuatro lecturas de ventas">
            {agentes.map((item) => <button key={item.id} type="button" aria-pressed={item.id === activo} onClick={() => setActivo(item.id)} style={{ "--b18-chip": item.color } as CSSProperties}>
              <i /><strong>{item.kpi}</strong><span>{item.iniciales} · {item.titulo}</span>
            </button>)}
          </div>

          <div className="b18-centro-comparativo" style={{ "--b18-comp": agente.color } as CSSProperties}>
            <p>{agente.comparativo.titulo}<b>{agente.comparativo.delta}</b></p>
            <div><span>{agente.comparativo.actual.etiqueta}</span><b>{agente.comparativo.actual.texto}</b><i style={{ width: `${agente.comparativo.actual.ancho}%` }} /></div>
            <div><span>{agente.comparativo.previo.etiqueta}</span><b>{agente.comparativo.previo.texto}</b><i style={{ width: `${agente.comparativo.previo.ancho}%` }} /></div>
          </div>

          <div className="b18-centro-metricas">{agente.metricas.map((metrica) => <div key={metrica.etiqueta}><b>{metrica.valor}</b><span>{metrica.etiqueta}</span></div>)}</div>

          <Link className="b18-vt-enlace" href={mapa.enlaceProductos.href}>{mapa.enlaceProductos.texto} →</Link>

          <dl className="b18-metadatos">
            <div><dt>Fuente</dt><dd>{mapa.fuente}</dd></div>
            <div><dt>Capa</dt><dd>{mapa.capa}</dd></div>
            <div><dt>Período</dt><dd>{ytd ? `${ytd.actual.inicio} → ${ytd.actual.fin} (${ytd.dias} días)` : "sin comparable"}</dd></div>
            <div><dt>Corte</dt><dd>{corte}</dd></div>
            <div><dt>Moneda</dt><dd>{mapa.moneda}</dd></div>
            <div><dt>IVA</dt><dd>12% incluido</dd></div>
            <div><dt>{agente.coberturaNombre}</dt><dd>{pct(agente.cobertura)}</dd></div>
            <div><dt>Límite</dt><dd>{agente.limite}</dd></div>
          </dl>
        </article>
      </div>
    </div>

    {drilldown ? <DrilldownAgente agente={agentes.find((item) => item.id === drilldown) ?? agentes[0]} mapa={mapa} onCerrar={() => setDrilldown(null)} /> : null}
    {dashboardAbierto ? <DashboardVentasB18 mapa={mapa} fmt={fmt} onCerrar={() => setDashboardAbierto(false)} onAbrirAgente={(id) => { setActivo(id); setDrilldown(id); setDashboardAbierto(false); }} /> : null}
  </section>;
}
