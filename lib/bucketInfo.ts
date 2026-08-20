// Colores/etiquetas de cada bucket de aging — antes vivía duplicado dentro de
// app/aging/page.tsx. Se extrae acá porque ahora TRES páginas lo necesitan
// (/aging, /aging/detalle, /aging/verificacion): triplicar esta tabla
// hubiera sido el primer lugar donde una futura edición de color se
// desincroniza entre páginas.

import type { BucketAging } from "./types";

export const BUCKET_INFO: Record<
  BucketAging,
  { etiqueta: string; color: string; colorSuave: string; gradiente?: string; critico?: boolean }
> = {
  actual: {
    etiqueta: "Al día",
    color: "#0F8B7B",
    colorSuave: "#e6f2f0",
  },
  "1-30": {
    etiqueta: "1–30 días",
    color: "#4F7CFF",
    colorSuave: "#e8edff",
  },
  "31-60": {
    etiqueta: "31–60 días",
    color: "#D97706",
    colorSuave: "#fef3e2",
  },
  "61-90": {
    etiqueta: "61–90 días",
    color: "#EA580C",
    colorSuave: "#feeadb",
    gradiente: "linear-gradient(135deg,#FDBA74,#EA580C)",
    critico: true,
  },
  "90+": {
    etiqueta: "90+ días",
    color: "#D14343",
    colorSuave: "#fde3e3",
    gradiente: "linear-gradient(135deg,#F87171,#D14343)",
    critico: true,
  },
};
