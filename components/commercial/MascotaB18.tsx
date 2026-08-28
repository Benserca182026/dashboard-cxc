"use client";

import { useEffect, useState, type CSSProperties } from "react";

export type TonoMascota = "riesgo" | "atencion" | "oportunidad" | "analisis";

export const TONOS_MASCOTA: Record<TonoMascota, { etiqueta: string; color: string }> = {
  riesgo: { etiqueta: "Riesgo", color: "#ef5b63" },
  atencion: { etiqueta: "Atención", color: "#f1b84b" },
  oportunidad: { etiqueta: "Oportunidad", color: "#32b883" },
  analisis: { etiqueta: "Análisis", color: "#8b67df" },
};

export function MascotaB18({ detalleAbierto, onTonoCambiar }: { detalleAbierto: boolean; onTonoCambiar: (tono: TonoMascota) => void }) {
  const [tono, setTono] = useState<TonoMascota>("riesgo");
  const [presentacion, setPresentacion] = useState(true);
  const elegirTono = (siguiente: TonoMascota) => { setTono(siguiente); onTonoCambiar(siguiente); };

  useEffect(() => {
    const temporizador = window.setTimeout(() => setPresentacion(false), 1100);
    return () => window.clearTimeout(temporizador);
  }, []);

  return <>
    {presentacion ? <div className="mascota-b18-intro" aria-label="Benserca 18 cargando">
      <div className="mascota-b18-intro-marca"><b>B</b><span>18</span></div>
      <p>Benserca 18</p>
    </div> : null}
    <aside className={`mascota-b18 ${detalleAbierto ? "mascota-b18-en-detalle" : ""}`} style={{ "--mascota-color": TONOS_MASCOTA[tono].color } as CSSProperties} aria-label="Guía B18">
      <div className="mascota-b18-opciones" aria-label="Elegir enfoque de B18">
        {(Object.keys(TONOS_MASCOTA) as TonoMascota[]).map((opcion) => <button
          key={opcion}
          type="button"
          aria-label={TONOS_MASCOTA[opcion].etiqueta}
          aria-pressed={tono === opcion}
          onClick={() => elegirTono(opcion)}
          className="mascota-b18-color"
          style={{ backgroundColor: TONOS_MASCOTA[opcion].color }}
        />)}
      </div>
      <div className="mascota-b18-figura" aria-label="B18, guía de análisis"><b>B</b><i>18</i></div>
    </aside>
  </>;
}
