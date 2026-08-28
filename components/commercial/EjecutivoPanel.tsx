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
    <section id="sec-pulso" className="scroll-mt-24 overflow-hidden entrada-suave">
      <div className="relative z-10">
        <PortadaVentas ventas={ventas} fmt={fmt} fuente={dataset.fuente} cartera={{ vencida: lectura.totalVencido, moraCritica: lectura.totalMoraCritica, porcentajeVencido }} />
      </div>
    </section>
  );
}
