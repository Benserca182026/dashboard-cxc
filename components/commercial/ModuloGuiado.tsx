"use client";

import type { ReactNode } from "react";

export function ModuloGuiado({
  orden,
  agente,
  iniciales,
  senal,
  color,
  suave,
  activo,
  atenuado = false,
  onActivar,
  children,
}: {
  orden: string;
  agente: string;
  iniciales: string;
  senal: string;
  color: string;
  suave: string;
  activo: boolean;
  atenuado?: boolean;
  onActivar: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`guided-module relative overflow-hidden rounded-[30px] border border-white/90 bg-white/82 p-5 shadow-[0_14px_34px_rgba(44,63,108,.10)] transition duration-300 md:p-6 ${atenuado ? "blur-[3px] opacity-30" : ""} ${activo ? "ring-2 shadow-[0_18px_42px_rgba(70,88,161,.2)]" : ""}`} style={activo ? { outlineColor: color } : undefined}>
      <button type="button" onClick={onActivar} className="mb-5 flex w-full items-center gap-3 text-left transition hover:opacity-80 focus:outline-none">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 text-[12px] font-black shadow-[0_8px_18px_rgba(42,55,94,.14)]" style={{ borderColor: `${color}33`, background: suave, color }}>{iniciales}</span>
        <span className="min-w-0 flex-1"><span className="block text-[9px] font-black uppercase tracking-[.15em]" style={{ color }}>Módulo {orden} · agente</span><span className="block truncate text-sm font-black text-[#263149]">{agente}</span><span className="block truncate text-[10px] font-bold" style={{ color }}>{senal}</span></span>
        <span className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[.1em]" style={{ color, background: suave }}>{activo ? "en foco" : "ver"}</span>
      </button>
      {children}
    </section>
  );
}
