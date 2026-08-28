"use client";

import { useEffect, useMemo, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { SkeletonPagina } from "@/components/Basicos";
import { ModuloGuiado } from "@/components/commercial/ModuloGuiado";
import { acumuladosVentasPorCliente } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";

type Canal = "retail" | "ecommerce" | "tradicional" | "tienda_grande";
type Asignaciones = Record<string, Canal>;

const CLAVE_LOCAL = "edge-canales-por-cliente-v1";

const CANALES: { id: Canal; nombre: string; abreviatura: string; color: string; suave: string; descripcion: string }[] = [
  { id: "retail", nombre: "Retail", abreviatura: "RT", color: "#596bd0", suave: "#edf0ff", descripcion: "venta a comercios minoristas" },
  { id: "ecommerce", nombre: "E-commerce", abreviatura: "EC", color: "#a45ccf", suave: "#f7edff", descripcion: "venta por canal digital" },
  { id: "tradicional", nombre: "Canal tradicional", abreviatura: "CT", color: "#2f9d78", suave: "#e8f8f1", descripcion: "distribución y comercio tradicional" },
  { id: "tienda_grande", nombre: "Tienda grande", abreviatura: "TG", color: "#e47743", suave: "#fff0e9", descripcion: "cuentas de gran superficie" },
];

const SECCIONES = [
  { id: "sec-mapa-canal", etiqueta: "Mapa de canales" },
  { id: "sec-clasificar", etiqueta: "Clasificar clientes" },
  { id: "sec-control-canal", etiqueta: "Control" },
];

function porcentaje(valor: number, total: number) {
  return total > 0 ? (valor / total) * 100 : 0;
}

function GraficoHistorico({ puntos, color }: { puntos: { periodo: string; valor: number }[]; color: string }) {
  const maximo = Math.max(1, ...puntos.map((p) => p.valor));
  const coords = puntos.map((punto, indice) => ({
    x: 18 + (indice / Math.max(1, puntos.length - 1)) * 244,
    y: 18 + (1 - punto.valor / maximo) * 100,
  }));
  const path = coords.map((punto, indice) => `${indice ? "L" : "M"}${punto.x},${punto.y}`).join(" ");
  if (puntos.length === 0) return <div className="grid h-32 place-items-center text-center text-[11px] text-[#707991]">Aún no hay clientes clasificados por canal.</div>;
  return (
    <svg viewBox="0 0 280 138" className="h-32 w-full" role="img" aria-label="Histórico acumulado por canal clasificado">
      {[34, 70, 106].map((y) => <line key={y} x1="18" x2="262" y1={y} y2={y} stroke="#dce3f1" strokeDasharray="3 5" />)}
      <path d={`${path} L${coords.at(-1)?.x ?? 262},122 L18,122 Z`} fill={color} opacity=".12" />
      <path d={path} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((punto, indice) => <circle key={indice} cx={punto.x} cy={punto.y} r="3.5" fill="white" stroke={color} strokeWidth="2.5" />)}
    </svg>
  );
}

function Agente({
  iniciales,
  nombre,
  senal,
  color,
  suave,
  activo,
  onClick,
  clase,
}: {
  iniciales: string; nombre: string; senal: string; color: string; suave: string; activo: boolean; onClick: () => void; clase: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`absolute z-20 grid w-24 justify-items-center gap-1 text-center transition duration-300 hover:scale-105 focus:outline-none ${clase} ${activo ? "scale-110" : ""}`}>
      <span className="grid h-14 w-14 place-items-center rounded-full border-4 text-sm font-black shadow-[0_10px_22px_rgba(42,55,94,.18)]" style={{ borderColor: `${color}33`, background: suave, color }}>
        {iniciales}
      </span>
      <span className="max-w-[118px] text-[10px] font-extrabold leading-tight" style={{ color }}>{nombre}</span>
      <span className="text-[10px] font-bold leading-tight" style={{ color }}>{senal}</span>
    </button>
  );
}

export default function PaginaCanalesVentas() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const [asignaciones, setAsignaciones] = useState<Asignaciones>({});
  const [listo, setListo] = useState(false);
  const [agenteActivo, setAgenteActivo] = useState<"historia" | "mezcla" | "cobertura" | "clasificacion" | null>(null);

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_LOCAL);
      if (guardado) setAsignaciones(JSON.parse(guardado) as Asignaciones);
    } catch {
      // Si el navegador no permite almacenamiento, la vista sigue operando en memoria.
    } finally {
      setListo(true);
    }
  }, []);

  const clientes = useMemo(() => acumuladosVentasPorCliente(dataset), [dataset]);
  const total = clientes.reduce((suma, cliente) => suma + cliente.valor, 0);
  const porCanal = useMemo(() => CANALES.map((canal) => {
    const filas = clientes.filter((cliente) => asignaciones[cliente.id] === canal.id);
    const valor = filas.reduce((suma, cliente) => suma + cliente.valor, 0);
    return { ...canal, filas, valor, pedidos: filas.reduce((suma, cliente) => suma + cliente.pedidos, 0) };
  }), [clientes, asignaciones]);
  const sinClasificar = clientes.filter((cliente) => !asignaciones[cliente.id]);
  const valorSinClasificar = sinClasificar.reduce((suma, cliente) => suma + cliente.valor, 0);
  const valorClasificado = total - valorSinClasificar;
  const cobertura = porcentaje(valorClasificado, total);
  const principal = [...porCanal].sort((a, b) => b.valor - a.valor)[0];
  const historial = useMemo(() => {
    const meses = new Map<string, number>();
    for (const cliente of clientes) {
      if (!asignaciones[cliente.id] || !cliente.hasta) continue;
      const mes = cliente.hasta.slice(0, 7);
      meses.set(mes, (meses.get(mes) ?? 0) + cliente.valor);
    }
    return [...meses.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([periodo, valor]) => ({ periodo, valor }));
  }, [clientes, asignaciones]);

  const cambiarCanal = (clienteId: string, canal: string) => {
    const siguiente = { ...asignaciones };
    if (canal) siguiente[clienteId] = canal as Canal;
    else delete siguiente[clienteId];
    setAsignaciones(siguiente);
    try { window.localStorage.setItem(CLAVE_LOCAL, JSON.stringify(siguiente)); } catch { /* memoria local */ }
  };

  if (cargando || !listo) return <SkeletonPagina />;

  const enfocado = agenteActivo !== null;
  const claseModulo = (id: typeof agenteActivo) => `channel-module relative rounded-[28px] border border-white/90 bg-white/85 p-5 shadow-[0_14px_34px_rgba(44,63,108,.10)] transition duration-300 ${enfocado && agenteActivo !== id ? "blur-[3px] opacity-30" : ""} ${agenteActivo === id ? "z-10 ring-2 ring-[#6d7ee0]/60 shadow-[0_18px_42px_rgba(70,88,161,.2)]" : ""}`;

  return (
    <div className="space-y-6">
      <Encabezado titulo="Canales de venta" secciones={SECCIONES} dataset={dataset} modulo="ventas" />

      <section id="sec-mapa-canal" className="scroll-mt-24 rounded-[34px] border border-white/90 bg-[linear-gradient(135deg,#edf2ff_0%,#dfe9fa_100%)] p-5 shadow-[0_20px_50px_rgba(44,63,108,.12)] md:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#6d7ee0]">Acumulado histórico</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-[#1d2638]">Ventas por tipo de cliente</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#707991]">Retail, e-commerce, canal tradicional y tienda grande. Cada cifra viene del total cerrado en Odoo; la clasificación de canal se declara cliente por cliente.</p>
          </div>
          <div className="rounded-full bg-white/80 px-4 py-2 text-right shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#7e879a]">Venta histórica leída</p>
            <p className="text-lg font-black tabular-nums text-[#202a3b]">{fmt(total)}</p>
            <p className="text-[10px] font-semibold text-[#6f7990]">corte {fechaCorte}</p>
          </div>
        </div>

        <div className="channel-agent-stage relative min-h-[780px] overflow-hidden rounded-[30px] bg-[#e9f0fc] p-5 md:p-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className={claseModulo("historia")}>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Histórico clasificado</p>
              <h3 className="mt-1 text-lg font-black text-[#253047]">Ritmo del acumulado</h3>
              <GraficoHistorico puntos={historial} color="#596bd0" />
              {agenteActivo === "historia" && <p className="mt-1 text-[11px] font-bold text-[#596bd0]">La curva aparece cuando los clientes reciben un canal; no rellena períodos sin clasificación.</p>}
            </article>

            <article className={claseModulo("mezcla")}>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Mezcla comercial</p>
              <h3 className="mt-1 text-lg font-black text-[#253047]">Participación por canal</h3>
              <div className="mt-5 space-y-4">
                {porCanal.map((canal) => <div key={canal.id}>
                  <div className="mb-1 flex justify-between gap-3 text-[11px] font-bold text-[#536078]"><span>{canal.nombre}</span><span>{fmt(canal.valor)} · {porcentaje(canal.valor, total).toFixed(1)}%</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#e6eaf3]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${porcentaje(canal.valor, total)}%`, background: canal.color }} /></div>
                </div>)}
              </div>
              {agenteActivo === "mezcla" && <p className="mt-4 text-[11px] font-bold text-[#a45ccf]">{principal?.valor ? `${principal.nombre} es el canal más grande entre los ya clasificados.` : "Aún no hay base clasificada para comparar canales."}</p>}
            </article>

            <article className={claseModulo("clasificacion")}>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Cola de codificación</p>
              <h3 className="mt-1 text-lg font-black text-[#253047]">Clientes que aún no tienen canal</h3>
              <div className="mt-4 space-y-2">
                {sinClasificar.slice(0, 5).map((cliente) => <div key={cliente.id} className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 rounded-2xl bg-[#f6f8fc] px-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-[11px] font-extrabold text-[#36415a]">{cliente.etiqueta}</p><p className="text-[10px] font-semibold text-[#748099]">{fmt(cliente.valor)} · {cliente.pedidos} pedidos</p></div>
                  <select aria-label={`Asignar canal a ${cliente.etiqueta}`} value="" onChange={(e) => cambiarCanal(cliente.id, e.target.value)} className="rounded-xl border border-[#dce3f0] bg-white px-2 py-1.5 text-[10px] font-bold text-[#54617b] outline-none focus:border-[#596bd0]">
                    <option value="">Asignar canal</option>
                    {CANALES.map((canal) => <option key={canal.id} value={canal.id}>{canal.nombre}</option>)}
                  </select>
                </div>)}
                {sinClasificar.length === 0 && <p className="rounded-2xl bg-[#e8f8f1] p-4 text-[11px] font-bold text-[#2f9d78]">Toda la venta disponible ya tiene canal asignado.</p>}
              </div>
              {agenteActivo === "clasificacion" && <p className="mt-3 text-[11px] font-bold text-[#e47743]">La asignación queda guardada en este navegador. No modifica Odoo hasta que se conecte la dimensión canal al origen.</p>}
            </article>

            <article className={claseModulo("cobertura")}>
              <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#657291]">Control de lectura</p>
              <h3 className="mt-1 text-lg font-black text-[#253047]">Cobertura de canal</h3>
              <div className="mt-6 flex items-end justify-between gap-4"><p className="text-5xl font-black tracking-[-.06em] text-[#253047]">{cobertura.toFixed(1)}%</p><p className="pb-1 text-right text-[11px] font-bold text-[#72809a]">{sinClasificar.length.toLocaleString("es-GT")} clientes sin canal<br />{fmt(valorSinClasificar)} aún sin leer por tipo</p></div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-[#e6eaf3]"><div className="h-full rounded-full bg-[#2f9d78] transition-all duration-500" style={{ width: `${cobertura}%` }} /></div>
              <p className="mt-4 text-[11px] leading-relaxed text-[#6e7990]">El modelo actual trae cliente y venta, pero no un campo de canal. Esta vista hace visible esa ausencia para clasificarla, no la adivina por el nombre.</p>
              {agenteActivo === "cobertura" && <p className="mt-3 text-[11px] font-bold text-[#c84e56]">Hasta que la cobertura llegue a 100%, cualquier porcentaje por canal es parcial y queda señalado como tal.</p>}
            </article>
          </div>

          <Agente iniciales="HC" nombre="Histórico canal" senal={`${historial.length} períodos`} color="#596bd0" suave="#edf0ff" activo={agenteActivo === "historia"} onClick={() => setAgenteActivo(agenteActivo === "historia" ? null : "historia")} clase="left-[6%] top-[37%]" />
          <Agente iniciales="MX" nombre="Mezcla de canales" senal={principal?.valor ? `${principal.nombre} lidera` : "sin base aún"} color="#a45ccf" suave="#f7edff" activo={agenteActivo === "mezcla"} onClick={() => setAgenteActivo(agenteActivo === "mezcla" ? null : "mezcla")} clase="right-[6%] top-[37%]" />
          <Agente iniciales="CC" nombre="Codificador comercial" senal={`${sinClasificar.length} pendientes`} color="#e47743" suave="#fff0e9" activo={agenteActivo === "clasificacion"} onClick={() => setAgenteActivo(agenteActivo === "clasificacion" ? null : "clasificacion")} clase="bottom-[4%] left-[22%]" />
          <Agente iniciales="CV" nombre="Cobertura visible" senal={`${cobertura.toFixed(1)}% leído`} color="#2f9d78" suave="#e8f8f1" activo={agenteActivo === "cobertura"} onClick={() => setAgenteActivo(agenteActivo === "cobertura" ? null : "cobertura")} clase="bottom-[4%] right-[22%]" />
        </div>
      </section>

      <section id="sec-clasificar" className="scroll-mt-24 rounded-[34px] border border-white/90 bg-[linear-gradient(135deg,#f1f5ff_0%,#e8effb_100%)] p-5 shadow-[0_16px_38px_rgba(44,63,108,.10)] md:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#596bd0]">Ruta de trabajo</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] text-[#253047]">Módulos guiados por agentes</h2><p className="mt-1 text-sm text-[#6b7690]">La página no cambia de modo: cada agente vive dentro de su módulo y conduce la siguiente lectura.</p></div><span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-black text-[#657291]">01 → 04</span></div>
        <div className="space-y-4">
          <ModuloGuiado orden="01" agente="Cobertura visible" iniciales="CV" senal={`${cobertura.toFixed(1)}% de venta ya clasificada`} color="#2f9d78" suave="#e8f8f1" activo={agenteActivo === "cobertura"} atenuado={Boolean(agenteActivo && agenteActivo !== "cobertura")} onActivar={() => setAgenteActivo(agenteActivo === "cobertura" ? null : "cobertura")}>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]"><div><p className="text-xl font-black text-[#263149]">{cobertura.toFixed(1)}% leído por canal</p><div className="mt-3 h-4 overflow-hidden rounded-full bg-[#e2e8f2]"><div className="h-full rounded-full bg-[#2f9d78]" style={{ width: `${cobertura}%` }} /></div></div><p className="text-right text-[11px] font-bold text-[#69758c]">{sinClasificar.length.toLocaleString("es-GT")} clientes aún sin canal<br />{fmt(valorSinClasificar)} por clasificar</p></div>
          </ModuloGuiado>
          <ModuloGuiado orden="02" agente="Mezcla de canales" iniciales="MX" senal={principal?.valor ? `${principal.nombre} lidera la base clasificada` : "todavía no hay base clasificada"} color="#a45ccf" suave="#f7edff" activo={agenteActivo === "mezcla"} atenuado={Boolean(agenteActivo && agenteActivo !== "mezcla")} onActivar={() => setAgenteActivo(agenteActivo === "mezcla" ? null : "mezcla")}>
            <div className="grid gap-3 md:grid-cols-2">{porCanal.map((canal) => <div key={canal.id} className="rounded-2xl bg-[#f7f9fd] p-3"><div className="flex justify-between gap-3 text-[11px] font-black text-[#536078]"><span>{canal.nombre}</span><span>{porcentaje(canal.valor, total).toFixed(1)}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e4e9f2]"><div className="h-full rounded-full" style={{ width: `${porcentaje(canal.valor, total)}%`, background: canal.color }} /></div><p className="mt-2 text-[10px] font-semibold text-[#718099]">{canal.filas.length} clientes · {canal.pedidos} pedidos</p></div>)}</div>
          </ModuloGuiado>
          <ModuloGuiado orden="03" agente="Histórico de canal" iniciales="HC" senal={`${historial.length} períodos comparables`} color="#596bd0" suave="#edf0ff" activo={agenteActivo === "historia"} atenuado={Boolean(agenteActivo && agenteActivo !== "historia")} onActivar={() => setAgenteActivo(agenteActivo === "historia" ? null : "historia")}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]"><GraficoHistorico puntos={historial} color="#596bd0" /><p className="self-center text-[11px] leading-relaxed text-[#68758f]">El histórico se activa al clasificar clientes. No distribuye la venta hacia atrás sin una decisión de canal verificable.</p></div>
          </ModuloGuiado>
          <ModuloGuiado orden="04" agente="Codificador comercial" iniciales="CC" senal={`${sinClasificar.length} clientes en cola`} color="#e47743" suave="#fff0e9" activo={agenteActivo === "clasificacion"} atenuado={Boolean(agenteActivo && agenteActivo !== "clasificacion")} onActivar={() => setAgenteActivo(agenteActivo === "clasificacion" ? null : "clasificacion")}>
            <div className="grid gap-2 md:grid-cols-2">{sinClasificar.slice(0, 6).map((cliente) => <div key={cliente.id} className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 rounded-2xl bg-[#fff8f4] px-3 py-2.5"><div className="min-w-0"><p className="truncate text-[11px] font-extrabold text-[#36415a]">{cliente.etiqueta}</p><p className="text-[10px] font-semibold text-[#748099]">{fmt(cliente.valor)} · {cliente.pedidos} pedidos</p></div><select aria-label={`Asignar canal a ${cliente.etiqueta}`} value="" onChange={(e) => cambiarCanal(cliente.id, e.target.value)} className="rounded-xl border border-[#f0d8cb] bg-white px-2 py-1.5 text-[10px] font-bold text-[#8f674f] outline-none focus:border-[#e47743]"><option value="">Asignar canal</option>{CANALES.map((canal) => <option key={canal.id} value={canal.id}>{canal.nombre}</option>)}</select></div>)}{sinClasificar.length === 0 && <p className="rounded-2xl bg-[#e8f8f1] p-4 text-[11px] font-bold text-[#2f9d78]">Toda la venta disponible ya tiene canal asignado.</p>}</div>
          </ModuloGuiado>
        </div>
      </section>

      <section id="sec-control-canal" className="scroll-mt-24 rounded-[28px] border border-[#dfe6f4] bg-[#f6f8fc] p-5 text-[11px] leading-relaxed text-[#5e6b83]">
        <p className="font-black uppercase tracking-[.14em] text-[#657291]">Regla de procedencia</p>
        <p className="mt-2">La página suma únicamente el total de pedido cerrado en Odoo. “Canal” no existe aún como columna del dataset actual; por eso ningún cliente se reparte automáticamente entre retail, e-commerce, tradicional o tienda grande. Las decisiones de clasificación son visibles, reversibles y locales hasta que el campo llegue desde la fuente.</p>
      </section>
    </div>
  );
}
