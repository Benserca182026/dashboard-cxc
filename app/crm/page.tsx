"use client";

import { useMemo } from "react";
import { BarraUsuario } from "@/components/BarraUsuario";
import { MoldeB18 } from "@/components/commercial/MoldeB18";
import { construirCrmB18 } from "@/lib/agentes-crm-b18";
import { useApp } from "@/lib/store";

/**
 * CRM COMERCIAL sobre el molde B18, en estado honesto "sin fuente".
 *
 * Verificado contra Odoo vivo: crm.lead devuelve 0 registros y crm.stage
 * devuelve 4 etapas configuradas. El modulo esta instalado y listo, pero
 * nadie ha creado una oportunidad. No es falta de permiso ni de API.
 *
 * Por eso ningun KPI dice "0%" y todos dicen "Sin dato".
 */
export default function PaginaCRM() {
  const { dataset } = useApp();

  const contrato = useMemo(() => construirCrmB18(), []);

  return (
    <main className="b18-prototype-page">
      <header className="b18-prototype-title">
        <div>
          <p>{contrato.eyebrow}</p>
          <h1>
            CRM <span>comercial</span>
          </h1>
        </div>
        <BarraUsuario dataset={dataset} modulo="ventas" />
      </header>
      <MoldeB18 contrato={contrato} />
    </main>
  );
}
