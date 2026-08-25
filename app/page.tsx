"use client";

import { useMemo, useState } from "react";

const cartera = [
  ["Distribuidora Central", 248500, 12, "Al día"],
  ["Grupo Horizonte", 193200, 47, "Vencida"],
  ["Comercial Norte", 132800, 96, "Crítica"],
  ["Almacenes Nova", 88600, 28, "Al día"],
  ["Servicios Atlas", 72100, 63, "Vencida"],
] as const;
const fmt = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 });

export default function Home() {
  const [q, setQ] = useState("");
  const [vista, setVista] = useState("Resumen");
  const rows = useMemo(() => cartera.filter(([nombre]) => nombre.toLowerCase().includes(q.toLowerCase())), [q]);
  const total = cartera.reduce((n, [, saldo]) => n + saldo, 0);
  const vencido = cartera.filter(([, , dias]) => dias > 30).reduce((n, [, saldo]) => n + saldo, 0);
  return <main className="min-h-screen bg-[#f4f5f7] text-[#17191d]">
    <header className="border-b border-black/5 bg-white px-5 py-4"><div className="mx-auto flex max-w-7xl items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Finanzas · control operativo</p><h1 className="text-xl font-bold">Dashboard CxC</h1></div><button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Exportar</button></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 p-5 md:grid-cols-[180px_1fr] md:p-9">
      <nav className="flex gap-2 overflow-auto rounded-2xl bg-white p-2 md:block md:h-fit">{["Resumen", "Aging", "Seguimiento", "Prioritarios", "Datos"].map(x => <button key={x} onClick={() => setVista(x)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium md:mb-1 md:block md:w-full ${vista === x ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{x}</button>)}</nav>
      <section className="space-y-6"><div><p className="text-sm text-slate-500">Corte: 25 de agosto de 2026</p><h2 className="text-3xl font-bold">{vista === "Resumen" ? "Resumen de cartera" : vista}</h2></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Cartera pendiente" value={fmt.format(total)} note="5 clientes activos"/><Metric title="Cartera vencida" value={fmt.format(vencido)} note="61% de la cartera" tone="amber"/><Metric title="Riesgo 90+" value={fmt.format(132800)} note="gestión prioritaria" tone="rose"/><Metric title="DSO estimado" value="42 días" note="meta: 35 días" tone="blue"/></div>
        <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><article className="rounded-3xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Cartera por cliente</h3><p className="text-xs text-slate-500">Prioriza y da seguimiento a saldos pendientes.</p></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar cliente" className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/></div><table className="mt-5 w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Cliente</th><th>Saldo</th><th>Días</th><th>Estado</th></tr></thead><tbody>{rows.map(([nombre,saldo,dias,estado])=><tr key={nombre} className="border-b border-slate-100"><td className="py-4 font-semibold">{nombre}</td><td>{fmt.format(saldo)}</td><td>{dias}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${estado === "Crítica" ? "bg-rose-100 text-rose-700" : estado === "Vencida" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{estado}</span></td></tr>)}</tbody></table></article><article className="rounded-3xl bg-slate-900 p-6 text-white"><h3 className="font-bold">Distribución por antigüedad</h3><p className="mt-1 text-xs text-white/55">Cartera clasificada por vencimiento.</p><div className="mt-8 space-y-5"><Bar label="Al día" n={47}/><Bar label="31–60 días" n={28}/><Bar label="61–90 días" n={14}/><Bar label="90+ días" n={11}/></div></article></div>
      </section>
    </div>
  </main>;
}
function Metric({title,value,note,tone="plain"}:{title:string;value:string;note:string;tone?:string}) { return <article className={`rounded-3xl p-5 shadow-sm ${tone === "amber" ? "bg-amber-50" : tone === "rose" ? "bg-rose-50" : tone === "blue" ? "bg-blue-50" : "bg-white"}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></article>; }
function Bar({label,n}:{label:string;n:number}) { return <div><div className="mb-2 flex justify-between text-xs"><span>{label}</span><span className="text-white/60">{n}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{width:`${n}%`}}/></div></div>; }
