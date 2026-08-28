"use client";

// Riel lateral CONTRAÍDO — como el de la referencia (RonDesignLab): sólo
// íconos en círculo, ancho fijo angosto, y el nombre aparece al pasar el mouse.
//
// El texto no desaparece: se difiere. Un riel de puros íconos sin nombre es un
// acertijo; con el nombre al pasar el mouse es una barra angosta que igual se
// puede aprender. El activo lleva el círculo negro — el mismo negro único de
// la referencia, ahora en su sitio natural.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";

const ITEMS = [
  { href: "/", etiqueta: "Centro ejecutivo", icono: "▦", grupo: "Cartera" },
  { href: "/aging", etiqueta: "Aging", icono: "▤", grupo: "Cartera" },
  { href: "/prioritarios", etiqueta: "Clientes prioritarios", icono: "▲", grupo: "Cartera" },
  { href: "/ventas", etiqueta: "Ventas", icono: "◈", grupo: "Operación" },
  { href: "/ventas/canales", etiqueta: "Canales de venta", icono: "◌", grupo: "Operación" },
  { href: "/ventas/productos", etiqueta: "Categorías de producto", icono: "◇", grupo: "Operación" },
  { href: "/inventario", etiqueta: "Inventario", icono: "▢", grupo: "Operación" },
  { href: "/forecast", etiqueta: "Forecast comercial", icono: "◔", grupo: "Proyección" },
  { href: "/seguimiento", etiqueta: "Seguimiento de cobros", icono: "☏", grupo: "Proyección" },
  { href: "/datos", etiqueta: "Carga y calidad de datos", icono: "⇪", grupo: "Proyección" },
];

function Boton({ href, etiqueta, icono, activo, onIr }: {
  href: string; etiqueta: string; icono: string; activo: boolean; onIr?: () => void;
}) {
  return (
    <li className="group relative">
      <Link
        href={href}
        onClick={onIr}
        aria-label={etiqueta}
        aria-current={activo ? "page" : undefined}
        className={`grid h-11 w-11 place-items-center rounded-full text-[15px] transition ${
          activo
            ? "bg-tinta text-white shadow-[0_8px_20px_-8px_rgba(22,24,29,.6)]"
            : "text-[#6b6f78] hover:bg-white/70 hover:text-tinta"
        }`}
      >
        <span aria-hidden>{icono}</span>
      </Link>
      {/* El nombre no se pierde: se difiere al hover. */}
      <span className="pointer-events-none absolute left-[54px] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-pastilla bg-tinta px-3 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
        {etiqueta}
      </span>
    </li>
  );
}

export function Sidebar() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const { dataset } = useApp();
  const esReal = dataset.fuente === "odoo-real";

  const riel = (
    <nav className="flex h-full w-[68px] flex-col items-center gap-1 py-5">
      {/* Marca reducida a su inicial, como el logo del riel de la referencia. */}
      <Link
        href="/"
        aria-label="Dashboard CxC — inicio"
        className="mb-4 grid h-10 w-10 place-items-center rounded-[14px] bg-tinta text-[13px] font-extrabold text-white"
      >
        CxC
      </Link>

      <ul className="flex flex-col items-center gap-1.5">
        {ITEMS.map((it, i) => (
          <div key={it.href} className="contents">
            {/* Separador donde cambia el grupo: la estructura sobrevive al colapso. */}
            {i > 0 && ITEMS[i - 1].grupo !== it.grupo && (
              <li aria-hidden className="my-1.5 h-px w-6 bg-black/[.08]" />
            )}
            <Boton {...it} activo={ruta === it.href} onIr={() => setAbierto(false)} />
          </div>
        ))}
      </ul>

      <span
        title={
          esReal
            ? "Datos reales de Benserca 18 (Odoo). Ninguna fórmula está aprobada por Finanzas."
            : "Todos los datos son ficticios. Ninguna fórmula está aprobada por Finanzas."
        }
        className={`mt-auto grid h-9 w-9 cursor-help place-items-center rounded-full bg-white/70 text-[13px] ${
          esReal ? "text-[#0F8B7B]" : "text-[#8b6b1f]"
        }`}
        aria-label={
          esReal
            ? "Datos reales de Benserca 18 (Odoo). Ninguna fórmula está aprobada por Finanzas."
            : "Todos los datos son ficticios. Ninguna fórmula está aprobada por Finanzas."
        }
      >
        {esReal ? "✓" : "⚠"}
      </span>
    </nav>
  );

  return (
    <>
      <button
        className="fixed left-3 top-3 z-40 rounded-lg border border-borde bg-tarjeta px-3 py-2 text-sm shadow-sm lg:hidden"
        onClick={() => setAbierto(true)}
        aria-label="Abrir navegación"
      >
        ☰
      </button>
      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setAbierto(false)}>
          <aside className="h-full bg-white/85 shadow-xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            {riel}
          </aside>
        </div>
      )}
      <aside className="hidden shrink-0 lg:block">{riel}</aside>
    </>
  );
}
