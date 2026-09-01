"use client";

import { useState, type ReactNode } from "react";
import { TONOS_MASCOTA, type TonoMascota } from "./MascotaB18";
import type { AgenteLateral } from "./PanelAgentesLateral";

export type TarjetaAnalisis = {
  id: string;
  etiqueta: string;
  pregunta: string;
  kpiEtiqueta: string;
  kpiPct: number;
  conclusion: string;
};

export function PanelReporteAgentes<T extends string>({
  agentes,
  activo,
  tono,
  onSeleccionar,
  onTonoCambiar,
  analisis,
  titulo,
  corte,
  children,
}: {
  agentes: AgenteLateral<T>[];
  activo: T;
  tono: TonoMascota;
  onSeleccionar: (id: T) => void;
  onTonoCambiar: (tono: TonoMascota) => void;
  analisis?: TarjetaAnalisis[];
  titulo: string;
  corte: string;
  children: ReactNode;
}) {
  const [dashboardAbierto, setDashboardAbierto] = useState(false);
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];
  const lecturas = analisis?.length ? analisis : agentes.map((item) => ({
    id: item.id,
    etiqueta: item.nombre,
    pregunta: item.pregunta ?? item.senal,
    kpiEtiqueta: item.kpiEtiqueta ?? "señal",
    kpiPct: item.kpiPct ?? 0,
    conclusion: item.accion ?? item.senal,
  }));
  return <section className="bg-white py-2 md:py-3">
    <div className="reporte-agentes-shell">
      <aside className="reporte-agentes-lateral">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#3d74ec,#7dc3ff)] text-[11px] font-black text-white shadow-[0_12px_26px_rgba(64,119,239,.28)] ring-4 ring-[#edf4ff]">{agente?.iniciales}</div>
        <p className="mb-3 text-[9px] font-black uppercase tracking-[.15em] text-[#9babc8]">Agentes</p>
        <div className="space-y-2">
          {agentes.map((item) => <button key={item.id} type="button" aria-pressed={item.id === activo} onClick={() => onSeleccionar(item.id)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition ${item.id === activo ? "bg-white shadow-[0_12px_24px_rgba(70,106,180,.18)] ring-1 ring-[#e5edff]" : "opacity-60 hover:bg-white hover:opacity-100"}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black ${item.id === activo ? "bg-[#dce9ff] text-[#3f78ec]" : "bg-[#eef3ff] text-[#a5b9ec]"}`}>{item.iniciales}</span>
            <span className={`hidden truncate text-[10px] font-black md:block ${item.id === activo ? "text-[#416bb8]" : "text-[#aab8d1]"}`}>{item.nombre}</span>
          </button>)}
        </div>
        <div className="mt-5 rounded-2xl border border-white bg-white/95 p-3 shadow-[0_12px_26px_rgba(71,103,171,.14)]">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[.12em] text-[#71809b]"><span>Agent status</span><span className="text-[#779ff3]">● Live</span></div>
          <div className="mt-2 rounded-lg bg-[#dfe9ff] px-2.5 py-2 text-[#4263a2]"><div className="flex justify-between gap-2 text-[10px] font-black"><span className="truncate">{agente?.nombre}</span><span>{TONOS_MASCOTA[tono].etiqueta}</span></div><p className="mt-1 text-[9px] font-bold leading-tight text-[#5675b3]">{agente?.senal}</p></div>
        </div>
        <button type="button" className="panel-b18" onClick={() => setDashboardAbierto(true)} aria-label="Abrir dashboard integral B18">B<span>18</span></button>
      </aside>
      <main className="reporte-agentes-canvas">
        <div className="reporte-agentes-cabecera"><div><p>Reporte general</p><h2>{titulo}</h2></div><span>Corte: {corte}</span></div>
        <div className="reporte-agentes-grid">
          {lecturas.slice(0, 4).map((item, indice) => <button type="button" key={item.id} onClick={() => onSeleccionar(item.id as T)} className={`reporte-agente-tarjeta reporte-agente-${indice}`}>
            <span className="reporte-agente-sigla">{agente?.iniciales}</span><span className="reporte-agente-nombre">{agente?.nombre} · {item.etiqueta}</span><strong>{item.pregunta}</strong><span className="reporte-agente-kpi"><b>{item.kpiEtiqueta}</b><em>{item.kpiPct.toFixed(2)}%</em></span><span className="reporte-agente-riel"><i style={{ width: `${Math.max(item.kpiPct, 3)}%` }} /></span><span className="reporte-agente-conclusion">{item.conclusion}</span>
          </button>)}
          <article className="reporte-agentes-centro" aria-live="polite">{children}</article>
        </div>
      </main>
      {dashboardAbierto ? <div className="panel-b18-velo" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && setDashboardAbierto(false)}><section className="panel-b18-dashboard" role="dialog" aria-modal="true" aria-labelledby="panel-b18-titulo"><header><div><p>Dashboard integral B18</p><h2 id="panel-b18-titulo">{titulo}</h2><span>Reporte general · corte {corte}</span></div><button type="button" onClick={() => setDashboardAbierto(false)} aria-label="Cerrar dashboard B18">×</button></header><div className="panel-b18-metricas">{lecturas.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => { onSeleccionar(item.id as T); setDashboardAbierto(false); }}><span>{item.etiqueta}</span><strong>{item.kpiPct.toFixed(2)}%</strong><small>{item.kpiEtiqueta}</small></button>)}</div><section className="panel-b18-alertas"><p>Alertas y problemas encontrados</p>{lecturas.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => { onSeleccionar(item.id as T); setDashboardAbierto(false); }}><b>{item.etiqueta}</b><span>{item.conclusion}</span><em>Ver agente →</em></button>)}</section><footer>B18 reúne las cuatro lecturas; cada alerta abre el agente que la explica.</footer></section></div> : null}
    </div>
  </section>;
}
