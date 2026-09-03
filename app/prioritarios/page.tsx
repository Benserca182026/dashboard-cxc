"use client";

import { useMemo } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirPrioritariosB18 } from "@/lib/agentes-prioritarios-b18";
import { useApp } from "@/lib/store";

/**
 * CLIENTES PRIORITARIOS sobre el molde B18 (referencia: /ventas/productos).
 *
 * La página no dibuja: describe. Toda la estructura visual —riel, dos agentes
 * por lado, reporte al centro, B18 cerrado— vive en MoldeB18, y los datos
 * salen de analizarPrioritariosComercial()/prioridadSimulada(), ya probadas.
 */
export default function PaginaPrioritarios() {
  const { dataset, cargando, fechaCorte, fmt, gestiones } = useApp();

  const contrato = useMemo(
    () => construirPrioritariosB18(dataset, fechaCorte, gestiones, fmt),
    [dataset, fechaCorte, gestiones, fmt]
  );

  if (cargando) return <SkeletonPagina />;

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Clientes <span>prioritarios</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="prioritarios" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
