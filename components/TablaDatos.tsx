"use client";

// Tabla genérica propia: búsqueda de texto libre, orden por columna
// (asc/desc/ninguno), paginación con selector de tamaño y estado vacío.
// Patrón conceptual (toolbar + columnas declarativas + paginación inferior)
// tomado de la referencia visual; implementación desde cero sin librerías.

import React, { useMemo, useState } from "react";
import { EstadoVacio } from "./Basicos";

export interface ColumnaDef<T> {
  clave: string;
  titulo: string;
  /** Valor para ordenar/buscar. */
  valor: (fila: T) => string | number;
  /** Render opcional (por defecto muestra `valor`). */
  render?: (fila: T) => React.ReactNode;
  alinear?: "izquierda" | "derecha";
  ordenable?: boolean;
}

type DireccionOrden = "asc" | "desc" | null;

export function TablaDatos<T>({
  filas,
  columnas,
  textoBuscar = "Buscar…",
  mensajeVacio = "Sin resultados con los filtros actuales.",
  filtrosExtra,
}: {
  filas: T[];
  columnas: ColumnaDef<T>[];
  textoBuscar?: string;
  mensajeVacio?: string;
  /** Controles adicionales que la página quiera insertar en la barra superior. */
  filtrosExtra?: React.ReactNode;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [ordenPor, setOrdenPor] = useState<string | null>(null);
  const [direccion, setDireccion] = useState<DireccionOrden>(null);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(10);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q === "") return filas;
    return filas.filter((f) =>
      columnas.some((c) => String(c.valor(f)).toLowerCase().includes(q))
    );
  }, [filas, columnas, busqueda]);

  const ordenadas = useMemo(() => {
    if (!ordenPor || !direccion) return filtradas;
    const col = columnas.find((c) => c.clave === ordenPor);
    if (!col) return filtradas;
    return [...filtradas].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return direccion === "asc" ? cmp : -cmp;
    });
  }, [filtradas, ordenPor, direccion, columnas]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = ordenadas.slice(
    paginaActual * porPagina,
    (paginaActual + 1) * porPagina
  );

  const clicOrden = (clave: string) => {
    if (ordenPor !== clave) {
      setOrdenPor(clave);
      setDireccion("asc");
    } else if (direccion === "asc") setDireccion("desc");
    else {
      setOrdenPor(null);
      setDireccion(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(0);
          }}
          placeholder={textoBuscar}
          className="w-56 rounded-lg border border-borde bg-tarjeta px-3 py-2 text-sm outline-none focus:border-acento"
        />
        {filtrosExtra}
        {busqueda !== "" && (
          <button
            onClick={() => setBusqueda("")}
            className="rounded-lg border border-borde px-3 py-2 text-sm text-tintaSuave hover:bg-fondo"
          >
            Limpiar
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio mensaje={mensajeVacio} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-borde bg-tarjeta">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs text-tintaSuave">
                {columnas.map((c) => (
                  <th key={c.clave} className="px-4 py-3 font-medium">
                    {c.ordenable !== false ? (
                      <button
                        onClick={() => clicOrden(c.clave)}
                        className="inline-flex items-center gap-1 hover:text-tinta"
                      >
                        {c.titulo}
                        <span aria-hidden className="text-[10px]">
                          {ordenPor === c.clave
                            ? direccion === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      c.titulo
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila, i) => (
                <tr key={i} className="border-b border-borde last:border-0">
                  {columnas.map((c) => (
                    <td
                      key={c.clave}
                      className={`px-4 py-3 ${
                        c.alinear === "derecha" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {c.render ? c.render(fila) : String(c.valor(fila))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-tintaSuave">
        <label className="flex items-center gap-2">
          Filas por página
          <select
            value={porPagina}
            onChange={(e) => {
              setPorPagina(Number(e.target.value));
              setPagina(0);
            }}
            className="rounded-lg border border-borde bg-tarjeta px-2 py-1"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span>
            Página {paginaActual + 1} de {totalPaginas} · {ordenadas.length} filas
          </span>
          <button
            disabled={paginaActual === 0}
            onClick={() => setPagina(paginaActual - 1)}
            className="rounded-lg border border-borde px-3 py-1 disabled:opacity-40"
          >
            ‹
          </button>
          <button
            disabled={paginaActual >= totalPaginas - 1}
            onClick={() => setPagina(paginaActual + 1)}
            className="rounded-lg border border-borde px-3 py-1 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
