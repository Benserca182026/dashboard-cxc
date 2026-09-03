"use client";

import { useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirInventarioB18 } from "@/lib/agentes-inventario-b18";
import { useApp } from "@/lib/store";

/**
 * INVENTARIO sobre el molde B18 (referencia: /ventas/productos).
 *
 * La página no dibuja: describe. Toda la estructura visual vive en MoldeB18,
 * y los datos salen de analiticaInventario, que ya estaba probada.
 */
export default function PaginaInventario() {
  const { dataset, cargando, fmt } = useApp();

  const contrato = useMemo(() => construirInventarioB18(dataset, fmt), [dataset, fmt]);

  if (cargando) return <SkeletonPagina />;

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            <span>Inventario</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="inventario" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
