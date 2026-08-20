"use client";

// Detalle de facturas clasificadas — página secundaria, se llega con un clic
// desde /aging (la leyenda de buckets ahora navega para acá en vez de
// filtrar in-place). Búsqueda, orden y paginación intactos, sin cambios de
// lógica — sólo cambió dónde vive.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SkeletonPagina } from "@/components/Basicos";
import { calcularAging, fmtMoneda, type FacturaClasificada } from "@/lib/calculos";
import { BUCKETS, type BucketAging, type EstadoFactura } from "@/lib/types";
import { BUCKET_INFO } from "@/lib/bucketInfo";
import { useApp } from "@/lib/store";
import { UMBRALES } from "@/lib/argumento";

const ESTADO_ESTILO: Record<EstadoFactura, { etiqueta: string; clase: string }> = {
  abierta: { etiqueta: "Abierta", clase: "bg-blue-50 text-blue-700 border-blue-200" },
  pagada: { etiqueta: "Pagada", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  disputada: { etiqueta: "Disputada", clase: "bg-amber-50 text-amber-800 border-amber-300" },
  anulada: { etiqueta: "Anulada", clase: "bg-slate-100 text-slate-600 border-slate-300" },
};

type DireccionOrden = "asc" | "desc" | null;
type ClaveColumna = "factura" | "cliente" | "vence" | "dias" | "bucket" | "saldo" | "estado";

const COLUMNAS: { clave: ClaveColumna; titulo: string; alinear?: "derecha" }[] = [
  { clave: "factura", titulo: "Factura" },
  { clave: "cliente", titulo: "Cliente" },
  { clave: "vence", titulo: "Vencimiento" },
  { clave: "dias", titulo: "Días de atraso", alinear: "derecha" },
  { clave: "bucket", titulo: "Bucket" },
  { clave: "saldo", titulo: "Saldo pendiente", alinear: "derecha" },
  { clave: "estado", titulo: "Estado" },
];

function ContenidoDetalle() {
  const { dataset, cargando, fechaCorte } = useApp();
  const params = useSearchParams();
  const bucketInicial = params.get("bucket") as BucketAging | null;

  const [filtroBucket, setFiltroBucket] = useState<BucketAging | "todos">(
    bucketInicial && BUCKETS.includes(bucketInicial) ? bucketInicial : "todos"
  );
  const [busqueda, setBusqueda] = useState("");
  const [ordenPor, setOrdenPor] = useState<ClaveColumna | null>(null);
  const [direccion, setDireccion] = useState<DireccionOrden>(null);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(10);

  if (cargando) return <SkeletonPagina />;

  const aging = calcularAging(dataset, fechaCorte);
  const nombreCliente = (id: string) =>
    dataset.clientes.find((c) => c.id_cliente === id)?.nombre_cliente ?? id;
  const fmt = (n: number) => fmtMoneda(n, dataset.fuente === "odoo-real" ? "GTQ" : "USD");

  const filasBucket =
    filtroBucket === "todos"
      ? aging.clasificadas
      : aging.clasificadas.filter((f) => f.bucket === filtroBucket);

  const valorColumna = (f: FacturaClasificada, clave: ClaveColumna): string | number => {
    switch (clave) {
      case "factura": return f.factura.numero_factura;
      case "cliente": return nombreCliente(f.factura.id_cliente);
      case "vence": return f.factura.fecha_vencimiento ?? "";
      case "dias": return f.dias;
      case "bucket": return f.bucket;
      case "saldo": return f.saldo;
      case "estado": return f.estado;
    }
  };

  const q = busqueda.trim().toLowerCase();
  const filtradas =
    q === ""
      ? filasBucket
      : filasBucket.filter(
          (f) =>
            f.factura.numero_factura.toLowerCase().includes(q) ||
            nombreCliente(f.factura.id_cliente).toLowerCase().includes(q)
        );

  const ordenadas =
    !ordenPor || !direccion
      ? filtradas
      : [...filtradas].sort((a, b) => {
          const va = valorColumna(a, ordenPor);
          const vb = valorColumna(b, ordenPor);
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb));
          return direccion === "asc" ? cmp : -cmp;
        });

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = ordenadas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);

  const clicOrden = (clave: ClaveColumna) => {
    if (ordenPor !== clave) {
      setOrdenPor(clave);
      setDireccion("asc");
    } else if (direccion === "asc") setDireccion("desc");
    else {
      setOrdenPor(null);
      setDireccion(null);
    }
    setPagina(0);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/aging" className="text-sm font-medium text-tintaSuave hover:text-tinta">
          ← Volver a Aging
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-tinta">
          Detalle de facturas clasificadas ({aging.clasificadas.length})
        </h1>
        <p className="mt-1 text-sm text-tintaSuave">
          Corte {fechaCorte} · Fuente: {dataset.fuente}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="list" aria-label="Filtro por bucket">
        <button
          type="button"
          onClick={() => { setFiltroBucket("todos"); setPagina(0); }}
          className={`rounded-pastilla border px-3.5 py-1.5 text-xs font-medium ${
            filtroBucket === "todos" ? "pastilla-activa border-tinta" : "border-white/90 bg-white/70 text-tinta/80 shadow-flotante"
          }`}
        >
          Todos · {aging.clasificadas.length}
        </button>
        {BUCKETS.map((b) => {
          const info = BUCKET_INFO[b];
          const resaltado = filtroBucket === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => { setFiltroBucket(resaltado ? "todos" : b); setPagina(0); }}
              className={`flex items-center gap-2 rounded-pastilla border px-3.5 py-1.5 text-xs font-medium outline-none transition ${
                resaltado ? "pastilla-activa border-tinta" : "border-white/90 bg-white/70 text-tinta/80 shadow-flotante hover:shadow-flotanteAlta"
              }`}
            >
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: resaltado ? "#ffffff" : info.color }} />
              {info.etiqueta}
              <span className={`tabular-nums ${resaltado ? "text-white/70" : "text-tintaSuave"}`}>{fmt(aging.totalesPorBucket[b])}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }}
          placeholder="Buscar factura o cliente…"
          className="w-72 rounded-pastilla border border-white/90 bg-white/70 px-4 py-2 text-sm text-tinta shadow-flotante outline-none focus:border-tinta"
        />
        {busqueda !== "" && (
          <button
            onClick={() => setBusqueda("")}
            className="rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-2 text-sm text-tintaSuave shadow-flotante hover:shadow-flotanteAlta"
          >
            Limpiar
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-tarjeta bg-white/70 p-10 text-center text-sm text-tintaSuave">
          No hay facturas abiertas para clasificar con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-tarjeta bg-white/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/80 bg-white/40 text-left text-[11px] font-semibold uppercase tracking-wide text-etapa">
                {COLUMNAS.map((c) => (
                  <th key={c.clave} className="px-5 py-3.5">
                    <button
                      onClick={() => clicOrden(c.clave)}
                      className={`inline-flex items-center gap-1 hover:text-tinta ${c.alinear === "derecha" ? "flex-row-reverse" : ""}`}
                    >
                      {c.titulo}
                      <span aria-hidden className="text-[10px] text-etapa opacity-70">
                        {ordenPor === c.clave ? (direccion === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const info = BUCKET_INFO[f.bucket];
                const estado = ESTADO_ESTILO[f.estado];
                return (
                  <tr key={f.factura.id_factura} className="border-b border-white/70 last:border-0 hover:bg-white/60">
                    <td className="px-5 py-3.5 font-medium text-tinta">{f.factura.numero_factura}</td>
                    <td className="px-5 py-3.5 text-tinta/80">{nombreCliente(f.factura.id_cliente)}</td>
                    <td className="px-5 py-3.5 text-tintaSuave">{f.factura.fecha_vencimiento ?? ""}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-tinta/80">{f.dias}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-pastilla px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: info.colorSuave, color: info.color }}>
                        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: info.color }} />
                        {info.etiqueta}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-tinta">{fmt(f.saldo)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-pastilla border px-2.5 py-0.5 text-xs font-medium ${estado.clase}`}>{estado.etiqueta}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-tintaSuave">
        <label className="flex items-center gap-2">
          Filas por página
          <select
            value={porPagina}
            onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(0); }}
            className="rounded-pastilla border border-white/90 bg-white/70 px-3 py-1 shadow-flotante"
          >
            {[5, 10, 20, 50].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span>Página {paginaActual + 1} de {totalPaginas} · {ordenadas.length} filas</span>
          <button disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)} className="rounded-pastilla border border-white/90 bg-white/70 px-3 py-1 shadow-flotante disabled:opacity-40">‹</button>
          <button disabled={paginaActual >= totalPaginas - 1} onClick={() => setPagina(paginaActual + 1)} className="rounded-pastilla border border-white/90 bg-white/70 px-3 py-1 shadow-flotante disabled:opacity-40">›</button>
        </div>
      </div>

      <p className="text-[10.5px] leading-relaxed text-[#a0a2a6]">
        Umbrales del argumento: concentración {UMBRALES.concentracionAlta}% del vencido · tramo
        dominante {UMBRALES.tramoDominante}% del vencido. 🟡 Pendientes de validación por Finanzas.
      </p>
    </div>
  );
}

export default function PaginaDetalle() {
  return (
    <Suspense fallback={<SkeletonPagina />}>
      <ContenidoDetalle />
    </Suspense>
  );
}
