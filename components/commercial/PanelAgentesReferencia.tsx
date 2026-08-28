"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AgenteLateral } from "./PanelAgentesLateral";

const POSICIONES_CENTRALES = [
  "left-[calc(50%-128px)] top-28",
  "right-[calc(50%-128px)] top-28",
  "bottom-28 left-[calc(50%-128px)]",
  "bottom-28 right-[calc(50%-128px)]",
];

const POSICIONES_ESQUINAS = [
  "fixed left-7 top-24 md:left-12 md:top-24",
  "fixed right-7 top-24 md:right-12 md:top-24",
  "fixed bottom-8 left-7 md:bottom-10 md:left-12",
  "fixed bottom-8 right-7 md:bottom-10 md:right-12",
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
  const indiceActivo = Math.max(agentes.findIndex((item) => item.id === activo), 0);
  useEffect(() => setDetalleAbierto(false), [activo]);
  const seleccionarAgente = (id: T) => { setDetalleAbierto(false); onSeleccionar(id); };

  return (
    <section className="bg-white py-2 md:py-3">
      <div className="relative mx-auto min-h-[550px] max-w-5xl overflow-visible rounded-[30px] border border-[#edf1fb] bg-white shadow-[0_28px_70px_rgba(71,105,175,.12)]">
        <div className="absolute inset-x-0 bottom-0 h-36 rounded-b-[30px] bg-[radial-gradient(ellipse_at_50%_100%,rgba(204,220,255,.6),transparent_72%)]" />
        <div className="relative grid min-h-[550px] grid-cols-[112px_minmax(0,1fr)] md:grid-cols-[158px_minmax(0,1fr)]">
          <aside className={`z-20 border-r border-[#eef2fa] bg-[linear-gradient(180deg,#fbfcff_0%,#f6f8ff_100%)] px-3 pt-28 transition duration-500 md:px-4 ${detalleAbierto ? "pointer-events-none opacity-25 blur-[3px]" : ""}`}>
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

          <main className="relative min-h-[550px] overflow-hidden px-5 py-8 md:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(231,240,255,.9),transparent_34%)]" />
            {detalleAbierto && <button type="button" onClick={() => setDetalleAbierto(false)} aria-label="Cerrar detalle del agente" className="fixed inset-0 z-40 cursor-default bg-white/35 backdrop-blur-[7px]" />}
            {detalleAbierto && <div className="fixed bottom-8 left-28 right-8 top-24 z-50 overflow-y-auto rounded-[30px] border border-[#eef2fb] bg-white/96 p-6 shadow-[0_28px_70px_rgba(50,80,140,.2)] animate-[entradaSuave_.32s_ease-out] md:bottom-12 md:left-40 md:right-12 md:top-28 md:p-9">{children}</div>}

            {alrededor.map((item, indice) => {
              const posicion = detalleAbierto ? POSICIONES_ESQUINAS[indice] : POSICIONES_CENTRALES[indice];
              return <button key={item.id} type="button" onClick={() => seleccionarAgente(item.id)} className={`producto-nodo-esquina producto-nodo-${indice + 1} ${detalleAbierto ? "z-50" : "absolute z-20"} grid h-14 w-14 place-items-center rounded-2xl border border-[#edf2fe] bg-white text-[10px] font-black text-[#76a0f4] shadow-[0_12px_28px_rgba(90,126,195,.15)] transition-all duration-500 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[#e1ebff] ${posicion}`}>{item.iniciales}<span className="absolute -bottom-9 w-32 text-center text-[8px] font-bold leading-tight text-[#8d9bb5]"><span className="block truncate">{item.nombre}</span><span className="block truncate text-[#6c91dc]">{item.senal}</span></span></button>;
            })}

            {!detalleAbierto && <><button key={agente?.id} type="button" onClick={() => setDetalleAbierto(true)} aria-expanded={detalleAbierto} className="producto-nucleo-activo absolute left-1/2 top-1/2 z-30 grid h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[25px] bg-[linear-gradient(135deg,#3d74ec,#7dc3ff)] text-lg font-black text-white shadow-[0_22px_45px_rgba(64,119,239,.35)] ring-8 ring-[#edf4ff] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#cbdcff]">{agente?.iniciales}</button>
            <div className="absolute left-1/2 top-[calc(50%+56px)] z-30 w-60 -translate-x-1/2 text-center"><p className="text-[11px] font-black text-[#6079ad]">{agente?.senal}</p><div className="mt-2 flex justify-center gap-2 text-[8px] font-black"><span className="rounded-full bg-white px-2 py-1 text-[#567cbe] shadow-[0_8px_18px_rgba(71,103,171,.12)]">{agente?.capacidad}</span><span className="rounded-full bg-[#e6efff] px-2 py-1 text-[#567cbe]">alerta activa</span></div></div></>}
          </main>
        </div>

        {!detalleAbierto && <div style={{ top: `${22 + indiceActivo * 56}px` }} className="absolute -left-3 z-40 w-[226px] rounded-2xl border border-white bg-white/95 p-3 shadow-[0_16px_34px_rgba(71,103,171,.18)] transition-[top] duration-500 md:-left-10">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[.12em] text-[#71809b]"><span>Agent status</span><span className="text-[#779ff3]">● Live</span></div>
          <div className="mt-2 rounded-lg bg-[#dfe9ff] px-2.5 py-2 text-[#4263a2]">
            <div className="flex items-center justify-between text-[10px] font-black"><span className="truncate">{agente?.nombre}</span><span>Alerta</span></div>
            <p className="mt-1 text-[9px] font-bold leading-tight text-[#5675b3]">{agente?.senal}</p>
          </div>
        </div>}
      </div>
    </section>
  );
}
