"use client";

// M1 — Resumen de cartera (paso-3-modulos-propios.md).
// Agrega lo que M2 clasifica; no introduce reglas propias.

import { SkeletonPagina } from "@/components/Basicos";
import {
  AgingRow,
  BannerFicticioPremium,
  PanelAging,
} from "@/components/ResumenPremium";
import { calcularAging } from "@/lib/calculos";
import { concentracionRiesgo } from "@/lib/kpis";
import { BUCKETS } from "@/lib/types";
import { useApp } from "@/lib/store";
import { KpisGestion } from "@/components/KpisGestion";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";
import { argumentoDso } from "@/lib/argumento";
import { Encabezado } from "@/components/Encabezado";
import { FilaAgentes } from "@/components/Agentes";

export default function PaginaResumen() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();

  if (cargando) return <SkeletonPagina />;

  const aging = calcularAging(dataset, fechaCorte);
  const carteraTotal = aging.totalClasificado + aging.saldoNoClasificable;
  const alDia = aging.totalesPorBucket["actual"];
  const pctAlDia = carteraTotal > 0 ? Math.round((alDia / carteraTotal) * 100) : 0;
  const critico = aging.totalesPorBucket["90+"];
  const concentracion = concentracionRiesgo(dataset, fechaCorte);
  const cuentasConDisputa = new Set(
    dataset.disputas
      .filter((d) => d.estado_disputa === "abierta" || d.estado_disputa === "en_revision")
      .map((d) => d.id_cliente)
  ).size;
  // Con datos reales de Odoo, dataset.disputas siempre viene [] (no existe
  // esa tabla en el Supabase real — ver lib/datosReales.ts) — "0 de N" ahí NO
  // es un hallazgo de negocio ("no hay disputas"), es "no tenemos ese dato
  // todavía". Se muestra distinto para no confundir una cosa con la otra
  // (hallazgo confirmado por verificación 2026-08-19).
  const sinDatosDisputa = dataset.fuente === "odoo-real";
  // El dinero lo pinta el formateador del store: es el ÚNICO lugar donde una
  // cifra cambia de moneda, y lo hace al PINTAR. Todo lo de arriba (umbrales,
  // porcentajes, comparaciones, cuadres) se calculó en la moneda de registro y
  // no se entera de esta vista. Ver components/ControlMoneda.tsx.

  const SECCIONES = [
    { id: "sec-argumento", etiqueta: "El caso" },
    { id: "sec-indicadores", etiqueta: "Indicadores" },
    { id: "sec-antiguedad", etiqueta: "Antigüedad" },
    { id: "sec-contexto", etiqueta: "Contexto" },
  ];

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + titular grande, al modo de la referencia. */}
      <Encabezado titulo="Resumen de cartera" secciones={SECCIONES} dataset={dataset} />

      {/* Rediseño demostrativo: el tablero no enuncia el DSO, lo DEMUESTRA por
          etapas. Los cuatro KPIs de cartera ya no abren la página en una fila
          propia: se repartieron al pie de las tarjetas, cada uno junto a la
          etapa que lo interroga. Arriba eran cuatro números sin conversación. */}
      <section id="sec-argumento" className="scroll-mt-24">
        <RecorridoArgumental
          arg={argumentoDso(dataset, fechaCorte)}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} />}
          /* Cada anillo dibuja la proporción que afirma SU etapa. Antes los
             cuatro KPIs iban por orden y no pegaban con la etapa de al lado;
             ahora cada tarjeta muestra el número del que está hablando. */
          kpis={[
            { etiqueta: "al día · de la cartera", valor: fmt(alDia), pct: pctAlDia },
            {
              etiqueta: "mayor cliente · de la cartera",
              valor: fmt(concentracion.mayorCliente?.saldo ?? 0),
              pct: concentracion.mayorPct ?? 0,
            },
            {
              etiqueta: "bucket 90+ · de la cartera",
              valor: fmt(critico),
              pct: carteraTotal > 0 ? (critico / carteraTotal) * 100 : 0,
            },
            // LA TARJETA QUE ANTES ERA MUDA. Decía "clientes con disputa · sin
            // datos", ponía el literal "sin datos" como valor y —lo peor—
            // mandaba pct: 0, con lo cual el anillo dibujaba un cero perfecto.
            // Ese 0 no era un hueco: era una AFIRMACIÓN falsa, la de que
            // ningún cliente tiene disputas. Ahora la tarjeta declara el hueco
            // con los mismos tres campos que el popover de los agentes.
            {
              etiqueta: "clientes con disputa",
              valor: sinDatosDisputa ? "" : `${cuentasConDisputa} de ${dataset.clientes.length}`,
              ...(sinDatosDisputa
                ? {
                    sinDato: {
                      queFalta:
                        "La fuente de disputas. No está en Supabase, y el 2026-08-24 el Frente 1 confirmó que tampoco existe en Odoo: no hay modelo de disputa ni de reclamo.",
                      consecuencia:
                        "No se puede saber cuánta cartera está frenada por un reclamo. Un 0 acá afirmaría que no hay ninguno, que es distinto de no saberlo.",
                      comoSeLlena:
                        "Decidiendo primero dónde registrar los reclamos. El seguimiento de cobranza de Odoo (64 clientes) es lo más cercano, pero es gestión de cobro, no disputa.",
                    },
                  }
                : {
                    pct:
                      dataset.clientes.length > 0
                        ? (cuentasConDisputa / dataset.clientes.length) * 100
                        : 0,
                  }),
            },
          ]}
        />
      </section>

      {/* Dos secciones lado a lado, como el par de paneles inferiores de la
          referencia: los indicadores a la izquierda y la distribución a la
          derecha. Antes iban apiladas a lo ancho y obligaban a bajar para
          comparar dos cosas que se leen juntas. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
      {/* Paso 7 — indicadores de gestión, cada uno abrible hasta sus facturas.
          Los dos bloques de abajo llevan el MISMO envoltorio que el de arriba:
          lienzo con degradado, mordisco y las fichas de agentes asomadas. Son
          la misma pieza con distinto contenido. */}
      <section id="sec-indicadores" className="scroll-mt-24">
        <LienzoConAgentes
          titulo="Indicadores de gestión"
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} />}
        >
          <KpisGestion dataset={dataset} fechaCorte={fechaCorte} />
        </LienzoConAgentes>
      </section>

      <section id="sec-antiguedad" className="scroll-mt-24">
      <LienzoConAgentes
        titulo="Distribución por antigüedad"
        agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} />}
      >
      <PanelAging
        titulo=""
        nota={`La suma de los buckets (${fmt(aging.totalClasificado)}) cubre solo facturas clasificables.`}
      >
        {BUCKETS.map((b) => {
          const monto = aging.totalesPorBucket[b];
          const pct =
            aging.totalClasificado > 0
              ? (monto / aging.totalClasificado) * 100
              : 0;
          return (
            <AgingRow key={b} bucket={b} monto={monto} pct={pct} fmtMoneda={fmt} />
          );
        })}
        {/* El contexto del corte ya no es una caja suelta al final de la
            página: vive DENTRO de este panel. En la referencia sólo hay dos
            espacios abajo y todo lo demás va dentro de ellos — nada flotando
            por su cuenta. */}
        <div id="sec-contexto" className="mt-5 scroll-mt-24 border-t border-[rgba(22,24,29,.07)] pt-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                Contexto del corte
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-[#85878c]">
                Fecha de corte: {fechaCorte} (configurable en el módulo Aging) · Fuente: {dataset.fuente}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                Cartera total pendiente
              </p>
              <p className="text-[22px] font-bold leading-tight tabular-nums text-tinta">
                {fmt(carteraTotal)}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <BannerFicticioPremium fuente={dataset.fuente} />
          </div>
        </div>
      </PanelAging>
      </LienzoConAgentes>
      </section>
      </div>
    </div>
  );
}
