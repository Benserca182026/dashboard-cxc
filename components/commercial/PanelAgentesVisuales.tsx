"use client";

import { useMemo, useState } from "react";
import type { Agente, Hallazgo } from "@/components/Agentes";
import type { Dataset } from "@/lib/types";

const nombreCorto: Record<string, string> = {
  "oportunidad-ventas": "Concentración de venta",
  "cambio-ventas": "Tendencia homologada",
  "accion-ventas": "Palanca comercial",
  "control-ventas": "Cobertura de margen",
  "oportunidad-inventario": "ABC de salidas",
  "riesgo-inventario": "Confianza de inventario",
  "accion-inventario": "Rotación lenta",
  "control-inventario": "Trazabilidad",
  "horizonte-forecast": "Universo elegible",
  "brecha-forecast": "Brecha de caja",
  "disputa-forecast": "Disputas",
  "meseta-forecast": "Concentración temporal",
};

function VisualHallazgo({ hallazgo, fmt }: { hallazgo: Hallazgo; fmt: (n: number) => string }) {
  if (hallazgo.estado === "sin-dato") {
    return <div className="grid h-24 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center"><span className="text-2xl text-slate-400">?</span><span className="px-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">dato faltante</span></div>;
  }
  if (hallazgo.estado === "hallazgo" && hallazgo.ranking && hallazgo.ranking.filas.length) {
    const filas = hallazgo.ranking.filas.slice(0, 4);
    return <div className="space-y-2">{filas.map((fila) => <div key={fila.id} className="group/bar"><div className="flex justify-between gap-2 text-[9px]"><span className="truncate font-semibold text-tinta">{fila.etiqueta}</span><span className="tabular-nums text-tintaSuave">{fila.pct.toFixed(1)}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-gradient-to-r from-[#536b91] to-[#8b7cf6]" style={{ width: `${Math.max(2, Math.min(100, fila.pct))}%` }} /></div></div>)}</div>;
  }
  const numericas = hallazgo.evidencia.entradas.filter((e) => typeof e.valor === "number").slice(0, 3);
  const porcentajes = numericas.filter((e) => e.unidad === "%");
  if (porcentajes.length) {
    const p = Math.max(0, Math.min(100, Number(porcentajes[0].valor)));
    return <div className="flex h-24 items-center gap-4 rounded-2xl bg-slate-50 px-4"><svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90"><circle cx="22" cy="22" r="17" fill="none" stroke="#e2e8f0" strokeWidth="5"/><circle cx="22" cy="22" r="17" fill="none" stroke="#536b91" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${p * 1.068} 107`}/></svg><div><p className="text-xl font-extrabold tabular-nums text-tinta">{p.toFixed(1)}%</p><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">{porcentajes[0].nombre}</p></div></div>;
  }
  const principal = numericas[0];
  return <div className="flex h-24 items-end gap-2 rounded-2xl bg-slate-50 px-4 py-3">{numericas.map((entrada, i) => <div key={entrada.nombre} className="flex flex-1 flex-col justify-end gap-1"><div className="rounded-t-lg bg-[#536b91]" style={{ height: `${75 - i * 18}%`, opacity: 1 - i * .2 }} /><span className="truncate text-[8px] font-bold uppercase tracking-wider text-tintaSuave">{entrada.nombre}</span></div>)}{principal && <span className="sr-only">{fmt(Number(principal.valor))}</span>}</div>;
}

export function PanelAgentesVisuales({ dataset, fechaCorte, agentes, fmt }: { dataset: Dataset; fechaCorte: string; agentes: Agente[]; fmt: (n: number) => string }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const vistos = useMemo(() => agentes.map((agente) => ({ agente, hallazgo: agente.mirar(dataset, fechaCorte) })), [agentes, dataset, fechaCorte]);
  return <section className="rounded-[28px] border border-white/90 bg-[linear-gradient(135deg,#f8fbff,#eef2fb)] p-5 shadow-flotante">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#536b91]">Agentes deterministas</p><h2 className="mt-1 text-base font-bold text-tinta">Señales visuales y no reseñas</h2></div><span className="rounded-full bg-white px-3 py-1 text-[9px] font-bold text-tintaSuave">{agentes.length} reglas</span></div>
    <div className={`mt-4 grid gap-3 ${agentes.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"}`}>{vistos.map(({ agente, hallazgo }) => <details key={agente.id} open={abierto === agente.id} onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open ? agente.id : null)} className="group rounded-[20px] border border-white bg-white/85 p-3 shadow-flotante"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-[#16181d] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-white">{nombreCorto[agente.id] ?? agente.nombre}</span><span className={hallazgo.estado === "sin-dato" ? "text-slate-400" : hallazgo.estado === "hallazgo" ? "text-[#c2703a]" : "text-emerald-600"}>{hallazgo.estado === "sin-dato" ? "?" : "●"}</span></div><div className="mt-3"><VisualHallazgo hallazgo={hallazgo} fmt={fmt} /></div><p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#536b91] group-open:hidden">tocar evidencia ↘</p></summary><div className="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-tintaSuave">{hallazgo.estado === "sin-dato" ? <><b className="text-tinta">Falta:</b> {hallazgo.queFalta}<br/><b className="text-tinta">Bloquea:</b> {hallazgo.consecuencia}</> : <><p>{hallazgo.texto}</p><p className="mt-2 rounded-xl bg-slate-50 px-2 py-1.5"><b className="text-tinta">Fórmula:</b> {hallazgo.evidencia.expresion}</p></>}</div></details>)}</div>
  </section>;
}
