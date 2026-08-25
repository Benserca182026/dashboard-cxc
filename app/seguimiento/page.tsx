"use client";

// M5 — Seguimiento de cobros (Decisión A: entra al prototipo con datos locales).
// Entidad gestiones_cobranza del Paso 4 §1.9, persistida SOLO en localStorage.
// Sin base de datos, sin ERP, sin APIs externas.
//
// Reorientación comercial: la página abre con agentes de decisión, embudo,
// promesas, cuentas sin gestión y productividad. El formulario y la bitácora
// permanecen abajo como herramientas operativas y conservan localStorage.
//
// NADA de la persistencia cambió: sigue siendo localStorage puro, la
// bitácora sigue en orden inverso y las validaciones del formulario son las
// mismas (cliente obligatorio, resultado no vacío).

import { SkeletonPagina } from "@/components/Basicos";
import { useApp } from "@/lib/store";
import type { GestionCobranza, TipoGestion } from "@/lib/types";
import { useMemo, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_SEGUIMIENTO, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes } from "@/components/Argumento";
import { BannerFicticioPremium } from "@/components/ResumenPremium";
import { nombreDeCliente } from "@/lib/calculos";
import { DecisionPanelV2 } from "@/components/DecisionPanelV2";
import {
  AgentesComercialesCobranza,
  BarrasRanking,
  EmbudoCobranza,
  EstadoSinDatos,
  TablaProductividad,
} from "@/components/commercial/CobranzaComercial";
import { analizarSeguimientoComercial } from "@/lib/commercial-cobranza";

const TIPOS: TipoGestion[] = ["llamada", "email", "carta", "visita", "escalamiento_legal", "otro"];

const SECCIONES = [
  { id: "sec-decisiones-v2", etiqueta: "Decisiones" },
  { id: "sec-comercial", etiqueta: "Embudo" },
  { id: "sec-registrar", etiqueta: "Registrar gestión" },
  { id: "sec-bitacora", etiqueta: "Bitácora" },
];

export default function PaginaSeguimiento() {
  const { dataset, cargando, fechaCorte, gestiones, agregarGestion, fmt } = useApp();
  const [clienteSel, setClienteSel] = useState<string>("");
  const [tipo, setTipo] = useState<TipoGestion>("llamada");
  const [resultado, setResultado] = useState("");
  const [proximaAccion, setProximaAccion] = useState("");
  const [fechaProximaAccion, setFechaProximaAccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const comercial = useMemo(
    () => analizarSeguimientoComercial(dataset, fechaCorte, gestiones),
    [dataset, fechaCorte, gestiones]
  );

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
      fecha_proxima_accion: fechaProximaAccion || undefined,
      sla_estado: "en_plazo",
      creado_por: "usuario_demo_local",
      fecha_creacion: ahora,
    };
    agregarGestion(nueva);
    setResultado("");
    setProximaAccion("");
    setFechaProximaAccion("");
    setOk(true);
  };

  const claseCampo =
    "w-full rounded-pastilla border border-white/90 bg-white/70 px-4 py-2 text-sm text-tinta shadow-flotante outline-none focus:border-tinta";

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

      <DecisionPanelV2 modulo="seguimiento" />

      <section id="sec-comercial" className="scroll-mt-24 space-y-6">
        <AgentesComercialesCobranza agentes={comercial.agentes} fmt={fmt} />

        <LienzoConAgentes titulo="Embudo operativo de cobranza">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-2xl text-[11px] leading-relaxed text-tintaSuave">
              El embudo cuenta clientes, no gestiones. “Pago posterior” solo confirma secuencia temporal después de una promesa documentada; no atribuye el pago al contacto.
            </p>
            <p className="text-right text-[10px] font-semibold text-tintaSuave">
              Corte {fechaCorte} · fuente {dataset.fuente}
            </p>
          </div>
          <EmbudoCobranza etapas={comercial.embudo} />
        </LienzoConAgentes>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <LienzoConAgentes titulo="Promesas vencidas y próximas">
            {comercial.promesas.length === 0 ? (
              <EstadoSinDatos texto="No hay promesas documentadas en las gestiones. Para que entren aquí, el resultado o la próxima acción debe registrar la promesa y, de ser posible, su fecha." />
            ) : (
              <div className="space-y-2">
                {comercial.promesas.slice(0, 10).map((promesa) => {
                  const clases = {
                    "fecha-vencida": "border-red-200 bg-red-50 text-red-950",
                    proxima: "border-amber-200 bg-amber-50 text-amber-950",
                    vigente: "border-white/90 bg-white/65 text-tinta",
                    "sin-fecha": "border-dashed border-[rgba(22,24,29,.18)] bg-white/45 text-tinta",
                  } as const;
                  const etiqueta = {
                    "fecha-vencida": "fecha vencida · sin cierre",
                    proxima: "próximos 7 días",
                    vigente: "vigente",
                    "sin-fecha": "sin fecha",
                  } as const;
                  return (
                    <article key={promesa.idGestion} className={`rounded-[16px] border px-4 py-3 ${clases[promesa.estado]}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold">{promesa.cliente}</p>
                          <p className="mt-1 text-[10px] leading-relaxed opacity-75">{promesa.accion}</p>
                        </div>
                        <span className="rounded-pastilla border border-current/15 px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[.08em]">
                          {etiqueta[promesa.estado]}
                        </span>
                      </div>
                      <p className="mt-2 text-[9.5px] opacity-65">
                        {promesa.responsable} · {promesa.fecha ?? "fecha de compromiso no registrada"}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </LienzoConAgentes>

          <LienzoConAgentes titulo="Top cuentas vencidas sin ninguna gestión">
            <div className="mb-4 flex items-end justify-between gap-3">
              <p className="text-[11px] leading-relaxed text-tintaSuave">
                Primera cola de asignación: saldo y días observados, sin inferir contacto fuera de la bitácora.
              </p>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-tinta">{fmt(comercial.saldoSinGestion)}</p>
                <p className="text-[8.5px] font-bold uppercase tracking-[.08em] text-etapa">sin gestión registrada</p>
              </div>
            </div>
            <BarrasRanking
              filas={comercial.sinGestion.slice(0, 10).map((fila) => ({
                id: fila.idCliente,
                etiqueta: fila.cliente,
                valor: fila.saldo,
                meta: `${fila.dias} d · ${fila.proximaAccion}`,
              }))}
              fmt={fmt}
              vacio="Todas las cuentas vencidas tienen al menos una gestión registrada."
            />
          </LienzoConAgentes>
        </div>

        <LienzoConAgentes titulo="Productividad y conversión por responsable">
          <div className="mb-4 rounded-[15px] border border-white/80 bg-white/50 px-4 py-3 text-[10px] leading-relaxed text-tintaSuave">
            Conversión = gestiones que documentan una promesa ÷ gestiones del responsable. “Pago posterior” es una señal temporal por cliente, no una atribución de desempeño ni una tasa de recuperación monetaria.
          </div>
          <TablaProductividad filas={comercial.productividad} />
        </LienzoConAgentes>
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
            <label className="text-sm">
              <span className="etiqueta-fase mb-1.5 block">
                Fecha de próxima acción (opcional)
              </span>
              <input
                type="date"
                value={fechaProximaAccion}
                onChange={(e) => setFechaProximaAccion(e.target.value)}
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
