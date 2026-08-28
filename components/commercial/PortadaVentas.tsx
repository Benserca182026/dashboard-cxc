"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ejecutarAgentesPortada, type AgenteComercial, type ContextoCarteraPortada, type ZonaAgente } from "@/lib/agents-portada";
import type { AnaliticaVentas, FilaComercial, PuntoTendencia } from "@/lib/commercial-operacion";

const ESTILO_ESTADO = {
  critico: { anillo: "ring-[#ff725f]", punto: "bg-[#ff725f]", texto: "text-[#c34c3a]", fondo: "bg-[#fff0ed]" },
  atencion: { anillo: "ring-[#f3bd4f]", punto: "bg-[#f3bd4f]", texto: "text-[#9a6200]", fondo: "bg-[#fff7df]" },
  observando: { anillo: "ring-[#7286c4]", punto: "bg-[#7286c4]", texto: "text-[#4b5f9b]", fondo: "bg-[#eef1ff]" },
  estable: { anillo: "ring-[#54bb8c]", punto: "bg-[#54bb8c]", texto: "text-[#287657]", fondo: "bg-[#eaf8f1]" },
} as const;

const ZONAS: Record<ZonaAgente, { etiqueta: string; clase: string }> = {
  ventas: { etiqueta: "Ventas", clase: "agent-zone-ventas" },
  clientes: { etiqueta: "Clientes", clase: "agent-zone-clientes" },
  productos: { etiqueta: "Productos", clase: "agent-zone-productos" },
  cartera: { etiqueta: "Cartera", clase: "agent-zone-cartera" },
  centro: { etiqueta: "Coordinación", clase: "agent-zone-centro" },
};

function GraficoLinea({ puntos, fmt, activo, onActivar }: { puntos: PuntoTendencia[]; fmt: (n: number) => string; activo: boolean; onActivar: () => void }) {
  const serie = puntos.slice(-12);
  const maximo = Math.max(1, ...serie.map((p) => p.valor));
  const minimo = Math.min(...serie.map((p) => p.valor));
  const rango = Math.max(1, maximo - minimo);
  const coords = serie.map((p, indice) => ({ x: 18 + (indice / Math.max(1, serie.length - 1)) * 244, y: 22 + ((maximo - p.valor) / rango) * 96, ...p }));
  const path = coords.map((p, indice) => `${indice ? "L" : "M"}${p.x},${p.y}`).join(" ");
  return <button type="button" onMouseEnter={onActivar} onFocus={onActivar} onClick={onActivar} className={`module-card group w-full text-left ${activo ? "module-card-active" : ""}`}>
    <span className="module-kicker">Ventas</span><span className="module-title">Ritmo mensual</span>
    <svg viewBox="0 0 280 142" className="mt-2 h-28 w-full" role="img" aria-label="Ritmo mensual de ventas">
      {[45, 82, 119].map((y) => <line key={y} x1="18" x2="262" y1={y} y2={y} stroke="#d9dfeb" strokeDasharray="3 5" />)}
      <path d={`${path} L${coords.at(-1)?.x ?? 262},126 L18,126 Z`} fill="#7c8be4" opacity=".14" />
      <path d={path} fill="none" stroke="#5668cc" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((p, index) => <circle key={p.periodo} cx={p.x} cy={p.y} r={index === coords.length - 1 ? 5 : 3.5} fill={index === coords.length - 1 ? "#e47743" : "#5668cc"} stroke="white" strokeWidth="2" />)}
    </svg>
    <span className="module-hover">{serie.at(-1) ? `${serie.at(-1)!.periodo} · ${fmt(serie.at(-1)!.valor)}` : "Sin serie"}</span>
  </button>;
}

function GraficoBarras({ titulo, zona, filas, fmt, activo, onActivar }: { titulo: string; zona: string; filas: FilaComercial[]; fmt: (n: number) => string; activo: boolean; onActivar: () => void }) {
  const top = filas.slice(0, 4); const maximo = Math.max(1, ...top.map((x) => x.valor));
  return <button type="button" onMouseEnter={onActivar} onFocus={onActivar} onClick={onActivar} className={`module-card group w-full text-left ${activo ? "module-card-active" : ""}`}>
    <span className="module-kicker">{zona}</span><span className="module-title">{titulo}</span>
    <div className="mt-3 space-y-2.5">{top.map((fila, indice) => <div key={fila.id}><div className="flex justify-between gap-2"><span className="truncate text-[9px] font-semibold text-[#566175]">{fila.etiqueta}</span><span className="text-[9px] font-bold text-[#31394b]">{fila.pct.toFixed(1)}%</span></div><span className="mt-1 block h-2 rounded-full bg-[#e8ecf3]"><i className={`block h-full rounded-full ${indice === 0 ? "bg-[#e47743]" : "bg-[#7487c4]"}`} style={{ width: `${Math.max(5, fila.valor / maximo * 100)}%` }} /></span></div>)}</div>
    <span className="module-hover">pasar por encima para llamar a los agentes</span>
  </button>;
}

function ModuloCartera({ contexto, fmt, activo, onActivar }: { contexto: ContextoCarteraPortada; fmt: (n: number) => string; activo: boolean; onActivar: () => void }) {
  const maximo = Math.max(1, contexto.vencida, contexto.moraCritica);
  return <button type="button" onMouseEnter={onActivar} onFocus={onActivar} onClick={onActivar} className={`module-card group w-full text-left ${activo ? "module-card-active" : ""}`}>
    <span className="module-kicker">Cartera</span><span className="module-title">Pulso de cobro</span>
    <div className="mt-4 flex items-end gap-3"><div className="flex-1"><div className="flex items-center justify-between text-[9px] text-[#566175]"><span>Vencida</span><b>{contexto.porcentajeVencido.toFixed(1)}%</b></div><i className="mt-1.5 block h-4 rounded-full bg-[#ff8b78]" style={{ width: `${contexto.vencida / maximo * 100}%` }} /></div><div className="flex-1"><div className="flex items-center justify-between text-[9px] text-[#566175]"><span>90+</span><b>crítica</b></div><i className="mt-1.5 block h-4 rounded-full bg-[#1f2430]" style={{ width: `${contexto.moraCritica / maximo * 100}%` }} /></div></div>
    <span className="mt-4 block text-[10px] font-bold text-[#31394b]">{fmt(contexto.vencida)} vencida</span><span className="module-hover">abrir investigación de cartera</span>
  </button>;
}

function AgenteOrbital({ agente, seleccionado, iluminado, onSelect }: { agente: AgenteComercial; seleccionado: boolean; iluminado: boolean; onSelect: () => void }) {
  const estilo = ESTILO_ESTADO[agente.estado];
  return <button type="button" onClick={onSelect} aria-pressed={seleccionado} className={`agent-orb agent-${agente.id} ${ZONAS[agente.zona].clase} ${seleccionado ? "agent-orb-selected" : ""} ${iluminado ? "agent-orb-lit" : ""}`}>
    <span className={`agent-core ring-4 ${estilo.anillo} ${estilo.fondo}`}><span className={`agent-pulse ${estilo.punto}`} /><b>{agente.abreviatura}</b></span>
    <span className="agent-name">{agente.nombre}</span><span className={`agent-signal ${estilo.texto}`}>{agente.senal}</span>
  </button>;
}

export function PortadaVentas({ ventas, fmt, fuente, cartera }: { ventas: AnaliticaVentas; fmt: (n: number) => string; fuente: string; cartera: ContextoCarteraPortada }) {
  const agentes = useMemo(() => ejecutarAgentesPortada(ventas, cartera), [ventas, cartera]);
  const [seleccionadoId, setSeleccionadoId] = useState("coordinador");
  const [zonaActiva, setZonaActiva] = useState<ZonaAgente | null>(null);
  const seleccionado = agentes.find((a) => a.id === seleccionadoId) ?? agentes[0];
  if (!ventas.disponible) return <section className="rounded-[28px] border border-white/90 bg-white/70 p-5 text-sm text-tintaSuave">Ventas todavía no están disponibles para este corte.</section>;

  const activar = (zona: ZonaAgente) => setZonaActiva(zona);
  return <section id="sec-ventas" className="agent-command-surface">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="agent-eyebrow">Centro de agentes comerciales</p><h3 className="agent-heading">La operación se lee a través de sus agentes</h3></div><div className="flex items-center gap-2"><span className="rounded-full bg-white/70 px-3 py-1.5 text-[9px] font-bold text-[#65728b]">{agentes.length} agentes activos</span><span className="rounded-full bg-white/70 px-3 py-1.5 text-[9px] font-semibold text-[#65728b]">{fuente}</span></div></div>

    <div className="agent-stage mt-5" onMouseLeave={() => setZonaActiva(null)}>
      <div className="agent-stage-grid">
        <GraficoLinea puntos={ventas.tendencia} fmt={fmt} activo={zonaActiva === "ventas" || seleccionado?.zona === "ventas"} onActivar={() => activar("ventas")} />
        <GraficoBarras titulo="Clientes principales" zona="Clientes" filas={ventas.topClientes} fmt={fmt} activo={zonaActiva === "clientes" || seleccionado?.zona === "clientes"} onActivar={() => activar("clientes")} />
        <GraficoBarras titulo="Productos que mueven el mix" zona="Productos" filas={ventas.topProductos} fmt={fmt} activo={zonaActiva === "productos" || seleccionado?.zona === "productos"} onActivar={() => activar("productos")} />
        <ModuloCartera contexto={cartera} fmt={fmt} activo={zonaActiva === "cartera" || seleccionado?.zona === "cartera"} onActivar={() => activar("cartera")} />
      </div>
      <div className="agent-orbit-layer" aria-label="Agentes comerciales">{agentes.map((agente) => <AgenteOrbital key={agente.id} agente={agente} seleccionado={agente.id === seleccionado?.id} iluminado={zonaActiva === agente.zona || agente.id === seleccionado?.id} onSelect={() => { setSeleccionadoId(agente.id); setZonaActiva(agente.zona); }} />)}</div>
    </div>

    {seleccionado ? <aside id="sec-problemas" className="agent-insight"><div className="flex min-w-0 items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO_ESTADO[seleccionado.estado].punto}`} /><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#71809b]">{seleccionado.nombre}</span></div><p className="agent-insight-evidence">{seleccionado.evidencia}</p><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] text-[#71809b]">{seleccionado.accion}</p><Link href={seleccionado.href} className="agent-investigate">investigar ↗</Link></div></aside> : null}
    <p className="mt-3 text-center text-[9.5px] text-[#8791a3]">Pasa por un módulo para activar su equipo; selecciona un agente para ver la señal y profundizar.</p>
  </section>;
}
