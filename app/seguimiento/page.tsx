"use client";

// M5 — Seguimiento de cobros (Decisión A: entra al prototipo con datos locales).
// Entidad gestiones_cobranza del Paso 4 §1.9, persistida SOLO en localStorage.
// Sin base de datos, sin ERP, sin APIs externas.
//
// Reestructuración (M6): mismo esqueleto de "/" y "/aging". De arriba abajo:
// Encabezado con menú interno y BarraUsuario → el motor de argumentación
// propio de este módulo (argumentoSeguimiento, con los agentes
// AGENTES_SEGUIMIENTO asomados en el mordisco) → el alta de gestión y la
// bitácora, cada uno envuelto en el mismo LienzoConAgentes del resto.
//
// NADA de la persistencia cambió: sigue siendo localStorage puro, la
// bitácora sigue en orden inverso y las validaciones del formulario son las
// mismas (cliente obligatorio, resultado no vacío).

import { SkeletonPagina } from "@/components/Basicos";
import { useApp } from "@/lib/store";
import type { GestionCobranza, TipoGestion } from "@/lib/types";
import { useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_SEGUIMIENTO, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";
import { BannerFicticioPremium } from "@/components/ResumenPremium";
import { argumentoSeguimiento } from "@/lib/argumento";
import { prioridadSimulada } from "@/lib/simulados";
import { nombreDeCliente } from "@/lib/calculos";

const TIPOS: TipoGestion[] = ["llamada", "email", "carta", "visita", "escalamiento_legal", "otro"];

const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-registrar", etiqueta: "Registrar gestión" },
  { id: "sec-bitacora", etiqueta: "Bitácora" },
];

export default function PaginaSeguimiento() {
  const { dataset, cargando, fechaCorte, gestiones, agregarGestion } = useApp();
  const [clienteSel, setClienteSel] = useState<string>("");
  const [tipo, setTipo] = useState<TipoGestion>("llamada");
  const [resultado, setResultado] = useState("");
  const [proximaAccion, setProximaAccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (cargando) return <SkeletonPagina />;

  const clientes = dataset.clientes;
  // Nunca imprimir un id crudo como si fuera un nombre: si no resuelve, la
  // pantalla lo DICE (ver nombreDeCliente en lib/calculos.ts).
  const nombre = (id: string) => nombreDeCliente(clientes, id);
  const gestionesVisibles = clienteSel
    ? gestiones.filter((g) => g.id_cliente === clienteSel)
    : gestiones;

  const guardar = () => {
    setOk(false);
    if (!clienteSel) {
      setError("Elegí un cliente antes de registrar la gestión.");
      return;
    }
    if (resultado.trim() === "") {
      setError("El resultado de la gestión no puede quedar vacío.");
      return;
    }
    setError(null);
    const ahora = new Date().toISOString().slice(0, 16);
    const nueva: GestionCobranza = {
      id_gestion: `GES-LOCAL-${Date.now()}`,
      id_cliente: clienteSel,
      id_factura: null,
      responsable: "Usuario demo (ficticio)",
      fecha_hora: ahora,
      tipo_gestion: tipo,
      resultado: resultado.trim(),
      proxima_accion: proximaAccion.trim() || undefined,
      sla_estado: "en_plazo",
      creado_por: "usuario_demo_local",
      fecha_creacion: ahora,
    };
    agregarGestion(nueva);
    setResultado("");
    setProximaAccion("");
    setOk(true);
  };

  const claseCampo =
    "w-full rounded-pastilla border border-white/90 bg-white/70 px-4 py-2 text-sm text-tinta shadow-flotante outline-none focus:border-tinta";

  // ── Las cifras de los cuatro anillos — la misma cuenta que arma el
  //    argumento, no números sueltos. ──
  const prioridad = prioridadSimulada(dataset, fechaCorte);
  const porClienteGestion = new Map<string, number>();
  for (const g of gestiones) {
    porClienteGestion.set(g.id_cliente, (porClienteGestion.get(g.id_cliente) ?? 0) + 1);
  }
  const clientesConGestion = new Set(porClienteGestion.keys());
  const clientesConSaldo = new Set(prioridad.map((f) => f.idCliente));
  const cubiertos = [...clientesConSaldo].filter((id) => clientesConGestion.has(id));
  const sinGestion = prioridad.filter((f) => !clientesConGestion.has(f.idCliente));
  const ranking = [...porClienteGestion.entries()]
    .map(([id, n]) => ({ id, nombre: nombre(id), n }))
    .sort((a, b) => b.n - a.n);
  const masGestionado = ranking[0] ?? null;
  const prioridadSinGestion = sinGestion[0] ?? null;
  const porcentaje = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". Las
          automatizaciones de acá hablan de gestión y bitácora, no de cartera
          general. */}
      <Encabezado
        titulo="Seguimiento de cobros"
        secciones={SECCIONES}
        dataset={dataset}
        modulo="seguimiento"
      />

      {/* El motor de argumentación del módulo: ¿cuánta gestión se ha hecho,
          sobre quién se concentra, qué queda pendiente, y a quién contactar
          hoy? Las cuatro etapas viven en lib/argumento.ts; la bitácora es
          estado local del navegador y se pasa como parámetro. */}
      <section id="sec-argumento" className="scroll-mt-24">
        <RecorridoArgumental
          rotulo="El caso del seguimiento"
          arg={argumentoSeguimiento(dataset, gestiones, fechaCorte)}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_SEGUIMIENTO} />}
          kpis={[
            {
              etiqueta: "con gestión · de los que tienen saldo",
              valor: `${cubiertos.length} de ${clientesConSaldo.size}`,
              pct: porcentaje(cubiertos.length, clientesConSaldo.size),
            },
            {
              etiqueta: "más gestionado · del total de gestiones",
              // Sin gestiones registradas no hay "más gestionado". Se dice así
              // y no con un "—" ambiguo, que se lee como "dato faltante"
              // cuando en realidad el hecho es que nadie gestionó todavía.
              valor: masGestionado ? `${masGestionado.nombre} · ${masGestionado.n}` : "sin gestiones registradas",
              pct: masGestionado ? porcentaje(masGestionado.n, gestiones.length) : 0,
            },
            {
              etiqueta: "sin ninguna gestión · de los que tienen saldo",
              valor: `${sinGestion.length} de ${clientesConSaldo.size}`,
              pct: porcentaje(sinGestion.length, clientesConSaldo.size),
            },
            {
              etiqueta: "próximo contacto · score simulado",
              valor: prioridadSinGestion?.nombreCliente ?? "seguimiento al día",
              pct: prioridadSinGestion?.scoreSimulado ?? 0,
            },
          ]}
        />
      </section>

      {/* Alta de gestión: mismos campos, misma validación, mismo guardado
          local de siempre. */}
      <section id="sec-registrar" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Registrar gestión (local)"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_SEGUIMIENTO} />}
        >
          <p className="text-[11.5px] leading-snug text-[#85878c]">
            Se guarda solo en este navegador — nada viaja a un servidor.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="etiqueta-fase mb-1.5 block">Cliente</span>
              <select
                value={clienteSel}
                onChange={(e) => setClienteSel(e.target.value)}
                className={claseCampo}
              >
                <option value="">— elegir —</option>
                {clientes.map((c) => (
                  <option key={c.id_cliente} value={c.id_cliente}>
                    {c.nombre_cliente}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="etiqueta-fase mb-1.5 block">Tipo de gestión</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoGestion)}
                className={claseCampo}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="etiqueta-fase mb-1.5 block">Resultado</span>
              <input
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                placeholder="Ej. cliente promete pago (dato ficticio)"
                className={claseCampo}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="etiqueta-fase mb-1.5 block">
                Próxima acción (opcional)
              </span>
              <input
                value={proximaAccion}
                onChange={(e) => setProximaAccion(e.target.value)}
                placeholder="Ej. llamar la próxima semana"
                className={claseCampo}
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-critico">
              <span aria-hidden className="opacity-60">▲</span>
              {error}
            </p>
          )}
          {ok && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-acento">
              <span aria-hidden className="opacity-60">✓</span>
              Gestión guardada en este navegador.
            </p>
          )}

          <button
            onClick={guardar}
            className="pastilla-activa mt-4 px-5 py-2.5 text-sm font-semibold transition hover:shadow-flotanteAlta"
          >
            Guardar gestión
          </button>

          <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
            <BannerFicticioPremium fuente={dataset.fuente} />
          </div>
        </LienzoConAgentes>
      </section>

      {/* Bitácora: mismo orden inverso, mismo filtro por cliente. */}
      <section id="sec-bitacora" className="scroll-mt-24">
        <LienzoConAgentes
          titulo={`Bitácora (${gestionesVisibles.length})`}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_SEGUIMIENTO} />}
        >
          {clienteSel && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => setClienteSel("")}
                className="rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-2 text-xs font-medium text-tinta/80 shadow-flotante transition hover:shadow-flotanteAlta"
              >
                filtrando por {nombre(clienteSel)} · ver todas ✕
              </button>
            </div>
          )}

          {gestionesVisibles.length === 0 ? (
            <div className="rounded-tarjeta bg-white/70 p-10 text-center text-sm text-tintaSuave">
              Sin gestiones registradas para esta cuenta.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {[...gestionesVisibles].reverse().map((g, i) => (
                <li
                  key={g.id_gestion}
                  className="tarjeta-calada entrada-suave p-5 text-sm transition"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span aria-hidden className="text-tintaSuave opacity-40">→</span>
                    <b className="text-tinta">{nombre(g.id_cliente)}</b>
                    <span className="rounded-pastilla border border-white/90 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-tinta/80 shadow-flotante">
                      {g.tipo_gestion}
                    </span>
                    {g.id_factura && (
                      <span className="text-xs text-tintaSuave">factura {g.id_factura}</span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-tintaSuave">
                      {g.fecha_hora}
                    </span>
                  </div>
                  {g.resultado && <p className="mt-2 text-tinta/85">{g.resultado}</p>}
                  {g.proxima_accion && (
                    <p className="mt-1.5 text-xs text-tinta/80">
                      <span aria-hidden className="mr-1 opacity-40">◆</span>
                      Próxima acción: <b>{g.proxima_accion}</b>
                      {g.fecha_proxima_accion && ` · ${g.fecha_proxima_accion}`}
                    </p>
                  )}
                  <p className="etiqueta-fase mt-2 border-t border-white/80 pt-2">
                    responsable: {g.responsable} · creado por: {g.creado_por} · SLA: {g.sla_estado}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </LienzoConAgentes>
      </section>
    </div>
  );
}
