"use client";

import { useMemo } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirCanalesB18 } from "@/lib/agentes-canales-b18";
import { useApp } from "@/lib/store";

/**
 * CANALES Y TIPO DE CLIENTE sobre el molde B18 (referencia: /ventas/productos).
 *
 * A diferencia de las demás páginas B18, acá no hay ningún dato real que
 * traducir: el dataset no trae campo de canal ni de tipo de cliente. La
 * página igual usa el molde único —riel, dos agentes por lado, reporte al
 * centro, B18 cerrado— pero con las cuatro categorías en su único estado
 * honesto posible: "sin fuente conectada". Ver `lib/agentes-canales-b18.ts`.
 */
export default function PaginaCanalesVentas() {
  const { dataset, fmt } = useApp();

  const contrato = useMemo(() => construirCanalesB18(fmt), [fmt]);

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Canales <span>y tipo de cliente</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="ventas" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
