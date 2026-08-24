"use client";

// Encabezado al modo de la referencia: marca a la izquierda, menú INTERNO de
// la página en horizontal con una sola píldora negra para la sección activa, y
// botones circulares a la derecha.
//
// El menú es interno a la página: no navega a otra ruta, salta a una sección
// de ESTA. La navegación entre módulos sigue siendo el riel lateral. Mezclar
// las dos cosas en una barra fue lo que hizo confuso el original.
//
// NOTA SOBRE LA MARCA: no tengo el archivo del logo de EDGE Helmets, así que
// esto es un logotipo tipográfico. Cuando exista el SVG real, se reemplaza acá
// y en ningún otro lado.

import { useEffect, useState } from "react";
import type { Dataset } from "@/lib/types";
import { BarraUsuario, type ModuloFlujo } from "@/components/BarraUsuario";
import { ControlMoneda } from "@/components/ControlMoneda";

export interface SeccionPagina {
  id: string;
  etiqueta: string;
}

/** Las tres acciones circulares del panel. Sólo van las que hacen algo de
 *  verdad: copiar el enlace de la vista, imprimir o guardar como PDF, y
 *  recalcular desde los datos. */
export function AccionesVista() {
  const [copiado, setCopiado] = useState(false);
  const clase =
    "grid h-9 w-9 place-items-center rounded-full bg-white/80 text-[13px] text-[#6b6f78] shadow-flotante transition hover:text-tinta";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
          } catch {
            // Sin permiso de portapapeles no se finge éxito: no pasa nada.
          }
        }}
        title={copiado ? "Enlace copiado" : "Copiar el enlace de esta vista"}
        aria-label="Copiar el enlace de esta vista"
        className={clase}
      >
        {copiado ? "✓" : "⧉"}
      </button>
      <button
        onClick={() => window.print()}
        title="Imprimir o guardar como PDF"
        aria-label="Imprimir o guardar como PDF"
        className={clase}
      >
        ⎙
      </button>
      <button
        onClick={() => window.location.reload()}
        title="Recalcular desde los datos"
        aria-label="Recalcular desde los datos"
        className={clase}
      >
        ↻
      </button>
    </div>
  );
}

export function Encabezado({
  titulo,
  secciones,
  dataset,
  /** Qué modulo describen las automatizaciones de la barra de usuario. Sin
   *  valor, sigue siendo la cartera general — la pagina 1 no cambia. */
  modulo,
}: {
  titulo: string;
  secciones: SeccionPagina[];
  dataset: Dataset;
  modulo?: ModuloFlujo;
}) {
  const [activa, setActiva] = useState(secciones[0]?.id ?? "");

  // La píldora sigue a lo que se está mirando, no a lo último que se clickeó.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-88px 0px -55% 0px", threshold: 0 }
    );
    secciones.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [secciones]);

  return (
    <header className="mb-7">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Logotipo tipográfico — pendiente del SVG real de la marca. */}
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[9px] bg-tinta text-[13px] text-white">
            ◆
          </span>
          <span className="text-[15px] font-extrabold tracking-[-0.01em] text-tinta">
            EDGE <span className="font-medium text-[#8b8f98]">Helmets</span>
          </span>
        </span>

        {/* Menú interno de esta página. */}
        <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1">
          {secciones.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActiva(s.id)}
              aria-current={activa === s.id ? "true" : undefined}
              className={`rounded-pastilla px-3.5 py-1.5 text-[12.5px] transition ${
                activa === s.id
                  ? "bg-tinta font-semibold text-white"
                  : "text-[#7c808a] hover:bg-white/70 hover:text-tinta"
              }`}
            >
              {s.etiqueta}
            </a>
          ))}
        </nav>
        {/* Buscar, mensajes automáticos, avisos y sesión — como en la
            referencia. Las acciones de la vista (copiar, imprimir, recalcular)
            viven en la franja del panel, que es otra cosa. */}
        <BarraUsuario dataset={dataset} modulo={modulo} />
      </div>

      {/* El título grande, como "Customer Journeys" en la referencia. */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em] text-tinta">
          {titulo}
        </h1>
        {/* El control de moneda vive en el ENCABEZADO, que es el único lugar
            común a todas las páginas: así un solo gesto cambia toda la vista de
            una vez, y no hay una pantalla que quede en otra moneda que el
            resto. Lo que cambia es cómo se PINTA el dinero; ningún cálculo,
            umbral ni comparación se rehace (ver components/ControlMoneda.tsx). */}
        <div className="max-w-[340px] shrink-0">
          <ControlMoneda />
        </div>
      </div>
    </header>
  );
}
