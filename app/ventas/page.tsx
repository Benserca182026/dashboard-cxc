"use client";

import { useEffect, useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MapaB18Ventas } from "@/components/commercial/MapaB18Ventas";
import { construirMapaVentasB18 } from "@/lib/agentes-ventas-b18";
import { useApp } from "@/lib/store";

/**
 * Ventas comerciales con la misma estructura B18 que la clasificación de
 * productos: cuatro agentes alrededor de un reporte visual.
 *
 * Los cuatro contestan una sola pregunta —de dónde viene el crecimiento— y
 * todos leen la MISMA capa: `amount_total` de sale.order, con el IVA del 12%
 * incluido. El rótulo de esa decisión viaja visible en el encabezado y se
 * repite dentro del mapa: no es un detalle de pie de página.
 */
export default function PaginaVentas() {
  const { cargando, dataset, fmt } = useApp();
  useEffect(() => {
    document.body.classList.add("b18-lienzo-blanco");
    return () => document.body.classList.remove("b18-lienzo-blanco");
  }, []);

  const mapa = useMemo(() => construirMapaVentasB18(dataset, fmt), [dataset, fmt]);

  if (cargando) return <SkeletonPagina />;

  return <main className="b18-prototype-page">
    <header className="b18-prototype-title">
      <div>
        <p>Ventas · {mapa.declaracion}</p>
        <h1>Ventas <span>comerciales</span></h1>
      </div>
      <BarraUsuario dataset={dataset} modulo="ventas" />
    </header>
    {/* La excepción de moneda se declara arriba del mapa, no dentro de un modal:
        el año afectado se sigue mostrando, pero su monto no es un total en
        quetzales y eso tiene que leerse ANTES de compararlo con otro año.
        Va fuera del encabezado para ocupar el ancho completo también en móvil. */}
    {mapa.avisoMoneda ? <p className="b18-vt-aviso b18-vt-aviso-moneda"><b>Moneda</b>{mapa.avisoMoneda}</p> : null}
    <MapaB18Ventas mapa={mapa} fmt={fmt} />
  </main>;
}
