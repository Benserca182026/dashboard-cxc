"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

export type TonoMascota = "riesgo" | "atencion" | "oportunidad" | "analisis";

export const TONOS_MASCOTA: Record<TonoMascota, { etiqueta: string; color: string; nombreColor: string }> = {
  riesgo: { etiqueta: "Riesgo comercial", color: "#ef4d5b", nombreColor: "Rojo" },
  atencion: { etiqueta: "Desbalance del mix", color: "#e9ad28", nombreColor: "Amarillo" },
  oportunidad: { etiqueta: "Oportunidad comercial", color: "#23a978", nombreColor: "Verde" },
  analisis: { etiqueta: "Estrategia", color: "#7957d5", nombreColor: "Morado" },
};

type Posicion = { izquierda: number; arriba: number } | null;

export function MascotaB18({
  tono,
  onTonoCambiar,
}: {
  tono: TonoMascota;
  onTonoCambiar: (tono: TonoMascota) => void;
}) {
  const [presentacion, setPresentacion] = useState(true);
  const [posicion, setPosicion] = useState<Posicion>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inicioArrastre = useRef<{
    x: number;
    y: number;
    izquierda: number;
    arriba: number;
    anchoLimite: number;
    altoLimite: number;
  } | null>(null);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setPresentacion(false), 1150);
    return () => window.clearTimeout(temporizador);
  }, []);

  const iniciarArrastre = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const limite = event.currentTarget.closest<HTMLElement>("[data-b18-boundary]");
    if (!limite) return;
    const cajaLimite = limite.getBoundingClientRect();
    const cajaB18 = event.currentTarget.getBoundingClientRect();
    inicioArrastre.current = {
      x: event.clientX,
      y: event.clientY,
      izquierda: cajaB18.left - cajaLimite.left,
      arriba: cajaB18.top - cajaLimite.top,
      anchoLimite: cajaLimite.width - cajaB18.width,
      altoLimite: cajaLimite.height - cajaB18.height,
    };
    setArrastrando(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moverArrastre = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!inicioArrastre.current) return;
    const siguienteIzquierda = inicioArrastre.current.izquierda + event.clientX - inicioArrastre.current.x;
    const siguienteArriba = inicioArrastre.current.arriba + event.clientY - inicioArrastre.current.y;
    setPosicion({
      izquierda: Math.max(8, Math.min(inicioArrastre.current.anchoLimite - 8, siguienteIzquierda)),
      arriba: Math.max(8, Math.min(inicioArrastre.current.altoLimite - 8, siguienteArriba)),
    });
  };

  const terminarArrastre = () => {
    inicioArrastre.current = null;
    setArrastrando(false);
  };

  const estiloB18 = {
    "--b18-halo": TONOS_MASCOTA[tono].color,
    ...(posicion ? { left: posicion.izquierda, top: posicion.arriba, bottom: "auto" } : {}),
  } as CSSProperties;

  return (
    <>
      {presentacion ? (
        <div className="b18-welcome" data-testid="b18-welcome" aria-label="Bienvenida de B18">
          <div className="b18-welcome-orb" aria-hidden="true">
            <span>B</span><small>18</small>
          </div>
          <div className="b18-welcome-card">
            <strong>Bienvenido, usuario</strong>
            <span>Tu lectura comercial está lista.</span>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`b18-orb ${arrastrando ? "b18-orb-dragging" : ""}`}
        style={estiloB18}
        data-testid="b18"
        onPointerDown={iniciarArrastre}
        onPointerMove={moverArrastre}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
        aria-label={`B18, enfoque ${TONOS_MASCOTA[tono].etiqueta}. Arrastrar para mover.`}
      >
        <span>B</span><small>18</small>
      </button>

      <div className="b18-focus-panel" aria-label="Enfoques comerciales de B18">
        <p>Enfoque de B18</p>
        <div className="b18-focus-options">
          {(Object.keys(TONOS_MASCOTA) as TonoMascota[]).map((opcion) => (
            <button
              key={opcion}
              type="button"
              data-testid={`focus-${opcion}`}
              aria-pressed={tono === opcion}
              onClick={() => onTonoCambiar(opcion)}
              style={{ "--selector-color": TONOS_MASCOTA[opcion].color } as CSSProperties}
            >
              <i aria-hidden="true" />
              <span>{TONOS_MASCOTA[opcion].nombreColor}</span>
              <small>{TONOS_MASCOTA[opcion].etiqueta}</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
