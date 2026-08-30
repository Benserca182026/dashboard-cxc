"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MascotaB18, TONOS_MASCOTA, type TonoMascota } from "./MascotaB18";
import type { AgenteLateral } from "./PanelAgentesLateral";

const POSICIONES_CENTRALES = [
  "left-[calc(50%-128px)] top-44",
  "right-[calc(50%-128px)] top-44",
  "bottom-24 left-[calc(50%-128px)]",
  "bottom-24 right-[calc(50%-128px)]",
];

const POSICIONES_TARJETAS = ["tarjeta-comercial-0", "tarjeta-comercial-1", "tarjeta-comercial-2", "tarjeta-comercial-3", "tarjeta-comercial-4"];

const POSICIONES_ESQUINAS = [
  "fixed left-7 top-24 md:left-12 md:top-24",
  "fixed right-7 top-24 md:right-12 md:top-24",
  "fixed bottom-8 left-7 md:bottom-10 md:left-12",
  "fixed bottom-8 right-7 md:bottom-10 md:right-12",
];

function MicroKpi<T extends string>({ agente }: { agente: AgenteLateral<T> }) {
  const pct = agente.kpiPct ?? 0;
  return <span className="micro-kpi" aria-label={`${agente.kpiEtiqueta}: ${pct.toFixed(2)} por ciento`}>
    <span className="micro-kpi-linea"><b>{agente.kpiEtiqueta ?? "KPI"}</b><strong>{pct.toFixed(2)}%</strong></span>
    <span className="micro-kpi-riel"><span style={{ width: `${Math.max(pct, 3)}%` }} /></span>
  </span>;
}

function MicroVisual<T extends string>({ agente }: { agente: AgenteLateral<T> }) {
  const pct = agente.kpiPct ?? 0;
  if (agente.kpiVisual === "pareto") return <span className="micro-visual micro-pareto" aria-label="Pareto de modelos"><i style={{ height: "86%" }} /><i style={{ height: "52%" }} /><i style={{ height: "34%" }} /></span>;
  if (agente.kpiVisual === "barras") return <span className="micro-visual micro-barras" aria-label="Mix de tipos"><i style={{ width: "86%" }} /><i style={{ width: "52%" }} /><i style={{ width: "28%" }} /></span>;
  const visible = agente.kpiVisual === "cobertura" ? 100 - pct : pct;
  return <span className="micro-visual micro-dona" style={{ background: `conic-gradient(#4b80ee ${visible}%, #eaf0ff 0)` }} aria-label={`${visible.toFixed(2)} por ciento`}><i>{visible.toFixed(0)}%</i></span>;
}

function TarjetaComercial<T extends string>({ agente, indice }: { agente: AgenteLateral<T>; indice: number }) {
  return <article className={`tarjeta-comercial ${POSICIONES_TARJETAS[indice]}`}>
    <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-md bg-[#e8f0ff] text-[7px] font-black text-[#4b80ee]">{agente.iniciales}</span><p>{agente.nombre}</p></div>
    <h3>{agente.pregunta}</h3>
    <div className="tarjeta-comercial-kpi"><MicroVisual agente={agente} /><MicroKpi agente={agente} /></div>
    <span className="tarjeta-comercial-lectura">{agente.accion}</span>
  </article>;
}

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
  const [tono, setTono] = useState<TonoMascota>("riesgo");
  const [mostrarExplicaciones, setMostrarExplicaciones] = useState(false);
  const agente = agentes.find((item) => item.id === activo) ?? agentes[0];
  const alrededor = agentes.filter((item) => item.id !== agente?.id);
  const indiceActivo = Math.max(agentes.findIndex((item) => item.id === activo), 0);
  useEffect(() => setDetalleAbierto(false), [activo]);
  const seleccionarAgente = (id: T) => { setDetalleAbierto(false); onSeleccionar(id); };
  const enfoque = {
    riesgo: { etiqueta: "Riesgo comercial", kpi: agente?.senal ?? "", texto: "Hace visible dónde la venta depende más de un grupo comercial." },
    atencion: { etiqueta: "Atención", kpi: "Prioridad comercial", texto: "Ordena los SKU o extensiones que cambian la lectura del mix." },
    oportunidad: { etiqueta: "Oportunidad", kpi: agente?.capacidad ?? "", texto: agente?.accion ?? "Convierte la lectura en una decisión comercial accionable." },
    analisis: { etiqueta: "Análisis", kpi: agente?.capacidad ?? "", texto: "Separa venta confirmada de composición y declara qué parte es inferida." },
  }[tono];

  return (
    <section className="bg-white py-2 md:py-3">
      <div className="relative mx-auto flex min-h-[540px] max-w-5xl gap-5 overflow-visible">
        <aside className={`relative z-20 min-h-[610px] w-[118px] shrink-0 rounded-[30px] border border-[#edf1fb] bg-[linear-gradient(180deg,#fbfcff_0%,#f6f8ff_100%)] px-3 py-5 shadow-[0_20px_48px_rgba(71,105,175,.1)] transition duration-500 md:w-[150px] md:px-4 ${detalleAbierto ? "pointer-events-none opacity-25 blur-[3px]" : ""}`}>
            <div className="mb-6 flex justify-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#3d74ec,#7dc3ff)] text-[11px] font-black text-white shadow-[0_12px_26px_rgba(64,119,239,.28)] ring-4 ring-[#edf4ff]">{agente?.iniciales}</span></div>
            <p className="mb-4 hidden px-1 text-[9px] font-black uppercase tracking-[.15em] text-[#9babc8] md:block">Agentes</p>
            <div className="space-y-3">
              {agentes.map((item) => {
                const seleccionado = item.id === activo;
                return <button key={item.id} type="button" onClick={() => seleccionarAgente(item.id)} aria-pressed={seleccionado} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left transition-all duration-300 ${seleccionado ? "relative z-30 -translate-y-2 bg-white shadow-[0_15px_30px_rgba(70,106,180,.22)] ring-1 ring-[#e5edff]" : "opacity-60 hover:translate-x-1 hover:bg-white hover:opacity-100"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-black ${seleccionado ? "bg-[#dce9ff] text-[#3f78ec]" : "bg-[#eef3ff] text-[#a5b9ec]"}`}>{item.iniciales}</span>
                  <span className={`hidden truncate text-[10px] font-black md:block ${seleccionado ? "text-[#416bb8]" : "text-[#aab8d1]"}`}>{item.nombre}</span>
                </button>;
              })}
            </div>
            {!detalleAbierto && <div className="mt-6 rounded-2xl border border-white bg-white/95 p-3 shadow-[0_12px_26px_rgba(71,103,171,.14)]">
              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[.12em] text-[#71809b]"><span>Agent status</span><span className="text-[#779ff3]">● Live</span></div>
              <div className="mt-2 rounded-lg bg-[#dfe9ff] px-2.5 py-2 text-[#4263a2]">
                <div className="flex items-center justify-between text-[10px] font-black"><span className="truncate">{agente?.nombre}</span><span>Alerta</span></div>
                <p className="mt-1 text-[9px] font-bold leading-tight text-[#5675b3]">{agente?.senal}</p>
              </div>
            </div>}
            <MascotaB18 detalleAbierto={detalleAbierto} explicacionActiva={mostrarExplicaciones} enPanelLateral onTonoCambiar={setTono} onExplicacionActiva={() => setMostrarExplicaciones(true)} />
        </aside>

        <div className="relative min-w-0 flex-1 overflow-hidden rounded-[30px] border border-[#edf1fb] bg-white shadow-[0_24px_58px_rgba(71,105,175,.1)]">
          <div className="absolute inset-x-0 bottom-0 h-32 rounded-b-[30px] bg-[radial-gradient(ellipse_at_50%_100%,rgba(204,220,255,.5),transparent_72%)]" />
          <main className="relative min-h-[610px] overflow-hidden px-5 py-8 md:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(231,240,255,.9),transparent_34%)]" />
            {detalleAbierto && <button type="button" onClick={() => setDetalleAbierto(false)} aria-label="Cerrar detalle del agente" className="fixed inset-0 z-40 cursor-default bg-white/35 backdrop-blur-[7px]" />}
            {detalleAbierto && <div className="fixed bottom-8 left-28 right-8 top-24 z-50 overflow-y-auto rounded-[30px] border border-[#eef2fb] bg-white/96 p-6 shadow-[0_28px_70px_rgba(50,80,140,.2)] animate-[entradaSuave_.32s_ease-out] md:bottom-12 md:left-40 md:right-12 md:top-28 md:p-9">
              <div className="mb-5 rounded-2xl bg-[#f5f8ff] px-4 py-3 text-[#475c87]">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#6e98f3]">Problema comercial · {TONOS_MASCOTA[tono].etiqueta}</p><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black shadow-sm">{enfoque.kpi}</span></div>
                <p className="mt-1 text-sm font-black text-[#273b61]">{agente?.problema}</p><p className="mt-1 text-[11px] font-semibold leading-relaxed">Resolverlo ayuda a: {agente?.accion}</p>
              </div>
              {children}
            </div>}
            {mostrarExplicaciones && !detalleAbierto ? <div className="absolute inset-0 z-20 pointer-events-none">{alrededor.map((item, indice) => <TarjetaComercial key={item.id} agente={item} indice={indice} />)}</div> : null}

            {alrededor.map((item, indice) => {
              const posicion = detalleAbierto ? POSICIONES_ESQUINAS[indice] : POSICIONES_CENTRALES[indice];
              return <button key={item.id} type="button" onClick={() => seleccionarAgente(item.id)} className={`producto-nodo-esquina producto-nodo-${indice + 1} ${detalleAbierto ? "z-50" : "absolute z-20"} grid h-14 w-14 place-items-center rounded-2xl border border-[#edf2fe] bg-white text-[10px] font-black text-[#76a0f4] shadow-[0_12px_28px_rgba(90,126,195,.15)] transition-all duration-500 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-[#e1ebff] ${posicion}`}>{item.iniciales}<span className="absolute -bottom-9 w-32 text-center text-[8px] font-bold leading-tight text-[#8d9bb5]"><span className="block truncate">{item.nombre}</span><span className="block truncate text-[#6c91dc]">{item.senal}</span></span></button>;
            })}

            {!detalleAbierto && <><button key={agente?.id} type="button" onClick={() => setDetalleAbierto(true)} aria-expanded={detalleAbierto} className="producto-nucleo-activo absolute left-1/2 top-[55%] z-30 grid h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[25px] bg-[linear-gradient(135deg,#3d74ec,#7dc3ff)] text-lg font-black text-white shadow-[0_22px_45px_rgba(64,119,239,.35)] ring-8 ring-[#edf4ff] transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#cbdcff]">{agente?.iniciales}</button>
            <div className="absolute left-1/2 top-[calc(55%+56px)] z-30 w-60 -translate-x-1/2 text-center"><p className="text-[11px] font-black text-[#6079ad]">{agente?.senal}</p><div className="mt-2 flex justify-center gap-2 text-[8px] font-black"><span className="rounded-full bg-white px-2 py-1 text-[#567cbe] shadow-[0_8px_18px_rgba(71,103,171,.12)]">{agente?.capacidad}</span><span className="rounded-full px-2 py-1 text-white" style={{ backgroundColor: TONOS_MASCOTA[tono].color }}>{enfoque.etiqueta}</span></div></div></>}
          </main>
        </div>

      </div>
    </section>
  );
}
