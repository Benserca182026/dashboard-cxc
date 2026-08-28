"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AgenteLateral } from "./PanelAgentesLateral";

const ESQUINAS = [
  "left-5 top-7 md:left-10 md:top-9",
  "right-5 top-7 md:right-10 md:top-9",
  "bottom-6 left-5 md:bottom-10 md:left-10",
  "bottom-6 right-5 md:bottom-10 md:right-10",
];

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
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];
  const alrededor = agentes.filter((item) => item.id !== agente?.id);
  useEffect(() => setDetalleAbierto(false), [activo]);
  const seleccionarAgente = (id: T) => { setDetalleAbierto(false); onSeleccionar(id); };

  return (
    <section className="bg-white py-6 md:py-10">
      <div className="relative mx-auto min-h-[760px] max-w-6xl overflow-visible rounded-[30px] border border-[#edf1fb] bg-white shadow-[0_28px_70px_rgba(71,105,175,.12)]">
        <div className="absolute inset-x-0 bottom-0 h-44 rounded-b-[30px] bg-[radial-gradient(ellipse_at_50%_100%,rgba(204,220,255,.6),transparent_72%)]" />
        <div className="relative grid min-h-[760px] grid-cols-[126px_minmax(0,1fr)] md:grid-cols-[182px_minmax(0,1fr)]">
          <aside className="z-20 border-r border-[#eef2fa] bg-[linear-gradient(180deg,#fbfcff_0%,#f6f8ff_100%)] px-3 pt-32 md:px-5">
            <p className="mb-4 hidden px-1 text-[9px] font-black uppercase tracking-[.15em] text-[#9babc8] md:block">Agentes</p>
            <div className="space-y-3">
              {agentes.map((item) => {
                const seleccionado = item.id === activo;
                return <button key={item.id} type="button" onClick={() => seleccionarAgente(item.id)} aria-pressed={seleccionado} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition-all duration-300 ${seleccionado ? "relative z-30 -translate-y-2 bg-white shadow-[0_15px_30px_rgba(70,106,180,.22)] ring-1 ring-[#e5edff]" : "opacity-60 hover:translate-x-1 hover:bg-white hover:opacity-100"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black ${seleccionado ? "bg-[#dce9ff] text-[#3f78ec]" : "bg-[#eef3ff] text-[#a5b9ec]"}`}>{item.iniciales}</span>
                  <span className={`hidden truncate text-[10px] font-black md:block ${seleccionado ? "text-[#416bb8]" : "text-[#aab8d1]"}`}>{item.nombre}</span>
                </button>;
              })}
            </div>
          </aside>

          <main className="relative min-h-[760px] overflow-hidden px-5 pb-16 pt-32 md:px-10 md:pt-36">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(231,240,255,.9),transparent_26%)]" />
            {detalleAbierto && <div className="absolute inset-x-5 bottom-8 top-40 z-10 overflow-y-auto rounded-[26px] border border-[#eef2fb] bg-white/95 p-5 shadow-[0_18px_44px_rgba(72,106,174,.12)] animate-[entradaSuave_.32s_ease-out] md:inset-x-10 md:bottom-12 md:top-44 md:p-8">{children}</div>}

            {alrededor.map((item, indice) => <button key={item.id} type="button" onClick={() => seleccionarAgente(item.id)} className={`producto-nodo-esquina producto-nodo-${indice + 1} absolute z-20 grid h-14 w-14 place-items-center rounded-2xl border border-[#edf2fe] bg-white text-[10px] font-black text-[#76a0f4] shadow-[0_12px_28px_rgba(90,126,195,.15)] transition hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[#e1ebff] ${ESQUINAS[indice]}`}>{item.iniciales}<span className="absolute -bottom-4 w-24 truncate text-center text-[8px] font-bold text-[#8d9bb5]">{item.nombre}</span></button>)}

            <button key={agente?.id} type="button" onClick={() => setDetalleAbierto(true)} aria-expanded={detalleAbierto} className="producto-nucleo-activo absolute left-1/2 top-8 z-30 grid h-[88px] w-[88px] -translate-x-1/2 place-items-center rounded-[25px] bg-[linear-gradient(135deg,#3d74ec,#7dc3ff)] text-lg font-black text-white shadow-[0_22px_45px_rgba(64,119,239,.35)] ring-8 ring-[#edf4ff] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#cbdcff]">{agente?.iniciales}</button>
            <p className="absolute left-1/2 top-[108px] z-30 w-52 -translate-x-1/2 text-center text-[11px] font-black text-[#6079ad]">{agente?.senal}</p>
          </main>
        </div>

        <div className="absolute -left-3 top-8 z-40 w-[226px] rounded-2xl border border-white bg-white/95 p-3 shadow-[0_16px_34px_rgba(71,103,171,.18)] md:-left-10 md:top-10">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[.12em] text-[#71809b]"><span>Agent status</span><span className="text-[#779ff3]">● Live</span></div>
          <div className="mt-2 rounded-lg bg-[#dfe9ff] px-2.5 py-2 text-[#4263a2]">
            <div className="flex items-center justify-between text-[10px] font-black"><span className="truncate">{agente?.nombre}</span><span>Alerta</span></div>
            <p className="mt-1 text-[9px] font-bold leading-tight text-[#5675b3]">{agente?.senal}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
