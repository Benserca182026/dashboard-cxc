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
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];

  return (
    <section className="rounded-[34px] border border-white/90 bg-[radial-gradient(circle_at_0%_0%,#fafdff_0,transparent_28%),radial-gradient(circle_at_100%_100%,#cfddff_0,transparent_52%),linear-gradient(135deg,#f3f7ff_0%,#dce8ff_100%)] p-4 shadow-[0_24px_64px_rgba(68,103,175,.16)] md:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#7292df]">Espacio de agentes</p>
          <h2 className="mt-1 text-[clamp(1.35rem,2.3vw,2rem)] font-black tracking-[-.055em] text-[#14203a]">{titulo}</h2>
        </div>
        <p className="rounded-full bg-white/65 px-3 py-1.5 text-[10px] font-bold text-[#7080a0] shadow-[0_8px_18px_rgba(70,95,150,.08)]">{contexto}</p>
      </div>

      <div className="relative overflow-hidden rounded-[30px] border border-white/90 bg-white/80 shadow-[0_20px_48px_rgba(70,96,158,.13)]">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_50%_0%,rgba(198,216,255,.72),transparent_70%)]" />
        <div className="relative grid min-h-[560px] lg:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="z-10 border-b border-[#edf2ff] bg-[linear-gradient(180deg,rgba(246,249,255,.96),rgba(236,243,255,.7))] p-4 pt-24 lg:border-b-0 lg:border-r lg:pt-28">
            <p className="px-2 text-[9px] font-black uppercase tracking-[.16em] text-[#8a9abd]">Agentes</p>
            <div className="mt-3 space-y-1.5">
              {agentes.map((item) => {
                const seleccionado = activo === item.id;
                return <button key={item.id} type="button" onClick={() => onSeleccionar(item.id)} aria-pressed={seleccionado} className={`group flex w-full items-center gap-2 rounded-xl p-2 text-left transition ${seleccionado ? "bg-white shadow-[0_8px_18px_rgba(64,95,166,.14)]" : "hover:bg-white/70"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black transition ${seleccionado ? "bg-[#dbe7ff] text-[#3974e7]" : "bg-[#edf3ff] text-[#8aa8ec] group-hover:bg-[#e4edff]"}`}>{item.iniciales}</span>
                  <span className="min-w-0"><span className={`block truncate text-[10px] font-extrabold ${seleccionado ? "text-[#263858]" : "text-[#7c8ca9]"}`}>{item.nombre}</span><span className="block truncate text-[9px] font-semibold text-[#9aa8c1]">{seleccionado ? "en foco" : item.senal}</span></span>
                </button>;
              })}
            </div>
          </aside>
          <main className="relative flex min-h-[560px] flex-col overflow-hidden px-5 pb-7 pt-28 md:px-10 lg:pt-32">
            <div className="absolute left-4 top-5 z-20 w-[min(285px,calc(100%-2rem))] rounded-2xl border border-white bg-white/95 p-3.5 shadow-[0_16px_34px_rgba(71,103,171,.18)] lg:-left-10 lg:top-7">
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[.13em] text-[#6e7f9e]"><span>Agent status</span><span className="text-[#6d99f5]">● Live</span></div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[#dfe9ff] px-2.5 py-2 text-[11px] font-black text-[#324d87]"><span className="truncate">{agente?.nombre}</span><span className="ml-3 text-[#4d80ed]">en foco</span></div>
            </div>
            <div className="relative mx-auto grid w-full max-w-lg place-items-center py-3 text-center">
              <span className="absolute left-[16%] top-[20%] grid h-11 w-11 place-items-center rounded-xl border border-[#e9efff] bg-white text-lg text-[#7da3f7] shadow-[0_9px_20px_rgba(79,116,181,.13)]">▣</span>
              <span className="absolute right-[16%] top-[13%] grid h-11 w-11 place-items-center rounded-xl border border-[#e9efff] bg-white text-xl text-[#7da3f7] shadow-[0_9px_20px_rgba(79,116,181,.13)]">⌁</span>
              <span className="absolute bottom-[1%] left-[24%] grid h-11 w-11 place-items-center rounded-xl border border-[#e9efff] bg-white text-xl text-[#7da3f7] shadow-[0_9px_20px_rgba(79,116,181,.13)]">↗</span>
              <span className="absolute bottom-[7%] right-[19%] grid h-11 w-11 place-items-center rounded-xl border border-[#e9efff] bg-white text-xl text-[#7da3f7] shadow-[0_9px_20px_rgba(79,116,181,.13)]">◌</span>
              <div className="grid h-[94px] w-[94px] place-items-center rounded-[26px] bg-[linear-gradient(135deg,#3c75ee,#80c5ff)] text-[17px] font-black text-white shadow-[0_18px_38px_rgba(72,129,240,.38)] ring-8 ring-[#edf3ff]">{agente?.iniciales}</div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-[#83a0dd]">Agente trabajando</p>
              <h3 className="mt-1 text-xl font-black tracking-[-.045em] text-[#1a2945]">{agente?.nombre}</h3>
              <p className="mt-1 max-w-sm text-sm font-medium leading-relaxed text-[#71809e]">{agente?.senal}</p>
            </div>
            <div className="relative z-10 mt-5 flex-1 rounded-[24px] border border-[#edf2ff] bg-white/88 p-4 shadow-[0_12px_30px_rgba(70,102,163,.09)] md:p-6">
              <div className="mb-4 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#6e9cf4]" /><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#8393b1]">Resultado de la consulta</p></div>
              {children}
            </div>
          </main>
        </div>
        <aside className="relative z-20 mx-4 mb-4 rounded-2xl border border-white bg-white/95 p-4 shadow-[0_16px_34px_rgba(71,103,171,.16)] lg:absolute lg:bottom-5 lg:right-5 lg:mb-0 lg:w-64">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e4eeff] text-[#5d8bf0]">⌁</span><div><p className="text-[9px] font-black uppercase tracking-[.13em] text-[#8293b2]">Handoff</p><p className="text-[11px] font-black text-[#2a3b59]">Resultado del agente</p></div></div>
          <div className="mt-3 text-[11px] leading-relaxed text-[#667695]">{lateral}</div>
        </aside>
      </div>
    </section>
  );
}
