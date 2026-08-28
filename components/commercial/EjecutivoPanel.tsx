"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { construirLecturaEjecutiva } from "@/lib/commercial-ejecutivo";
import { analiticaVentas } from "@/lib/commercial-operacion";
import { PortadaVentas } from "@/components/commercial/PortadaVentas";

/** La home sólo presenta el campo de agentes. Los reportes extensos viven en
 * sus rutas de investigación, no compiten con la lectura inicial. */
export function EjecutivoPanel() {
  const { dataset, fechaCorte, fmt } = useApp();
  const lectura = useMemo(() => construirLecturaEjecutiva(dataset, fechaCorte), [dataset, fechaCorte]);
  const ventas = useMemo(() => analiticaVentas(dataset), [dataset]);
  const porcentajeVencido = lectura.totalCarteraClasificable > 0
    ? (lectura.totalVencido / lectura.totalCarteraClasificable) * 100
    : 0;

  return (
    <section id="sec-pulso" className="lienzo-referencia scroll-mt-24 overflow-hidden entrada-suave">
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#778198]">Centro comercial activo</p>
            <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-tinta">Agentes que recorren la operación</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#6b6f78]">Los módulos contienen señales; los agentes indican dónde mirar y qué investigar.</p>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-semibold text-[#536b91] shadow-flotante">corte operativo · {fechaCorte}</span>
        </div>
        <div className="mt-5"><PortadaVentas ventas={ventas} fmt={fmt} fuente={dataset.fuente} cartera={{ vencida: lectura.totalVencido, moraCritica: lectura.totalMoraCritica, porcentajeVencido }} /></div>
      </div>
    </section>
  );
}
