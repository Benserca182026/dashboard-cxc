"use client";

/**
 * Faceta de tablero B18 — un gráfico por categoría, forma según el tipo de
 * dato. Genérico a propósito: lo usa el molde compartido (`MoldeB18.tsx`) y
 * las 3 páginas con stack propio (Producto, Ventas, Cartera de clientes),
 * cada una adaptando su propio contrato a esta forma mínima.
 */

import { pctB18 } from "@/lib/contrato-b18";

export type FormaFaceta = "barras" | "apilada" | "columnas" | "pareto" | "dumbbell" | "hero";
export type FilaFaceta = { nombre: string; pct: number; valorTexto?: string };
export type ParFaceta = { nombre: string; a: number; b: number; aTexto: string; bTexto: string };
export type HeroFaceta = { valor: string; etiqueta: string; medidorPct?: number; medidorEtiqueta?: string };

export const AZUL_MARCA = "#1a7fe6";
export const GRIS_CONTEXTO = "#b9cbea";
export const RAMPA_ORDINAL = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281", "#0d366b"];

export function FacetaTablero({ sigla, nombre, pregunta, senal, filas, forma = "barras", pares, paresEtiquetas, hero }: {
  sigla: string;
  nombre: string;
  pregunta: string;
  senal?: string;
  filas: FilaFaceta[];
  forma?: FormaFaceta;
  pares?: ParFaceta[];
  paresEtiquetas?: [string, string];
  hero?: HeroFaceta | null;
}) {
  const filasVisibles = filas.slice(0, forma === "apilada" ? 6 : 5);
  const maximo = Math.max(...filasVisibles.map((f) => f.pct), 1);
  const cabecera = <figcaption><span>{sigla}</span><strong>{nombre}</strong><em>{pregunta}</em></figcaption>;

  // ── hero: una cifra fuerte + medidor ────────────────────────────────────
  if (forma === "hero") {
    return <figure className="b18-dash-faceta b18-dash-faceta-hero">
      {cabecera}
      {hero
        ? <div className="b18-dash-hero">
            <strong>{hero.valor}</strong>
            <span>{hero.etiqueta}</span>
            {typeof hero.medidorPct === "number" && <>
              <i className="b18-dash-medidor" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(Math.max(hero.medidorPct, 0), 100))} aria-label={hero.medidorEtiqueta ?? hero.etiqueta}>
                <b style={{ width: `${Math.min(Math.max(hero.medidorPct, 0), 100)}%` }} />
              </i>
              {hero.medidorEtiqueta && <small>{hero.medidorEtiqueta}</small>}
            </>}
            {senal && <p>{senal}</p>}
          </div>
        : <p className="b18-dash-vacio">Sin cifra disponible</p>}
    </figure>;
  }

  // ── dumbbell: dos poblaciones por fila ───────────────────────────────────
  if (forma === "dumbbell" && pares && pares.length > 0) {
    const paresVisibles = pares.slice(0, 5);
    const tope = Math.max(...paresVisibles.flatMap((p) => [p.a, p.b]), 1);
    const [etA, etB] = paresEtiquetas ?? ["A", "B"];
    return <figure className="b18-dash-faceta">
      {cabecera}
      <div className="b18-dash-leyenda" aria-label="Leyenda"><span><i style={{ background: GRIS_CONTEXTO }} />{etA}</span><span><i style={{ background: AZUL_MARCA }} />{etB}</span></div>
      <ul className="b18-dash-dumbbell" role="list">
        {paresVisibles.map((p) => {
          const xa = (p.a / tope) * 100, xb = (p.b / tope) * 100;
          return <li key={p.nombre} title={`${p.nombre}: ${etA} ${p.aTexto} · ${etB} ${p.bTexto}`}>
            <span className="b18-dash-barra-nombre">{p.nombre}</span>
            <span className="b18-dash-dumbbell-pista">
              <i className="b18-dash-dumbbell-linea" style={{ left: `${Math.min(xa, xb)}%`, width: `${Math.abs(xb - xa)}%` }} />
              <i className="b18-dash-dumbbell-punto" style={{ left: `${xa}%`, background: GRIS_CONTEXTO }} />
              <i className="b18-dash-dumbbell-punto" style={{ left: `${xb}%`, background: AZUL_MARCA }} />
            </span>
            <b className="b18-dash-barra-valor">{p.aTexto} → {p.bTexto}</b>
          </li>;
        })}
      </ul>
    </figure>;
  }

  if (filasVisibles.length === 0) {
    return <figure className="b18-dash-faceta">{cabecera}<p className="b18-dash-vacio">Sin reparto disponible</p></figure>;
  }

  // ── apilada: tramos ordenados que suman 100% ─────────────────────────────
  if (forma === "apilada") {
    const suma = filasVisibles.reduce((s, f) => s + f.pct, 0) || 1;
    return <figure className="b18-dash-faceta">
      {cabecera}
      <div className="b18-dash-apilada" role="img" aria-label={filasVisibles.map((f) => `${f.nombre} ${pctB18(f.pct)}`).join(", ")}>
        {filasVisibles.map((f, i) => <i key={f.nombre} title={`${f.nombre}: ${f.valorTexto ?? pctB18(f.pct)} · ${pctB18(f.pct)}`} style={{ flexGrow: Math.max(f.pct / suma, 0.01), background: RAMPA_ORDINAL[Math.min(i, RAMPA_ORDINAL.length - 1)] }} />)}
      </div>
      <ul className="b18-dash-apilada-leyenda" role="list">
        {filasVisibles.map((f, i) => <li key={f.nombre}>
          <i style={{ background: RAMPA_ORDINAL[Math.min(i, RAMPA_ORDINAL.length - 1)] }} />
          <span>{f.nombre}</span>
          <b>{f.valorTexto ?? pctB18(f.pct)}</b>
          <em>{pctB18(f.pct)}</em>
        </li>)}
      </ul>
    </figure>;
  }

  // ── columnas / pareto: SVG en orden de entrada ───────────────────────────
  if (forma === "columnas" || forma === "pareto") {
    const n = filasVisibles.length;
    const ancho = 100, alto = 60, base = 46, techo = 8;
    const paso = ancho / n, w = paso * 0.56;
    const altura = (pct: number) => ((pct / maximo) * (base - techo));
    let acumulado = 0;
    const puntos = filasVisibles.map((f, i) => {
      acumulado += f.pct;
      const x = paso * i + paso / 2;
      return { x, yBarra: base - altura(f.pct), yAcum: base - (Math.min(acumulado, 100) / 100) * (base - techo), acum: acumulado, f };
    });
    const linea = (forma === "pareto" ? puntos.map((p) => `${p.x},${p.yAcum}`) : puntos.map((p) => `${p.x},${p.yBarra}`)).join(" ");
    return <figure className="b18-dash-faceta">
      {cabecera}
      {forma === "pareto" && <div className="b18-dash-leyenda" aria-label="Leyenda"><span><i style={{ background: AZUL_MARCA }} />participación</span><span><i className="b18-dash-leyenda-linea" />acumulado</span></div>}
      <svg className="b18-dash-svg" viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img" aria-label={filasVisibles.map((f) => `${f.nombre} ${f.valorTexto ?? pctB18(f.pct)}`).join(", ")}>
        <line x1="0" y1={base} x2={ancho} y2={base} className="b18-dash-svg-base" />
        {puntos.map((p) => <g key={p.f.nombre}>
          <title>{`${p.f.nombre}: ${p.f.valorTexto ?? pctB18(p.f.pct)} · ${pctB18(p.f.pct)}${forma === "pareto" ? ` · acumulado ${pctB18(p.acum)}` : ""}`}</title>
          <rect x={p.x - w / 2} y={p.yBarra} width={w} height={base - p.yBarra} rx="1.2" className="b18-dash-svg-barra" style={{ fill: forma === "pareto" && p === puntos[0] ? AZUL_MARCA : forma === "pareto" ? GRIS_CONTEXTO : AZUL_MARCA }} />
          <text x={p.x} y={base + 6} textAnchor="middle" className="b18-dash-svg-eje">{p.f.nombre.length > 9 ? `${p.f.nombre.slice(0, 8)}…` : p.f.nombre}</text>
        </g>)}
        <polyline points={linea} className="b18-dash-svg-linea" />
        {puntos.map((p) => <circle key={`m-${p.f.nombre}`} cx={p.x} cy={forma === "pareto" ? p.yAcum : p.yBarra} r="1.6" className="b18-dash-svg-marcador" />)}
        {(forma === "pareto" ? [puntos[puntos.length - 1]] : puntos).map((p) => <text key={`v-${p.f.nombre}`} x={p.x} y={(forma === "pareto" ? p.yAcum : p.yBarra) - 2.2} textAnchor={forma === "pareto" ? "end" : "middle"} className="b18-dash-svg-valor">{forma === "pareto" ? pctB18(p.acum) : (p.f.valorTexto ?? pctB18(p.f.pct))}</text>)}
      </svg>
    </figure>;
  }

  // ── barras (ranking con énfasis): líder en azul, contexto en gris ────────
  return <figure className="b18-dash-faceta">
    {cabecera}
    <ul className="b18-dash-barras" role="list">
      {filasVisibles.map((fila, i) => {
        const valor = fila.valorTexto ?? pctB18(fila.pct);
        return <li key={fila.nombre} title={`${fila.nombre}: ${valor} · ${pctB18(fila.pct)}`}>
          <span className="b18-dash-barra-nombre">{fila.nombre}</span>
          <span className="b18-dash-barra-pista"><i style={{ width: `${Math.max((fila.pct / maximo) * 100, 2)}%`, background: i === 0 ? AZUL_MARCA : GRIS_CONTEXTO }} /></span>
          <b className="b18-dash-barra-valor">{valor}</b>
        </li>;
      })}
    </ul>
  </figure>;
}
