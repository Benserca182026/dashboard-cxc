"use client";

// M2 — Aging (paso-6-aging.md).
// Fecha de corte SIEMPRE explícita y configurable — nunca "hoy" automático.
//
// Reestructuración (M5): esta página pasa al MISMO esqueleto de la página 1.
// De arriba abajo: Encabezado con menú interno y barra de usuario → el motor
// de argumentación (cuatro etapas derivadas del dato, con los agentes asomados
// en el mordisco) → los bloques de abajo, todos envueltos en LienzoConAgentes.
//
// NADA de la lógica de aging se movió (lib/calculos.ts sin tocar). Lo que sí
// cambió (pedido explícito con datos reales): el detalle factura-por-factura
// y la comparación tramo-por-tramo contra Odoo NO viven más incrustados acá
// — con 224 facturas clasificadas y 6 tramos, esos bloques hacían la página
// larguísima. Ahora son páginas secundarias (/aging/detalle,
// /aging/verificacion) — se llega con un clic, esta página muestra sólo el
// número que importa a simple vista + el link. Mismo criterio ya aplicado a
// /aging/excluidas.

import Link from "next/link";
import { SkeletonPagina } from "@/components/Basicos";
import { calcularAging, fmtMoneda } from "@/lib/calculos";
import { BUCKETS, type BucketAging } from "@/lib/types";
import { BUCKET_INFO } from "@/lib/bucketInfo";
import { useApp } from "@/lib/store";
import { useEffect, useState } from "react";
import { Encabezado } from "@/components/Encabezado";
import { FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";
import { argumentoAging } from "@/lib/argumento";
import { BannerFicticioPremium } from "@/components/ResumenPremium";
import { cargarComparacionOdoo, type ComparacionOdoo } from "@/lib/verificacionOdoo";

const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-distribucion", etiqueta: "Distribución" },
  { id: "sec-corte", etiqueta: "Corte y exclusiones" },
];

export default function PaginaAging() {
  const { dataset, cargando, fechaCorte, setFechaCorte } = useApp();
  const [bucketActivo, setBucketActivo] = useState<BucketAging | null>(null);
  const [comparacion, setComparacion] = useState<ComparacionOdoo | null>(null);
  const [errorComparacion, setErrorComparacion] = useState<string | null>(null);

  useEffect(() => {
    if (dataset.fuente !== "odoo-real") return;
    let vigente = true;
    cargarComparacionOdoo()
      .then((c) => { if (vigente) setComparacion(c); })
      .catch((e) => { if (vigente) setErrorComparacion(e instanceof Error ? e.message : "No se pudo cargar la comparación."); });
    return () => { vigente = false; };
  }, [dataset.fuente]);

  if (cargando) return <SkeletonPagina />;

  const aging = calcularAging(dataset, fechaCorte);
  const advertencias = aging.clasificadas.filter((f) => f.advertenciaCorteAnterior);
  const excluidasPorMotivo = new Map<string, { n: number; saldo: number }>();
  for (const e of aging.excluidas) {
    const acc = excluidasPorMotivo.get(e.motivo) ?? { n: 0, saldo: 0 };
    acc.n++;
    acc.saldo += e.saldo;
    excluidasPorMotivo.set(e.motivo, acc);
  }
  const maximoBucket = Math.max(...BUCKETS.map((b) => aging.totalesPorBucket[b]), 1);

  // ── Las cifras de los cuatro anillos. Cada una es la que AFIRMA su etapa;
  //    salen de las mismas funciones que el argumento, no de números sueltos.
  const cartera = aging.totalClasificado + aging.saldoNoClasificable;
  const alDia = aging.totalesPorBucket["actual"];
  const vencido = Math.max(0, aging.totalClasificado - alDia);
  const tramosVencidos = BUCKETS.filter((b) => b !== "actual").map((b) => ({
    bucket: b,
    monto: aging.totalesPorBucket[b],
  }));
  const mayorTramo = [...tramosVencidos].sort((a, b) => b.monto - a.monto)[0];
  const vencidoPorCliente = new Map<string, number>();
  for (const c of aging.clasificadas) {
    if (c.bucket === "actual") continue;
    vencidoPorCliente.set(
      c.factura.id_cliente,
      (vencidoPorCliente.get(c.factura.id_cliente) ?? 0) + c.saldo
    );
  }
  const mayorDeudor = [...vencidoPorCliente.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const porcentaje = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0);
  const diferenciaOdoo = comparacion ? cartera - comparacion.total : null;
  const moneda = dataset.fuente === "odoo-real" ? "GTQ" : "USD";
  const fmt = (n: number) => fmtMoneda(n, moneda);

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que la página 1. Las
          automatizaciones se declaran de ESTE módulo: los disparadores del
          aging son el corte y el cruce de tramo, no la cartera general. */}
      <Encabezado
        titulo="Aging de cartera"
        secciones={SECCIONES}
        dataset={dataset}
        modulo="aging"
      />

      {/* El motor de argumentación del módulo: ¿cuánto está vencido, desde
          cuándo, y en quién se concentra? Las cuatro etapas se derivan en
          lib/argumento.ts — acá sólo se muestran. */}
      <section id="sec-argumento" className="scroll-mt-24">
        <RecorridoArgumental
          rotulo="El caso del aging"
          arg={argumentoAging(dataset, fechaCorte)}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} />}
          kpis={[
            {
              etiqueta: "vencido · de la cartera",
              valor: fmt(vencido),
              pct: porcentaje(vencido, cartera),
            },
            {
              etiqueta: `tramo ${mayorTramo?.bucket ?? "—"} · del vencido`,
              valor: fmt(mayorTramo?.monto ?? 0),
              pct: porcentaje(mayorTramo?.monto ?? 0, vencido),
            },
            {
              etiqueta: "mayor deudor · del vencido",
              valor: mayorDeudor ? fmt(mayorDeudor[1]) : "—",
              pct: porcentaje(mayorDeudor?.[1] ?? 0, vencido),
            },
            {
              etiqueta: "fuera del aging · de la cartera",
              valor: fmt(aging.saldoNoClasificable),
              pct: porcentaje(aging.saldoNoClasificable, cartera),
            },
          ]}
        />
      </section>

      {/* Los dos bloques de abajo, lado a lado y con el MISMO envoltorio del de
          arriba: lienzo, mordisco y fichas de agentes asomadas. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section id="sec-distribucion" className="scroll-mt-24">
          <LienzoConAgentes
            titulo="Distribución de cartera por bucket"
            agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} />}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="text-[11.5px] leading-snug text-[#85878c]">
                Saldo clasificado por tramo de atraso a la fecha de corte
              </p>
              <div className="text-right">
                <p className="text-[22px] font-bold leading-tight tabular-nums text-tinta">
                  {fmt(aging.totalClasificado)}
                </p>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                  total clasificado
                </p>
              </div>
            </div>

            <GraficoBuckets
              buckets={BUCKETS}
              totales={aging.totalesPorBucket}
              maximo={maximoBucket}
              activo={bucketActivo}
              onHover={setBucketActivo}
              fmt={fmt}
            />

            {/* Las píldoras son la leyenda Y el acceso al detalle: un clic
                lleva a /aging/detalle ya filtrado por ese bucket — el
                filtrado en vivo ahora vive allá, no acá. */}
            <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Leyenda de buckets">
              {BUCKETS.map((b) => {
                const info = BUCKET_INFO[b];
                return (
                  <Link
                    key={b}
                    href={`/aging/detalle?bucket=${b}`}
                    role="listitem"
                    onMouseEnter={() => setBucketActivo(b)}
                    onMouseLeave={() => setBucketActivo(null)}
                    onFocus={() => setBucketActivo(b)}
                    onBlur={() => setBucketActivo(null)}
                    className="flex items-center gap-2 rounded-pastilla border border-white/90 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-tinta/80 shadow-flotante outline-none transition hover:shadow-flotanteAlta"
                    style={bucketActivo === b ? { backgroundColor: info.colorSuave, borderColor: info.color } : undefined}
                  >
                    <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
                    {info.etiqueta}
                    <span className="tabular-nums text-tintaSuave">{fmt(aging.totalesPorBucket[b])}</span>
                  </Link>
                );
              })}
            </div>
          </LienzoConAgentes>
        </section>

        {/* Corte, exclusiones y contexto. El selector de fecha vive acá: junto
            a lo que el corte explica, no suelto arriba. Su comportamiento es
            el de siempre — parámetro explícito, nunca "hoy" implícito. */}
        <section id="sec-corte" className="scroll-mt-24">
          <LienzoConAgentes
            titulo={`Corte y exclusiones (${aging.excluidas.length})`}
            agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} />}
          >
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                  Fecha de corte
                </span>
                <input
                  type="date"
                  value={fechaCorte}
                  onChange={(e) => e.target.value && setFechaCorte(e.target.value)}
                  className="rounded-xl border border-borde bg-white px-3 py-1.5 text-sm text-tinta outline-none focus:border-tinta"
                />
              </label>
              <div className="text-right">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                  Cartera total pendiente
                </p>
                <p className="text-[22px] font-bold leading-tight tabular-nums text-tinta">
                  {fmt(cartera)}
                </p>
              </div>
            </div>

            <p className="mt-2 text-[11.5px] leading-snug text-[#85878c]">
              Días de atraso = fecha de corte − fecha de vencimiento. 🟡 Fórmula
              pendiente de validación por Finanzas · Fuente: {dataset.fuente}
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2 border-t border-[rgba(22,24,29,.07)] pt-4">
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                  Total clasificado
                </p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-tinta">
                  {fmt(aging.totalClasificado)}
                </p>
              </div>
              {aging.saldoNoClasificable > 0 && (
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                    Saldo no clasificable
                  </p>
                  <p className="mt-0.5 text-[17px] font-bold tabular-nums text-tinta/80">
                    {fmt(aging.saldoNoClasificable)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                  Facturas clasificadas
                </p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-tinta/80">
                  {aging.clasificadas.length}
                </p>
              </div>
            </div>

            {advertencias.length > 0 && (
              <div className="mt-4 flex items-start gap-3 rounded-tarjeta border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
                <span aria-hidden className="mt-0.5">
                  ⚠️
                </span>
                <p>
                  {advertencias.length} factura(s) con fecha de corte anterior a su fecha de
                  emisión ({advertencias.map((f) => f.factura.numero_factura).join(", ")}) —
                  revisá el parámetro elegido.
                </p>
              </div>
            )}

            {/* Detalle factura por factura — vive en /aging/detalle. */}
            <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                Detalle factura por factura
              </p>
              <p className="mt-1.5 text-[12px] text-[#85878c]">
                {aging.clasificadas.length} facturas clasificadas, con búsqueda, orden y filtro por bucket.
              </p>
              <Link
                href="/aging/detalle"
                className="mt-1.5 inline-block text-[12px] font-semibold text-tinta underline decoration-[rgba(22,24,29,.25)] underline-offset-2 hover:decoration-tinta"
              >
                Ver el detalle completo →
              </Link>
            </div>

            {/* Verificación contra Odoo — vive en /aging/verificacion. Sólo
                aparece con dataset real: no tiene sentido comparar el
                demo-ficticio contra nada. */}
            {dataset.fuente === "odoo-real" && (
              <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                  Verificación contra Odoo
                </p>
                <p className="mt-1.5 text-[12px] text-[#85878c]">
                  {errorComparacion
                    ? `No se pudo cargar: ${errorComparacion}`
                    : diferenciaOdoo === null
                      ? "Cargando saldos declarados por Odoo…"
                      : `Diferencia total ${diferenciaOdoo >= 0 ? "+" : ""}${fmt(diferenciaOdoo)} contra lo que Odoo declara — explicada, no error (ver detalle).`}
                </p>
                <Link
                  href="/aging/verificacion"
                  className="mt-1.5 inline-block text-[12px] font-semibold text-tinta underline decoration-[rgba(22,24,29,.25)] underline-offset-2 hover:decoration-tinta"
                >
                  Ver la comparación tramo por tramo →
                </Link>
              </div>
            )}

            {/* Excluidas del aging — resumen agrupado por motivo, vive en
                /aging/excluidas el detalle factura por factura. */}
            <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#a0a2a6]">
                Excluidas del aging ({aging.excluidas.length})
              </p>
              {aging.excluidas.length === 0 ? (
                <p className="mt-1.5 text-[11.5px] text-[#85878c]">Ninguna.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-1">
                    {[...excluidasPorMotivo.entries()].map(([motivo, { n, saldo }]) => (
                      <li key={motivo} className="text-[12px] text-[#85878c]">
                        <span className="font-semibold text-tinta">{n}</span>{" "}
                        {motivo === "sin_fecha_vencimiento"
                          ? `sin fecha de vencimiento — ${fmt(saldo)} en total, fuera de los buckets (no se inventa fecha)`
                          : `${motivo} — ${fmt(saldo)} en total`}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/aging/excluidas"
                    className="mt-2.5 inline-block text-[12px] font-semibold text-tinta underline decoration-[rgba(22,24,29,.25)] underline-offset-2 hover:decoration-tinta"
                  >
                    Ver el detalle factura por factura ({aging.excluidas.length}) →
                  </Link>
                </>
              )}
            </div>

            <div className="mt-4">
              <BannerFicticioPremium fuente={dataset.fuente} />
            </div>
          </LienzoConAgentes>
        </section>
      </div>
    </div>
  );
}

function GraficoBuckets({
  buckets,
  totales,
  maximo,
  activo,
  onHover,
  fmt,
}: {
  buckets: BucketAging[];
  totales: Record<BucketAging, number>;
  maximo: number;
  activo: BucketAging | null;
  onHover: (b: BucketAging | null) => void;
  fmt: (n: number) => string;
}) {
  const ANCHO = 760;
  const ALTO = 220;
  const M_IZQ = 56;
  const M_DER = 16;
  const M_SUP = 16;
  const M_INF = 32;
  const areaAncho = ANCHO - M_IZQ - M_DER;
  const areaAlto = ALTO - M_SUP - M_INF;
  const anchoBanda = areaAncho / buckets.length;
  const anchoBarra = anchoBanda * 0.52;

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="mt-4 w-full"
      role="img"
      aria-label="Distribución del saldo de cartera por bucket de aging"
    >
      <defs>
        <pattern id="puntosFondoAging" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="#e2e8f0" />
        </pattern>
        {buckets.map((b) => (
          <linearGradient key={b} id={`barra-${b}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={BUCKET_INFO[b].color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={BUCKET_INFO[b].color} stopOpacity="1" />
          </linearGradient>
        ))}
      </defs>

      <rect
        x={M_IZQ}
        y={M_SUP}
        width={areaAncho}
        height={areaAlto}
        fill="url(#puntosFondoAging)"
        opacity="0.55"
      />

      {[0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={M_IZQ}
            y1={M_SUP + areaAlto - areaAlto * f}
            x2={ANCHO - M_DER}
            y2={M_SUP + areaAlto - areaAlto * f}
            stroke="#e2e8f0"
            strokeDasharray="2 6"
            strokeLinecap="round"
          />
          <text
            x={M_IZQ - 8}
            y={M_SUP + areaAlto - areaAlto * f + 3.5}
            fontSize="10"
            fill="#94a3b8"
            textAnchor="end"
          >
            {fmt(maximo * f)}
          </text>
        </g>
      ))}
      <line
        x1={M_IZQ}
        y1={M_SUP + areaAlto}
        x2={ANCHO - M_DER}
        y2={M_SUP + areaAlto}
        stroke="#cbd5e1"
      />

      {buckets.map((b, i) => {
        const valor = totales[b];
        const altoBarra = maximo > 0 ? (valor / maximo) * areaAlto : 0;
        const cx = M_IZQ + anchoBanda * i + anchoBanda / 2;
        const x = cx - anchoBarra / 2;
        const y = M_SUP + areaAlto - altoBarra;
        const opacidad = activo === null || activo === b ? 1 : 0.35;
        return (
          <g
            key={b}
            style={{ opacity: opacidad, transition: "opacity 150ms" }}
            onMouseEnter={() => onHover(b)}
            onMouseLeave={() => onHover(null)}
          >
            <rect
              x={x}
              y={y}
              width={anchoBarra}
              height={Math.max(altoBarra, 3)}
              rx={10}
              fill={`url(#barra-${b})`}
            />
            <text
              x={cx}
              y={y - 8}
              fontSize="11"
              fontWeight="700"
              fill={BUCKET_INFO[b].color}
              textAnchor="middle"
            >
              {fmt(valor)}
            </text>
            <text
              x={cx}
              y={ALTO - M_INF + 18}
              fontSize="10"
              fill="#64748b"
              textAnchor="middle"
            >
              {BUCKET_INFO[b].etiqueta}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
