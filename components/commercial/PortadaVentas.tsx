"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ejecutarAgentesPortada, type ProblemaPortada } from "@/lib/agents-portada";
import type { AnaliticaVentas, FilaComercial, PuntoTendencia } from "@/lib/commercial-operacion";

const TONOS = {
  critico: { punto: "bg-[#ff755f]", texto: "text-[#ff9b8b]", fondo: "bg-[#ff755f]/10" },
  alto: { punto: "bg-[#f0b45d]", texto: "text-[#f5ca87]", fondo: "bg-[#f0b45d]/10" },
  medio: { punto: "bg-[#8fa7d8]", texto: "text-[#b9c8e8]", fondo: "bg-[#8fa7d8]/10" },
} as const;

function LineaVentas({ puntos, fmt }: { puntos: PuntoTendencia[]; fmt: (n: number) => string }) {
  const [activo, setActivo] = useState(puntos.at(-1)?.periodo ?? "");
  const serie = puntos.slice(-12);
  const maximo = Math.max(1, ...serie.map((p) => p.valor));
  const minimo = Math.min(...serie.map((p) => p.valor));
  const ancho = 720;
  const alto = 190;
  const padX = 24;
  const padY = 22;
  const rango = Math.max(1, maximo - minimo);
  const coordenadas = serie.map((p, i) => ({
    ...p,
    x: padX + (i / Math.max(1, serie.length - 1)) * (ancho - padX * 2),
    y: padY + ((maximo - p.valor) / rango) * (alto - padY * 2),
  }));
  const path = coordenadas.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = coordenadas.length
    ? `${path} L${coordenadas.at(-1)!.x},${alto - padY} L${coordenadas[0].x},${alto - padY} Z`
    : "";
  const seleccionado = coordenadas.find((p) => p.periodo === activo) ?? coordenadas.at(-1);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#796de0]">Ritmo de ventas</p>
          <p className="mt-1 text-[12px] font-semibold text-tinta">12 meses · punto final parcial</p>
        </div>
        {seleccionado ? <div className="text-right"><p className="text-[9px] uppercase tracking-wider text-tintaSuave">{seleccionado.periodo}</p><p className="text-[15px] font-extrabold tabular-nums text-tinta">{fmt(seleccionado.valor)}</p></div> : null}
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="mt-3 w-full" role="img" aria-label="Ventas mensuales de los últimos doce meses">
        <defs>
          <linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#796de0" stopOpacity=".30"/><stop offset="1" stopColor="#796de0" stopOpacity=".02"/></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={padX} x2={ancho - padX} y1={alto * f} y2={alto * f} stroke="#dfe4ee" strokeDasharray="4 6" />)}
        {area ? <path d={area} fill="url(#sales-area)" /> : null}
        {path ? <path d={path} fill="none" stroke="#796de0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {coordenadas.map((p, i) => <g key={p.periodo} className="cursor-pointer" onClick={() => setActivo(p.periodo)}>
          <circle cx={p.x} cy={p.y} r={activo === p.periodo ? 7 : 4} fill={i === coordenadas.length - 1 ? "#c2703a" : "#796de0"} stroke="white" strokeWidth="3" />
          {(i === 0 || i === coordenadas.length - 1 || i % 3 === 0) ? <text x={p.x} y={alto - 3} textAnchor="middle" fontSize="9" fill="#7c8495">{p.periodo.slice(5)}</text> : null}
        </g>)}
      </svg>
    </div>
  );
}

function BarrasRanking({ titulo, filas, fmt }: { titulo: string; filas: FilaComercial[]; fmt: (n: number) => string }) {
  const top = filas.slice(0, 5);
  const maximo = Math.max(1, ...top.map((f) => f.valor));
  return <div className="rounded-[20px] bg-[#f4f6fb] p-4">
    <p className="text-[10px] font-bold uppercase tracking-[.12em] text-tintaSuave">{titulo}</p>
    <div className="mt-3 space-y-2.5">{top.map((fila, i) => <div key={fila.id}>
      <div className="flex items-baseline justify-between gap-3 text-[10px]"><span className="truncate font-semibold text-tinta">{i + 1}. {fila.etiqueta}</span><span className="shrink-0 tabular-nums text-tintaSuave">{fmt(fila.valor)}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-gradient-to-r from-[#536b91] to-[#796de0]" style={{ width: `${Math.max(3, (fila.valor / maximo) * 100)}%` }} /></div>
    </div>)}</div>
  </div>;
}

function ProblemasAgentes({ problemas }: { problemas: ProblemaPortada[] }) {
  const [activo, setActivo] = useState(problemas[0]?.id ?? "");
  const seleccionado = problemas.find((p) => p.id === activo) ?? problemas[0];
  return <section id="sec-problemas" className="rounded-[26px] bg-[#16181d] p-4 text-white shadow-[0_24px_46px_-28px_rgba(22,24,29,.9)]">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/45">Agentes en ejecución</p><h3 className="mt-1 text-[15px] font-bold">Top 5 problemas</h3></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] text-white/65">5 reglas</span></div>
    <div className="mt-3 space-y-1.5">{problemas.map((problema, i) => {
      const tono = TONOS[problema.severidad];
      return <button type="button" key={problema.id} onClick={() => setActivo(problema.id)} aria-pressed={activo === problema.id} className={`grid w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${activo === problema.id ? "bg-white/12" : "hover:bg-white/[.07]"}`}>
        <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-extrabold text-[#16181d] ${tono.punto}`}>{i + 1}</span>
        <span className="truncate text-[10.5px] font-semibold">{problema.titulo}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${tono.fondo} ${tono.texto}`}>{problema.metrica}</span>
      </button>;
    })}</div>
    {seleccionado ? <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.06] p-3">
      <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${TONOS[seleccionado.severidad].punto}`}/><p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{seleccionado.agente}</p></div>
      <p className="mt-2 text-[11px] leading-snug text-white/75">{seleccionado.evidencia}</p>
      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[9.5px] leading-snug text-white/50">{seleccionado.accion}</p><Link href={seleccionado.href} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[9px] font-bold text-[#16181d]">abrir ↗</Link></div>
    </div> : null}
  </section>;
}

export function PortadaVentas({ ventas, fmt, fuente }: { ventas: AnaliticaVentas; fmt: (n: number) => string; fuente: string }) {
  const resultado = useMemo(() => ejecutarAgentesPortada(ventas), [ventas]);
  if (!ventas.disponible) return <section className="rounded-[28px] border border-white/90 bg-white/70 p-5 text-sm text-tintaSuave">Ventas todavía no están disponibles para este corte.</section>;
  const variacion = ventas.variacionUltimoPeriodo;
  return <section id="sec-ventas" className="rounded-[30px] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,.88),rgba(230,236,250,.74))] p-5 shadow-[0_24px_50px_-34px_rgba(31,46,82,.45)]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#796de0]">Ventas · prioridad de portada</p><h3 className="mt-1 text-[clamp(1.35rem,2.2vw,2rem)] font-extrabold tracking-[-.03em] text-tinta">Pulso comercial y problemas que exigen atención</h3></div>
      <div className="flex items-center gap-2"><span className="rounded-full bg-white/75 px-3 py-1.5 text-[9.5px] font-semibold text-tintaSuave">{fuente}</span><Link href="/ventas" className="rounded-full bg-[#16181d] px-3 py-1.5 text-[9.5px] font-bold text-white">explorar ventas ↗</Link></div>
    </div>
    <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[20px] bg-white/80 p-3.5"><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">Venta histórica</p><p className="mt-2 text-[clamp(1.2rem,2vw,1.75rem)] font-extrabold tabular-nums text-tinta">{fmt(ventas.vendidoOdoo)}</p><p className="mt-1 text-[9px] text-tintaSuave">{ventas.desde} → {ventas.hasta}</p></div>
      <div className="rounded-[20px] bg-white/80 p-3.5"><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">Pedidos confirmados</p><p className="mt-2 text-[clamp(1.2rem,2vw,1.75rem)] font-extrabold tabular-nums text-tinta">{ventas.pedidosConReferencia.toLocaleString("es-GT")}</p><p className="mt-1 text-[9px] text-tintaSuave">{ventas.pedidosSinReferencia} sin total fuente</p></div>
      <div className="rounded-[20px] bg-white/80 p-3.5"><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">Ticket promedio</p><p className="mt-2 text-[clamp(1.2rem,2vw,1.75rem)] font-extrabold tabular-nums text-tinta">{fmt(resultado.ticketPromedio)}</p><p className="mt-1 text-[9px] text-tintaSuave">venta ÷ pedidos con total</p></div>
      <div className={`rounded-[20px] p-3.5 ${variacion !== null && variacion < 0 ? "bg-[#fff0ec]" : "bg-[#edf8f3]"}`}><p className="text-[9px] font-bold uppercase tracking-wider text-tintaSuave">MTD comparable</p><p className={`mt-2 text-[clamp(1.2rem,2vw,1.75rem)] font-extrabold tabular-nums ${variacion !== null && variacion < 0 ? "text-[#b75845]" : "text-emerald-700"}`}>{variacion === null ? "—" : `${variacion >= 0 ? "+" : "−"}${Math.abs(variacion).toFixed(1)}%`}</p><p className="mt-1 text-[9px] text-tintaSuave">hasta día {ventas.diaCorteComparacion ?? "—"}</p></div>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
      <div className="rounded-[24px] border border-white/80 bg-white/65 p-4"><LineaVentas puntos={ventas.tendencia} fmt={fmt}/></div>
      <ProblemasAgentes problemas={resultado.problemas}/>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <BarrasRanking titulo="Top clientes" filas={ventas.topClientes} fmt={fmt}/>
      <BarrasRanking titulo="Top productos · valor de lista" filas={ventas.topProductos} fmt={fmt}/>
    </div>
  </section>;
}
