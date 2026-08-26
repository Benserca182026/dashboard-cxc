"use client";

import { SkeletonPagina } from "@/components/Basicos";
import { Encabezado } from "@/components/Encabezado";
import { LienzoConAgentes } from "@/components/Argumento";
import {
  InventarioMovimientoVisual,
  OperacionKpi,
  OperacionRanking,
} from "@/components/commercial/OperacionVisuales";
import { analiticaInventario } from "@/lib/commercial-operacion";
import { useApp } from "@/lib/store";

const SECCIONES = [
  { id: "sec-decisiones-v2", etiqueta: "Decisiones" },
  { id: "sec-pulso", etiqueta: "Pulso" },
  { id: "sec-rotacion", etiqueta: "Movimiento" },
  { id: "sec-acciones", etiqueta: "Oportunidades" },
];

export default function PaginaInventario() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  const analitica = analiticaInventario(dataset);

  if (cargando) return <SkeletonPagina />;

  return (
    <div className="space-y-6">
      <Encabezado titulo="Inventario" secciones={SECCIONES} dataset={dataset} modulo="inventario" />

      <section className="rounded-[20px] border border-white/80 bg-white/60 px-4 py-3 shadow-flotante">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6876d8]">Movimiento observado</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-tintaSuave">
          <b>Salida</b> = una unidad que el registro marca como salida del almacén. Puede ser una entrega, una venta u otro movimiento; esta vista no supone que toda salida fue una venta. Se muestran las salidas registradas entre {analitica.desde ?? "sin inicio"} y {analitica.hasta ?? "sin fin"}.
        </p>
      </section>

      <section id="sec-pulso" className="scroll-mt-24">
        <LienzoConAgentes titulo="Pulso comercial del inventario">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6876d8]">Flujo verificable</p>
              <h2 className="mt-1 text-xl font-bold text-tinta">Qué productos mueven valor y dónde actuar primero</h2>
            </div>
            <p className="text-[11px] text-tintaSuave">
              {analitica.desde && analitica.hasta ? `${analitica.desde} → ${analitica.hasta} · ${analitica.movimientos.toLocaleString("es-GT")} movimientos` : "Sin ventana de movimientos"}
            </p>
          </div>

          {!analitica.disponible ? (
            <div className="mt-5 rounded-2xl border border-dashed border-borde bg-white/60 p-6 text-sm text-tintaSuave">
              Este dataset no trae catálogo y movimientos suficientes para analizar inventario.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <OperacionKpi etiqueta="Valor que salió del almacén" valor={fmt(analitica.valorSalidas)} nota="Unidades de salida × costo unitario de cada producto" tono="positivo" />
              <OperacionKpi etiqueta="Unidades que salieron" valor={Math.round(analitica.unidadesSalida).toLocaleString("es-GT")} nota={`Registradas en ${analitica.productosConMovimiento} productos con movimiento`} />
              <OperacionKpi etiqueta="Productos con salida valorizada" valor={analitica.productosConSalidaValorizada.toLocaleString("es-GT")} nota="Productos cuyo movimiento de salida aporta monto al análisis" />
            </div>
          )}
        </LienzoConAgentes>
      </section>

      <section id="sec-rotacion" className="scroll-mt-24">
        <LienzoConAgentes titulo="Productos que mueven más valor">
          <InventarioMovimientoVisual filas={analitica.topSalidas} total={analitica.valorSalidas} formatear={fmt} />
        </LienzoConAgentes>
      </section>

      <section id="sec-acciones" className="scroll-mt-24">
        <LienzoConAgentes titulo="Oportunidades observadas">
          <div className="grid gap-4 lg:grid-cols-2">
            <OperacionRanking
              titulo="Revisar baja rotación"
              subtitulo={`${analitica.candidatosSinSalida} candidatos · denominador completo ${fmt(analitica.valorEntradasSinSalida)} · se muestran los líderes`}
              filas={analitica.entradasSinSalida}
              formatear={fmt}
              vacio="No hay productos con entradas y cero salidas en la ventana."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-[24px] border border-white/90 bg-white/70 p-5 shadow-flotante">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6876d8]">Validar reposición</p>
                <p className="mt-2 text-sm font-bold text-tinta">Empezar por {analitica.topSalidas[0]?.etiqueta ?? "el producto de mayor salida"}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-tintaSuave">Es el primer producto a revisar por monto de salida observado.</p>
              </article>
              <article className="rounded-[24px] border border-white/90 bg-white/70 p-5 shadow-flotante">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6876d8]">Revisar liquidación</p>
                <p className="mt-2 text-sm font-bold text-tinta">{analitica.candidatosSinSalida} candidatos · {fmt(analitica.valorEntradasSinSalida)}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-tintaSuave">Productos que entraron y no registran salida dentro de la ventana observada.</p>
              </article>
            </div>
          </div>
        </LienzoConAgentes>
      </section>
    </div>
  );
}
