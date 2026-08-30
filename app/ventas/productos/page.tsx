"use client";

import { useEffect, useState } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { SkeletonPagina } from "@/components/Basicos";
import { PanelReporteAgentes } from "@/components/commercial/PanelReporteAgentes";
import type { AgenteLateral } from "@/components/commercial/PanelAgentesLateral";
import { construirLecturasProductoVentas, type AgenteProductoVentas, type LecturaAgenteProducto } from "@/lib/agentes-producto-ventas";
import { useApp } from "@/lib/store";
import type { TonoMascota } from "@/components/commercial/MascotaB18";

type AgenteProducto = AgenteProductoVentas;

type FilaLectura = { nombre: string; productos?: number; valor: number; pct: number };
function BarrasDeLectura({ lectura, lecturas, fmt }: { lectura: LecturaAgenteProducto; lecturas: Record<AgenteProducto, LecturaAgenteProducto>; fmt: (valor: number) => string }) {
  const tieneValor = lectura.filas.some((fila) => fila.valor > 0);
  return <section aria-live="polite">
    <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#6e98f3]">Reporte general del portafolio</p>
    <h2 className="mt-2 text-[clamp(1.55rem,2.5vw,2.25rem)] font-black tracking-[-.06em] text-[#121c32]">Cascos sostienen la composición comercial.</h2>
    <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f5f8ff] p-3"><p className="text-[8px] font-black uppercase tracking-[.12em] text-[#8193b4]">Familia líder</p><b className="mt-1 block text-xs text-[#29415f]">{lecturas.familia.filas[0]?.nombre}</b><span className="text-[10px] font-black text-[#4b80ee]">{lecturas.familia.filas[0]?.pct.toFixed(2)}%</span></div><div className="rounded-xl bg-[#f5f8ff] p-3"><p className="text-[8px] font-black uppercase tracking-[.12em] text-[#8193b4]">Tipo líder</p><b className="mt-1 block text-xs text-[#29415f]">{lecturas.tipo.filas[0]?.nombre}</b><span className="text-[10px] font-black text-[#4b80ee]">{lecturas.tipo.filas[0]?.pct.toFixed(2)}%</span></div></div>
    <div className="mt-6 border-t border-[#e8eefb] pt-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#6e98f3]">Profundización · {lectura.nombre}</p><h3 className="mt-2 text-[clamp(1.15rem,2vw,1.55rem)] font-black tracking-[-.04em] text-[#121c32]">{lectura.titulo}</h3></div>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6a7893]">{lectura.explicacion}</p>
    <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
      <div className="space-y-4">
        {lectura.filas.map((fila, indice) => <div key={fila.nombre}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] font-bold text-[#34435f]">
            <span>{fila.nombre}{fila.productos ? <span className="ml-2 text-[#9aa9c4]">{fila.productos} productos</span> : null}</span>
            <span className="text-[#4b7fe8]">{fila.pct.toFixed(2)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#eef3ff]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4b80ee,#87c6ff)] transition-all duration-700" style={{ width: `${Math.max(fila.pct, 1.5)}%`, opacity: 1 - indice * 0.08 }} /></div>
          {tieneValor && fila.valor > 0 ? <p className="mt-1 text-[10px] font-semibold text-[#8997b1]">{fmt(fila.valor)}</p> : null}
        </div>)}
      </div>
      <aside className="rounded-2xl border border-[#e7eefc] bg-[#f8fbff] p-5 shadow-[0_12px_28px_rgba(75,115,190,.08)]">
        <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#7d91b8]">Hallazgo</p>
        <p className="mt-3 text-sm font-black leading-relaxed text-[#283a5d]">{lectura.hallazgo}</p>
        <p className="mt-5 border-t border-[#e1e9fb] pt-4 text-[10px] font-semibold leading-relaxed text-[#74839e]">La gráfica cambia con el agente activo y conserva el límite de cada clasificación.</p>
      </aside>
    </div>
  </section>;
}

export default function PaginaCategoriasProducto() {
  const { cargando, fmt, dataset } = useApp();
  const [activo, setActivo] = useState<AgenteProducto>("familia");
  const [tono, setTono] = useState<TonoMascota>("analisis");
  useEffect(() => {
    document.body.classList.add("producto-lienzo-blanco");
    return () => document.body.classList.remove("producto-lienzo-blanco");
  }, []);
  if (cargando) return <SkeletonPagina />;

  const lecturas = construirLecturasProductoVentas(dataset);
  const lectura = lecturas[activo];
  const capacidades: Record<AgenteProducto, string> = {
    familia: `${lecturas.familia.cobertura.toFixed(1)}% identificado`,
    tipo: `${lecturas.tipo.cobertura.toFixed(1)}% identificado`,
    modelo: `${lecturas.modelo.cobertura.toFixed(1)}% identificado`,
    licencia: `${lecturas.licencia.cobertura.toFixed(1)}% con señal`,
  };
  const agentes: AgenteLateral<AgenteProducto>[] = (Object.keys(lecturas) as AgenteProducto[]).map((id) => ({
    id, iniciales: lecturas[id].iniciales, nombre: lecturas[id].nombre, senal: lecturas[id].senal, capacidad: capacidades[id], problema: lecturas[id].problema, accion: lecturas[id].accion, kpiPct: lecturas[id].kpiPct, kpiEtiqueta: lecturas[id].kpiEtiqueta, pregunta: lecturas[id].pregunta, kpiVisual: lecturas[id].kpiVisual, color: "#4b80ee", suave: "#eaf1ff",
  }));

  return <div className="space-y-3">
    <header className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-start gap-4 pt-3">
      <span aria-hidden="true" />
      <h1 className="min-w-0 whitespace-nowrap text-center text-[clamp(1.75rem,3.35vw,3.15rem)] font-black leading-none tracking-[-.065em] text-[#111827]">Clasificación <span className="bg-[linear-gradient(90deg,#467deb,#8cc8ff)] bg-clip-text text-transparent">comercial de productos</span></h1>
      <div className="justify-self-end"><BarraUsuario dataset={dataset} modulo="ventas" /></div>
    </header>
    <div id="sec-productos"><PanelReporteAgentes agentes={agentes} activo={activo} tono={tono} onSeleccionar={setActivo} onTonoCambiar={setTono} titulo="Clasificación comercial de productos" corte="última venta disponible"><BarrasDeLectura lectura={lectura} lecturas={lecturas} fmt={fmt} /></PanelReporteAgentes></div>
  </div>;
}
