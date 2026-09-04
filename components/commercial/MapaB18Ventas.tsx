"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
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
const entero = (valor: number) => valor.toLocaleString("es-GT");

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
 * Consistencia, en filas horizontales: un mes por fila, la barra sale del
 * centro hacia la derecha (subió) o hacia la izquierda (bajó). Nada rotado:
 * el mes y el % se leen en horizontal, como cualquier texto normal — la
 * versión con columnas verticales y etiquetas giradas se encimaba entre sí
 * apenas había más de 4-5 meses, así que se reemplaza por completo.
 */
function BarraConsistencia({ serie }: { serie: { etiqueta: string; valor: number; texto: string }[] }) {
  if (!serie || serie.length === 0) return null;
  const maximoAbs = Math.max(...serie.map((p) => Math.abs(p.valor)), 1);
  return <div className="b18-vt-subkpi-cons" role="img" aria-label={serie.map((p) => `${p.etiqueta}: ${p.texto}`).join(", ")}>
    {serie.map((p, indice) => {
      // El ancho de barra máximo es la MITAD de la pista: la otra mitad es
      // para el lado contrario (positivo o negativo), así ambos comparten la
      // misma escala sin que uno pueda invadir el espacio del otro.
      const anchoPct = Math.max((Math.abs(p.valor) / maximoAbs) * 50, 2);
      const sube = p.valor >= 0;
      return <div key={`${p.etiqueta}-${indice}`} className={`b18-vt-subkpi-cons-fila ${sube ? "is-sube" : "is-baja"}`} title={`${p.etiqueta} · ${p.texto}`}>
        <span className="b18-vt-subkpi-cons-mes">{p.etiqueta}</span>
        <span className="b18-vt-subkpi-cons-pista">
          <i style={sube ? { left: "50%", width: `${anchoPct}%` } : { right: "50%", width: `${anchoPct}%` }} />
        </span>
        <b className="b18-vt-subkpi-cons-valor">{p.texto}</b>
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
  // Por instrucción directa: Calidad y Ritmo se dejan en blanco, sin contenido.
  if (sub.id === "calidad" || sub.id === "ritmo") {
    return <div className={`b18-rol-card b18-rol-${slot} b18-vt-sub`} style={{ "--b18-role": sub.color } as CSSProperties}>
      <span className="b18-connector" aria-hidden="true" />
    </div>;
  }
  const veredicto = partirFrase(sub.veredicto);
  const robustez = partirFrase(sub.robustez);
  const ocultarLista = Boolean(sub.serie && sub.serie.length > 0 && TIENE_BARRAS_ETIQUETADAS.has(sub.id));
  // Dependencia responde "qué tan preocupados debemos estar" con el marco de
  // referencia (facturación total, clientes totales) en vez de con un
  // expandible de texto — por eso no lleva "Ver por qué", aunque su robustez
  // tenga una segunda frase: esa frase se deja de mostrar a propósito.
  // Dependencia usa el formato "tarjeta de resumen" (círculo, pastilla,
  // filas de estadística) que pidió el usuario: sin párrafo narrativo, el
  // número y las filas ya cuentan la historia. Los otros tres agentes
  // conservan el formato de lectura con veredicto.
  const esResumen = sub.id === "dependencia";
  const tieneMas = !esResumen && Boolean(veredicto.resto || robustez.resto);
  return <div className={`b18-rol-card b18-rol-${slot} b18-vt-sub ${esResumen ? "b18-vt-sub-resumen" : ""}`} style={{ "--b18-role": sub.color } as CSSProperties}>
    <span className="b18-connector" aria-hidden="true" />
    {/* El botón cubre sólo la lectura —no el expandible "Ver por qué"— porque
        un <details> dentro de un <button> es HTML inválido y, peor, el click
        en el <summary> abriría el drill-down en vez de sólo desplegar texto. */}
    <button type="button" className="b18-vt-sub-boton" onClick={onAbrir} aria-label={`${sub.etiqueta}: ${sub.titulo}. Abrir la lectura completa de ${agente.nombre}`}>
      <div className="b18-rol-visual">
        <div className="b18-vt-sub-cabecera">
          {sub.icono ? <span className="b18-vt-sub-icono">{sub.icono}</span> : null}
          <span className="b18-vt-sub-etiqueta">{sub.etiqueta}</span>
        </div>
        <div className="b18-vt-sub-titulo-fila">
          <strong className="b18-vt-sub-titulo">{sub.titulo}</strong>
          {sub.badge ? <span className="b18-vt-sub-badge">{sub.badge.texto}<em>{sub.badge.comparativo}</em></span> : null}
        </div>
        <GraficoSubKpi sub={sub} />
        {sub.estadisticas ? <div className="b18-vt-sub-stats">
          {sub.estadisticas.map((stat) => <div key={stat.etiqueta}><span>{stat.etiqueta}</span><b>{stat.valor}</b></div>)}
        </div> : null}
        {esResumen ? null : <p className="b18-vt-sub-veredicto">{veredicto.cabeza}</p>}
        {esResumen || ocultarLista ? null : <p className="b18-vt-sub-detalle">{sub.detalle}</p>}
        {esResumen ? null : <p className="b18-vt-sub-robustez">{robustez.cabeza}</p>}
        {sub.aviso ? <p className="b18-vt-sub-aviso">⚠ {sub.aviso}</p> : null}
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
 * Lo que hay que leer ANTES de mirar las cuatro tarjetas — pero SIN ocupar el
 * espacio de una caja grande siempre visible. Tres estados, tres colores, y
 * ninguno es decorativo:
 *   · sin comparable → el alcance no tiene contra qué medirse (2022)
 *   · parcial o recortado → la comparación vale, pero no cubre el año entero
 *   · completo → los dos lados son años calendario enteros
 *
 * LA ADVERTENCIA NO PUEDE DESAPARECER: es la regla que sostiene toda la
 * página (nunca comparar un año parcial contra uno completo sin decirlo), así
 * que el ícono + la frase corta quedan SIEMPRE visibles, pegados a los
 * botones del filtro. Lo que se mueve detrás de "Ver por qué" es sólo el
 * párrafo largo —por qué está recortado, contra qué se compara en detalle—,
 * no el aviso mismo.
 */
function fraseCortaAlcance(alcance: AlcanceVentasB18): { icono: string; texto: string; estado: "is-completo" | "is-parcial" | "is-sinbase" } {
  if (alcance.sinComparacion) return { icono: "⚠", texto: `${alcance.etiqueta} sin comparable`, estado: "is-sinbase" };
  if (alcance.parcial || alcance.comparacionRecortada) {
    return {
      icono: "✂",
      texto: alcance.diasComparables !== null ? `Comparación recortada a ${entero(alcance.diasComparables)} días` : "Comparación recortada a días equivalentes",
      estado: "is-parcial",
    };
  }
  return { icono: "✓", texto: "Años calendario completos", estado: "is-completo" };
}

function DeclaracionAlcance({ alcance }: { alcance: AlcanceVentasB18 }) {
  const frase = fraseCortaAlcance(alcance);
  // El párrafo completo —por qué está recortado, contra qué se compara— no se
  // borra, se mueve entero al expandible: antes se cortaba en la primera
  // oración y el resto iba en "Ver por qué"; ahora TODO el texto vive ahí,
  // porque lo único que queda siempre visible es la frase corta de arriba.
  const textoCompleto = `${alcance.aviso ? `${alcance.aviso} ` : `${alcance.etiqueta} se observa entero: ${alcance.resumen}. `}${alcance.comparacion}`;
  return <div className={`b18-vt-alcance-decl ${frase.estado}`} aria-live="polite">
    <span className="b18-vt-alcance-decl-frase"><i className="b18-vt-alcance-icono" aria-hidden="true">{frase.icono}</i>{frase.texto}</span>
    <details className="b18-vt-mas">
      <summary>Ver por qué</summary>
      <p>{textoCompleto}</p>
    </details>
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

// ── Drill-down de Dependencia de clientes: sólo gráficos ────────────────────
//
// El drill-down genérico (`DrilldownAgente`, abajo) sirve al agente Evolución
// entero —serie anual, serie mensual, ficha del dato— y es texto largo. Lo
// que pidió el usuario para ESTA tarjeta es otra cosa: expandir y ver el
// análisis de concentración en gráficos, con poco texto. Por eso es un
// componente aparte y no una pestaña más del drilldown genérico.
//
// Nada se lee de nuevo: los 6 alcances (Todo el período + 2022..2026) ya
// vienen con su sub-KPI de dependencia calculado en `mapa.alcances`. Acá sólo
// se cruzan esos 5 años entre sí — Todo el período queda fuera porque es un
// agregado de todo el histórico, no un año más que comparar en la tendencia.

/** Un año del Top 5, ya resuelto por `subKpiDependencia`. */
type PuntoDependenciaAnio = {
  anio: string;
  participacionTop5: number;
  clientes: { etiqueta: string; valor: number; texto: string; monto?: number }[];
};

/**
 * De cada alcance-año toma su sub-KPI de dependencia. Un año sin base (sin
 * pedidos en el alcance) no entra en la tendencia ni en el cruce de
 * clientes — se declara aparte, no se dibuja como una barra en cero.
 */
function extraerDependenciaPorAnio(alcances: AlcanceVentasB18[]): { anios: PuntoDependenciaAnio[]; sinBase: string[] } {
  const anios: PuntoDependenciaAnio[] = [];
  const sinBase: string[] = [];
  [...alcances]
    .filter((alcance) => alcance.id !== "todo")
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((alcance) => {
      const sub = alcance.subKpis.find((item) => item.id === "dependencia");
      if (!sub || sub.participacionTop5 === undefined || !sub.serie || sub.serie.length === 0) {
        sinBase.push(alcance.etiqueta);
        return;
      }
      anios.push({ anio: alcance.etiqueta, participacionTop5: sub.participacionTop5, clientes: sub.serie });
    });
  return { anios, sinBase };
}

type ClienteNucleo = { nombre: string; apariciones: { anio: string; valor: number; texto: string; monto?: number }[] };
type ClientePuntual = { nombre: string; anio: string; valor: number; texto: string; monto?: number };

/** El mayor menos el menor % que tuvo el cliente en los años en que apareció. */
function rangoApariciones(apariciones: { valor: number }[]): number {
  const valores = apariciones.map((item) => item.valor);
  return Math.max(...valores) - Math.min(...valores);
}

/**
 * Núcleo: el mismo cliente en el Top 5 de 2 o más años. Puntual: aparece en
 * uno solo y desaparece — es ruido, no patrón, y por eso no lleva gráfico
 * propio. El nombre se agrupa normalizado (mayúsculas/espacios) porque el
 * mismo cliente puede llegar escrito de dos formas distintas (ya declarado en
 * el aviso de identidad de Clientes); agrupar así sólo une filas del mismo
 * Top 5 ya calculado, no cambia ningún valor ni año de los que trae `serie`.
 */
function clasificarNucleoPuntual(anios: PuntoDependenciaAnio[]): { nucleo: ClienteNucleo[]; puntual: ClientePuntual[] } {
  const porNombre = new Map<string, ClienteNucleo>();
  for (const anio of anios) {
    for (const cliente of anio.clientes) {
      const clave = cliente.etiqueta.trim().toUpperCase();
      const punto = { anio: anio.anio, valor: cliente.valor, texto: cliente.texto, monto: cliente.monto };
      const existente = porNombre.get(clave);
      if (existente) existente.apariciones.push(punto);
      else porNombre.set(clave, { nombre: cliente.etiqueta, apariciones: [punto] });
    }
  }
  const nucleo: ClienteNucleo[] = [];
  const puntual: ClientePuntual[] = [];
  for (const entrada of porNombre.values()) {
    if (entrada.apariciones.length >= 2) nucleo.push(entrada);
    else puntual.push({ nombre: entrada.nombre, anio: entrada.apariciones[0].anio, valor: entrada.apariciones[0].valor, texto: entrada.apariciones[0].texto, monto: entrada.apariciones[0].monto });
  }
  // El que más cambió primero: es la lectura que este gráfico existe para dar.
  nucleo.sort((a, b) => rangoApariciones(b.apariciones) - rangoApariciones(a.apariciones));
  puntual.sort((a, b) => b.valor - a.valor);
  return { nucleo, puntual };
}

/** Gráfico A: una barra por año con su % de concentración encima. Mismo
 * lenguaje visual que `BarraCalidad` —altura proporcional, cifra pegada a la
 * barra— para que la caída año a año se lea de un vistazo. */
function BarraTendenciaConcentracion({ anios }: { anios: PuntoDependenciaAnio[] }) {
  if (anios.length === 0) return null;
  const maximo = Math.max(...anios.map((a) => a.participacionTop5), 1);
  return <div className="b18-dep-tendencia" role="img" aria-label={anios.map((a) => `${a.anio}: ${pct(a.participacionTop5)}`).join(", ")}>
    {anios.map((a) => <div key={a.anio} className="b18-dep-tendencia-col">
      <b>{pct(a.participacionTop5)}</b>
      <i style={{ height: `${Math.max((a.participacionTop5 / maximo) * 100, 4)}px` }} />
      <span>{a.anio}</span>
    </div>)}
  </div>;
}

/** Un cliente del núcleo: su % en cada año en que estuvo en el Top 5. Esto es
 * lo que muestra la subida y caída de una cuenta sin necesitar un párrafo. */
function MiniSerieCliente({ cliente, color }: { cliente: ClienteNucleo; color: string }) {
  const ordenado = [...cliente.apariciones].sort((a, b) => a.anio.localeCompare(b.anio));
  const maximo = Math.max(...ordenado.map((p) => p.valor), 1);
  return <div className="b18-dep-nucleo-cliente">
    <p title={cliente.nombre}>{truncarNombre(cliente.nombre, 24)}</p>
    <div className="b18-dep-nucleo-mini" role="img" aria-label={ordenado.map((p) => `${p.anio}: ${p.texto}`).join(", ")}>
      {ordenado.map((p) => <div key={p.anio} className="b18-dep-nucleo-mini-col" title={`${p.anio} · ${p.texto}`}>
        <b>{pct(p.valor)}</b>
        {p.monto !== undefined ? <em>{abreviarQ(p.monto)}</em> : null}
        <i style={{ height: `${Math.max((p.valor / maximo) * 36, 3)}px`, backgroundColor: color }} />
        <span>{p.anio}</span>
      </div>)}
    </div>
  </div>;
}

/** Los clientes puntuales: una fila compacta por cliente, sin gráfico —el
 * patrón está en que NO se repiten, no en su forma. */
function ListaPuntual({ puntual }: { puntual: ClientePuntual[] }) {
  if (puntual.length === 0) return null;
  return <ul className="b18-dep-puntual">
    {puntual.map((cliente) => <li key={`${cliente.nombre}-${cliente.anio}`} title={cliente.nombre}>
      <span>{truncarNombre(cliente.nombre, 22)}</span><b>{cliente.anio}</b><em>{pct(cliente.valor)}</em>
    </li>)}
  </ul>;
}

function DrilldownDependencia({ mapa, onCerrar }: { mapa: MapaVentasB18; onCerrar: () => void }) {
  const { anios, sinBase } = extraerDependenciaPorAnio(mapa.alcances);
  const { nucleo, puntual } = clasificarNucleoPuntual(anios);
  const color = mapa.alcances.flatMap((a) => a.subKpis).find((s) => s.id === "dependencia")?.color ?? "#0789e6";

  const primero = anios[0] ?? null;
  const ultimo = anios.length > 0 ? anios[anios.length - 1] : null;
  const bajaSostenido = Boolean(primero && ultimo && primero.anio !== ultimo.anio && ultimo.participacionTop5 < primero.participacionTop5);
  const veredictoTendencia = !primero || !ultimo || primero.anio === ultimo.anio
    ? "No hay suficientes años con base para leer una tendencia."
    : bajaSostenido
      ? `La concentración baja cada año: de ${pct(primero.participacionTop5)} en ${primero.anio} a ${pct(ultimo.participacionTop5)} en ${ultimo.anio}.`
      : `La concentración no cae de forma sostenida: de ${pct(primero.participacionTop5)} en ${primero.anio} a ${pct(ultimo.participacionTop5)} en ${ultimo.anio}.`;

  const masCambio = nucleo[0] ?? null;
  const veredictoNucleo = (() => {
    if (!masCambio) return "Ningún cliente del Top 5 se repite en dos o más años: no hay núcleo que seguir.";
    const ordenadas = [...masCambio.apariciones].sort((a, b) => a.valor - b.valor);
    const min = ordenadas[0];
    const max = ordenadas[ordenadas.length - 1];
    return `${masCambio.nombre} es la cuenta que más cambió: de ${pct(min.valor)} en ${min.anio} a ${pct(max.valor)} en ${max.anio}.`;
  })();

  return <div className="b18-drilldown-velo" role="presentation" onPointerDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
    <section className="b18-drilldown b18-dep-drilldown" role="dialog" aria-modal="true" aria-labelledby="b18-drilldown-dependencia-titulo" style={{ "--b18-role": color } as CSSProperties}>
      <header>
        <div>
          <p>DEPENDENCIA · T5</p>
          <h2 id="b18-drilldown-dependencia-titulo">Dependencia de clientes</h2>
          <span>Cómo cambia el Top 5 año a año · corte {mapa.corte}</span>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar dependencia de clientes">×</button>
      </header>

      <section className="b18-dep-bloque" aria-label="Tendencia de concentración por año">
        <p className="b18-dep-veredicto">{veredictoTendencia}</p>
        <BarraTendenciaConcentracion anios={anios} />
      </section>

      <section className="b18-dep-bloque" aria-label="Núcleo y clientes puntuales del Top 5">
        <p className="b18-dep-veredicto">{veredictoNucleo}</p>
        {nucleo.length > 0 ? <div className="b18-dep-nucleo">
          {nucleo.map((cliente) => <MiniSerieCliente key={cliente.nombre} cliente={cliente} color={color} />)}
        </div> : null}
        {puntual.length > 0 ? <details className="b18-dep-puntual-detalle">
          <summary>Aparecen una sola vez, sin patrón que seguir ({puntual.length})</summary>
          <ListaPuntual puntual={puntual} />
        </details> : null}
      </section>

      {sinBase.length > 0 ? <p className="b18-vt-nota">Sin base en {sinBase.join(", ")}: no hay pedidos en el alcance sobre los cuales repartir el Top 5.</p> : null}
    </section>
  </div>;
}

// ── Consistencia del crecimiento: una sola línea cronológica ────────────────
//
// Coexiste con el gráfico de 5 líneas por año (cada una comparando "el mismo
// mes entre años"), que vive más abajo, junto a `DrilldownConsistencia` —los
// dos aparecen en el mismo modal, uno debajo del otro. Éste es otra lectura:
// UNA sola línea continua que recorre los meses reales en orden —ago 2022,
// sep 2022, …, ago 2026— sin repetirse por año, coloreada por tramos según a
// qué año pertenece cada uno.
//
// Mismo criterio técnico que el gráfico anterior (y que `MiniSerieDivergente`):
// curva suave Catmull-Rom→Bezier (`curvaSuave`, se reusa tal cual), puntos
// HTML fuera del SVG para que `preserveAspectRatio="none"` no los deforme,
// tooltip propio con `useRef`+`getBoundingClientRect`. Sólo cambia qué datos
// se grafican: una lista cronológica plana en vez de una matriz por mes del
// año, y la fuente sigue siendo la misma, `mapa.mesesPorAnio`.
//
// Dos presentaciones del MISMO gráfico: la tarjeta chica del slot "explica"
// (con scroll horizontal, mismo patrón que `.b18-vt-estacion-grafico`, porque
// 47 meses no caben cómodos en una tarjeta) y el modal `DrilldownConsistencia`
// (ancho completo, sin scroll). Un solo componente, `GraficoConsistenciaLinea`,
// resuelve las dos: con `anchoMinPx` fuerza un ancho en píxeles reales (scroll);
// sin él, ocupa el 100% del contenedor (modal).

/** Redondeo a 2 decimales, igual criterio que el resto de la página. */
const dos = (valor: number) => Math.round(valor * 100) / 100;

/** Color fijo de identidad de Consistencia en toda la página (mismo morado
 * que usaba su sub-KPI en `lib/agentes-ventas-b18.ts`). */
const CONSISTENCIA_COLOR = "#7b2bf4";

type PuntoConsistenciaCronologico = {
  periodo: string;
  anio: string;
  mes: number;
  etiqueta: string;
  valor: number;
  texto: string;
  parcial: boolean;
};

/**
 * A diferencia de la versión anterior (que reorganizaba `mapa.mesesPorAnio`
 * por MES DEL AÑO, para comparar el mismo mes entre años), esto arma una
 * lista CRONOLÓGICA continua: los meses reales uno detrás de otro, sin
 * repetirse por año. Es la misma fuente —el monto crudo en quetzales de cada
 * mes— leída con otro criterio de orden: por año y, dentro de cada año, por
 * mes calendario.
 */
function extraerConsistenciaCronologica(mapa: MapaVentasB18, fmt: (valor: number) => string): { puntos: PuntoConsistenciaCronologico[]; anios: string[] } {
  const anios = Object.keys(mapa.mesesPorAnio).sort();
  const puntos: PuntoConsistenciaCronologico[] = [];
  anios.forEach((anio) => {
    const meses = [...(mapa.mesesPorAnio[anio] ?? [])].sort((a, b) => a.mes - b.mes);
    meses.forEach((mes) => {
      puntos.push({
        periodo: mes.periodo,
        anio,
        mes: mes.mes,
        etiqueta: mes.etiqueta,
        valor: mes.valor,
        texto: `${fmt(mes.valor)}${mes.parcial ? " · parcial" : ""}`,
        parcial: mes.parcial,
      });
    });
  });
  return { puntos, anios };
}

/**
 * El veredicto de la serie cronológica contesta otra pregunta que la del
 * cruce por mes calendario de antes: acá no importa si un mes le pega igual
 * a todos los años, sino CÓMO SE MUEVE la venta real mes a mes en todo el
 * histórico — cuál fue el pico y si el tramo final vende más o menos que el
 * arranque. Los meses parciales quedan FUERA del pico y de la comparación de
 * tramos: un mes cortado por el corte (o por el inicio del histórico) compite
 * en desventaja contra uno entero y ensuciaría los dos cálculos.
 */
function analizarConsistenciaCronologica(puntos: PuntoConsistenciaCronologico[], fmt: (valor: number) => string): string {
  if (puntos.length === 0) return "No hay meses observados en el histórico para leer una tendencia.";
  const completos = puntos.filter((p) => !p.parcial);
  if (completos.length === 0) return "Todos los meses del histórico están cortados: ninguno es comparable para leer una tendencia.";

  const pico = completos.reduce((a, b) => (b.valor > a.valor ? b : a));
  const frasePico = `${pico.etiqueta} es el mes de mayor venta del histórico, con ${fmt(pico.valor)}`;

  // Con menos de 6 meses completos, dividir en tercios deja tramos de 1-2
  // meses: un solo pedido grande decidiría la "tendencia" entera. Se declara
  // el pico y se corta ahí, sin inventar una tendencia que el dato no sostiene.
  if (completos.length < 6) {
    return `${frasePico}. Sólo hay ${entero(completos.length)} meses completos en el histórico, muy pocos para leer una tendencia general.`;
  }

  const tercio = Math.max(1, Math.floor(completos.length / 3));
  const inicio = completos.slice(0, tercio);
  const final = completos.slice(completos.length - tercio);
  const promedio = (arr: PuntoConsistenciaCronologico[]) => arr.reduce((suma, p) => suma + p.valor, 0) / arr.length;
  const promInicio = promedio(inicio);
  const promFinal = promedio(final);
  const variacion = promInicio > 0 ? dos(((promFinal - promInicio) / promInicio) * 100) : null;

  const tendencia = variacion === null
    ? "no se puede comparar el arranque del histórico contra el tramo final porque el arranque promedia cero"
    : `la venta mensual promedio ${variacion >= 0 ? "subió" : "bajó"} ${Math.abs(variacion).toFixed(2)}% entre el arranque (${inicio[0].etiqueta} → ${inicio[inicio.length - 1].etiqueta}) y el tramo final (${final[0].etiqueta} → ${final[final.length - 1].etiqueta})`;

  return `${frasePico}. Comparando sólo meses completos, ${tendencia}.`;
}

/** Convierte una corrida de puntos en un path SVG suavizado (Catmull-Rom →
 * Bezier) en vez de una polyline recta: la línea deja de verse quebrada en
 * cada mes y queda continua, sin esconder ningún valor —los puntos exactos
 * siguen siendo los mismos, sólo cambia cómo se conectan visualmente. */
function curvaSuave(puntos: { x: number; y: number }[]): string {
  if (puntos.length === 0) return "";
  if (puntos.length === 1) return `M ${puntos[0].x},${puntos[0].y} L ${puntos[0].x},${puntos[0].y}`;
  let d = `M ${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

type TramoAnioLinea = { anio: string; puntos: { punto: PuntoConsistenciaCronologico; indice: number }[] };

/**
 * Parte la lista cronológica en un tramo por año, pero cada tramo (salvo el
 * primero) SE LLEVA el último punto del tramo anterior como su propio primer
 * punto: es lo que hace que la línea se vea continua en el cambio de año
 * (dic de un año conecta con ene del siguiente) en vez de cortarse, aunque
 * cada tramo se pinte con el color de SU año — el "gradiente por tramos" que
 * pidió el usuario en vez de 5 líneas paralelas.
 */
function segmentosPorAnio(puntos: PuntoConsistenciaCronologico[]): TramoAnioLinea[] {
  const tramos: TramoAnioLinea[] = [];
  puntos.forEach((punto, indice) => {
    const actual = tramos[tramos.length - 1];
    if (actual && actual.anio === punto.anio) {
      actual.puntos.push({ punto, indice });
      return;
    }
    const puente = actual ? [actual.puntos[actual.puntos.length - 1]] : [];
    tramos.push({ anio: punto.anio, puntos: [...puente, { punto, indice }] });
  });
  return tramos;
}

/** El punto "activo" (hover con mouse, tap con touch) que arma la cajita
 * propia de tooltip: la posición se guarda en % sobre el viewBox, ya que el
 * SVG usa `preserveAspectRatio="none"` y el contenedor HTML no comparte la
 * unidad interna del gráfico. */
type PuntoActivoLinea = { punto: PuntoConsistenciaCronologico; xPct: number; yPct: number };

/**
 * Línea hecha a mano con SVG, mismo criterio técnico que el gráfico anterior
 * de consistencia (viewBox propio, `preserveAspectRatio="none"`, puntos HTML
 * fuera del SVG, tooltip propio) pero para UNA sola serie continua de N
 * puntos en vez de una línea por año superpuesta.
 *
 * `anchoMinPx`, si viene, fija el ancho del área dibujada en píxeles REALES
 * (no relativos al contenedor) — eso es lo que fuerza el scroll horizontal en
 * la tarjeta chica, mismo patrón que `.b18-vt-estacion-grafico`. Sin
 * `anchoMinPx` el gráfico ocupa el 100% del contenedor (la variante grande
 * del modal, donde todos los meses tienen que caber sin scroll).
 */
function GraficoConsistenciaLinea({ puntos, anios, anchoMinPx }: { puntos: PuntoConsistenciaCronologico[]; anios: string[]; anchoMinPx?: number }) {
  const [activo, setActivo] = useState<PuntoActivoLinea | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  if (puntos.length === 0) return null;

  const colorDe = (anio: string) => COLORES_ANIO[anios.indexOf(anio) % COLORES_ANIO.length];
  const ANCHO = 720, ALTO = 170, PAD_VERT = 10;
  const valores = puntos.map((p) => p.valor);
  const maxValor = Math.max(...valores, 0);
  const minValor = Math.min(...valores, 0);
  const rango = maxValor - minValor || 1;
  const xDe = (indice: number) => (puntos.length === 1 ? ANCHO / 2 : (indice / (puntos.length - 1)) * ANCHO);
  const yDe = (valor: number) => PAD_VERT + (1 - (valor - minValor) / rango) * (ALTO - PAD_VERT * 2);

  const activar = (indice: number, punto: PuntoConsistenciaCronologico) =>
    setActivo({ punto, xPct: (xDe(indice) / ANCHO) * 100, yPct: (yDe(punto.valor) / ALTO) * 100 });

  // Igual que en el gráfico anterior: se activa el punto más cercano a donde
  // cayó el mouse dentro del tramo, no sólo al acertarle a un círculo de
  // pocos px — necesario acá más que nunca, con muchos puntos apretados.
  const activarPorPosicion = (evento: React.PointerEvent, tramo: TramoAnioLinea) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((evento.clientX - rect.left) / rect.width) * ANCHO;
    let mejor = tramo.puntos[0], mejorDist = Infinity;
    for (const item of tramo.puntos) {
      const dist = Math.abs(xDe(item.indice) - relX);
      if (dist < mejorDist) { mejorDist = dist; mejor = item; }
    }
    activar(mejor.indice, mejor.punto);
  };

  const tramos = segmentosPorAnio(puntos);
  // Las etiquetas del eje van por AÑO, no por mes: muchas abreviaturas de mes
  // apretadas serían ilegibles a cualquier ancho, y el mes exacto de cada
  // punto ya se lee en el tooltip al pasar el mouse o tocar. Cada año se
  // etiqueta en el punto medio de su propio tramo.
  const etiquetasAnio = tramos.map((tramo) => {
    const indices = tramo.puntos.map((p) => p.indice);
    const centro = (Math.min(...indices) + Math.max(...indices)) / 2;
    return { anio: tramo.anio, x: xDe(centro) };
  });

  const estiloAncho: CSSProperties | undefined = anchoMinPx ? { width: `${anchoMinPx}px` } : undefined;

  const plano = <>
    <div className="b18-consl-plano" style={estiloAncho}>
      <svg
        ref={svgRef}
        className="b18-consl-svg"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={puntos.map((p) => `${p.etiqueta}: ${p.texto}`).join(", ")}
        // Tocar el fondo del SVG (no un punto) cierra la cajita: en touch no
        // existe "mouseleave", así que sin esto el tooltip queda pegado.
        onTouchStart={(evento) => { if (evento.target === evento.currentTarget) setActivo(null); }}
      >
        {tramos.map((tramo, indiceTramo) => {
          const d = curvaSuave(tramo.puntos.map(({ punto, indice }) => ({ x: xDe(indice), y: yDe(punto.valor) })));
          const color = colorDe(tramo.anio);
          return <g key={`linea-${tramo.anio}-${indiceTramo}`}>
            {/* Línea fina, sin brillo — el neón vive sólo en los puntos. */}
            <path d={d} className="b18-consl-linea" style={{ stroke: color } as CSSProperties} />
            {/* Encima, invisible y más gruesa: el área real donde el mouse
                activa el tooltip, para no depender de acertarle a un punto. */}
            <path d={d} className="b18-consl-linea-hit" onPointerMove={(evento) => activarPorPosicion(evento, tramo)} onPointerLeave={() => setActivo(null)} />
          </g>;
        })}
      </svg>
      {/* Los puntos se dibujan como círculos HTML, NO dentro del SVG: con
          `preserveAspectRatio="none"` un `<circle>` se estira distinto en X
          que en Y y queda ovalado. Con `position:absolute` en % el punto
          queda perfectamente redondo sin importar cómo se estire el gráfico. */}
      <div className="b18-consl-puntos" aria-hidden="true">
        {puntos.map((p, indice) => <span
          key={p.periodo}
          className={`b18-consl-punto ${p.parcial ? "is-parcial" : ""}`}
          title={`${p.etiqueta} · ${p.texto}`}
          style={{ left: `${(xDe(indice) / ANCHO) * 100}%`, top: `${(yDe(p.valor) / ALTO) * 100}%`, "--b18-glow": colorDe(p.anio), backgroundColor: p.parcial ? "#fff" : colorDe(p.anio), borderColor: colorDe(p.anio) } as CSSProperties}
          onMouseEnter={() => activar(indice, p)}
          onMouseLeave={() => setActivo(null)}
          onTouchStart={(evento) => { evento.stopPropagation(); activar(indice, p); }}
        />)}
      </div>
      {activo ? <div className="b18-consl-tooltip" role="status" style={{ left: `${activo.xPct}%`, top: `${activo.yPct}%` }}>
        <b>{activo.punto.etiqueta}</b>
        <span>{activo.punto.texto}</span>
      </div> : null}
    </div>
    <div className="b18-consl-meses" aria-hidden="true" style={estiloAncho}>
      {etiquetasAnio.map(({ anio, x }) => <span key={anio} style={{ left: `${(x / ANCHO) * 100}%` }}>{anio}</span>)}
    </div>
  </>;

  return <div className={`b18-consl-grafico ${anchoMinPx ? "is-chica" : "is-grande"}`}>
    {/* El scroll horizontal envuelve SÓLO el plano+eje (que comparten el
        mismo ancho fijo en px) — no la leyenda, que se queda siempre visible
        debajo, mismo patrón que `.b18-vt-estacion-grafico`. */}
    {anchoMinPx ? <div className="b18-consl-scroll">{plano}</div> : plano}
    <ul className="b18-consl-leyenda">
      {tramos.map((tramo) => <li key={tramo.anio}><i style={{ backgroundColor: colorDe(tramo.anio) }} />{tramo.anio}</li>)}
    </ul>
  </div>;
}

/**
 * Tarjeta chica del slot "explica": mismo tamaño que el resto de tarjetas del
 * grid (comparte `.b18-rol-card`/`.b18-vt-sub` con `TarjetaSubKpi`, aunque
 * esto no es un sub-KPI de `mapa.alcances` sino la serie cronológica completa
 * de `mapa.mesesPorAnio`). 47 meses no caben cómodos en el espacio de una
 * tarjeta, así que el gráfico entra con scroll horizontal en vez de aplastar
 * cada punto — al pulsarla se abre `DrilldownConsistencia` con el mismo
 * gráfico a tamaño completo, sin scroll.
 */
function TarjetaConsistenciaCronologica({ mapa, fmt, onAbrir }: { mapa: MapaVentasB18; fmt: (valor: number) => string; onAbrir: () => void }) {
  const { puntos, anios } = extraerConsistenciaCronologica(mapa, fmt);
  if (puntos.length === 0) return null;
  const veredicto = partirFrase(analizarConsistenciaCronologica(puntos, fmt));
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  return <div className="b18-rol-card b18-rol-explica b18-vt-sub" style={{ "--b18-role": CONSISTENCIA_COLOR } as CSSProperties}>
    <span className="b18-connector" aria-hidden="true" />
    <button type="button" className="b18-vt-sub-boton" onClick={onAbrir} aria-label={`Consistencia del crecimiento, ${primero.etiqueta} a ${ultimo.etiqueta}. Abrir la línea cronológica completa`}>
      <div className="b18-rol-visual">
        <div className="b18-vt-sub-cabecera">
          <span className="b18-vt-sub-icono">CR</span>
          <span className="b18-vt-sub-etiqueta">CONSISTENCIA · CRONOLÓGICA</span>
        </div>
        <div className="b18-vt-sub-titulo-fila">
          <strong className="b18-vt-sub-titulo">{primero.etiqueta} → {ultimo.etiqueta}</strong>
        </div>
        {/* 20px por mes: suficiente para separar los puntos sin apretarlos,
            con un piso de 360px para que el gráfico no se vea angosto cuando
            el histórico todavía tiene pocos meses. */}
        <GraficoConsistenciaLinea puntos={puntos} anios={anios} anchoMinPx={Math.max(puntos.length * 20, 360)} />
        <p className="b18-vt-sub-veredicto">{veredicto.cabeza}</p>
      </div>
    </button>
  </div>;
}

// ── Consistencia del crecimiento: cruce por mismo mes calendario ───────────
//
// Segundo gráfico del modal, debajo de la línea cronológica de arriba. Es el
// que había ANTES de la línea continua y que se recupera acá por pedido
// directo: 5 líneas SEPARADAS superpuestas, una por año, cada una comparando
// el mismo mes calendario entre años (eje X = ene..dic fijo, eje Y =
// quetzales) — ago 2024 contra ago 2025 contra ago 2026, nunca ago contra
// sep. Responde otra pregunta que la línea cronológica: no "cómo se mueve la
// venta mes a mes" sino "qué tan parecido/distinto es el mismo mes de un año
// al siguiente".
//
// Mismo criterio técnico que `GraficoConsistenciaLinea`: curva suave
// Catmull-Rom→Bezier (`curvaSuave`, se reusa), puntos HTML circulares con
// brillo neón fuera del SVG (para que `preserveAspectRatio="none"` no los
// deforme), tooltip propio con `useRef`+`getBoundingClientRect`, mes parcial
// como punto hueco (relleno blanco, borde del color del año). La diferencia
// está en `segmentosDeSerie`: cuando a un año le faltan meses seguidos (no
// consecutivos en el calendario), la línea de ESE año se corta ahí en vez de
// dibujar un segmento recto que uniría dos meses no contiguos como si el hueco
// de en medio fuera un valor real.

/** Un mes de un año, ya resuelto para el cruce por mes calendario. */
type PuntoMesConsistencia = {
  mes: number; // 1-12
  etiqueta: string; // "Ene", "Feb"…
  periodo: string;
  valor: number;
  texto: string;
  parcial: boolean;
};

/** La serie de un año: sólo sus meses observados, ordenados por mes calendario. */
type SerieAnioConsistencia = { anio: string; puntos: PuntoMesConsistencia[] };

/** El punto "activo" (hover/tap) del cruce por mes calendario, con su año —a
 * diferencia de `PuntoActivoLinea` acá hace falta saber de qué línea/año es
 * el punto, porque puede haber varios puntos en el mismo mes (uno por año). */
type PuntoActivoConsistencia = { punto: PuntoMesConsistencia; anio: string; xPct: number; yPct: number };

/** "Ene".."Dic", eje X fijo del cruce por mes calendario. */
const MESES_CORTOS_EJE = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * De `mapa.mesesPorAnio` arma una serie por año —ordenada por mes calendario,
 * SIN meses inventados en cero: un año sin agosto no dibuja un agosto en
 * cero, directamente no aparece en la lista de ese año, y es `segmentosDeSerie`
 * quien decide dónde cortar la línea por eso.
 */
function extraerConsistenciaPorAnio(mapa: MapaVentasB18, fmt: (valor: number) => string): SerieAnioConsistencia[] {
  const anios = Object.keys(mapa.mesesPorAnio).sort();
  return anios
    .map((anio) => {
      const meses = [...(mapa.mesesPorAnio[anio] ?? [])].sort((a, b) => a.mes - b.mes);
      const puntos: PuntoMesConsistencia[] = meses.map((mes) => ({
        mes: mes.mes,
        etiqueta: MESES_CORTOS_EJE[mes.mes - 1] ?? mes.etiqueta,
        periodo: mes.periodo,
        valor: mes.valor,
        texto: `${fmt(mes.valor)}${mes.parcial ? " · parcial" : ""}`,
        parcial: mes.parcial,
      }));
      return { anio, puntos };
    })
    .filter((serie) => serie.puntos.length > 0);
}

/**
 * Corta la serie de un año en tramos contiguos por mes calendario: dos meses
 * consecutivos (mes N y mes N+1) siguen en el mismo tramo; si el siguiente
 * punto salta más de un mes (falta uno o más meses en medio), arranca un
 * tramo nuevo. Así la curva nunca cruza un hueco como si fuera un valor real
 * —el mismo problema que resuelve `segmentosPorAnio` para la línea cronológica,
 * pero acá el eje es el mes calendario en vez de la posición en la lista.
 */
function segmentosDeSerie(puntos: PuntoMesConsistencia[]): PuntoMesConsistencia[][] {
  const segmentos: PuntoMesConsistencia[][] = [];
  puntos.forEach((punto, indice) => {
    const anterior = puntos[indice - 1];
    if (anterior && punto.mes - anterior.mes === 1) segmentos[segmentos.length - 1].push(punto);
    else segmentos.push([punto]);
  });
  return segmentos;
}

/**
 * El veredicto del cruce por mes calendario contesta otra pregunta que la
 * línea cronológica: no importa la tendencia general del histórico, sino QUÉ
 * TAN PARECIDO es el mismo mes de un año al siguiente. Se mide con el mes que
 * tiene la MAYOR diferencia porcentual entre su año más flojo y su año más
 * fuerte —ese es el mes menos consistente— entre los meses con 2 o más años
 * COMPLETOS para comparar. Los meses parciales quedan fuera: un mes cortado
 * por el corte compite en desventaja contra uno entero.
 */
function analizarConsistenciaCruzada(anios: SerieAnioConsistencia[], fmt: (valor: number) => string): string {
  if (anios.length < 2) return "Hay menos de dos años con meses observados: no hay con qué cruzar el mismo mes calendario.";

  const porMes = new Map<number, { anio: string; valor: number }[]>();
  anios.forEach((serie) => {
    serie.puntos.forEach((punto) => {
      if (punto.parcial) return;
      const lista = porMes.get(punto.mes) ?? [];
      lista.push({ anio: serie.anio, valor: punto.valor });
      porMes.set(punto.mes, lista);
    });
  });

  const comparables = [...porMes.entries()].filter(([, valores]) => valores.length >= 2);
  if (comparables.length === 0) return "Ningún mes calendario tiene dos años completos para comparar entre sí.";

  type Dispar = { mes: number; rango: number; min: { anio: string; valor: number }; max: { anio: string; valor: number } };
  let mesMasDispar: Dispar | null = null;
  comparables.forEach(([mes, valores]) => {
    const min = valores.reduce((a, b) => (b.valor < a.valor ? b : a));
    const max = valores.reduce((a, b) => (b.valor > a.valor ? b : a));
    const rango = min.valor > 0 ? ((max.valor - min.valor) / min.valor) * 100 : max.valor > 0 ? Infinity : 0;
    if (!mesMasDispar || rango > mesMasDispar.rango) mesMasDispar = { mes, rango, min, max };
  });
  if (!mesMasDispar) return "No se pudo calcular la dispersión entre años.";
  const disparNoNulo: Dispar = mesMasDispar;

  const nombreMes = MESES_CORTOS_EJE[disparNoNulo.mes - 1];
  const fraseDispersion = disparNoNulo.rango === 0
    ? `${nombreMes} es igual de fuerte en los años que se pueden comparar: ${fmt(disparNoNulo.min.valor)}`
    : `${nombreMes} es el mes con más diferencia entre años: de ${fmt(disparNoNulo.min.valor)} en ${disparNoNulo.min.anio} a ${fmt(disparNoNulo.max.valor)} en ${disparNoNulo.max.anio}`;

  return `${fraseDispersion}. Comparando el mismo mes calendario, ${comparables.length} de 12 meses tienen dos o más años completos para cruzar.`;
}

/**
 * Gráfico de 5 líneas superpuestas, una por año, mismo mes calendario en el
 * eje X para las cinco. Hecho a mano con SVG, mismo criterio técnico que
 * `GraficoConsistenciaLinea` (viewBox propio, `preserveAspectRatio="none"`,
 * puntos HTML fuera del SVG, tooltip propio con `useRef`) pero con el eje X
 * fijo en 12 meses en vez de la cronología completa, y con `segmentosDeSerie`
 * cortando cada línea de año donde falten meses seguidos.
 */
function GraficoConsistenciaCruzada({ anios }: { anios: SerieAnioConsistencia[] }) {
  const [activo, setActivo] = useState<PuntoActivoConsistencia | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const todosLosPuntos = anios.flatMap((serie) => serie.puntos);
  if (todosLosPuntos.length === 0) return null;

  const colorDe = (anio: string) => COLORES_ANIO[anios.findIndex((serie) => serie.anio === anio) % COLORES_ANIO.length];
  const ANCHO = 720, ALTO = 170, PAD_VERT = 10;
  const valores = todosLosPuntos.map((p) => p.valor);
  const maxValor = Math.max(...valores, 0);
  const minValor = Math.min(...valores, 0);
  const rango = maxValor - minValor || 1;
  const xDe = (mes: number) => ((mes - 1) / 11) * ANCHO;
  const yDe = (valor: number) => PAD_VERT + (1 - (valor - minValor) / rango) * (ALTO - PAD_VERT * 2);

  const activar = (punto: PuntoMesConsistencia, anio: string) =>
    setActivo({ punto, anio, xPct: (xDe(punto.mes) / ANCHO) * 100, yPct: (yDe(punto.valor) / ALTO) * 100 });

  // Igual que en la línea cronológica: se activa el punto más cercano a
  // donde cayó el mouse dentro del TRAMO (no del año entero), para no
  // depender de acertarle a un círculo de pocos px.
  const activarPorPosicion = (evento: React.PointerEvent, segmento: PuntoMesConsistencia[], anio: string) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((evento.clientX - rect.left) / rect.width) * ANCHO;
    let mejor = segmento[0], mejorDist = Infinity;
    for (const punto of segmento) {
      const dist = Math.abs(xDe(punto.mes) - relX);
      if (dist < mejorDist) { mejorDist = dist; mejor = punto; }
    }
    activar(mejor, anio);
  };

  return <div className="b18-cons-grafico">
    <div className="b18-cons-plano">
      <svg
        ref={svgRef}
        className="b18-cons-svg"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={anios.map((serie) => `${serie.anio}: ${serie.puntos.map((p) => `${p.etiqueta} ${p.texto}`).join(", ")}`).join(" · ")}
        onTouchStart={(evento) => { if (evento.target === evento.currentTarget) setActivo(null); }}
      >
        {anios.map((serie) => {
          const color = colorDe(serie.anio);
          const segmentos = segmentosDeSerie(serie.puntos);
          return <g key={serie.anio}>
            {segmentos.map((segmento, indiceSeg) => {
              const d = curvaSuave(segmento.map((p) => ({ x: xDe(p.mes), y: yDe(p.valor) })));
              return <g key={`${serie.anio}-${indiceSeg}`}>
                {/* Línea fina, sin brillo — el neón vive sólo en los puntos. */}
                <path d={d} className="b18-cons-linea" style={{ stroke: color } as CSSProperties} />
                {/* Encima, invisible y más gruesa: el área real donde el
                    mouse activa el tooltip. */}
                <path d={d} className="b18-cons-linea-hit" onPointerMove={(evento) => activarPorPosicion(evento, segmento, serie.anio)} onPointerLeave={() => setActivo(null)} />
              </g>;
            })}
          </g>;
        })}
      </svg>
      {/* Puntos como círculos HTML, no `<circle>` de SVG: con
          `preserveAspectRatio="none"` un círculo de SVG se estira distinto en
          X que en Y y queda ovalado. */}
      <div className="b18-cons-puntos" aria-hidden="true">
        {anios.flatMap((serie) => serie.puntos.map((p) => <span
          key={`${serie.anio}-${p.periodo}`}
          className={`b18-cons-punto ${p.parcial ? "is-parcial" : ""}`}
          title={`${serie.anio} ${p.etiqueta} · ${p.texto}`}
          style={{ left: `${(xDe(p.mes) / ANCHO) * 100}%`, top: `${(yDe(p.valor) / ALTO) * 100}%`, "--b18-glow": colorDe(serie.anio), backgroundColor: p.parcial ? "#fff" : colorDe(serie.anio), borderColor: colorDe(serie.anio) } as CSSProperties}
          onMouseEnter={() => activar(p, serie.anio)}
          onMouseLeave={() => setActivo(null)}
          onTouchStart={(evento) => { evento.stopPropagation(); activar(p, serie.anio); }}
        />))}
      </div>
      {activo ? <div className="b18-cons-tooltip" role="status" style={{ left: `${activo.xPct}%`, top: `${activo.yPct}%` }}>
        <b>{activo.anio} · {activo.punto.etiqueta}</b>
        <span>{activo.punto.texto}</span>
      </div> : null}
    </div>
    <div className="b18-cons-eje" aria-hidden="true">
      {MESES_CORTOS_EJE.map((etiqueta, indice) => <span key={etiqueta} style={{ left: `${(xDe(indice + 1) / ANCHO) * 100}%` }}>{etiqueta}</span>)}
    </div>
    <ul className="b18-cons-leyenda">
      {anios.map((serie) => <li key={serie.anio}><i style={{ backgroundColor: colorDe(serie.anio) }} />{serie.anio}</li>)}
    </ul>
  </div>;
}

/**
 * Modal de Consistencia: mismo patrón que `DrilldownDependencia` —mismo
 * cascarón (`.b18-drilldown-velo`/`.b18-drilldown`), header con botón de
 * cerrar, una frase de veredicto y el gráfico llevando el dato. Muestra DOS
 * lecturas, una debajo de la otra, cada una con su propio bloque
 * (`.b18-dep-bloque`) y su propio veredicto (`.b18-dep-veredicto`):
 *   1. La línea cronológica (arriba) — el mismo gráfico de la tarjeta chica,
 *      acá a tamaño completo: no se pasa `anchoMinPx`, así que el SVG se
 *      estira al 100% del modal en vez de scrollear.
 *   2. El cruce por mismo mes calendario (abajo) — 5 líneas por año,
 *      recuperado por pedido directo del usuario. No reemplaza a la línea
 *      cronológica, va ADEMÁS.
 */
function DrilldownConsistencia({ mapa, fmt, onCerrar }: { mapa: MapaVentasB18; fmt: (valor: number) => string; onCerrar: () => void }) {
  const { puntos, anios } = extraerConsistenciaCronologica(mapa, fmt);
  const veredicto = analizarConsistenciaCronologica(puntos, fmt);
  const primero = puntos[0] ?? null;
  const ultimo = puntos.length > 0 ? puntos[puntos.length - 1] : null;

  return <div className="b18-drilldown-velo" role="presentation" onPointerDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
    <section className="b18-drilldown b18-cons-drilldown" role="dialog" aria-modal="true" aria-labelledby="b18-drilldown-consistencia-titulo" style={{ "--b18-role": CONSISTENCIA_COLOR } as CSSProperties}>
      <header>
        <div>
          <p>CONSISTENCIA · CRONOLÓGICA</p>
          <h2 id="b18-drilldown-consistencia-titulo">Consistencia del crecimiento</h2>
          <span>{primero && ultimo ? `${primero.etiqueta} → ${ultimo.etiqueta}` : "Sin meses observados"} · corte {mapa.corte}</span>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar consistencia del crecimiento">×</button>
      </header>

      <section className="b18-dep-bloque" aria-label="Venta mensual, un solo tramo cronológico coloreado por año">
        <p className="b18-dep-veredicto">{veredicto}</p>
        <GraficoConsistenciaLinea puntos={puntos} anios={anios} />
      </section>
    </section>
  </div>;
}

/**
 * El gráfico año-contra-año (5 líneas superpuestas, mismo mes calendario
 * comparado entre años) NO vive en el modal: por instrucción directa, se
 * planta como su propia fila de ancho completo debajo del grid principal —
 * donde vivía el gráfico de Consistencia antes de que se separara en tarjeta
 * chica + modal — y el modal se queda sólo con la línea cronológica.
 */
function ConsistenciaPorAnio({ mapa, fmt }: { mapa: MapaVentasB18; fmt: (valor: number) => string }) {
  const anios = extraerConsistenciaPorAnio(mapa, fmt);
  const veredicto = analizarConsistenciaCruzada(anios, fmt);
  return <section className="b18-cons-fila" aria-label="Consistencia: el mismo mes calendario comparado entre años">
    <div className="b18-cons-fila-titulo"><span>Consistencia · año contra año</span></div>
    <p className="b18-dep-veredicto">{veredicto}</p>
    <GraficoConsistenciaCruzada anios={anios} />
  </section>;
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
  // Dependencia de clientes abre su propio drilldown, sólo de gráficos, en vez
  // del genérico de Evolución (serie anual/mensual/ficha, texto largo): es lo
  // que pidió el usuario para esta tarjeta en particular.
  const [dependenciaAbierta, setDependenciaAbierta] = useState(false);
  // Consistencia (cronológica) abre su propio modal, mismo patrón que
  // Dependencia: la tarjeta chica del slot "explica" es sólo el disparador.
  const [consistenciaAbierta, setConsistenciaAbierta] = useState(false);
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

      <div className={`b18-map-grid ${esEvolucion ? "b18-map-grid-evolucion" : ""}`}>
        {/* Evolución ya no repite a los otros tres agentes —que ya están en el
            lateral y en los chips del centro— pero tampoco muestra las cuatro
            tarjetas de sub-KPI de antes: sólo Dependencia (slot "detecta") y
            Consistencia cronológica (slot "explica") siguen siendo tarjetas.
            Ritmo y Calidad (prioriza/recomienda) se quedan en blanco por
            instrucción directa — no se renderizan. La navegación no depende
            de estas tarjetas: sigue viva en la lista lateral y en los chips,
            así que no se pierde ningún camino. */}
        {esEvolucion
          ? <>
              {subKpis?.filter((sub) => sub.id === "dependencia").map((sub) => <TarjetaSubKpi
                  key={sub.id}
                  sub={sub}
                  slot="detecta"
                  agente={agente}
                  onAbrir={() => setDependenciaAbierta(true)}
                />)}
              <TarjetaConsistenciaCronologica mapa={mapa} fmt={fmt} onAbrir={() => setConsistenciaAbierta(true)} />
            </>
          : agentes.map((item) => <TarjetaAgente key={item.id} agente={item} activa={item.id === activo} onSeleccionar={() => { setActivo(item.id); setDrilldown(item.id); }} />)}

        <article className="b18-centro" aria-live="polite">
          {/* Por instrucción directa: el panel central se dejó SOLO con el
              filtro de alcance. Todo lo demás que vivía acá (declaración del
              alcance, descomposición del crecimiento, chips de los 4 agentes,
              comparativo, métricas, enlace a Productos, ficha de metadatos)
              se quitó a propósito — no se perdió, sigue en el código de
              versiones anteriores si hace falta traer algo de vuelta. */}
          {esEvolucion && alcance ? <div className="b18-vt-alcance-bloque">
            <FiltroAlcance alcances={mapa.alcances} activo={alcance.id} onElegir={setAlcanceId} />
          </div> : null}
        </article>
      </div>

      {esEvolucion ? <ConsistenciaPorAnio mapa={mapa} fmt={fmt} /> : null}
    </div>

    {drilldown ? <DrilldownAgente agente={agentes.find((item) => item.id === drilldown) ?? agentes[0]} mapa={mapa} onCerrar={() => setDrilldown(null)} /> : null}
    {dashboardAbierto ? <DashboardVentasB18 mapa={mapa} fmt={fmt} onCerrar={() => setDashboardAbierto(false)} onAbrirAgente={(id) => { setActivo(id); setDrilldown(id); setDashboardAbierto(false); }} /> : null}
    {dependenciaAbierta ? <DrilldownDependencia mapa={mapa} onCerrar={() => setDependenciaAbierta(false)} /> : null}
    {consistenciaAbierta ? <DrilldownConsistencia mapa={mapa} fmt={fmt} onCerrar={() => setConsistenciaAbierta(false)} /> : null}
  </section>;
}
