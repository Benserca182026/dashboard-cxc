"use client";

// Detalle completo de facturas EXCLUIDAS del aging (pagada / anulada / sin
// fecha de vencimiento). Vive en una ruta aparte — NO en el riel principal
// (components/Sidebar.tsx) — porque con datos reales esta lista puede tener
// miles de filas (2958 con el dataset actual): meterla entera dentro de
// "/aging" hacía esa página enorme e imposible de recorrer. La evidencia
// sigue siendo siempre visible (nunca en modal ni acordeón, Paso 6 §2) — sólo
// que ahora vive en su propia página con búsqueda y paginación, en vez de un
// <ul> con miles de <li>.

import { useState } from "react";
import Link from "next/link";
import { SkeletonPagina } from "@/components/Basicos";
import { calcularAging, fmtMoneda, type FacturaExcluida } from "@/lib/calculos";
import { useApp } from "@/lib/store";

const MOTIVO_ETIQUETA: Record<FacturaExcluida["motivo"], string> = {
  pagada: "Pagada",
  anulada: "Anulada",
  sin_fecha_vencimiento: "Sin fecha de vencimiento",
};

export default function PaginaExcluidas() {
  const { dataset, cargando, fechaCorte } = useApp();
  const [busqueda, setBusqueda] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState<FacturaExcluida["motivo"] | "todos">("todos");
  const [pagina, setPagina] = useState(0);
  const porPagina = 25;

  if (cargando) return <SkeletonPagina />;

  const aging = calcularAging(dataset, fechaCorte);
  const nombreCliente = (id: string) =>
    dataset.clientes.find((c) => c.id_cliente === id)?.nombre_cliente ?? id;
  const fmt = (n: number) => fmtMoneda(n, dataset.fuente === "odoo-real" ? "GTQ" : "USD");

  const porMotivo = new Map<FacturaExcluida["motivo"], { n: number; saldo: number }>();
  for (const e of aging.excluidas) {
    const acc = porMotivo.get(e.motivo) ?? { n: 0, saldo: 0 };
    acc.n++;
    acc.saldo += e.saldo;
    porMotivo.set(e.motivo, acc);
  }

  const q = busqueda.trim().toLowerCase();
  const filtradas = aging.excluidas.filter((e) => {
    if (filtroMotivo !== "todos" && e.motivo !== filtroMotivo) return false;
    if (q === "") return true;
    return (
      e.factura.numero_factura.toLowerCase().includes(q) ||
      nombreCliente(e.factura.id_cliente).toLowerCase().includes(q)
    );
  });

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtradas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/aging" className="text-sm font-medium text-tintaSuave hover:text-tinta">
          ← Volver a Aging
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-tinta">
          Facturas excluidas del aging ({aging.excluidas.length})
        </h1>
        <p className="mt-1 text-sm text-tintaSuave">
          Corte {fechaCorte} · Fuente: {dataset.fuente}. Excluida no significa perdida: es una
          factura con saldo 0 (pagada/anulada) o sin fecha de vencimiento para clasificar por
          tramo — nunca se le inventa una fecha.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFiltroMotivo("todos"); setPagina(0); }}
          className={`rounded-pastilla border px-3.5 py-1.5 text-xs font-medium ${
            filtroMotivo === "todos" ? "pastilla-activa border-tinta" : "border-white/90 bg-white/70 text-tinta/80 shadow-flotante"
          }`}
        >
          Todos · {aging.excluidas.length}
        </button>
        {[...porMotivo.entries()].map(([motivo, { n, saldo }]) => (
          <button
            key={motivo}
            onClick={() => { setFiltroMotivo(motivo); setPagina(0); }}
            className={`rounded-pastilla border px-3.5 py-1.5 text-xs font-medium ${
              filtroMotivo === motivo ? "pastilla-activa border-tinta" : "border-white/90 bg-white/70 text-tinta/80 shadow-flotante"
            }`}
          >
            {MOTIVO_ETIQUETA[motivo]} · {n} · {fmt(saldo)}
          </button>
        ))}
      </div>

      <input
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }}
        placeholder="Buscar factura o cliente…"
        className="w-72 rounded-pastilla border border-white/90 bg-white/70 px-4 py-2 text-sm text-tinta shadow-flotante outline-none focus:border-tinta"
      />

      <div className="overflow-x-auto rounded-tarjeta bg-white/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/80 bg-white/40 text-left text-[11px] font-semibold uppercase tracking-wide text-etapa">
              <th className="px-5 py-3">Factura</th>
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Motivo</th>
              <th className="px-5 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.factura.id_factura} className="border-b border-white/70 last:border-0">
                <td className="px-5 py-2.5 font-medium text-tinta">{e.factura.numero_factura}</td>
                <td className="px-5 py-2.5 text-tinta/80">{nombreCliente(e.factura.id_cliente)}</td>
                <td className="px-5 py-2.5 text-tintaSuave">{MOTIVO_ETIQUETA[e.motivo]}</td>
                <td className="px-5 py-2.5 text-right tabular-nums text-tinta/80">{fmt(e.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-tintaSuave">
        <span>
          Página {paginaActual + 1} de {totalPaginas} · {filtradas.length} filas
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={paginaActual === 0}
            onClick={() => setPagina(paginaActual - 1)}
            className="rounded-pastilla border border-white/90 bg-white/70 px-3 py-1 shadow-flotante disabled:opacity-40"
          >
            ‹
          </button>
          <button
            disabled={paginaActual >= totalPaginas - 1}
            onClick={() => setPagina(paginaActual + 1)}
            className="rounded-pastilla border border-white/90 bg-white/70 px-3 py-1 shadow-flotante disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
