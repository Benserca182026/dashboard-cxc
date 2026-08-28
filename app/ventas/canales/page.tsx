"use client";

import { useEffect, useMemo, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelAgentesLateral, type AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import { acumuladosVentasPorCliente } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";

type Canal = "retail" | "ecommerce" | "tradicional" | "tienda_grande";
type AgenteCanal = "cobertura" | "historia" | "mezcla" | "clasificar";
type Asignaciones = Record<string, Canal>;

const CLAVE_LOCAL = "edge-canales-por-cliente-v1";
const SECCIONES = [{ id: "sec-canales", etiqueta: "Espacio de agentes" }];
const CANALES: { id: Canal; nombre: string; color: string; suave: string }[] = [
  { id: "retail", nombre: "Retail", color: "#596bd0", suave: "#edf0ff" },
  { id: "ecommerce", nombre: "E-commerce", color: "#a45ccf", suave: "#f7edff" },
  { id: "tradicional", nombre: "Canal tradicional", color: "#2f9d78", suave: "#e8f8f1" },
  { id: "tienda_grande", nombre: "Tienda grande", color: "#e47743", suave: "#fff0e9" },
];

function GraficoHistorico({ puntos }: { puntos: { periodo: string; valor: number }[] }) {
  if (!puntos.length) return <div className="grid h-56 place-items-center rounded-2xl bg-[#f5f8fe] text-center text-sm font-semibold text-[#75819a]">Clasifica clientes para activar el histórico por canal.</div>;
  const maximo = Math.max(1, ...puntos.map((p) => p.valor));
  const coordenadas = puntos.map((p, i) => ({ x: 24 + (i / Math.max(1, puntos.length - 1)) * 372, y: 28 + (1 - p.valor / maximo) * 128 }));
  const path = coordenadas.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  return <svg viewBox="0 0 420 190" className="h-64 w-full" role="img" aria-label="Evolución del mix clasificado por canal">{[46, 88, 130, 172].map((y) => <line key={y} x1="22" x2="400" y1={y} y2={y} stroke="#dce5f4" strokeDasharray="3 6" />)}<path d={`${path} L${coordenadas.at(-1)?.x ?? 396},172 L24,172 Z`} fill="#5d83ea" opacity=".13" /><path d={path} fill="none" stroke="#5d83ea" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{coordenadas.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="white" stroke="#5d83ea" strokeWidth="3" />)}</svg>;
}

export default function PaginaCanalesVentas() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const [asignaciones, setAsignaciones] = useState<Asignaciones>({});
  const [listo, setListo] = useState(false);
  const [activo, setActivo] = useState<AgenteCanal>("cobertura");
  useEffect(() => { try { const guardado = window.localStorage.getItem(CLAVE_LOCAL); if (guardado) setAsignaciones(JSON.parse(guardado) as Asignaciones); } finally { setListo(true); } }, []);
  const clientes = useMemo(() => acumuladosVentasPorCliente(dataset), [dataset]);
  const total = clientes.reduce((s, x) => s + x.valor, 0);
  const porCanal = useMemo(() => CANALES.map((canal) => { const filas = clientes.filter((x) => asignaciones[x.id] === canal.id); return { ...canal, filas, valor: filas.reduce((s, x) => s + x.valor, 0), pedidos: filas.reduce((s, x) => s + x.pedidos, 0) }; }), [clientes, asignaciones]);
  const sinClasificar = clientes.filter((x) => !asignaciones[x.id]);
  const sinClasificarValor = sinClasificar.reduce((s, x) => s + x.valor, 0);
  const cobertura = total ? ((total - sinClasificarValor) / total) * 100 : 0;
  const principal = [...porCanal].sort((a, b) => b.valor - a.valor)[0];
  const historial = useMemo(() => { const meses = new Map<string, number>(); for (const cliente of clientes) { if (!asignaciones[cliente.id] || !cliente.hasta) continue; const periodo = cliente.hasta.slice(0, 7); meses.set(periodo, (meses.get(periodo) ?? 0) + cliente.valor); } return [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([periodo, valor]) => ({ periodo, valor })); }, [clientes, asignaciones]);
  const cambiarCanal = (clienteId: string, canal: string) => { const siguiente = { ...asignaciones }; if (canal) siguiente[clienteId] = canal as Canal; else delete siguiente[clienteId]; setAsignaciones(siguiente); try { window.localStorage.setItem(CLAVE_LOCAL, JSON.stringify(siguiente)); } catch {} };
  if (cargando || !listo) return <SkeletonPagina />;
  const agentes: AgenteLateral<AgenteCanal>[] = [
    { id: "cobertura", iniciales: "CV", nombre: "Cobertura visible", senal: `${cobertura.toFixed(1)}% leído`, color: "#2f9d78", suave: "#e8f8f1" },
    { id: "historia", iniciales: "HC", nombre: "Histórico canal", senal: `${historial.length} períodos`, color: "#596bd0", suave: "#edf0ff" },
    { id: "mezcla", iniciales: "MX", nombre: "Mezcla de canales", senal: principal?.valor ? principal.nombre : "sin base", color: "#a45ccf", suave: "#f7edff" },
    { id: "clasificar", iniciales: "CC", nombre: "Codificador comercial", senal: `${sinClasificar.length} pendientes`, color: "#e47743", suave: "#fff0e9" },
  ];
  const lateral = <p>{activo === "clasificar" ? "Clasifica el cliente en la cola. La elección queda local hasta que Odoo entregue el canal." : "El agente cambia la lectura central sin duplicar los datos ni tapar el análisis."}</p>;
  const centro = activo === "cobertura" ? <div className="grid h-full place-items-center"><div className="w-full max-w-md text-center"><div className="mx-auto grid h-44 w-44 place-items-center rounded-full border-[18px] border-[#e1f4ea]" style={{ borderTopColor: "#2f9d78", transform: "rotate(45deg)" }}><div style={{ transform: "rotate(-45deg)" }}><p className="text-4xl font-black tracking-[-.06em] text-[#263149]">{cobertura.toFixed(1)}%</p><p className="text-[10px] font-black uppercase tracking-[.13em] text-[#72809b]">cubierto</p></div></div><p className="mt-7 text-lg font-black text-[#29354d]">Venta histórica con canal declarado</p><p className="mt-2 text-sm text-[#6f7b92]">{sinClasificar.length} clientes todavía concentran {fmt(sinClasificarValor)} sin una categoría de canal.</p></div></div> : activo === "historia" ? <><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#596bd0]">Tendencia disponible</p><h3 className="mt-1 text-2xl font-black text-[#263149]">Acumulado clasificado</h3><GraficoHistorico puntos={historial} /></> : activo === "mezcla" ? <><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#a45ccf]">Lectura actual</p><h3 className="mt-1 text-2xl font-black text-[#263149]">Participación por canal</h3><div className="mt-8 space-y-5">{porCanal.map((canal) => <div key={canal.id}><div className="mb-2 flex justify-between gap-3 text-sm font-black text-[#536078]"><span>{canal.nombre}</span><span>{total ? ((canal.valor / total) * 100).toFixed(1) : "0.0"}%</span></div><div className="h-4 overflow-hidden rounded-full bg-[#e7ebf4]"><div className="h-full rounded-full transition-all" style={{ width: `${total ? (canal.valor / total) * 100 : 0}%`, background: canal.color }} /></div></div>)}</div></> : <><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#e47743]">Acción requerida</p><h3 className="mt-1 text-2xl font-black text-[#263149]">Clasificar clientes</h3><div className="mt-5 space-y-2">{sinClasificar.slice(0, 5).map((cliente) => <div key={cliente.id} className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-3 rounded-2xl bg-[#f8f9fd] p-3"><div className="min-w-0"><p className="truncate text-[11px] font-black text-[#36415a]">{cliente.etiqueta}</p><p className="text-[10px] font-semibold text-[#738099]">{fmt(cliente.valor)} · {cliente.pedidos} pedidos</p></div><select aria-label={`Asignar canal a ${cliente.etiqueta}`} value="" onChange={(e) => cambiarCanal(cliente.id, e.target.value)} className="rounded-xl border border-[#e8d7cd] bg-white px-2 py-2 text-[10px] font-bold text-[#876650]"><option value="">Asignar canal</option>{CANALES.map((canal) => <option key={canal.id} value={canal.id}>{canal.nombre}</option>)}</select></div>)}{!sinClasificar.length && <p className="rounded-2xl bg-[#e8f8f1] p-4 text-sm font-bold text-[#2f9d78]">Toda la venta disponible ya está clasificada.</p>}</div></>;
  return <div className="space-y-5"><Encabezado titulo="Canales de venta" secciones={SECCIONES} dataset={dataset} modulo="ventas" /><div id="sec-canales" className="scroll-mt-24"><PanelAgentesLateral titulo="Acumulado histórico por tipo de cliente" contexto={`${fmt(total)} · corte ${fechaCorte}`} agentes={agentes} activo={activo} onSeleccionar={setActivo} lateral={lateral}>{centro}</PanelAgentesLateral></div></div>;
}
