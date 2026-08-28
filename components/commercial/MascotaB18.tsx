"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type TonoMascota = "riesgo" | "atencion" | "oportunidad" | "analisis";

const TONOS: Record<TonoMascota, { etiqueta: string; color: string }> = {
  riesgo: { etiqueta: "Riesgo", color: "#ef5b63" },
  atencion: { etiqueta: "Atención", color: "#f1b84b" },
  oportunidad: { etiqueta: "Oportunidad", color: "#32b883" },
  analisis: { etiqueta: "Análisis", color: "#8b67df" },
};

export function MascotaB18({
  agente,
  alerta,
  detalleAbierto,
}: {
  agente: string;
  alerta: string;
  detalleAbierto: boolean;
}) {
  const [tono, setTono] = useState<TonoMascota>("riesgo");
  const [presentacion, setPresentacion] = useState(true);
  const color = TONOS[tono].color;

  useEffect(() => {
    const temporizador = window.setTimeout(() => setPresentacion(false), 1100);
    return () => window.clearTimeout(temporizador);
  }, []);

  const mensaje = useMemo(
    () => detalleAbierto
      ? `Estoy revisando ${agente}. El tablero ya está listo para profundizar.`
      : `${agente}: ${alerta}. Toca el agente central para ver el detalle.`,
    [agente, alerta, detalleAbierto],
  );

  return <>
    {presentacion ? <div className="mascota-b18-intro" aria-label="Benserca 18 cargando">
      <div className="mascota-b18-intro-marca"><b>B</b><span>18</span></div>
      <p>Benserca 18</p>
    </div> : null}
    <aside
      className={`mascota-b18 group ${detalleAbierto ? "mascota-b18-en-detalle" : ""}`}
      style={{ "--mascota-color": color } as CSSProperties}
      aria-label="Guía B18"
    >
      <div className="mascota-b18-opciones" aria-label="Elegir enfoque de B18">
        {(Object.keys(TONOS) as TonoMascota[]).map((opcion) => <button
          key={opcion}
          type="button"
          title={TONOS[opcion].etiqueta}
          aria-pressed={tono === opcion}
          onClick={() => setTono(opcion)}
          className="mascota-b18-color"
          style={{ backgroundColor: TONOS[opcion].color }}
        />)}
      </div>
      <div className="mascota-b18-figura" title="Pasa el mouse para elegir el enfoque">
        <img src="/mascota-b18.png" alt="B18, guía de análisis" />
        <span className="mascota-b18-marca"><b>B</b><i>18</i></span>
      </div>
      <div className="mascota-b18-globo">
        <div className="flex items-center gap-1.5"><span className="mascota-b18-punto" /><strong>B18 · {TONOS[tono].etiqueta}</strong></div>
        <p>{mensaje}</p>
      </div>
    </aside>
  </>;
}
