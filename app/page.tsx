"use client";

import { useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirCuadroDeMando } from "@/lib/agentes-cuadro-mando";
import { useApp } from "@/lib/store";

/**
 * CUADRO DE MANDO sobre el molde B18 (referencia: /ventas/productos).
 *
 * La página no dibuja: describe. Toda la estructura visual —riel, dos agentes
 * por lado, reporte al centro, B18 cerrado— vive en MoldeB18, y los datos
 * salen de funciones de cálculo que ya estaban probadas.
 */
export default function PaginaCuadroDeMando() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();

  const contrato = useMemo(
    () => construirCuadroDeMando(dataset, fechaCorte, fmt),
    [dataset, fechaCorte, fmt]
  );

  if (cargando) return <SkeletonPagina />;

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Cuadro <span>de mando</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="cartera" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
