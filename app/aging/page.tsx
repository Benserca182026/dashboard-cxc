"use client";

import { useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirAgingB18 } from "@/lib/agentes-aging-b18";
import { useApp } from "@/lib/store";

/**
 * AGING DE CARTERA sobre el molde B18 (referencia: /ventas/productos).
 *
 * La página no dibuja: describe. Toda la estructura visual —riel, dos
 * agentes por lado, reporte al centro, B18 cerrado— vive en MoldeB18, y los
 * datos salen de calcularAging / analizarAgingComercial / analizarSeguimientoComercial,
 * ya probados. /aging/detalle, /aging/excluidas y /aging/verificacion quedan
 * igual: siguen siendo el detalle factura por factura al que este resumen apunta.
 */
export default function PaginaAging() {
  const { dataset, cargando, fechaCorte, fmt, gestiones } = useApp();

  const contrato = useMemo(
    () => construirAgingB18(dataset, fechaCorte, gestiones, fmt),
    [dataset, fechaCorte, gestiones, fmt]
  );

  if (cargando) return <SkeletonPagina />;

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Aging <span>de cartera</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="aging" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
