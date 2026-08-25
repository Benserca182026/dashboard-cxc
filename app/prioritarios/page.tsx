"use client";

// M3 — Clientes prioritarios (paso-3-modulos-propios.md).
// El score es SIMULADO (pesos ficticios) — el plan maestro exige fórmula
// aprobada por Finanzas antes de usar un score real.
//
// Reorientación comercial: la página abre con agentes de decisión, un Top 10
// accionable y un cuadrante impacto × urgencia. La worklist completa conserva
// búsqueda, orden y paginación como capa operativa inferior.
//
// NADA de la lógica de la worklist se movió: el orden por score, la búsqueda,
// la paginación y la cascada de acción sugerida (lib/simulados.ts) siguen
// exactamente como estaban. Lo que cambió es DÓNDE vive cada cosa.

import { SkeletonPagina } from "@/components/Basicos";
import { BannerFicticioPremium } from "@/components/ResumenPremium";
import { SUPUESTOS_SCORING, type FilaPrioridad } from "@/lib/simulados";
import { useApp } from "@/lib/store";
import { useMemo, useState, type ReactNode } from "react";
import { Encabezado } from "@/components/Encabezado";
import { DecisionPanelV2 } from "@/components/DecisionPanelV2";
import { AGENTES_PRIORITARIOS, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes } from "@/components/Argumento";
import {
  AgentesComercialesCobranza,
  CuadrantePrioridad,
} from "@/components/commercial/CobranzaComercial";
import { analizarPrioritariosComercial } from "@/lib/commercial-cobranza";

type DireccionOrden = "asc" | "desc" | null;
type ClaveColumna = "score" | "cliente" | "saldo" | "dias" | "accion";

interface ColumnaLocal {
  clave: ClaveColumna;
  titulo: string;
  valor: (f: FilaPrioridad) => string | number;
  render?: (f: FilaPrioridad) => ReactNode;
  alinear?: "derecha";
}

const SECCIONES = [
  { id: "sec-decisiones-v2", etiqueta: "Decisiones" },
  { id: "sec-comercial", etiqueta: "Top 10" },
  { id: "sec-worklist", etiqueta: "Worklist" },
];

export default function PaginaPrioritarios() {
  const { dataset, cargando, fechaCorte, fmt, gestiones } = useApp();
  // El dinero lo pinta el formateador del store: es el ÚNICO lugar donde una
  // cifra cambia de moneda, y lo hace al PINTAR. Todo lo de arriba (umbrales,
  // porcentajes, comparaciones, cuadres) se calculó en la moneda de registro y
  // no se entera de esta vista. Ver components/ControlMoneda.tsx.
  const [busqueda, setBusqueda] = useState("");
  const [ordenPor, setOrdenPor] = useState<ClaveColumna | null>(null);
  const [direccion, setDireccion] = useState<DireccionOrden>(null);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(10);

  const comercial = useMemo(
    () => analizarPrioritariosComercial(dataset, fechaCorte, gestiones),
    [dataset, fechaCorte, gestiones]
  );
  const filas = useMemo<FilaPrioridad[]>(
    () =>
      cargando
        ? []
        : comercial.filas.map((fila) => ({
            idCliente: fila.idCliente,
            nombreCliente: fila.cliente,
            saldoTotal: fila.saldo,
            diasMaxAtraso: fila.dias,
            enDisputa: fila.enDisputa,
            scoreSimulado: fila.score,
            accionSugerida: fila.proximaAccion,
          })),
    [cargando, comercial.filas]
  );

  const columnas: ColumnaLocal[] = [
    {
      clave: "score",
      titulo: "Score (simulado)",
      valor: (f) => f.scoreSimulado,
      alinear: "derecha",
      render: (f) => (
        <span className="font-bold text-simulado tabular-nums">{f.scoreSimulado}</span>
      ),
    },
    { clave: "cliente", titulo: "Cliente", valor: (f) => f.nombreCliente },
    {
      clave: "saldo",
      titulo: "Saldo abierto",
      valor: (f) => f.saldoTotal,
      alinear: "derecha",
      render: (f) => fmt(f.saldoTotal),
    },
    {
      clave: "dias",
      titulo: "Días máx. de atraso",
      valor: (f) => f.diasMaxAtraso,
      alinear: "derecha",
    },
    {
      clave: "accion",
      titulo: "Acción sugerida",
      valor: (f) => f.accionSugerida,
      render: (f) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-pastilla border px-2.5 py-0.5 text-xs font-medium ${
            f.enDisputa
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-white/90 bg-white/70 text-tinta/80"
          }`}
        >
          <span aria-hidden className="opacity-40">
            {f.enDisputa ? "◆" : "→"}
          </span>
          {f.accionSugerida}
        </span>
      ),
    },
  ];

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q === "") return filas;
    return filas.filter((f) =>
      [f.scoreSimulado, f.nombreCliente, f.saldoTotal, f.diasMaxAtraso, f.accionSugerida].some(
        (v) => String(v).toLowerCase().includes(q)
      )
    );
  }, [filas, busqueda]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, ordenPor, direccion]);

  if (cargando) return <SkeletonPagina />;

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
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". Las
          automatizaciones declaradas acá son las de ESTE módulo: el score que
          cruza el umbral de escalamiento, no la cartera general. */}
      <Encabezado
        titulo="Clientes prioritarios"
        secciones={SECCIONES}
        dataset={dataset}
        modulo="prioritarios"
      />

      <DecisionPanelV2 modulo="prioritarios" />

      <section id="sec-comercial" className="scroll-mt-24 space-y-6">
        <AgentesComercialesCobranza agentes={comercial.agentes} fmt={fmt} />

        <div className="space-y-6">
          <LienzoConAgentes titulo="Top 10 · saldo, urgencia, dueño y siguiente paso">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <p className="max-w-xl text-[11px] leading-relaxed text-tintaSuave">
                Ranking por score simulado, con desempate por saldo y días. La probabilidad no existe en el dataset y se muestra explícitamente como no disponible.
              </p>
              <div className="text-right">
                <p className="text-xl font-bold tabular-nums text-tinta">{fmt(comercial.saldoTopDiez)}</p>
                <p className="text-[9px] font-bold uppercase tracking-[.08em] text-etapa">
                  saldo del Top 10 · {comercial.saldoTotal > 0 ? ((comercial.saldoTopDiez / comercial.saldoTotal) * 100).toFixed(1) : "0.0"}% del total
                </p>
              </div>
            </div>

            {comercial.topDiez.length === 0 ? (
              <div className="rounded-[18px] bg-white/60 p-10 text-center text-sm text-tintaSuave">
                No hay cuentas abiertas para priorizar.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[18px] border border-white/80 bg-white/65">
                <table className="w-full min-w-[920px] text-left text-[10.5px]">
                  <thead>
                    <tr className="border-b border-white bg-white/60 text-[9px] font-bold uppercase tracking-[.08em] text-etapa">
                      <th className="px-3 py-3"># / cliente</th>
                      <th className="px-3 py-3 text-right">Saldo</th>
                      <th className="px-3 py-3 text-right">Días</th>
                      <th className="px-3 py-3 text-right">Score</th>
                      <th className="px-3 py-3">Probabilidad</th>
                      <th className="px-3 py-3">Responsable</th>
                      <th className="px-3 py-3">Próxima acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comercial.topDiez.map((fila, indice) => (
                      <tr key={fila.idCliente} className="border-b border-white/80 align-top last:border-0">
                        <td className="px-3 py-3">
                          <div className="flex min-w-[190px] items-start gap-2">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${fila.enDisputa ? "bg-amber-500" : "bg-tinta"}`}>
                              {indice + 1}
                            </span>
                            <span className="font-semibold text-tinta">{fila.cliente}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-tinta">{fmt(fila.saldo)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-tinta">{fila.dias}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-simulado">{fila.score}</td>
                        <td className="px-3 py-3 text-tintaSuave">No disponible</td>
                        <td className="px-3 py-3 text-tintaSuave">{fila.responsable}</td>
                        <td className="max-w-[230px] px-3 py-3 font-medium text-tinta">
                          {fila.proximaAccion}
                          {fila.enDisputa && <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.06em] text-amber-700">disputa: no reclamar antes de resolver</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </LienzoConAgentes>

          <LienzoConAgentes titulo="Cuadrante de impacto × urgencia">
            <CuadrantePrioridad
              filas={comercial.topDiez}
              medianaSaldo={comercial.medianaSaldo}
              medianaDias={comercial.medianaDias}
              fmt={fmt}
            />
          </LienzoConAgentes>
        </div>
      </section>

      {/* La worklist: mismo orden por score, misma búsqueda, misma
          paginación de siempre, dentro del mismo envoltorio que el resto. */}
      <section id="sec-worklist" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Cuentas ordenadas por prioridad simulada"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_PRIORITARIOS} />}
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar cliente…"
              className="w-64 rounded-pastilla border border-white/90 bg-white/70 px-4 py-2 text-sm text-tinta shadow-flotante outline-none focus:border-tinta"
            />
            {busqueda !== "" && (
              <button
                onClick={() => setBusqueda("")}
                className="rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-2 text-sm text-tintaSuave shadow-flotante hover:shadow-flotanteAlta"
              >
                Limpiar
              </button>
            )}
            {ordenPor && direccion && (
              <span className="pastilla-activa inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium">
                Orden: {columnas.find((c) => c.clave === ordenPor)?.titulo}{" "}
                {direccion === "asc" ? "▲" : "▼"}
              </span>
            )}
          </div>

          {visibles.length === 0 ? (
            <div className="mt-3 rounded-tarjeta bg-white/70 p-10 text-center text-sm text-tintaSuave">
              No hay cuentas con saldo abierto para priorizar.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-tarjeta bg-white/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/80 bg-white/40 text-left text-[11px] font-semibold uppercase tracking-wide text-etapa">
                    {columnas.map((c) => (
                      <th key={c.clave} className="px-5 py-3.5">
                        <button
                          onClick={() => clicOrden(c.clave)}
                          className={`inline-flex items-center gap-1 hover:text-tinta ${
                            c.alinear === "derecha" ? "flex-row-reverse" : ""
                          }`}
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
                  {visibles.map((f, i) => (
                    <tr
                      key={f.idCliente}
                      className="entrada-suave border-b border-white/70 transition-colors last:border-0 hover:bg-white/60"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      {columnas.map((c) => (
                        <td
                          key={c.clave}
                          className={`px-5 py-3.5 text-tinta/80 ${
                            c.alinear === "derecha" ? "text-right tabular-nums" : ""
                          }`}
                        >
                          {c.render ? c.render(f) : String(c.valor(f))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-tintaSuave">
            <label className="flex items-center gap-2">
              Filas por página
              <select
                value={porPagina}
                onChange={(e) => {
                  setPorPagina(Number(e.target.value));
                  setPagina(0);
                }}
                className="rounded-pastilla border border-white/90 bg-white/70 px-3 py-1 shadow-flotante"
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

          {/* Avisos regulatorios: texto íntegro, conservado — sólo cambió de
              caja. Fecha de corte y supuestos del score, siempre a la vista. */}
          <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
            <p className="text-[11.5px] leading-snug text-[#85878c]">
              Fecha de corte: {fechaCorte} · Las cuentas en disputa se despriorizan y se rutean a
              «resolver disputa»
            </p>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-simulado">
              🟣 Simulación — pendiente de validación por Finanzas
            </p>
            <ul className="mt-1.5 space-y-1 text-[10.5px] leading-relaxed text-[#a0a2a6]">
              {SUPUESTOS_SCORING.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="opacity-50">
                    ◆
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <BannerFicticioPremium fuente={dataset.fuente} />
            </div>
          </div>
        </LienzoConAgentes>
      </section>
    </div>
  );
}
