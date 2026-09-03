"use client";

/**
 * MOLDE B18 — el formato aprobado, escrito una sola vez.
 *
 * Estructura, idéntica a la referencia /ventas/productos:
 *
 *   riel        canvas
 *   +----+----------+----------+----------+
 *   | .. | Detecta  |          | Explica  |
 *   | .. +----------+  CENTRO  +----------+
 *   | B18| Prioriza |          |Recomienda|
 *   +----+----------+----------+----------+
 *
 * Reglas que este componente GARANTIZA para toda página que lo use:
 *   - B18 nace cerrado y sólo abre con clic en su botón.
 *   - El drill-down sólo abre con clic en una tarjeta.
 *   - Ningún hover abre nada: el hover sólo resalta.
 *   - Toda cifra llega ya formateada; el molde no convierte ni asume unidad.
 *
 * Las clases .b18-* viven en app/globals.css y no mencionan ningún dominio.
 */

import { useState, type CSSProperties } from "react";
import {
  COLORES_B18,
  NOMBRES_B18,
  pctB18,
  type CategoriaB18,
  type ContratoB18,
  type FilaB18,
  type GraficaB18,
  type TarjetaB18,
} from "@/lib/contrato-b18";

function MiniGrafica({ tipo, color, filas, donaPct }: {
  tipo: GraficaB18; color: string; filas: FilaB18[]; donaPct: number;
}) {
  if (tipo === "dona" || tipo === "cobertura") {
    const seguro = Math.min(Math.max(donaPct, 0), 100);
    return <div
      className="b18-mini-dona"
      style={{ "--b18-color": color, "--b18-pct": `${seguro * 3.6}deg` } as CSSProperties}
      aria-label={`${tipo}: ${pctB18(seguro)}`}
    ><span>{seguro.toFixed(0)}%</span></div>;
  }
  const visibles = filas.slice(0, 3);
  if (tipo === "pareto") return <div className="b18-mini-pareto" aria-label="Pareto de la categoría activa">
    {visibles.map((fila, i) => <i key={fila.nombre} style={{ height: `${Math.max(fila.pct, 12)}%`, backgroundColor: color, opacity: 1 - i * 0.2 }} />)}
  </div>;
  return <div className="b18-mini-barras" aria-label="Barras de la categoría activa">
    {visibles.map((fila, i) => <i key={fila.nombre} style={{ width: `${Math.max(fila.pct, 8)}%`, backgroundColor: color, opacity: 1 - i * 0.2 }} />)}
  </div>;
}

function TarjetaRol({ tarjeta, categoria, activa, onSeleccionar }: {
  tarjeta: TarjetaB18; categoria: CategoriaB18; activa: boolean; onSeleccionar: () => void;
}) {
  const color = COLORES_B18[tarjeta.id];
  return <button
    type="button"
    className={`b18-rol-card b18-rol-${tarjeta.id} ${activa ? "is-active" : ""}`}
    onClick={onSeleccionar}
    aria-pressed={activa}
    aria-label={`${NOMBRES_B18[tarjeta.id]}. Abrir lectura ampliada`}
    style={{ "--b18-role": color } as CSSProperties}
  >
    <span className="b18-connector" aria-hidden="true" />
    <div className="b18-rol-visual">
      <div className="b18-rol-heading"><span>{categoria.sigla}</span><strong>{NOMBRES_B18[tarjeta.id]}</strong></div>
      <div className="b18-rol-content">
        <div className="b18-rol-kpi"><strong>{tarjeta.kpiTexto}</strong><span>{tarjeta.etiqueta}</span></div>
        <MiniGrafica tipo={tarjeta.grafica} color={color} filas={categoria.filas} donaPct={tarjeta.donaPct ?? categoria.cobertura} />
      </div>
      <p className="b18-rol-resumen">{tarjeta.resumen}</p>
    </div>
  </button>;
}

type Pestana = "resultado" | "problema" | "accion";

function Drilldown({ tarjeta, categoria, onCerrar }: {
  tarjeta: TarjetaB18; categoria: CategoriaB18; onCerrar: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("resultado");
  const principal = categoria.filas[0];
  const color = COLORES_B18[tarjeta.id];
  const pestanas: { id: Pestana; nombre: string }[] = [
    { id: "resultado", nombre: "Resultado" },
    { id: "problema", nombre: "Diagnóstico" },
    { id: "accion", nombre: "Acción" },
  ];

  return <div className="b18-drilldown-velo" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
    <section className="b18-drilldown" role="dialog" aria-modal="true" aria-labelledby="b18-drilldown-titulo" style={{ "--b18-role": color } as CSSProperties}>
      <header>
        <div>
          <p>Agente · {categoria.sigla}</p>
          <h2 id="b18-drilldown-titulo">{NOMBRES_B18[tarjeta.id]}: lectura ampliada</h2>
          <span>{categoria.nombre} · corte declarado en el pie</span>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar lectura ampliada">×</button>
      </header>
      <nav className="b18-drilldown-tabs" aria-label="Secciones del agente">
        {pestanas.map((tab) => <button key={tab.id} type="button" aria-pressed={pestana === tab.id} onClick={() => setPestana(tab.id)}>{tab.nombre}</button>)}
      </nav>

      {pestana === "resultado" ? <div className="b18-drilldown-resultados">
        <div className="b18-drilldown-kpi">
          {(() => {
            // B18-1: la dona del drill-down debe leer el KPI de la TARJETA
            // que se clickeó, no `principal` (categoria.filas[0], fijo). Se
            // usa la misma regla de fallback que TarjetaRol/MiniGrafica más
            // arriba (`tarjeta.donaPct ?? categoria.cobertura`): "explica" y
            // "prioriza" (barras/pareto) no traen `donaPct` propio, así que
            // caen a la cobertura de la categoría — un valor constante por
            // categoría, no una fila arbitraria del reparto.
            const donaValor = tarjeta.donaPct ?? categoria.cobertura;
            const donaSeguro = Math.min(Math.max(donaValor, 0), 100);
            return <div className="b18-diagnostico-dona" style={{ "--b18-color": color, "--b18-pct": `${donaSeguro * 3.6}deg` } as CSSProperties}>
              <strong>{donaSeguro.toFixed(0)}%</strong>
            </div>;
          })()}
          <div>
            <small>Señal principal</small>
            <strong>{principal?.nombre ?? "Sin señal"}</strong>
            <span>{tarjeta.kpiTexto} · {tarjeta.etiqueta} · {pctB18(categoria.cobertura)} {categoria.coberturaEtiqueta}</span>
          </div>
        </div>
        <div className="b18-drilldown-barras">
          {categoria.filas.slice(0, 5).map((fila) => <div key={fila.nombre}>
            <span>{fila.nombre}</span><b>{fila.valorTexto ?? pctB18(fila.pct)}</b>
            <i style={{ width: `${Math.max(fila.pct, 3)}%` }} />
          </div>)}
        </div>
      </div> : null}

      {pestana === "problema" ? <div className="b18-drilldown-texto">
        <small>Problema encontrado</small>
        <h3>{tarjeta.problema}</h3>
        <p>{categoria.problema}</p>
        <dl>
          <div><dt>Impacto observado</dt><dd>{tarjeta.resumen}</dd></div>
          <div><dt>Límite de lectura</dt><dd>{categoria.metadatos.at(-1)?.valor ?? "Declarado en el pie de procedencia."}</dd></div>
        </dl>
      </div> : null}

      {pestana === "accion" ? <div className="b18-drilldown-texto">
        <small>Recomendación del agente</small>
        <h3>{tarjeta.accion}</h3>
        <p>La lectura ordena la revisión; no autoriza la decisión. Confirmar contra la fuente antes de actuar.</p>
        <dl>
          {categoria.metadatos.slice(0, 4).map((meta) => <div key={meta.termino}><dt>{meta.termino}</dt><dd>{meta.valor}</dd></div>)}
        </dl>
      </div> : null}
    </section>
  </div>;
}

function DashboardB18({ contrato, onCerrar, onAbrirCategoria }: {
  contrato: ContratoB18; onCerrar: () => void; onAbrirCategoria: (id: string) => void;
}) {
  const { resumen, categorias, corte } = contrato;
  const primera = categorias[0];
  const principal = primera?.filas[0];

  return <div className="b18-diagnostico-velo" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
    <section className="b18-diagnostico b18-dashboard" role="dialog" aria-modal="true" aria-labelledby="b18-dashboard-titulo">
      <header>
        <div>
          <p>Dashboard B18 · lectura integral</p>
          <h2 id="b18-dashboard-titulo">{contrato.titulo}</h2>
          <small>{resumen.subtitulo} · corte {corte}</small>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar dashboard B18">×</button>
      </header>

      <div className="b18-dashboard-kpis">
        {resumen.kpis.map((kpi) => <div key={kpi.etiqueta}>
          <span>{kpi.etiqueta}</span><strong>{kpi.valor}</strong><b>{kpi.nota}</b>
        </div>)}
      </div>

      <div className="b18-dashboard-grid">
        <article className="b18-dashboard-mix">
          <div className="b18-dashboard-titulo"><span>{resumen.tituloMix}</span><h3>{resumen.preguntaMix}</h3></div>
          <div className="b18-dashboard-mix-body">
            <div className="b18-dona-principal" style={{ "--b18-color": COLORES_B18.detecta, "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` } as CSSProperties}>
              <span>{(principal?.pct ?? 0).toFixed(0)}<small>%</small></span>
              <em>{principal?.nombre ?? "Sin señal"}</em>
            </div>
            <div className="b18-dashboard-barras">
              {(primera?.filas ?? []).slice(0, 5).map((fila) => <div key={fila.nombre}>
                <span>{fila.nombre}</span><b>{fila.valorTexto ?? pctB18(fila.pct)}</b>
                <i style={{ width: `${Math.max(fila.pct, 3)}%` }} />
              </div>)}
            </div>
          </div>
        </article>

        <article className="b18-dashboard-cobertura">
          <div className="b18-dashboard-titulo"><span>{resumen.tituloCobertura}</span><h3>{resumen.preguntaCobertura}</h3></div>
          <div className="b18-dashboard-cobertura-lista">
            {categorias.map((cat) => <div key={cat.id}>
              <span>{cat.sigla} · {cat.nombre}</span><b>{pctB18(cat.cobertura)}</b>
              <i style={{ width: `${Math.min(Math.max(cat.cobertura, 0), 100)}%` }} />
            </div>)}
          </div>
          <p>{resumen.notaCobertura}</p>
        </article>
      </div>

      <section className="b18-dashboard-problemas" aria-label="Problemas encontrados">
        <div className="b18-dashboard-titulo"><span>Problemas encontrados</span><h3>Qué requiere revisión antes de decidir</h3></div>
        <div>
          {categorias.map((cat) => <button type="button" key={cat.id} onClick={() => onAbrirCategoria(cat.id)}>
            <span>{cat.sigla}</span>
            <div><strong>{cat.nombre}</strong><p>{cat.problema}</p></div>
            <b>{pctB18(cat.cobertura)}</b>
            <em>Ver agente →</em>
          </button>)}
        </div>
      </section>

      <footer>{resumen.pie}</footer>
    </section>
  </div>;
}

export function MoldeB18({ contrato }: { contrato: ContratoB18 }) {
  const [categoriaId, setCategoriaId] = useState(contrato.categorias[0]?.id ?? "");
  const [rolActivo, setRolActivo] = useState<TarjetaB18["id"]>("detecta");
  const [drilldown, setDrilldown] = useState<TarjetaB18["id"] | null>(null);
  // B18 NACE CERRADO. Sólo su botón lo abre.
  const [b18Abierto, setB18Abierto] = useState(false);

  const categoria = contrato.categorias.find((c) => c.id === categoriaId) ?? contrato.categorias[0];
  if (!categoria) return null;

  const tarjetaActiva = categoria.tarjetas.find((t) => t.id === rolActivo) ?? categoria.tarjetas[0];
  const principal = categoria.filas[0];
  const colorActivo = COLORES_B18[tarjetaActiva?.id ?? "detecta"];

  const irACategoria = (id: string) => { setCategoriaId(id); setRolActivo("detecta"); };

  return <section className="b18-map" aria-label={`Mapa B18 · ${contrato.titulo}`}>
    <aside className="b18-map-lateral">
      <div className="b18-map-marca">{categoria.sigla}</div>
      <p>{contrato.rotuloRiel}</p>
      <div className="b18-map-lista">
        {contrato.categorias.map((cat) => <button key={cat.id} type="button" onClick={() => irACategoria(cat.id)} aria-pressed={cat.id === categoria.id}>
          <span>{cat.sigla}</span>{cat.nombre}
        </button>)}
      </div>
      <div className="b18-map-status">
        <span>Agent status</span><b>● Lectura activa</b><p>{categoria.senal}</p>
      </div>
      <button type="button" className="b18-map-b18" onClick={() => setB18Abierto(true)} aria-label="Abrir diagnóstico integral B18">B<span>18</span></button>
    </aside>

    <div className="b18-map-canvas">
      <header className="b18-map-header">
        <div><p>Reporte general</p><h2>{contrato.titulo}</h2></div>
        <span>Corte: {contrato.corte}</span>
      </header>

      <div className="b18-map-grid">
        {categoria.tarjetas.map((tarjeta) => <TarjetaRol
          key={tarjeta.id}
          tarjeta={tarjeta}
          categoria={categoria}
          activa={tarjeta.id === rolActivo}
          onSeleccionar={() => { setRolActivo(tarjeta.id); setDrilldown(tarjeta.id); }}
        />)}

        <article className="b18-centro" aria-live="polite">
          <p className="b18-centro-eyebrow">Reporte visual · {categoria.nombre}</p>
          <h3>{categoria.pregunta}</h3>

          <div className="b18-centro-viz">
            <div className="b18-dona-principal" style={{ "--b18-color": colorActivo, "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` } as CSSProperties}>
              <span>{(principal?.pct ?? 0).toFixed(2)}<small>%</small></span>
              <em>{principal?.nombre ?? "Sin señal"}</em>
            </div>
            <div className="b18-centro-barras" aria-label="Distribución de la categoría activa">
              {categoria.filas.slice(0, 3).map((fila, i) => <div key={fila.nombre}>
                <span>{fila.nombre}</span><b>{fila.valorTexto ?? pctB18(fila.pct)}</b>
                <i style={{ width: `${Math.max(fila.pct, 3)}%`, opacity: 1 - i * 0.18, backgroundColor: colorActivo }} />
              </div>)}
            </div>
          </div>

          <div className="b18-centro-metricas">
            {categoria.metricas.map((metrica) => <div key={metrica.etiqueta}>
              <b>{metrica.valor}</b><span>{metrica.etiqueta}</span>
            </div>)}
          </div>

          <div className="b18-decision">
            <p>Siguiente validación</p><strong>{tarjetaActiva?.accion}</strong>
          </div>

          <dl className="b18-metadatos">
            {categoria.metadatos.map((meta) => <div key={meta.termino}>
              <dt>{meta.termino}</dt><dd>{meta.valor}</dd>
            </div>)}
          </dl>
        </article>
      </div>
    </div>

    {drilldown && tarjetaActiva ? <Drilldown
      tarjeta={categoria.tarjetas.find((t) => t.id === drilldown) ?? tarjetaActiva}
      categoria={categoria}
      onCerrar={() => setDrilldown(null)}
    /> : null}

    {b18Abierto ? <DashboardB18
      contrato={contrato}
      onCerrar={() => setB18Abierto(false)}
      onAbrirCategoria={(id) => { irACategoria(id); setDrilldown("detecta"); setB18Abierto(false); }}
    /> : null}
  </section>;
}
