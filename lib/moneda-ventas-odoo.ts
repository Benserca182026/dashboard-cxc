import type { Moneda } from "./types";

/**
 * Control compacto de la reconciliación hecha el 2026-08-25.
 *
 * Los 3,189 pedidos `sale` del Supabase operativo coincidieron por id con la
 * extracción directa de Odoo (3,209 pedidos `sale` al corte más reciente).
 * En la población operativa hay 3,188 pedidos GTQ y una única excepción USD.
 * La regla sólo se activa cuando la lista completa conserva la misma huella;
 * una importación futura distinta vuelve a quedar sin moneda hasta validarse.
 */
export const SNAPSHOT_MONEDA_VENTAS = {
  corteOdoo: "2026-08-25T18:48:13.548Z",
  corteSupabase: "2026-08-19",
  pedidos: 3189,
  huellaIds: "25a4abd2",
  monedaPredeterminada: "GTQ" as const,
  excepciones: {
    "VTA-S00013": "USD",
  } satisfies Record<string, Moneda>,
};

function fnv1a32(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function coincideSnapshotMonedaVentas(idsVenta: string[]): boolean {
  if (idsVenta.length !== SNAPSHOT_MONEDA_VENTAS.pedidos) return false;
  const huella = fnv1a32([...idsVenta].sort().join("\n"));
  return huella === SNAPSHOT_MONEDA_VENTAS.huellaIds;
}

export function monedaVentaSegunSnapshot(idVenta: string): Moneda {
  const excepciones: Record<string, Moneda> = SNAPSHOT_MONEDA_VENTAS.excepciones;
  return excepciones[idVenta] ?? SNAPSHOT_MONEDA_VENTAS.monedaPredeterminada;
}
