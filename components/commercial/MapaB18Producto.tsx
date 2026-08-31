"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { AgenteProductoVentas, LecturaAgenteProducto } from "@/lib/agentes-producto-ventas";

type Rol = "detecta" | "explica" | "prioriza" | "recomienda";

type RolLectura = {
  id: Rol;
  nombre: string;
  color: string;
  kpi: number;
  etiqueta: string;
  resumen: string;
  problema: string;
  accion: string;
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
      kpi: principal?.pct ?? 0, etiqueta: uno,
      resumen: `${(principal?.pedidos ?? 0).toLocaleString("es-GT")} pedidos incluyen esta señal.`,
      problema: `${uno} concentra ${pct(principal?.pct ?? 0)} de la composición observada.`,
      accion: "Confirmar la señal antes de usarla como decisión comercial.",
    },
    {
      id: "explica", nombre: "Explica", color: colores.explica, grafica: "barras",
      kpi: topDos, etiqueta: "Top 2 del mix",
      resumen: "Tres bandas muestran la distribución observada.",
      problema: `Las dos primeras señales reúnen ${pct(topDos)}: el mix puede estar concentrado.`,
      accion: "Contrastar el patrón con el maestro comercial.",
    },
    {
      id: "prioriza", nombre: "Prioriza", color: colores.prioriza, grafica: "pareto",
      kpi: principal?.pedidos ?? 0, etiqueta: "pedidos",
      resumen: coberturaBaja ? `Cobertura ${pct(lectura.cobertura)}: lectura incompleta.` : `${uno} lidera el Pareto de la categoría.`,
      problema: coberturaBaja ? `Solo ${pct(lectura.cobertura)} de la composición tiene lectura identificada.` : `${uno} domina los pedidos de esta categoría.`,
      accion: "Ordenar la revisión por pedidos, peso y cobertura.",
    },
    {
      id: "recomienda", nombre: "Recomienda", color: colores.recomienda, grafica: "cobertura",
      kpi: lectura.cobertura, etiqueta: "cobertura",
      resumen: "Sin margen ni inventario: validar antes de actuar.",
      problema: coberturaBaja ? `La cobertura es ${pct(lectura.cobertura)}; hay señal no identificada que puede sesgar la lectura.` : "La clasificación está suficientemente cubierta, pero no prueba margen ni inventario.",
      accion: "Evaluar una acción solo con maestro, margen e inventario.",
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
  if (tipo === "pareto") return <div className="b18-mini-pareto" aria-label="Pareto de la categoría activa">
    {filas.map((fila, indice) => <i key={fila!.nombre} style={{ height: `${Math.max(fila!.pct, 12)}%`, backgroundColor: color, opacity: 1 - indice * 0.2 }} />)}
  </div>;
  return <div className="b18-mini-barras" aria-label="Barras de la categoría activa">
    {filas.map((fila, indice) => <i key={fila!.nombre} style={{ width: `${Math.max(fila!.pct, 8)}%`, backgroundColor: color, opacity: 1 - indice * 0.2 }} />)}
  </div>;
}

function TarjetaRol({ item, lectura, insignia, activa, onSeleccionar }: { item: RolLectura; lectura: LecturaAgenteProducto; insignia: string; activa: boolean; onSeleccionar: () => void }) {
  return <button type="button" className={`b18-rol-card b18-rol-${item.id} ${activa ? "is-active" : ""}`} onClick={onSeleccionar} aria-pressed={activa} aria-label={`${item.nombre}. Abrir lectura ampliada`} style={{ "--b18-role": item.color } as CSSProperties}>
    <span className="b18-connector" aria-hidden="true" />
    <div className="b18-rol-visual">
      <div className="b18-rol-heading"><span>{insignia}</span><strong>{item.nombre}</strong></div>
      <div className="b18-rol-content"><div className="b18-rol-kpi"><strong>{item.kpi.toLocaleString("es-GT", { maximumFractionDigits: item.id === "prioriza" ? 0 : 2 })}{item.id === "prioriza" ? "" : "%"}</strong><span>{item.etiqueta}</span></div><MiniGrafica tipo={item.grafica} color={item.color} lectura={lectura} /></div>
      <p className="b18-rol-resumen">{item.resumen}</p>
    </div>
  </button>;
}

function DiagnosticoB18({ lecturas, corte, onCerrar }: { lecturas: Record<AgenteProductoVentas, LecturaAgenteProducto>; corte: string; onCerrar: () => void }) {
  const categorias = Object.keys(lecturas) as AgenteProductoVentas[];
  return <div className="b18-diagnostico-velo" role="presentation" onPointerDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
    <section className="b18-diagnostico" role="dialog" aria-modal="true" aria-labelledby="diagnostico-b18-titulo">
      <header><div><p>Diagnóstico integral</p><h2 id="diagnostico-b18-titulo">B<span>18</span> · problemas encontrados</h2><small>Lectura de composición de líneas confirmadas · corte {corte}</small></div><button type="button" onClick={onCerrar} aria-label="Cerrar diagnóstico B18">×</button></header>
      <div className="b18-diagnostico-grid">{categorias.map((id) => {
        const lectura = lecturas[id];
        const principal = lectura.filas[0];
        return <article key={id}>
          <div className="b18-diagnostico-card-title"><span>{siglas[id]}</span><b>{nombres[id]}</b><em>{pct(lectura.cobertura)} cobertura</em></div>
          <div className="b18-diagnostico-kpi"><div className="b18-diagnostico-dona" style={{ "--b18-color": "#1681ed", "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` } as CSSProperties}><strong>{(principal?.pct ?? 0).toFixed(0)}%</strong></div><div><strong>{principal?.nombre ?? "Sin señal"}</strong><span>{(principal?.pedidos ?? 0).toLocaleString("es-GT")} pedidos con señal</span></div></div>
          <p><b>Hallazgo</b>{lectura.hallazgo}</p>
          <p><b>Problema</b>{lectura.problema}</p>
          <p><b>Validación</b>{lectura.accion}</p>
        </article>;
      })}</div>
      <footer>Fuente: ventas + venta_lineas + productos · Clasificación inferida desde SKU/nombre · Moneda no agregable: segmentar por moneda.</footer>
    </section>
  </div>;
}

type PestanaDrilldown = "resultado" | "problema" | "accion";

function DrilldownRol({ item, lectura, insignia, onCerrar }: { item: RolLectura; lectura: LecturaAgenteProducto; insignia: string; onCerrar: () => void }) {
  const [pestana, setPestana] = useState<PestanaDrilldown>("resultado");
  const principal = lectura.filas[0];
  const pestanas: { id: PestanaDrilldown; nombre: string }[] = [{ id: "resultado", nombre: "Resultado" }, { id: "problema", nombre: "Diagnóstico" }, { id: "accion", nombre: "Acción" }];

  return <div className="b18-drilldown-velo" role="presentation" onPointerDown={(evento) => evento.target === evento.currentTarget && onCerrar()}>
    <section className="b18-drilldown" role="dialog" aria-modal="true" aria-labelledby="b18-drilldown-titulo" style={{ "--b18-role": item.color } as CSSProperties}>
      <header><div><p>Agente comercial · {insignia}</p><h2 id="b18-drilldown-titulo">{item.nombre}: lectura ampliada</h2><span>{lectura.nombre} · corte de ventas confirmado</span></div><button type="button" onClick={onCerrar} aria-label="Cerrar lectura ampliada">×</button></header>
      <nav className="b18-drilldown-tabs" aria-label="Secciones del agente">{pestanas.map((tab) => <button key={tab.id} type="button" aria-pressed={pestana === tab.id} onClick={() => setPestana(tab.id)}>{tab.nombre}</button>)}</nav>
      {pestana === "resultado" ? <div className="b18-drilldown-resultados"><div className="b18-drilldown-kpi"><div className="b18-diagnostico-dona" style={{ "--b18-color": item.color, "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` } as CSSProperties}><strong>{(principal?.pct ?? 0).toFixed(0)}%</strong></div><div><small>Señal principal</small><strong>{principal?.nombre ?? "Sin señal"}</strong><span>{(principal?.pedidos ?? 0).toLocaleString("es-GT")} pedidos · {pct(lectura.cobertura)} de cobertura</span></div></div><div className="b18-drilldown-barras">{lectura.filas.slice(0, 5).map((fila) => <div key={fila.nombre}><span>{fila.nombre}</span><b>{pct(fila.pct)}</b><i style={{ width: `${Math.max(fila.pct, 3)}%` }} /></div>)}</div></div> : null}
      {pestana === "problema" ? <div className="b18-drilldown-texto"><small>Problema encontrado</small><h3>{lectura.problema}</h3><p>{lectura.hallazgo}</p><dl><div><dt>Impacto observado</dt><dd>{item.resumen}</dd></div><div><dt>Límite de lectura</dt><dd>La clasificación se infiere desde SKU y nombre; no sustituye el maestro comercial.</dd></div></dl></div> : null}
      {pestana === "accion" ? <div className="b18-drilldown-texto"><small>Recomendación del agente</small><h3>{item.accion}</h3><p>{lectura.accion}</p><dl><div><dt>Decisión humana</dt><dd>Validar margen, inventario y maestro comercial antes de ejecutar una acción.</dd></div><div><dt>Fuente</dt><dd>Ventas confirmadas + líneas de pedido + productos.</dd></div></dl></div> : null}
    </section>
  </div>;
}

export function MapaB18Producto({ lecturas, corte, fuente, moneda }: { lecturas: Record<AgenteProductoVentas, LecturaAgenteProducto>; corte: string; fuente: string; moneda: string }) {
  const [categoria, setCategoria] = useState<AgenteProductoVentas>("familia");
  const [rolActivo, setRolActivo] = useState<Rol>("detecta");
  const [rolDrilldown, setRolDrilldown] = useState<Rol | null>(null);
  const [diagnosticoAbierto, setDiagnosticoAbierto] = useState(false);
  const lectura = lecturas[categoria];
  const roles = useMemo(() => construirRoles(lectura), [lectura]);
  const principal = lectura.filas[0];
  const activo = roles.find((rol) => rol.id === rolActivo) ?? roles[0];

  return <section className="b18-map" aria-label="Mapa comercial B18 de clasificación de productos">
    <aside className="b18-map-lateral">
      <div className="b18-map-marca">{siglas[categoria]}</div><p>Categorías</p>
      <div className="b18-map-lista">{(Object.keys(lecturas) as AgenteProductoVentas[]).map((id) => <button key={id} type="button" onClick={() => { setCategoria(id); setRolActivo("detecta"); }} aria-pressed={categoria === id}><span>{siglas[id]}</span>{nombres[id]}</button>)}</div>
      <div className="b18-map-status"><span>Agent status</span><b>● Lectura activa</b><p>{lectura.senal}</p></div>
      <button type="button" className="b18-map-b18" onClick={() => setDiagnosticoAbierto(true)} aria-label="Abrir diagnóstico integral B18">B<span>18</span></button>
    </aside>
    <div className="b18-map-canvas">
      <header className="b18-map-header"><div><p>Reporte general</p><h2>Clasificación comercial de productos</h2></div><span>Corte: {corte}</span></header>
      <div className="b18-map-grid">
        {roles.map((item) => <TarjetaRol key={item.id} item={item} lectura={lectura} insignia={siglas[categoria]} activa={item.id === rolActivo} onSeleccionar={() => { setRolActivo(item.id); setRolDrilldown(item.id); }} />)}
        <article className="b18-centro" aria-live="polite">
          <p className="b18-centro-eyebrow">Reporte visual · {lectura.nombre}</p>
          <h3>{lectura.pregunta}</h3>
          <div className="b18-centro-viz"><div className="b18-dona-principal" style={{ "--b18-color": activo.color, "--b18-pct": `${Math.min(principal?.pct ?? 0, 100) * 3.6}deg` } as CSSProperties}><span>{(principal?.pct ?? 0).toFixed(2)}<small>%</small></span><em>{principal?.nombre ?? "Sin señal"}</em></div><div className="b18-centro-barras" aria-label="Distribución de la categoría activa">{lectura.filas.slice(0, 3).map((fila, indice) => <div key={fila.nombre}><span>{fila.nombre}</span><b>{pct(fila.pct)}</b><i style={{ width: `${Math.max(fila.pct, 3)}%`, opacity: 1 - indice * .18, backgroundColor: activo.color }} /></div>)}</div></div>
          <div className="b18-centro-metricas"><div><b>{(principal?.pedidos ?? 0).toLocaleString("es-GT")}</b><span>pedidos con señal</span></div><div><b>{pct(lectura.cobertura)}</b><span>cobertura identificada</span></div><div><b>{lectura.filas.length}</b><span>segmentos visibles</span></div></div>
          <div className="b18-decision"><p>Siguiente validación</p><strong>{activo.accion}</strong></div>
          <dl className="b18-metadatos"><div><dt>Fuente</dt><dd>{fuente}</dd></div><div><dt>Capa</dt><dd>Composición de líneas, no venta total</dd></div><div><dt>Corte</dt><dd>{corte}</dd></div><div><dt>Moneda</dt><dd>{moneda}</dd></div><div><dt>Cobertura</dt><dd>{pct(lectura.cobertura)}</dd></div><div><dt>Límite</dt><dd>SKU/nombre inferido</dd></div></dl>
        </article>
      </div>
    </div>
    {rolDrilldown ? <DrilldownRol item={roles.find((rol) => rol.id === rolDrilldown) ?? roles[0]} lectura={lectura} insignia={siglas[categoria]} onCerrar={() => setRolDrilldown(null)} /> : null}
    {diagnosticoAbierto ? <DiagnosticoB18 lecturas={lecturas} corte={corte} onCerrar={() => setDiagnosticoAbierto(false)} /> : null}
  </section>;
}
