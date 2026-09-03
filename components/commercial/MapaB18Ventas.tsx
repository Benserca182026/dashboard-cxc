"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type {
  AgenteVentasB18,
  BarraSerieB18,
  LecturaAgenteVentasB18,
  MapaVentasB18,
} from "@/lib/agentes-ventas-b18";

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
  const { agentes, corte, historia, ytd } = mapa;
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];

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
        {agentes.map((item) => <TarjetaAgente key={item.id} agente={item} activa={item.id === activo} onSeleccionar={() => { setActivo(item.id); setDrilldown(item.id); }} />)}

        <article className="b18-centro" aria-live="polite">
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
