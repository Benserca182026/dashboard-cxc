// Aviso de cifras preliminares.
//
// POR QUÉ EXISTE: hasta el despliegue anterior, Ventas mostraba los montos
// rotulados como dólares. Esa etiqueta equivocada era, sin querer, la única
// señal visible de que el tablero estaba roto: nadie decide sobre un dashboard
// guatemalteco que dice "$26 millones". Al corregir el rótulo a quetzales, la
// cifra quedó bien etiquetada pero sigue inflada en Q6.6M, y ahora se ve
// creíble. Un número falso que parece confiable es peor instrumento de
// decisión que uno visiblemente roto.
//
// Este aviso devuelve esa señal de forma explícita, mientras Ventas e
// Inventario esperan los dos exports de Odoo (columna Descuento y stock.quant).
//
// CUÁNDO SE QUITA: cuando ambas cifras cuadren contra Odoo y exista la prueba
// de cifra de control que hoy no existe. Se borra este componente y su uso en
// app/layout.tsx — no vive en ningún otro lado.

"use client";

import { usePathname } from "next/navigation";

const PENDIENTES = [
  "Ventas: el total mostrado está por encima del real de Odoo (Q26,285,671.61 contra Q19,671,235.56). Falta restar la columna Descuento.",
  "Inventario: la variación y las recomendaciones de reposición no son confiables. Falta el export de stock.quant.",
];

export function AvisoPreliminar() {
  // En la pantalla de acceso no hay cifras que advertir, y el aviso ahí sólo
  // estorba.
  if (usePathname() === "/login") return null;

  return (
    <aside
      role="note"
      aria-label="Aviso: cifras preliminares"
      className="mb-5 rounded-pastilla border border-[#e6c200]/45 bg-[#fff8dd] px-4 py-3 print:border-black"
    >
      <p className="text-[13px] font-bold tracking-[-0.01em] text-tinta">
        <span aria-hidden className="mr-1.5">⚠</span>
        Cifras preliminares — Ventas e Inventario en revisión
      </p>
      <ul className="mt-1.5 space-y-1 text-[12.5px] leading-snug text-[#6b6f78]">
        {PENDIENTES.map((t) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden className="select-none">·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-[#7c808a]">
        No tomes decisiones sobre estos dos módulos hasta que se retire este
        aviso. La moneda ya está correcta: todos los montos son quetzales.
      </p>
    </aside>
  );
}
