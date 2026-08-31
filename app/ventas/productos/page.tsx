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

function BarrasDeLectura({ lectura, lecturas, fmt }: { lectura: LecturaAgenteProducto; lecturas: Record<AgenteProducto, LecturaAgenteProducto>; fmt: (valor: number) => string }) {
  const tieneValor = lectura.filas.some((fila) => fila.valor > 0);
  return <section className="producto-lectura" aria-live="polite">
    <div className="producto-lectura-encabezado"><div><p>Reporte comercial</p><h2>{lectura.nombre}</h2></div><strong>{lectura.titulo}</strong></div>
    <div className="producto-lectura-kpis"><div><p>Familia líder</p><b>{lecturas.familia.filas[0]?.nombre}</b><span>{lecturas.familia.filas[0]?.pct.toFixed(2)}%</span></div><div><p>Tipo líder</p><b>{lecturas.tipo.filas[0]?.nombre}</b><span>{lecturas.tipo.filas[0]?.pct.toFixed(2)}%</span></div></div>
    <div className="producto-lectura-pregunta"><p>Lectura · {lectura.nombre}</p><h3>{lectura.titulo}</h3><span>{lectura.explicacion}</span></div>
    <div className="producto-lectura-contenido">
      <div className="producto-lectura-lista">
        {lectura.filas.map((fila, indice) => <div key={fila.nombre}>
          <div className="producto-lectura-fila">
            <span>{fila.nombre}{fila.productos ? <span className="ml-2 text-[#9aa9c4]">{fila.productos} productos</span> : null}</span>
            <span className="text-[#4b7fe8]">{fila.pct.toFixed(2)}%</span>
          </div>
          <div className="producto-lectura-riel"><i style={{ width: `${Math.max(fila.pct, 1.5)}%`, opacity: 1 - indice * 0.08 }} /></div>
          {tieneValor && fila.valor > 0 ? <p className="producto-lectura-valor">{fmt(fila.valor)}</p> : null}
        </div>)}
      </div>
      <aside className="producto-lectura-hallazgo">
        <p>Conclusión comercial</p><strong>{lectura.hallazgo}</strong>
        <span>La lectura cambia con el agente activo.</span>
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
