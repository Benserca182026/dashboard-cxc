/// <reference types="vite/client" />
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type {
  AgenteClientesB18,
  BarraClientesB18,
  ComparativoClientesB18,
  CorteConcentracionB18,
  EstadoCobertura,
  FilaClienteB18,
  LecturaAgenteClienteB18,
  MetricaClientesB18,
  ProcedenciaClientes,
  PropsMapaB18Clientes,
  PuntoSerieClientesB18,
  SeccionB18Clientes,
  TramoRecenciaB18,
} from "@/lib/contrato-clientes-b18";
import est from "./MapaB18Clientes.module.css";

/**
 * B18 · CLIENTES — dashboard integral.
 *
 * B18 acá NO es un quinto KPI: es la pantalla completa de Clientes, con siete
 * secciones. Se eligieron PESTAÑAS y no siete bloques apilados por una razón
 * concreta: apiladas, las siete secciones suman ~5.000px de alto en escritorio
 * y el doble en móvil, y la procedencia de cada una —que es el punto de toda la
 * pantalla— queda a media pantalla de distancia del número que califica. Con
 * pestañas, cada sección entra completa con su procedencia debajo, sin scroll
 * de reconocimiento.
 *
 * Las pestañas van AGRUPADAS POR CAPA, no en una fila plana. Ésa es la manera
 * de que CxC no se lea como un quinto KPI de ventas: no comparte grupo, ni
 * color, ni forma de tarjeta con las secciones de venta confirmada. La barra de
 * pestañas es, además, la leyenda de capas de la pantalla.
 *
 * Todo lo que se ve acá viene calculado y formateado del contrato. Este archivo
 * no divide, no suma y no formatea moneda. Los únicos números que produce son
 * conteos de lo que está listando (`filas.length`), que es una descripción de la
 * lista, no una cifra de negocio.
 *
 * El detalle SIEMPRE se abre con clic. No hay una sola pieza de información que
 * dependa de pasar el mouse: en una tablet o con teclado esa información no
 * existiría.
 */

// ── Piezas compartidas ─────────────────────────────────────────────────────

/**
 * La procedencia va debajo de CADA sección, no una vez en el pie de la página.
 * Un número sin su límite al lado es un número que alguien va a copiar a un
 * correo sin el límite.
 */
function Procedencia({ p, tono }: { p: ProcedenciaClientes; tono: string }) {
  return <dl className={est.proc} data-tono={tono}>
    <div className={est.procCapa}><dt>Capa</dt><dd>{p.capa}</dd></div>
    <div><dt>Fuente</dt><dd>{p.fuente}</dd></div>
    <div><dt>Período</dt><dd>{p.periodo}</dd></div>
    <div><dt>Corte</dt><dd>{p.corte}</dd></div>
    <div><dt>Moneda</dt><dd>{p.moneda}</dd></div>
    <div><dt>Cobertura</dt><dd><b>{p.cobertura.valor.toFixed(2)}%</b> {p.cobertura.etiqueta}</dd></div>
    <div className={est.procLimite}><dt>Límite</dt><dd>{p.limite}</dd></div>
  </dl>;
}

/** Aviso de capa. Va en el flujo, antes del número, no como nota al pie. */
function Aviso({ titulo, texto, tono = "capa" }: { titulo: string; texto: string; tono?: string }) {
  return <p className={est.aviso} data-tono={tono}><b>{titulo}</b>{texto}</p>;
}

function Metricas({ items, tono }: { items: MetricaClientesB18[]; tono: string }) {
  return <div className={est.metricas} data-tono={tono}>
    {items.map((m) => <div key={m.etiqueta} className={est.metrica}>
      <b>{m.valor}</b>
      <span>{m.etiqueta}</span>
      {m.nota ? <small>{m.nota}</small> : null}
    </div>)}
  </div>;
}

/**
 * Lista de clientes. Es la unidad clicable de recencia, concentración y de los
 * agentes: la fila abre su propio detalle, y sólo una a la vez para que el
 * bloque no crezca sin control.
 *
 * `total` es el conteo REAL del tramo o del corte (`totalFilas` del contrato),
 * que puede ser mayor que lo que llega en `filas`. Sin ese dato el rótulo decía
 * "10 clientes listados" a un dedo de un tramo que decía 243, y las dos cifras
 * se leían como contradictorias. Ahora dice "10 de 243" y, debajo de la lista,
 * por qué faltan los otros 233. Cuando no hay truncamiento se usa la forma
 * corta: "20 de 20" es ruido, no información.
 */
function ListaClientes({ filas, titulo, total, onVerFicha }: {
  filas: FilaClienteB18[];
  titulo: string;
  total?: number;
  onVerFicha?: (clienteId: string) => void;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const real = total ?? filas.length;
  const truncada = real > filas.length;
  if (filas.length === 0) return <p className={est.vacio}>Este corte no lista clientes.</p>;
  return <div className={est.lista}>
    <p className={est.listaTitulo}>
      {titulo}
      {truncada
        ? <em data-truncada="true">{filas.length.toLocaleString("es-GT")} de {real.toLocaleString("es-GT")} clientes</em>
        : <em>{filas.length.toLocaleString("es-GT")} {filas.length === 1 ? "cliente listado" : "clientes listados"}</em>}
    </p>
    {/* Las celdas llevan su unidad escrita ("8 ped.", "123 d") además del
        encabezado: en móvil el encabezado no cabe y la celda tiene que
        explicarse sola. */}
    <div className={est.listaCabecera} aria-hidden="true"><span>Cliente</span><b>Venta</b><i>Frecuencia</i><u>Recencia</u></div>
    {filas.map((f) => {
      const activa = abierta === f.id;
      return <div key={f.id} className={est.listaItem} data-abierta={activa || undefined}>
        <button
          type="button"
          onClick={() => setAbierta(activa ? null : f.id)}
          aria-expanded={activa}
          aria-label={`${f.etiqueta}. ${activa ? "Cerrar" : "Abrir"} detalle`}
        >
          <span>{f.etiqueta}</span>
          <b>{f.texto}</b>
          <i>{f.pedidos.toLocaleString("es-GT")} ped.</i>
          <u>{f.dias === null ? "sin compra" : `${f.dias.toLocaleString("es-GT")} d`}</u>
        </button>
        {activa ? <dl className={est.listaDetalle}>
          <div><dt>Identificador</dt><dd>{f.id}</dd></div>
          <div><dt>Pedidos confirmados</dt><dd>{f.pedidos.toLocaleString("es-GT")}</dd></div>
          <div><dt>Venta acumulada</dt><dd>{f.texto}</dd></div>
          <div><dt>Última compra</dt><dd>{f.ultima ?? "Sin compra confirmada"}</dd></div>
          <div><dt>Días al corte</dt><dd>{f.dias === null ? "No aplica: no hay última compra" : `${f.dias.toLocaleString("es-GT")} días`}</dd></div>
          {/* La ficha individual se abre con CLIC, nunca al pasar el mouse.
              Vive fuera del mapa: el componente sólo avisa a quién se eligió. */}
          {onVerFicha ? <div className={est.listaFicha}>
            <button type="button" onClick={() => onVerFicha(f.id)} aria-label={`Ver ficha comercial de ${f.etiqueta}`}>
              Ver ficha del cliente <span aria-hidden="true">→</span>
            </button>
          </div> : null}
        </dl> : null}
      </div>;
    })}
    {truncada ? <p className={est.listaTruncada}>
      Listado truncado. Se muestran los <b>{filas.length.toLocaleString("es-GT")}</b> de mayor venta acumulada; el conteo completo es de <b>{real.toLocaleString("es-GT")}</b> clientes.
    </p> : null}
  </div>;
}

/** Barras horizontales con marca explícita de período parcial. */
function Barras({ filas, color }: { filas: BarraClientesB18[]; color: string }) {
  const [abierta, setAbierta] = useState<string | null>(filas[0]?.clave ?? null);
  if (filas.length === 0) return <p className={est.vacio}>Sin series observadas.</p>;
  return <div className={est.barras} style={{ "--acento": color } as CSSProperties}>
    {filas.map((b) => {
      const activa = abierta === b.clave;
      return <button
        key={b.clave}
        type="button"
        className={est.barra}
        data-parcial={b.parcial || undefined}
        data-abierta={activa || undefined}
        onClick={() => setAbierta(activa ? null : b.clave)}
        aria-expanded={activa}
      >
        <span>{b.etiqueta}{b.parcial ? <em>parcial</em> : null}</span>
        <b>{b.texto}</b>
        <i style={{ width: `${Math.max(b.ancho, 2)}%` }} />
        {activa ? <small>{b.nota ? `${b.nota} · ` : ""}{b.detalle}</small> : null}
      </button>;
    })}
  </div>;
}

function Comparativo({ c }: { c: ComparativoClientesB18 }) {
  return <div className={est.comparativo}>
    <p>{c.titulo}<b>{c.delta}</b></p>
    <div><span>{c.actual.etiqueta}</span><b>{c.actual.texto}</b><i style={{ width: `${c.actual.ancho}%` }} /></div>
    <div data-previo="true"><span>{c.previo.etiqueta}</span><b>{c.previo.texto}</b><i style={{ width: `${c.previo.ancho}%` }} /></div>
    <small>{c.nota}</small>
  </div>;
}

// ── Sección 1 · Cartera ────────────────────────────────────────────────────

function SeccionCartera({ panel }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["cartera"] }) {
  return <>
    <Encabezado
      rotulo="Venta confirmada"
      titulo="Cartera de clientes"
      bajada="Tamaño de la base, actividad del año y ticket. Todo sobre pedidos en estado confirmado."
      tono="venta"
    />
    <Metricas items={panel.metricas} tono="venta" />
    <Procedencia p={panel.procedencia} tono="venta" />
  </>;
}

// ── Sección 2 · Recencia ───────────────────────────────────────────────────

function SeccionRecencia({ panel, onVerFicha }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["recencia"]; onVerFicha?: (clienteId: string) => void }) {
  const [abierto, setAbierto] = useState<TramoRecenciaB18["clave"]>(panel.tramos[0]?.clave ?? "0-30");
  const tramo = panel.tramos.find((t) => t.clave === abierto) ?? panel.tramos[0];
  return <>
    <Encabezado
      rotulo="Venta confirmada"
      titulo="Recencia"
      bajada="Días entre la última compra confirmada de cada cliente y el corte. Pulsá un tramo para ver sus clientes."
      tono="venta"
    />
    <div className={est.tramos}>
      {panel.tramos.map((t) => <button
        key={t.clave}
        type="button"
        className={est.tramo}
        data-abierto={t.clave === abierto || undefined}
        data-frio={t.clave === "90+" || undefined}
        onClick={() => setAbierto(t.clave)}
        aria-pressed={t.clave === abierto}
        aria-label={`${t.etiqueta}. ${t.clientes} clientes. Abrir listado`}
      >
        <strong>{t.clientes.toLocaleString("es-GT")}</strong>
        <span>{t.etiqueta}</span>
        <i style={{ width: `${Math.max(t.ancho, 3)}%` }} />
        <small>{t.texto}</small>
      </button>)}
    </div>
    {tramo ? <div className={est.detalleBloque}>
      <ListaClientes key={tramo.clave} filas={tramo.filas} total={tramo.totalFilas} titulo={`Clientes en ${tramo.etiqueta.toLowerCase()}`} onVerFicha={onVerFicha} />
    </div> : null}
    <Procedencia p={panel.procedencia} tono="venta" />
  </>;
}

// ── Sección 3 · Concentración ──────────────────────────────────────────────

function SeccionConcentracion({ panel, onVerFicha }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["concentracion"]; onVerFicha?: (clienteId: string) => void }) {
  const [abierto, setAbierto] = useState<CorteConcentracionB18["clave"]>(panel.cortes[0]?.clave ?? "top1");
  const corte = panel.cortes.find((c) => c.clave === abierto) ?? panel.cortes[0];
  return <>
    <Encabezado
      rotulo="Venta confirmada"
      titulo="Concentración"
      bajada="Participación de las cuentas más grandes sobre la venta del período. El denominador es siempre la venta total, nunca el subconjunto."
      tono="venta"
    />
    <div className={est.cortes}>
      {panel.cortes.map((c) => <button
        key={c.clave}
        type="button"
        className={est.corte}
        data-abierto={c.clave === abierto || undefined}
        onClick={() => setAbierto(c.clave)}
        aria-pressed={c.clave === abierto}
        aria-label={`${c.etiqueta}. ${c.pct.toFixed(2)}% de la venta. Abrir clientes`}
      >
        <span>{c.etiqueta}</span>
        <strong>{c.pct.toFixed(2)}%</strong>
        <i><u style={{ width: `${Math.min(c.pct, 100)}%` }} /></i>
        <small>{c.texto}</small>
      </button>)}
    </div>
    {corte ? <div className={est.detalleBloque}>
      <ListaClientes key={corte.clave} filas={corte.filas} total={corte.totalFilas} titulo={`Clientes del ${corte.etiqueta}`} onVerFicha={onVerFicha} />
    </div> : null}
    <Procedencia p={panel.procedencia} tono="venta" />
  </>;
}

// ── Sección 4 · Serie ──────────────────────────────────────────────────────

type MetricaSerie = "valor" | "clientes" | "pedidos";

function SeccionSerie({ panel, fmt }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["serie"]; fmt?: (v: number) => string }) {
  const [metrica, setMetrica] = useState<MetricaSerie>("valor");
  const [mes, setMes] = useState<string | null>(null);

  const maximo = metrica === "valor" ? panel.maxValor : metrica === "clientes" ? panel.maxClientes : panel.maxPedidos;
  const leer = (m: PuntoSerieClientesB18) => metrica === "valor" ? m.valor : metrica === "clientes" ? m.clientes : m.pedidos;
  /* El tope de la escala no se formatea acá: si la app no pasó `fmt`, se usa el
     `texto` que el propio dato trae para el mes que sostiene el máximo. */
  const mesTope = panel.meses.find((m) => m.valor === panel.maxValor);
  const tope = metrica === "valor"
    ? (fmt ? fmt(panel.maxValor) : mesTope?.texto ?? "—")
    : maximo.toLocaleString("es-GT");
  const abierto = panel.meses.find((m) => m.clave === mes) ?? null;
  const parciales = panel.meses.filter((m) => m.parcial);

  return <>
    <Encabezado
      rotulo="Venta confirmada"
      titulo="Serie mensual"
      bajada="Clientes, pedidos y venta mes a mes. Pulsá un mes para ver sus tres cifras."
      tono="venta"
    />

    <div className={est.serieBarra}>
      <div className={est.conmutador} role="group" aria-label="Métrica de la serie">
        {([["valor", "Venta"], ["clientes", "Clientes"], ["pedidos", "Pedidos"]] as [MetricaSerie, string][]).map(([id, nombre]) =>
          <button key={id} type="button" aria-pressed={metrica === id} onClick={() => setMetrica(id)}>{nombre}</button>)}
      </div>
      <p className={est.escala}>Máximo de la escala <b>{tope}</b></p>
    </div>

    {parciales.length > 0 ? <Aviso
      tono="parcial"
      titulo={`${parciales.length} meses parciales, marcados en naranja rayado`}
      texto={parciales.map((m) => `${m.etiqueta}: ${m.nota ?? "período incompleto"}`).join(" · ")}
    /> : null}

    <div className={est.serieMarco}>
      <div className={est.serie} role="group" aria-label="Serie mensual">
        {panel.meses.map((m) => <button
          key={m.clave}
          type="button"
          className={est.mes}
          data-parcial={m.parcial || undefined}
          data-abierto={m.clave === mes || undefined}
          onClick={() => setMes(m.clave === mes ? null : m.clave)}
          aria-pressed={m.clave === mes}
          aria-label={`${m.etiqueta}${m.parcial ? ", mes parcial" : ""}. ${m.texto}, ${m.clientes} clientes, ${m.pedidos} pedidos`}
        >
          <i style={{ height: `${Math.max((leer(m) / (maximo || 1)) * 100, 3)}%` }} />
          <span>{m.etiqueta}</span>
        </button>)}
      </div>
    </div>

    <div className={est.detalleBloque}>
      {abierto ? <dl className={est.mesFicha} data-parcial={abierto.parcial || undefined}>
        <p>{abierto.etiqueta}{abierto.parcial ? <em>mes parcial</em> : null}</p>
        <div><dt>Venta</dt><dd>{abierto.texto}</dd></div>
        <div><dt>Clientes</dt><dd>{abierto.clientes.toLocaleString("es-GT")}</dd></div>
        <div><dt>Pedidos</dt><dd>{abierto.pedidos.toLocaleString("es-GT")}</dd></div>
        <div><dt>Período</dt><dd>{abierto.clave}</dd></div>
        {abierto.nota ? <div className={est.mesNota}><dt>Por qué es parcial</dt><dd>{abierto.nota}</dd></div> : null}
      </dl> : <p className={est.ayuda}>Pulsá cualquier mes de la serie para abrir sus tres cifras. Los meses rayados en naranja están incompletos y no se comparan contra un mes cerrado.</p>}
    </div>

    <Procedencia p={panel.procedencia} tono="venta" />
  </>;
}

// ── Sección 5 · Composición ────────────────────────────────────────────────

function SeccionComposicion({ panel }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["composicion"] }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  return <>
    <Encabezado
      rotulo="Composición de líneas"
      titulo="Qué compran"
      bajada="Familias y SKU de las líneas de pedido. Sirve para saber qué se lleva el cliente, no cuánto se le facturó."
      tono="composicion"
    />
    <Aviso titulo="Esto no es facturación" texto={panel.advertencia} tono="composicion" />
    <div className={est.compo}>
      {panel.filas.map((f) => {
        const activa = abierta === f.etiqueta;
        return <button
          key={f.etiqueta}
          type="button"
          className={est.compoFila}
          data-abierta={activa || undefined}
          onClick={() => setAbierta(activa ? null : f.etiqueta)}
          aria-expanded={activa}
        >
          <span>{f.etiqueta}</span>
          <b>{f.texto}</b>
          <i style={{ width: `${Math.max(f.ancho, 2)}%` }} />
          {activa ? <small>{f.unidades.toLocaleString("es-GT")} unidades en líneas de pedido · {f.texto} a precio de lista, no facturado</small> : null}
        </button>;
      })}
    </div>
    <Procedencia p={panel.procedencia} tono="composicion" />
  </>;
}

// ── Sección 6 · CxC ────────────────────────────────────────────────────────

/**
 * CxC es OTRA CAPA, no otro KPI. Por eso rompe deliberadamente con el resto de
 * la pantalla: fondo oscuro, acento verde en vez de azul, y —cuando hay cifras—
 * puestas como la operación que son (bruta − saldo a favor = neta) en vez de
 * como tres tarjetas iguales a las de cartera. Si se viera como las demás, se
 * sumaría a la venta en la cabeza del lector.
 *
 * v2 · LA SECCIÓN TIENE DOS ESTADOS Y HOY LLEGA EN "pendiente".
 * `saldos_odoo` no forma parte del dataset comercial de Clientes, así que la
 * ecuación no se dibuja: con el dato real diría «Q1,133,597.08 − No derivable =
 * No derivable», que es exactamente la clase de renglón que esta pantalla
 * existe para no producir. En "pendiente" no hay un solo número: hay el motivo
 * y el enlace a la página que sí tiene la cartera. La losa de la ecuación queda
 * escrita y probada para cuando el estado pase a "integrado".
 */
function CxcEcuacion({ cifras }: { cifras: NonNullable<PropsMapaB18Clientes["mapa"]["b18"]["cxc"]["cifras"]> }) {
  const piezas: { m: MetricaClientesB18; signo: string | null }[] = [
    { m: cifras.bruta, signo: null },
    { m: cifras.saldoFavor, signo: "−" },
    { m: cifras.neta, signo: "=" },
  ];
  return <div className={est.cxc}>
    {piezas.map(({ m, signo }) => <div key={m.etiqueta} className={est.cxcPieza} data-neta={signo === "=" || undefined}>
      {signo ? <em aria-hidden="true">{signo}</em> : null}
      <div>
        <b>{m.valor}</b>
        <span>{m.etiqueta}</span>
        {m.nota ? <small>{m.nota}</small> : null}
      </div>
    </div>)}
  </div>;
}

/**
 * Estado pendiente. Conserva la piel de la capa CxC —losa oscura, verde, ancho
 * completo— para que se siga leyendo como otra capa, pero con el borde punteado
 * que dice que ahí no hay dato. Muestra el mensaje del contrato y el enlace, y
 * nada más: ni un Q0.00 de relleno, ni un "No derivable" dentro de una
 * ecuación, ni la cartera bruta presentada como cálculo de esta pantalla.
 */
function CxcPendiente({ pendiente }: { pendiente: PropsMapaB18Clientes["mapa"]["b18"]["cxc"]["pendiente"] }) {
  return <div className={est.cxcPendiente}>
    <p className={est.cxcEstado}>Pendiente de integrar</p>
    <p className={est.cxcMensaje}>
      {pendiente?.mensaje ?? "CxC contextual pendiente de integrar a esta vista."}
    </p>
    {pendiente?.enlace ? <a className={est.cxcEnlace} href={pendiente.enlace.href}>
      {pendiente.enlace.texto}
      <em aria-hidden="true">→</em>
    </a> : null}
  </div>;
}

function SeccionCxc({ panel }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["cxc"] }) {
  const integrado = panel.estado === "integrado" && panel.cifras !== null;
  return <>
    <Encabezado
      rotulo="Cartera · otra capa"
      titulo="Cuentas por cobrar"
      bajada={integrado
        ? "Saldo pendiente de documentos de cartera. No es venta del período y no se suma con nada de las secciones anteriores."
        : "Esta pantalla no calcula cartera. Mientras la fuente no forme parte del dataset comercial de Clientes, la sección declara lo que falta en vez de estimarlo."}
      tono="cxc"
    />
    <Aviso titulo="Capa distinta a la venta" texto={panel.advertencia} tono="cxc" />
    {integrado && panel.cifras
      ? <CxcEcuacion cifras={panel.cifras} />
      : <CxcPendiente pendiente={panel.pendiente} />}
    <Procedencia p={panel.procedencia} tono="cxc" />
  </>;
}

// ── Sección 7 · Cobertura y límites ────────────────────────────────────────

const NOMBRE_ESTADO: Record<EstadoCobertura, string> = {
  existe: "Existe",
  parcial: "Parcial",
  falta: "Falta",
};

function SeccionCobertura({ panel }: { panel: PropsMapaB18Clientes["mapa"]["b18"]["cobertura"] }) {
  const cuenta = (e: EstadoCobertura) => panel.filas.filter((f) => f.estado === e).length;
  return <>
    <Encabezado
      rotulo="Alcance del dato"
      titulo="Cobertura y límites"
      bajada="Qué se puede afirmar con este snapshot, qué está a medias y qué no está. Es la sección que califica a las otras seis."
      tono="cobertura"
    />
    <div className={est.resumenCobertura}>
      {(["existe", "parcial", "falta"] as EstadoCobertura[]).map((e) => <div key={e} data-estado={e}>
        <b>{cuenta(e)}</b><span>{NOMBRE_ESTADO[e]}</span>
      </div>)}
    </div>
    <div className={est.cobertura}>
      {panel.filas.map((f) => <div key={f.concepto} className={est.coberturaFila} data-estado={f.estado}>
        <em>{NOMBRE_ESTADO[f.estado]}</em>
        <strong>{f.concepto}</strong>
        <p>{f.nota}</p>
      </div>)}
    </div>
    <div className={est.noAfirmable}>
      <p>No puede afirmarse con este dato</p>
      <ul>{panel.noAfirmable.map((n) => <li key={n}>{n}</li>)}</ul>
      <small>Ninguna de estas dimensiones se infiere ni se estima en esta pantalla. Si un análisis la necesita, el análisis no se hace hasta que el dato exista.</small>
    </div>
    <Procedencia p={panel.procedencia} tono="cobertura" />
  </>;
}

// ── Drill-down de agente ───────────────────────────────────────────────────

function DrilldownAgente({ agente, onCerrar, onVerFicha }: { agente: LecturaAgenteClienteB18; onCerrar: () => void; onVerFicha?: (clienteId: string) => void }) {
  useEffect(() => {
    const salir = (ev: KeyboardEvent) => { if (ev.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", salir);
    return () => window.removeEventListener("keydown", salir);
  }, [onCerrar]);

  return <div className={est.velo} role="presentation" onPointerDown={(ev) => ev.target === ev.currentTarget && onCerrar()}>
    <section className={est.modal} role="dialog" aria-modal="true" aria-labelledby="b18cl-modal" style={{ "--acento": agente.color } as CSSProperties}>
      <header>
        <div>
          <p>{agente.slot.toUpperCase()} · {agente.iniciales}</p>
          <h3 id="b18cl-modal">{agente.nombre}</h3>
          <span>{agente.pregunta}</span>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar lectura del agente">×</button>
      </header>

      <div className={est.modalKpi}>
        <div><small>{agente.kpiEtiqueta}</small><strong>{agente.kpi}</strong></div>
        <div><small>Cobertura · {agente.procedencia.cobertura.etiqueta}</small><strong>{agente.procedencia.cobertura.valor.toFixed(2)}%</strong></div>
      </div>

      <Barras filas={agente.barras} color={agente.color} />
      <Metricas items={agente.metricas} tono="venta" />
      {agente.comparativo ? <Comparativo c={agente.comparativo} /> : null}
      {agente.lista.length > 0 ? <ListaClientes filas={agente.lista} total={agente.listaTotal} titulo="Clientes de esta lectura" onVerFicha={onVerFicha} /> : null}

      <dl className={est.ficha}>
        <div><dt>Hallazgo</dt><dd>{agente.hallazgo}</dd></div>
        <div><dt>Problema</dt><dd>{agente.problema}</dd></div>
        <div><dt>Acción</dt><dd>{agente.accion}</dd></div>
        <div className={est.fichaFormula}><dt>Fórmula</dt><dd>{agente.formula}</dd></div>
      </dl>

      <Procedencia p={agente.procedencia} tono="venta" />
    </section>
  </div>;
}

// ── Encabezado de sección ──────────────────────────────────────────────────

function Encabezado({ rotulo, titulo, bajada, tono }: { rotulo: string; titulo: string; bajada: string; tono: string }) {
  return <div className={est.encabezado} data-tono={tono}>
    <p>{rotulo}</p>
    <h3>{titulo}</h3>
    <span>{bajada}</span>
  </div>;
}

// ── Navegación: siete secciones agrupadas por capa ─────────────────────────

type Grupo = { capa: string; tono: string; items: { id: SeccionB18Clientes; nombre: string }[] };

/** El tono baja al panel entero, no sólo al encabezado: si la barra de una
 *  fila de composición se pinta del azul de venta, la separación de capas se
 *  pierde justo en el gráfico, que es donde más importa. */
const TONO_SECCION: Record<SeccionB18Clientes, string> = {
  cartera: "venta",
  recencia: "venta",
  concentracion: "venta",
  serie: "venta",
  composicion: "composicion",
  cxc: "cxc",
  cobertura: "cobertura",
};

const GRUPOS: Grupo[] = [
  {
    capa: "Venta confirmada",
    tono: "venta",
    items: [
      { id: "cartera", nombre: "Cartera" },
      { id: "recencia", nombre: "Recencia" },
      { id: "concentracion", nombre: "Concentración" },
      { id: "serie", nombre: "Serie" },
    ],
  },
  { capa: "Composición", tono: "composicion", items: [{ id: "composicion", nombre: "Qué compran" }] },
  { capa: "Cartera CxC", tono: "cxc", items: [{ id: "cxc", nombre: "Cuentas por cobrar" }] },
  { capa: "Alcance", tono: "cobertura", items: [{ id: "cobertura", nombre: "Cobertura y límites" }] },
];

// ── Raíz ───────────────────────────────────────────────────────────────────

export function MapaB18Clientes({ mapa, fmt, onVerFicha }: PropsMapaB18Clientes) {
  const [seccion, setSeccion] = useState<SeccionB18Clientes>("cartera");
  const [agente, setAgente] = useState<AgenteClientesB18 | null>(null);
  const { b18 } = mapa;
  const abierto = agente ? mapa.agentes.find((a) => a.id === agente) ?? null : null;

  return <section className={est.raiz} aria-label="Dashboard B18 de clientes">
    <header className={est.cabecera}>
      <div>
        <p>Dashboard B18 · lectura integral</p>
        <h2>Clientes</h2>
      </div>
      <div className={est.declaracion}>
        <strong>{mapa.procedencia.capa}</strong>
        <span>{mapa.procedencia.moneda} · período {mapa.procedencia.periodo} · corte {mapa.procedencia.corte}</span>
      </div>
    </header>

    <p className={est.limiteGlobal}><b>Límite de toda la pantalla</b>{mapa.procedencia.limite}</p>

    {/* Los cuatro agentes no son una sección: son las señales que abren el
        detalle de cada lectura. Van arriba, en una tira, y se abren con clic. */}
    <div className={est.agentes} role="group" aria-label="Lecturas de los agentes">
      {mapa.agentes.map((a) => <button
        key={a.id}
        type="button"
        className={est.agente}
        onClick={() => setAgente(a.id)}
        style={{ "--acento": a.color } as CSSProperties}
        aria-label={`${a.titulo}. ${a.senal}. Abrir lectura completa`}
      >
        <span className={est.agenteSigla}>{a.iniciales}</span>
        <span className={est.agenteCuerpo}>
          <strong>{a.kpi}</strong>
          <em>{a.kpiEtiqueta}</em>
          <small>{a.senal}</small>
        </span>
        <span className={est.micro} aria-hidden="true">
          {a.micro.map((m, i) => <i key={`${m.etiqueta}-${i}`} data-parcial={m.parcial || undefined} style={{ height: `${Math.max(m.alto, 8)}%` }} />)}
        </span>
      </button>)}
    </div>

    <nav className={est.navegacion} aria-label="Secciones del dashboard de clientes">
      {GRUPOS.map((g) => <div key={g.capa} className={est.grupo} data-tono={g.tono}>
        <p>{g.capa}</p>
        <div>
          {g.items.map((it) => <button
            key={it.id}
            type="button"
            aria-pressed={seccion === it.id}
            onClick={() => setSeccion(it.id)}
          >{it.nombre}</button>)}
        </div>
      </div>)}
    </nav>

    <div className={est.panel} data-tono={TONO_SECCION[seccion]}>
      {seccion === "cartera" ? <SeccionCartera panel={b18.cartera} /> : null}
      {seccion === "recencia" ? <SeccionRecencia panel={b18.recencia} onVerFicha={onVerFicha} /> : null}
      {seccion === "concentracion" ? <SeccionConcentracion panel={b18.concentracion} onVerFicha={onVerFicha} /> : null}
      {seccion === "serie" ? <SeccionSerie panel={b18.serie} fmt={fmt} /> : null}
      {seccion === "composicion" ? <SeccionComposicion panel={b18.composicion} /> : null}
      {seccion === "cxc" ? <SeccionCxc panel={b18.cxc} /> : null}
      {seccion === "cobertura" ? <SeccionCobertura panel={b18.cobertura} /> : null}
    </div>

    {abierto ? <DrilldownAgente
      agente={abierto}
      onCerrar={() => setAgente(null)}
      onVerFicha={onVerFicha ? (id) => { setAgente(null); onVerFicha(id); } : undefined}
    /> : null}
  </section>;
}
