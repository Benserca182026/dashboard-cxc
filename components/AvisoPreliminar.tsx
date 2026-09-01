"use client";

import { usePathname } from "next/navigation";
import { useDecisionV2 } from "@/lib/decision-v2-client";

export function AvisoPreliminar() {
  const ruta = usePathname();
  const { bundle, origen, cargandoRemoto } = useDecisionV2();
  const { complete, partial, blocked, total } = bundle.coverage;
  if (ruta === "/login" || ruta === "/ventas/productos") return null;

  return (
    <aside
      role="note"
      aria-label="Estado del corte de datos"
      className="mb-5 rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 shadow-flotante backdrop-blur-xl print:border-black"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/*
            El 25-ago NO es el corte comercial: es cuándo se EXTRAJO el snapshot.
            Decía "Contenedor de snapshot Odoo · 25 ago 2026", y encima de una
            pantalla cuyo corte efectivo es el 19-ago se leía como si el corte
            fuera el 25. Son dos hechos distintos y ahora se nombran distinto:
            acá va la extracción, y el corte lo declara cada reporte.
          */}
          <p className="text-[12.5px] font-bold tracking-[-0.01em] text-tinta">Snapshot extraído el 25-ago-2026. El corte efectivo se declara en cada reporte.</p>
          <p className="mt-1 text-[11.5px] leading-snug text-[#6b6f78]">Cobertura declarada: {complete} completos · {partial} parciales · {blocked} bloqueados = {total}. La validación efectiva se lee en cada KPI.</p>
        </div>
        <span className="rounded-full bg-[#16181d] px-3 py-1.5 text-[10px] font-semibold text-white">
          {cargandoRemoto ? "sincronizando V2" : origen === "supabase-v2" ? "Supabase V2 activo" : "snapshot local declarado"}
        </span>
      </div>
    </aside>
  );
}
