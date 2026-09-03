"use client";

import { useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirDetalleVentaB18 } from "@/lib/agentes-detalle-venta-b18";
import { useApp } from "@/lib/store";

/**
 * DETALLE DE VENTA sobre el molde B18 (referencia: /ventas/productos).
 *
 * El riel elige QUÉ PEDIDO se mira, no un dominio temático: cada botón es uno
 * de los últimos pedidos confirmados. Las cuatro tarjetas fijas son los
 * cuatro ángulos de ese pedido (Pedido, Productos, Composición, Historial).
 * Ver lib/agentes-detalle-venta-b18.ts para el detalle del mapeo.
 */
export default function PaginaDetalleVentas() {
  const { dataset, cargando, fmt } = useApp();

  const contrato = useMemo(() => construirDetalleVentaB18(dataset, fmt), [dataset, fmt]);

  if (cargando) return <SkeletonPagina />;

  if (contrato.categorias.length === 0) {
    return (
      <main className="b18-prototype-page">
        <header className="b18-prototype-title">
          <div>
            <p>{contrato.eyebrow}</p>
            <h1>
              Detalle <span>de venta</span>
            </h1>
          </div>
          <BarraUsuario dataset={dataset} modulo="ventas" />
        </header>
        <p className="p-8 text-sm text-[#667793]">No hay pedidos confirmados disponibles.</p>
      </main>
    );
  }

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Detalle <span>de venta</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="ventas" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
