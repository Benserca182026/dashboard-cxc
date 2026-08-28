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
          <p className="text-[12.5px] font-bold tracking-[-0.01em] text-tinta">Contenedor de snapshot Odoo · 25 ago 2026, 10:00–10:05</p>
          <p className="mt-1 text-[11.5px] leading-snug text-[#6b6f78]">Cobertura declarada: {complete} completos · {partial} parciales · {blocked} bloqueados = {total}. El corte y la validación efectiva se leen en cada KPI.</p>
        </div>
        <span className="rounded-full bg-[#16181d] px-3 py-1.5 text-[10px] font-semibold text-white">
          {cargandoRemoto ? "sincronizando V2" : origen === "supabase-v2" ? "Supabase V2 activo" : "snapshot local declarado"}
        </span>
      </div>
    </aside>
  );
}
