"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export type TonoMascota = "riesgo" | "atencion" | "oportunidad" | "analisis";

export const TONOS_MASCOTA: Record<TonoMascota, { etiqueta: string; color: string }> = {
  riesgo: { etiqueta: "Riesgo", color: "#ef5b63" },
  atencion: { etiqueta: "Atención", color: "#f1b84b" },
  oportunidad: { etiqueta: "Oportunidad", color: "#32b883" },
  analisis: { etiqueta: "Análisis", color: "#8b67df" },
};

export function MascotaB18({ detalleAbierto, explicacionActiva, enPanelLateral = false, onTonoCambiar, onExplicacionActiva }: { detalleAbierto: boolean; explicacionActiva: boolean; enPanelLateral?: boolean; onTonoCambiar: (tono: TonoMascota) => void; onExplicacionActiva: () => void }) {
  const [tono, setTono] = useState<TonoMascota>("riesgo");
  const [presentacion, setPresentacion] = useState(true);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ x: 14, y: 18 });
  const inicioArrastre = useRef<{ x: number; y: number; izquierda: number; abajo: number } | null>(null);
  const seArrastro = useRef(false);
  const elegirTono = (siguiente: TonoMascota) => { setTono(siguiente); onTonoCambiar(siguiente); onExplicacionActiva(); setSelectorAbierto(false); };
  const iniciarArrastre = (event: ReactPointerEvent<HTMLButtonElement>) => {
    inicioArrastre.current = { x: event.clientX, y: event.clientY, izquierda: posicion.x, abajo: posicion.y };
    seArrastro.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moverArrastre = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!inicioArrastre.current) return;
    const dx = event.clientX - inicioArrastre.current.x;
    const dy = event.clientY - inicioArrastre.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) seArrastro.current = true;
    setPosicion({ x: Math.max(-70, Math.min(220, inicioArrastre.current.izquierda + dx)), y: Math.max(8, Math.min(330, inicioArrastre.current.abajo - dy)) });
  };
  const terminarArrastre = () => { inicioArrastre.current = null; };

  useEffect(() => {
    const temporizador = window.setTimeout(() => setPresentacion(false), 1100);
    return () => window.clearTimeout(temporizador);
  }, []);

  return <>
    {presentacion ? <div className="mascota-b18-intro" aria-label="Benserca 18 cargando">
      <div className="mascota-b18-intro-marca"><b>B</b><span>18</span></div>
      <p>Benserca 18</p>
    </div> : null}
    <aside className={`mascota-b18 ${enPanelLateral ? "mascota-b18-en-panel" : ""} ${detalleAbierto && !enPanelLateral ? "mascota-b18-en-detalle" : ""}`} style={enPanelLateral ? { "--mascota-color": TONOS_MASCOTA[tono].color } as CSSProperties : { "--mascota-color": TONOS_MASCOTA[tono].color, left: posicion.x, bottom: posicion.y } as CSSProperties} aria-label="Guía B18">
      <div className={`mascota-b18-opciones ${selectorAbierto ? "mascota-b18-opciones-abiertas" : ""}`} aria-label="Elegir enfoque de B18">
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
      <button type="button" onPointerDown={iniciarArrastre} onPointerMove={moverArrastre} onPointerUp={terminarArrastre} onPointerCancel={terminarArrastre} onClick={() => { if (!seArrastro.current) setSelectorAbierto((abierto) => !abierto); }} aria-expanded={selectorAbierto} className="mascota-b18-figura" aria-label="Abrir o mover los enfoques de B18"><b>B</b><i>18</i></button>
      {explicacionActiva ? <div className="mascota-b18-explicacion"><b>B18 · {TONOS_MASCOTA[tono].etiqueta}</b><span>Los agentes muestran qué problema comercial atienden.</span></div> : null}
    </aside>
  </>;
}
