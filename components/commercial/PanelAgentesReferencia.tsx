"use client";

import type { ReactNode } from "react";
import type { AgenteLateral } from "./PanelAgentesLateral";

export function PanelAgentesReferencia<T extends string>({
  agentes,
  activo,
  onSeleccionar,
  children,
  handoff,
}: {
  agentes: AgenteLateral<T>[];
  activo: T;
  onSeleccionar: (id: T) => void;
  children: ReactNode;
  handoff: ReactNode;
}) {
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];

  return (
    <section className="bg-white py-6 md:py-10">
      <div className="relative mx-auto min-h-[490px] max-w-5xl overflow-visible rounded-[30px] border border-[#edf1fb] bg-white shadow-[0_28px_70px_rgba(71,105,175,.12)]">
        <div className="absolute inset-x-0 bottom-0 h-32 rounded-b-[30px] bg-[radial-gradient(ellipse_at_50%_100%,rgba(203,218,255,.66),transparent_70%)]" />
        <div className="relative grid min-h-[490px] grid-cols-[126px_minmax(0,1fr)] md:grid-cols-[170px_minmax(0,1fr)]">
          <aside className="border-r border-[#f0f3fb] bg-[linear-gradient(180deg,#fbfcff_0%,#f6f8ff_100%)] px-3 pt-28 md:px-5">
            <div className="space-y-4">
              {agentes.map((item) => {
                const seleccionado = item.id === activo;
                return <button key={item.id} type="button" onClick={() => onSeleccionar(item.id)} aria-pressed={seleccionado} className={`flex w-full items-center gap-2 rounded-xl p-1.5 text-left transition ${seleccionado ? "bg-[#eaf1ff] shadow-[0_7px_16px_rgba(77,120,204,.12)]" : "opacity-65 hover:bg-white hover:opacity-100"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[8px] font-black ${seleccionado ? "bg-[#dce8ff] text-[#4c80ee]" : "bg-[#f0f4ff] text-[#a1b7ed]"}`}>{item.iniciales}</span>
                  <span className={`hidden truncate text-[9px] font-bold md:block ${seleccionado ? "text-[#5275bc]" : "text-[#b6c2da]"}`}>{item.nombre}</span>
                </button>;
              })}
            </div>
          </aside>

          <main className="relative grid min-h-[490px] place-items-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(231,239,255,.82),transparent_27%)]" />
            <div key={agente?.id} className="relative grid w-full max-w-md place-items-center text-center">
              <span className="producto-nodo-flotante producto-nodo-a absolute left-[12%] top-[15%] grid h-12 w-12 place-items-center rounded-xl border border-[#edf2fe] bg-white text-lg text-[#86acf8] shadow-[0_10px_24px_rgba(90,126,195,.12)]">▣</span>
              <span className="producto-nodo-flotante producto-nodo-b absolute right-[12%] top-[15%] grid h-12 w-12 place-items-center rounded-xl border border-[#edf2fe] bg-white text-lg text-[#86acf8] shadow-[0_10px_24px_rgba(90,126,195,.12)]">⌁</span>
              <span className="producto-nodo-flotante producto-nodo-c absolute bottom-[2%] left-[24%] grid h-12 w-12 place-items-center rounded-xl border border-[#edf2fe] bg-white text-lg text-[#86acf8] shadow-[0_10px_24px_rgba(90,126,195,.12)]">↗</span>
              <span className="producto-nodo-flotante producto-nodo-d absolute bottom-[2%] right-[24%] grid h-12 w-12 place-items-center rounded-xl border border-[#edf2fe] bg-white text-lg text-[#86acf8] shadow-[0_10px_24px_rgba(90,126,195,.12)]">◌</span>
              <div className="producto-nucleo-activo grid h-[90px] w-[90px] place-items-center rounded-[25px] bg-[linear-gradient(135deg,#3d74ec,#7dc3ff)] text-lg font-black text-white shadow-[0_22px_45px_rgba(64,119,239,.35)] ring-8 ring-[#edf4ff]">{agente?.iniciales}</div>
              <p className="mt-5 max-w-[220px] text-[11px] font-bold leading-relaxed text-[#7283a3]">{agente?.senal}</p>
            </div>
          </main>
        </div>

        <div className="absolute -left-3 top-8 z-20 w-[226px] rounded-2xl border border-white bg-white/95 p-3 shadow-[0_16px_34px_rgba(71,103,171,.18)] md:-left-10 md:top-10">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[.12em] text-[#71809b]"><span>Agent status</span><span className="text-[#779ff3]">● Live</span></div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#dfe9ff] px-2.5 py-2 text-[10px] font-bold text-[#4263a2]"><span className="truncate">{agente?.nombre}</span><span>activo</span></div>
        </div>

        <div className="absolute -bottom-8 right-4 z-20 w-[min(290px,calc(100%-2rem))] rounded-2xl border border-white bg-white/95 p-4 shadow-[0_18px_42px_rgba(71,103,171,.18)] md:right-9">
          <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e6efff] text-[#6d9bf1]">⌁</span><div><p className="text-[9px] font-black uppercase tracking-[.12em] text-[#8192b1]">Handoff</p><p className="mt-1 text-[12px] font-black text-[#263857]">{agente?.nombre}</p><div className="mt-2 text-[10px] leading-relaxed text-[#71809b]">{handoff}</div></div></div>
          <p className="mt-3 text-[10px] font-black text-[#5f8ef1]">Gráfica actualizada ↓</p>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-5xl rounded-[26px] border border-[#edf1fb] bg-white p-5 shadow-[0_18px_42px_rgba(71,105,175,.08)] md:p-7">{children}</div>
    </section>
  );
}
