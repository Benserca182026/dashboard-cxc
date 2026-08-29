"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { MascotaB18, TONOS_MASCOTA, type TonoMascota } from "./MascotaB18";
import type { AgenteLateral } from "./PanelAgentesLateral";

function MicroVisual<T extends string>({ agente }: { agente: AgenteLateral<T> }) {
  const datos = agente.miniDatos ?? [];
  const principal = datos[0]?.valor ?? agente.kpiPct ?? 0;

  if (agente.kpiVisual === "pareto") {
    const maximo = Math.max(...datos.map((dato) => dato.valor), 1);
    return (
      <span className="product-mini product-mini-pareto" aria-label="Mini Pareto de modelos">
        {datos.slice(0, 3).map((dato) => (
          <i key={dato.etiqueta} style={{ height: `${Math.max(20, dato.valor / maximo * 100)}%` }} title={`${dato.etiqueta} ${dato.valor.toFixed(2)}%`} />
        ))}
      </span>
    );
  }

  if (agente.kpiVisual === "barras") {
    const maximo = Math.max(...datos.map((dato) => dato.valor), 1);
    return (
      <span className="product-mini product-mini-bars" aria-label="Ranking de tipos de casco">
        {datos.slice(0, 3).map((dato) => (
          <i key={dato.etiqueta} style={{ width: `${Math.max(12, dato.valor / maximo * 100)}%` }} title={`${dato.etiqueta} ${dato.valor.toFixed(2)}%`} />
        ))}
      </span>
    );
  }

  return (
    <span
      className={`product-mini product-mini-ring ${agente.kpiVisual === "cobertura" ? "product-mini-coverage" : ""}`}
      style={{ "--mini-value": `${principal}%` } as CSSProperties}
      aria-label={`${principal.toFixed(2)} por ciento`}
    >
      <i>{principal.toFixed(0)}%</i>
    </span>
  );
}

function TarjetaComercial<T extends string>({
  agente,
  indice,
  tono,
  seleccionado,
  onSeleccionar,
}: {
  agente: AgenteLateral<T>;
  indice: number;
  tono: TonoMascota;
  seleccionado: boolean;
  onSeleccionar: () => void;
}) {
  const conclusion = agente.lecturas?.[tono] ?? "";
  return (
    <button
      type="button"
      className={`product-agent-card product-agent-card-${indice} ${seleccionado ? "product-agent-card-selected" : ""}`}
      style={{ "--focus-color": TONOS_MASCOTA[tono].color } as CSSProperties}
      onClick={onSeleccionar}
      data-testid={`card-${agente.id}`}
      data-focus={tono}
      aria-pressed={seleccionado}
    >
      <span className="product-agent-card-head">
        <i>{agente.iniciales}</i>
        <b>{agente.nombre}</b>
        {seleccionado ? <small>En foco</small> : null}
      </span>
      <strong className="product-agent-question">{agente.pregunta}</strong>
      <span className="product-agent-kpi-row">
        <MicroVisual agente={agente} />
        <span className="product-agent-kpis">
          {(agente.kpis ?? [`${agente.kpiEtiqueta} ${agente.kpiPct?.toFixed(2)}%`]).map((kpi) => <em key={kpi}>{kpi}</em>)}
        </span>
      </span>
      <span className="product-agent-conclusion">{conclusion}</span>
    </button>
  );
}

export function PanelAgentesReferencia<T extends string>({
  agentes,
  activo,
  onSeleccionar,
  children,
}: {
  agentes: AgenteLateral<T>[];
  activo: T;
  onSeleccionar: (id: T) => void;
  children: ReactNode;
}) {
  const [tono, setTono] = useState<TonoMascota>("riesgo");
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];
  const alrededor = agentes.filter((item) => item.id !== agente?.id);
  const lecturaActiva = agente?.lecturas?.[tono] ?? "";

  useEffect(() => {
    if (!detalleAbierto) return;
    const cerrarConEscape = (event: KeyboardEvent) => event.key === "Escape" && setDetalleAbierto(false);
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.body.style.overflow = desbordeAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [detalleAbierto]);

  return (
    <section
      className="product-commercial-shell"
      data-b18-boundary
      style={{ "--focus-color": TONOS_MASCOTA[tono].color } as CSSProperties}
    >
      <div className="product-commercial-intro">
        <div>
          <p>Lectura de portafolio</p>
          <h2>Cinco agentes, una decisión comercial</h2>
        </div>
        <span><i />{TONOS_MASCOTA[tono].etiqueta}</span>
      </div>

      <div className="product-agent-stage">
        {agentes.map((item, indice) => (
          <TarjetaComercial
            key={item.id}
            agente={item}
            indice={indice}
            tono={tono}
            seleccionado={item.id === activo}
            onSeleccionar={() => onSeleccionar(item.id)}
          />
        ))}

        <div className="product-agent-center" aria-live="polite">
          {alrededor.map((item, indice) => (
            <button
              key={item.id}
              type="button"
              className={`product-orbit-node product-orbit-node-${indice}`}
              onClick={() => onSeleccionar(item.id)}
              aria-label={`Seleccionar ${item.nombre}`}
            >
              <b>{item.iniciales}</b><span>{item.nombre}</span>
            </button>
          ))}
          <button
            type="button"
            className="product-central-node"
            data-testid="central-agent"
            data-agent={agente?.id}
            onClick={() => setDetalleAbierto(true)}
            aria-label={`Abrir detalle de ${agente?.nombre}`}
          >
            <span>{agente?.iniciales}</span>
            <small>Abrir detalle</small>
          </button>
          <div className="product-center-reading">
            <p>{agente?.nombre}</p>
            <h3>{agente?.pregunta}</h3>
            <span>{lecturaActiva}</span>
          </div>
        </div>
      </div>

      <div className="product-b18-dock" aria-hidden="true" />
      <MascotaB18 tono={tono} onTonoCambiar={setTono} />

      {detalleAbierto ? (
        <div className="product-detail-layer" role="dialog" aria-modal="true" aria-label={`Detalle de ${agente?.nombre}`} data-testid="agent-detail">
          <button type="button" className="product-detail-backdrop" onClick={() => setDetalleAbierto(false)} aria-label="Cerrar detalle" />
          <div className="product-detail-agents" aria-label="Otros agentes comerciales">
            {alrededor.map((item) => (
              <button key={item.id} type="button" onClick={() => onSeleccionar(item.id)} aria-label={`Ver ${item.nombre}`}>
                <b>{item.iniciales}</b><span>{item.nombre}</span>
              </button>
            ))}
          </div>
          <article className="product-detail-modal">
            <header>
              <div className="product-detail-agent-mark">{agente?.iniciales}</div>
              <div>
                <p>{agente?.nombre} · {TONOS_MASCOTA[tono].etiqueta}</p>
                <h2>{agente?.pregunta}</h2>
              </div>
              <button type="button" onClick={() => setDetalleAbierto(false)} aria-label="Cerrar dashboard detallado">×</button>
            </header>
            <div className="product-detail-decision">
              <span>Decisión comercial</span>
              <strong>{lecturaActiva}</strong>
            </div>
            <div className="product-detail-content">{children}</div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
