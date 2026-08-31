"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { AgenteProductoVentas, LecturaAgenteProducto } from "@/lib/agentes-producto-ventas";

type Rol = "detecta" | "explica" | "prioriza" | "recomienda";

type RolLectura = {
  id: Rol;
  nombre: string;
  color: string;
  problema: string;
  senal: string;
  paso: string;
  grafica: "dona" | "barras" | "pareto" | "cobertura";
};

const colores: Record<Rol, string> = {
  detecta: "#0789e6",
  explica: "#7b2bf4",
  prioriza: "#16a34a",
  recomienda: "#f97316",
};

const nombres: Record<AgenteProductoVentas, string> = {
  familia: "Familias", tipo: "Tipo de casco", modelo: "Modelos", licencia: "Licencias",
};

const siglas: Record<AgenteProductoVentas, string> = {
  familia: "FA", tipo: "TC", modelo: "MO", licencia: "LI",
};

function pct(valor: number) { return `${valor.toFixed(2)}%`; }

function construirRoles(lectura: LecturaAgenteProducto): RolLectura[] {
  const [principal, siguiente] = lectura.filas;
  const uno = principal?.nombre ?? "Sin señal";
  const dos = siguiente?.nombre ?? "Sin segunda señal";
  const topDos = (principal?.pct ?? 0) + (siguiente?.pct ?? 0);
  const coberturaBaja = lectura.cobertura < 90;

  return [
    {
      id: "detecta", nombre: "Detecta", color: colores.detecta, grafica: "dona",
      problema: lectura.problema,
      senal: `${uno} concentra ${pct(principal?.pct ?? 0)} de la composición de esta categoría.`,
      paso: "Confirmar que esta señal representa la decisión comercial que se quiere tomar.",
    },
    {
      id: "explica", nombre: "Explica", color: colores.explica, grafica: "barras",
      problema: "¿Cómo se reparte la composición y qué todavía no demuestra?",
      senal: `${uno} y ${dos} reúnen ${pct(topDos)}; la clasificación se infiere desde SKU y nombre.`,
      paso: "Contrastar el patrón con el maestro comercial antes de atribuir una causa.",
    },
    {
      id: "prioriza", nombre: "Prioriza", color: colores.prioriza, grafica: "pareto",
      problema: "¿Qué concentración o incertidumbre merece foco primero?",
      senal: coberturaBaja ? `La cobertura es ${pct(lectura.cobertura)}: hay valor que aún no se puede priorizar con confianza.` : `${uno} es la principal concentración observada; revisar dependencia relativa.`,
      paso: "Ordenar la revisión por valor, pedidos y porcentaje de cobertura.",
    },
    {
      id: "recomienda", nombre: "Recomienda", color: colores.recomienda, grafica: "cobertura",
      problema: "¿Qué experimento comercial se puede evaluar de forma responsable?",
      senal: `Cobertura de clasificación: ${pct(lectura.cobertura)}. No hay margen ni inventario en esta lectura.`,
      paso: "Evaluar una acción solo después de validar margen, inventario y maestro comercial.",
    },
  ];
}

function MiniGrafica({ tipo, color, lectura }: { tipo: RolLectura["grafica"]; color: string; lectura: LecturaAgenteProducto }) {
  const [uno, dos, tres] = lectura.filas;
  if (tipo === "dona" || tipo === "cobertura") {
    const valor = tipo === "dona" ? uno?.pct ?? 0 : lectura.cobertura;
    return <div className="b18-mini-dona" style={{ "--b18-color": color, "--b18-pct": `${Math.min(valor, 100) * 3.6}deg` } as CSSProperties} aria-label={`${tipo}: ${pct(valor)}`}><span>{valor.toFixed(0)}%</span></div>;
  }
  const filas = [uno, dos, tres].filter(Boolean);
  return <div className="b18-mini-barras" aria-label={`${tipo} de la categoría activa`}>
    {filas.map((fila, indice) => <i key={fila!.nombre} style={{ width: `${Math.max(fila!.pct, 8)}%`, backgroundColor: color, opacity: 1 - indice * 0.2 }} />)}
  </div>;
}

function TarjetaRol({ item, lectura, insignia, activa, onSeleccionar }: { item: RolLectura; lectura: LecturaAgenteProducto; insignia: string; activa: boolean; onSeleccionar: () => void }) {
  return <button type="button" className={`b18-rol-card b18-rol-${item.id} ${activa ? "is-active" : ""}`} onClick={onSeleccionar} aria-pressed={activa} style={{ "--b18-role": item.color } as CSSProperties}>
    <span className="b18-connector" aria-hidden="true" />
    <div className="b18-rol-heading"><span>{insignia}</span><strong>{item.nombre}</strong></div>
    <div className="b18-rol-content"><div><p><b>Problema</b>{item.problema}</p><p><b>Señal</b>{item.senal}</p><p><b>Próximo paso</b>{item.paso}</p></div><MiniGrafica tipo={item.grafica} color={item.color} lectura={lectura} /></div>
  </button>;
}

export function MapaB18Producto({ lecturas, corte, fuente, moneda }: { lecturas: Record<AgenteProductoVentas, LecturaAgenteProducto>; corte: string; fuente: string; moneda: string }) {
  const [categoria, setCategoria] = useState<AgenteProductoVentas>("familia");
  const [rolActivo, setRolActivo] = useState<Rol>("detecta");
  const lectura = lecturas[categoria];
  const roles = useMemo(() => construirRoles(lectura), [lectura]);
  const principal = lectura.filas[0];
  const activo = roles.find((rol) => rol.id === rolActivo) ?? roles[0];

  return <section className="b18-map" aria-label="Mapa comercial B18 de clasificación de productos">
    <aside className="b18-map-lateral">
      <div className="b18-map-marca">{siglas[categoria]}</div><p>Categorías</p>
      <div className="b18-map-lista">{(Object.keys(lecturas) as AgenteProductoVentas[]).map((id) => <button key={id} type="button" onClick={() => { setCategoria(id); setRolActivo("detecta"); }} aria-pressed={categoria === id}><span>{siglas[id]}</span>{nombres[id]}</button>)}</div>
      <div className="b18-map-status"><span>Agent status</span><b>● Lectura activa</b><p>{lectura.senal}</p></div>
    </aside>
    <div className="b18-map-canvas">
      <header className="b18-map-header"><div><p>Reporte general</p><h2>Clasificación comercial de productos</h2></div><span>Corte: {corte}</span></header>
      <div className="b18-map-grid">
        {roles.map((item) => <TarjetaRol key={item.id} item={item} lectura={lectura} insignia={siglas[categoria]} activa={item.id === rolActivo} onSeleccionar={() => setRolActivo(item.id)} />)}
        <article className="b18-centro" aria-live="polite">
          <div className="b18-centro-orbita" aria-hidden="true" />
          <div className="b18-centro-mascota">B<span>18</span></div>
          <p className="b18-centro-eyebrow">B18 coordina las cuatro lecturas</p>
          <h3>{lectura.pregunta}</h3>
          <div className="b18-centro-viz"><div className="b18-dona-principal" style={{ "--b18-color": activo.color, "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` } as CSSProperties}><span>{(principal?.pct ?? 0).toFixed(2)}<small>%</small></span><em>{principal?.nombre ?? "Sin señal"}</em></div><div><p>Hecho demostrado</p><strong>{lectura.hallazgo}</strong><span>{lectura.explicacion}</span></div></div>
          <div className="b18-resumen"><p><b>Problema completo</b>{lectura.problema}</p><p><b>Lo que aún no sabemos</b>La clasificación es inferida desde SKU y nombre; no sustituye el maestro Odoo.</p><p><b>Riesgo principal</b>{lectura.cobertura < 90 ? `La cobertura de ${pct(lectura.cobertura)} limita cualquier decisión por esta categoría.` : "La concentración observada no demuestra margen, inventario ni causalidad."}</p><p><b>Tensión entre lecturas</b>{activo.nombre} prioriza una perspectiva; B18 requiere contrastarla con las otras tres antes de decidir.</p></div>
          <div className="b18-decision"><p>Decisión humana requerida</p><strong>{activo.paso}</strong></div>
          <dl className="b18-metadatos"><div><dt>Fuente</dt><dd>{fuente}</dd></div><div><dt>Capa</dt><dd>Composición de líneas, no venta total</dd></div><div><dt>Corte</dt><dd>{corte}</dd></div><div><dt>Moneda</dt><dd>{moneda}</dd></div><div><dt>Cobertura</dt><dd>{pct(lectura.cobertura)}</dd></div><div><dt>Límite</dt><dd>SKU/nombre inferido</dd></div></dl>
        </article>
      </div>
    </div>
  </section>;
}
