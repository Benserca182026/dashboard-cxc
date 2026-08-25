// Carga saldos_odoo — el aging YA CALCULADO por Odoo (reporte "Vencido por
// cobrar"), cargado por scripts/importar-saldos-odoo.mjs — para comparar
// contra lo que la app misma clasifica desde facturas (lib/calculos.ts).
//
// Por qué los dos números NO coinciden exacto, y eso es esperado (verificado
// 2026-08-19): el total que arma la app suma facturas.saldo_pendiente_odoo
// por FACTURA. El total que declara Odoo en "Vencido por cobrar" es por
// CLIENTE, y ahí Odoo también descuenta pagos recibidos que todavía no están
// aplicados a ninguna factura puntual (anticipos, pagos sin conciliar). Esa
// diferencia — real, no un bug — es justamente lo que esta comparación hace
// visible en vez de esconder.

import type { BucketAging } from "./types";

const SUPABASE_URL = "https://jfvmuemyjcdesnoqeaix.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";

interface FilaSaldoOdoo {
  tramo: "actual" | "1-30" | "31-60" | "61-90" | "91-120" | "older" | "total";
  monto: number;
  fecha_corte: string;
}

export interface ComparacionOdoo {
  porBucket: Record<BucketAging, number>;
  total: number;
  fechaCorte: string;
}

// El aging propio tiene 5 buckets (actual · 1-30 · 31-60 · 61-90 · 90+); el
// reporte de Odoo trae 6 tramos (separa 91-120 de "older" / más viejo). El
// bucket "90+" de la app es la suma de esos dos tramos de Odoo.
export async function cargarComparacionOdoo(): Promise<ComparacionOdoo> {
  const filas: FilaSaldoOdoo[] = [];
  let desde = 0;
  const TAMANO_PAGINA = 1000;
  for (;;) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/saldos_odoo?select=tramo,monto,fecha_corte`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${desde}-${desde + TAMANO_PAGINA - 1}`,
      },
    });
    if (!resp.ok) throw new Error(`No se pudo cargar saldos_odoo (HTTP ${resp.status}).`);
    const pagina = (await resp.json()) as FilaSaldoOdoo[];
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }

  const porBucket: Record<BucketAging, number> = { actual: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let total = 0;
  let fechaCorte = "";
  for (const f of filas) {
    fechaCorte = f.fecha_corte;
    const monto = Number(f.monto);
    if (f.tramo === "total") { total += monto; continue; }
    if (f.tramo === "91-120" || f.tramo === "older") { porBucket["90+"] += monto; continue; }
    porBucket[f.tramo] += monto;
  }
  return { porBucket, total: Math.round(total * 100) / 100, fechaCorte };
}
