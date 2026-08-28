"use client";

import type { ReactNode } from "react";

export interface AgenteLateral<T extends string> {
  id: T;
  iniciales: string;
  nombre: string;
  senal: string;
  color: string;
  suave: string;
}

export function PanelAgentesLateral<T extends string>({
  titulo,
  contexto,
  agentes,
  activo,
  onSeleccionar,
  children,
  lateral,
}: {
  titulo: string;
  contexto: string;
  agentes: AgenteLateral<T>[];
  activo: T;
  onSeleccionar: (id: T) => void;
  children: ReactNode;
  lateral: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-white/90 bg-[radial-gradient(circle_at_5%_0%,#dce8ff_0,transparent_31%),linear-gradient(135deg,#edf3ff_0%,#e0eafd_100%)] p-4 shadow-[0_22px_55px_rgba(46,72,130,.14)] md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-[#6780c9]">Espacio de agentes</p><h2 className="mt-1 text-xl font-black tracking-[-.03em] text-[#202b42]">{titulo}</h2></div><p className="text-[10px] font-semibold text-[#71809b]">{contexto}</p></div>
      <div className="grid overflow-hidden rounded-[26px] border border-white/80 bg-white/55 lg:grid-cols-[220px_minmax(0,1fr)_230px]">
        <aside className="border-b border-[#dce5f5] bg-white/55 p-4 lg:border-b-0 lg:border-r"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#71809a]">Agent status <span className="float-right text-[#4f7fe6]">● Live</span></p><div className="mt-4 space-y-2">{agentes.map((agente) => <button key={agente.id} type="button" onClick={() => onSeleccionar(agente.id)} className={`flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-left transition ${activo === agente.id ? "bg-white shadow-[0_8px_20px_rgba(50,76,130,.13)]" : "hover:bg-white/70"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-black" style={{ background: agente.suave, color: agente.color }}>{agente.iniciales}</span><span className="min-w-0"><span className="block truncate text-[11px] font-black text-[#34415a]">{agente.nombre}</span><span className="block truncate text-[10px] font-bold" style={{ color: agente.color }}>{agente.senal}</span></span></button>)}</div></aside>
        <main className="min-h-[450px] p-5 md:p-7">{children}</main>
        <aside className="border-t border-[#dce5f5] bg-white/60 p-4 lg:border-l lg:border-t-0">{lateral}</aside>
      </div>
    </section>
  );
}
