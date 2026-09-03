"use client";

import { useMemo } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirEmpresaRegionB18 } from "@/lib/agentes-empresa-region-b18";
import { useApp } from "@/lib/store";

/**
 * EMPRESA Y REGIÓN sobre el molde B18, leyendo Odoo vivo.
 *
 * Página mixta por resultado de la medición, no por diseño: tres categorías
 * territoriales se calculan con datos reales (res.partner.state_id está
 * poblado en 371 de 417 clientes) y la cuarta —empresa— declara que sólo
 * existe una compañía en res.company, así que no hay comparación posible.
 *
 * Cifras y fórmulas en lib/agentes-empresa-region-b18.ts.
 */
export default function PaginaEmpresaRegion() {
  const { dataset } = useApp();

  const contrato = useMemo(() => construirEmpresaRegionB18(), []);

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Empresa <span>y región</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="ventas" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
