"use client";

import { useMemo } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirVendedoresB18 } from "@/lib/agentes-vendedores-b18";
import { useApp } from "@/lib/store";

/**
 * VENDEDORES sobre el molde B18 (referencia visual: /ventas/productos).
 *
 * Es la primera página del proyecto que NO lee el snapshot de Supabase: sus
 * cifras vienen de una lectura viva de Odoo, fechada al segundo, porque el
 * vendedor no existe en el snapshot — el importador lo lee y lo descarta (ver
 * scripts/importar-ventas-odoo.mjs:17).
 *
 * La lógica y las cifras viven en lib/agentes-vendedores-b18.ts y
 * lib/odoo-lectura-viva.ts. Esta página sólo dibuja.
 */
export default function PaginaVendedores() {
  const { dataset } = useApp();

  const contrato = useMemo(() => construirVendedoresB18(), []);

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            Vendedores <span>y cartera asignada</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="ventas" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
