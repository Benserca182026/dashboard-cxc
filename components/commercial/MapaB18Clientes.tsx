/// <reference types="vite/client" />
"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
  SlotClientesB18,
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
    {/* "Corte" a secas es ambiguo en esta página: no es el snapshot de Odoo
        (2026-08-24, el que usan Cuadro de mando/Aging/Prioritarios), es la
        fecha de la ÚLTIMA VENTA CONFIRMADA (2026-08-19) — dos conceptos
        legítimamente distintos que un rótulo pelado no distingue. */}
    <div><dt>Última venta</dt><dd>{p.corte}</dd></div>
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

/**
 * EL DRILL-DOWN MUESTRA LA EVIDENCIA DE SU AGENTE, Y NADA MÁS.
 *
 * Antes recibía una `listaExtra` con clientes de otro agente —Prioriza abría
 * la lista de recuperación—. Eso volvía a mezclar las dos preguntas: quien
 * abría "de cuántas cuentas depende el año" terminaba leyendo "a quién llamo
 * primero". Cada agente responde con su propia lista; la de recuperación se
 * abre desde Recomienda, que es de donde sale.
 */
function DrilldownAgente({ agente, color, onCerrar, onVerFicha }: {
  agente: LecturaAgenteClienteB18;
  /** Color del slot en el lienzo. El drill-down tiene que abrirse del color de
   *  la tarjeta que lo abrió, o deja de leerse como la misma pieza. */
  color?: string;
  onCerrar: () => void;
  onVerFicha?: (clienteId: string) => void;
}) {
  const acento = color ?? agente.color;
  useEffect(() => {
    const salir = (ev: KeyboardEvent) => { if (ev.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", salir);
    return () => window.removeEventListener("keydown", salir);
  }, [onCerrar]);

  return <div className={est.velo} role="presentation" onPointerDown={(ev) => ev.target === ev.currentTarget && onCerrar()}>
    <section className={est.modal} role="dialog" aria-modal="true" aria-labelledby="b18cl-modal" style={{ "--acento": acento } as CSSProperties}>
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

      <Barras filas={agente.barras} color={acento} />
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

// ── Panel B18 · el dashboard integral, cerrado por defecto ─────────────────

/**
 * B18 NO es la página: es el dashboard integral que se consulta desde el riel.
 * Vive en una superficie propia —velo + panel— por la misma razón que el
 * drill-down de agente: si se despliega dentro del mapa, el reporte ejecutivo
 * del centro deja de ser el centro y la pantalla vuelve a ser una lista de
 * siete secciones. Se abre SÓLO con el botón B18 y se cierra con la ×, con
 * Escape o tocando fuera.
 *
 * Lleva la clase `raiz` además de la suya porque los tonos por capa están
 * definidos como `.raiz [data-tono="…"]`: sin ese ancestro, las siete secciones
 * perderían el color que separa venta de composición, de CxC y de cobertura,
 * que es justamente lo que la barra de pestañas agrupada existe para enseñar.
 */
function PanelB18({ mapa, fmt, seccion, onSeccion, onCerrar, onVerFicha }: {
  mapa: PropsMapaB18Clientes["mapa"];
  fmt?: (valor: number) => string;
  seccion: SeccionB18Clientes;
  onSeccion: (id: SeccionB18Clientes) => void;
  onCerrar: () => void;
  onVerFicha?: (clienteId: string) => void;
}) {
  const { b18 } = mapa;
  useEffect(() => {
    const salir = (ev: KeyboardEvent) => { if (ev.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", salir);
    return () => window.removeEventListener("keydown", salir);
  }, [onCerrar]);

  return <div className={est.velo} role="presentation" onPointerDown={(ev) => ev.target === ev.currentTarget && onCerrar()}>
    <section className={`${est.raiz} ${est.panelB18}`} role="dialog" aria-modal="true" aria-labelledby="b18cl-panel">
      <header className={est.cabecera}>
        <div>
          <p>Dashboard integral · siete secciones</p>
          <h2 id="b18cl-panel">B18 · dashboard integral de Clientes</h2>
        </div>
        <div className={est.cabeceraDerecha}>
          <div className={est.declaracion}>
            <strong>{mapa.procedencia.capa}</strong>
            <span>{mapa.procedencia.moneda} · período {mapa.procedencia.periodo} · última venta registrada {mapa.procedencia.corte}</span>
          </div>
          <button type="button" className={est.cerrarPanel} onClick={onCerrar} aria-label="Cerrar B18 y volver al mapa">×</button>
        </div>
      </header>

      <p className={est.limiteGlobal}><b>Límite de toda la pantalla</b>{mapa.procedencia.limite}</p>

      <nav className={est.navegacion} aria-label="Secciones del dashboard de clientes">
        {GRUPOS.map((g) => <div key={g.capa} className={est.grupo} data-tono={g.tono}>
          <p>{g.capa}</p>
          <div>
            {g.items.map((it) => <button
              key={it.id}
              type="button"
              aria-pressed={seccion === it.id}
              onClick={() => onSeccion(it.id)}
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
    </section>
  </div>;
}

// ── Los cuatro agentes del mapa ────────────────────────────────────────────

/**
 * EL COLOR ES DEL SLOT, NO DEL DATO.
 *
 * El mapa entrega los cuatro agentes con el mismo azul porque el contrato no
 * describe dónde cae cada uno en el lienzo: esa es una decisión de la vista.
 * Por eso el color se aplica acá, por posición, y `lib/agentes-clientes-b18.ts`
 * no se toca. Ninguna cifra cambia por esto.
 */
const COLOR_SLOT: Record<SlotClientesB18, string> = {
  detecta: "#0789e6",
  prioriza: "#16a34a",
  explica: "#7b2bf4",
  recomienda: "#f97316",
};

const NOMBRE_SLOT: Record<SlotClientesB18, string> = {
  detecta: "Detecta",
  explica: "Explica",
  prioriza: "Prioriza",
  recomienda: "Recomienda",
};

/** Columnas: tramos, frecuencia. Alturas normalizadas que ya vienen del mapa. */
function MiniColumnas({ puntos, color }: { puntos: { etiqueta: string; alto: number }[]; color: string }) {
  return <div className="b18-mini-pareto" aria-hidden="true">
    {puntos.map((p, i) => <i
      key={`${p.etiqueta}-${i}`}
      style={{ height: `${Math.max(p.alto, 10)}%`, backgroundColor: color, opacity: 1 - i * 0.13 }}
    />)}
  </div>;
}

/** Filas: ranking de impacto, comparación de dos períodos. */
function MiniFilas({ puntos, color }: { puntos: { clave: string; ancho: number; tenue?: boolean }[]; color: string }) {
  return <div className="b18-mini-barras" aria-hidden="true">
    {puntos.map((p, i) => <i
      key={p.clave}
      style={{ width: `${Math.max(p.ancho, 7)}%`, backgroundColor: p.tenue ? "#d3ddf0" : color, opacity: p.tenue ? 1 : 1 - i * 0.11 }}
    />)}
  </div>;
}

type Tarjeta = {
  agente: LecturaAgenteClienteB18;
  color: string;
  /** KPI principal de la tarjeta. Ninguno se repite entre las cuatro. */
  kpi: string;
  kpiEtiqueta: string;
  /** Métrica secundaria. Tampoco repite el KPI de otra tarjeta. */
  apoyo: string;
  mini: ReactNode;
  /** Qué abre el clic, dicho en la etiqueta accesible. */
  abre: string;
  /**
   * Siguiente paso, cuando la tarjeta es la que dice a quién llamar. Sólo lo
   * lleva Recomienda: es el único de los cuatro cuya respuesta es una acción
   * de seguimiento y no una lectura. Las otras tres lo tienen en su
   * drill-down, donde el paso se puede auditar contra la lista.
   */
  pie?: string | null;
};

/**
 * Cada tarjeta arma su lectura desde `mapa`. NO hay un solo número escrito a
 * mano: los conteos salen de las barras del propio agente y los porcentajes,
 * de su `kpi` ya formateado.
 *
 * CADA TARJETA CONTESTA UNA PREGUNTA DISTINTA Y NINGUNA COMPARTE SU CIFRA
 * PRINCIPAL CON OTRA. Antes, Prioriza y Recomienda mostraban las dos el mismo
 * número —las cuentas del Top 50 histórico detenidas más de 90 días—, así que
 * dos de los cuatro agentes decían lo mismo con distinto rótulo y el lienzo
 * perdía un cuadrante. El reparto es:
 *
 *   Detecta     · quién dejó de comprar        → tramos de recencia
 *   Prioriza    · de cuántas cuentas depende   → concentración Top 5/10/20/50
 *   Explica     · de dónde viene el movimiento → comparable contra el año previo
 *   Recomienda  · a quién llamo primero        → recurrentes y cuentas detenidas
 *
 * Las cuentas detenidas viven en Recomienda y en ningún otro lado del lienzo:
 * son una lista de llamadas, no una medida de concentración.
 */
function construirTarjetas(mapa: PropsMapaB18Clientes["mapa"]): Tarjeta[] {
  const porId = (id: AgenteClientesB18) => mapa.agentes.find((a) => a.id === id) ?? null;
  const barra = (a: LecturaAgenteClienteB18 | null, clave: string) => a?.barras.find((b) => b.clave === clave) ?? null;
  const entero = (n: number) => n.toLocaleString("es-GT");

  const recencia = porId("recencia");
  const concentracion = porId("concentracion");
  const comparable = porId("comparable");
  const recuperacion = porId("recuperacion");

  const tarjetas: Tarjeta[] = [];

  // DETECTA · quién dejó de comprar.
  if (recencia) {
    const mas90 = barra(recencia, "90+");
    tarjetas.push({
      agente: recencia,
      color: COLOR_SLOT.detecta,
      kpi: mas90 ? entero(mas90.valor) : recencia.kpi,
      kpiEtiqueta: mas90 ? "clientes con más de 90 días sin comprar" : recencia.kpiEtiqueta,
      apoyo: `${recencia.kpi} ${recencia.kpiEtiqueta}`,
      mini: <MiniColumnas puntos={recencia.barras.map((b) => ({ etiqueta: b.etiqueta, alto: b.ancho }))} color={COLOR_SLOT.detecta} />,
      abre: "Abrir el drill-down de recencia: los cuatro tramos y sus clientes",
    });
  }

  // PRIORIZA · de cuántas cuentas depende el resultado del año.
  // El KPI sale del agente de concentración y de ninguno más: Top 5 sobre la
  // venta del año. El apoyo estira la misma lectura —Top 10 y cuántos clientes
  // juntan la mitad—, que es lo que convierte el porcentaje en una decisión.
  if (concentracion) {
    const top10 = barra(concentracion, "top10");
    const mitad = concentracion.metricas.find((m) => m.etiqueta.includes("mitad")) ?? null;
    const apoyo = [
      top10 ? `${top10.texto} en el ${top10.etiqueta}` : null,
      mitad ? `${mitad.valor} ${mitad.etiqueta}` : null,
    ].filter(Boolean).join(" · ");
    tarjetas.push({
      agente: concentracion,
      color: COLOR_SLOT.prioriza,
      kpi: concentracion.kpi,
      kpiEtiqueta: concentracion.kpiEtiqueta,
      apoyo: apoyo.length > 0 ? apoyo : concentracion.hallazgo,
      mini: <MiniFilas puntos={concentracion.barras.map((b) => ({ clave: b.clave, ancho: b.ancho }))} color={COLOR_SLOT.prioriza} />,
      abre: "Abrir el drill-down de concentración: Top 1, 5, 10, 20 y 50 sobre la venta del año, y las cuentas que los componen",
    });
  }

  // EXPLICA · de dónde viene el crecimiento.
  if (comparable) {
    const compradores = barra(comparable, "compradores");
    tarjetas.push({
      agente: comparable,
      color: COLOR_SLOT.explica,
      kpi: comparable.kpi,
      kpiEtiqueta: comparable.kpiEtiqueta,
      apoyo: compradores ? `${compradores.detalle} compradores` : comparable.senal,
      /* Los últimos doce meses de compradores, en columnas: es el mismo
         micrográfico que llevan las tarjetas de /ventas. Dos barras sueltas
         —el año contra su comparable— no llenaban el alto de la tarjeta y
         además repetían el bloque comparativo que ya está en el centro y en
         el drill-down; la serie sí dice algo que ninguno de los dos dice. */
      mini: <MiniColumnas puntos={comparable.micro.map((m) => ({ etiqueta: m.etiqueta, alto: m.alto }))} color={COLOR_SLOT.explica} />,
      abre: "Abrir el drill-down de crecimiento: compradores, pedidos, venta y ticket comparables",
    });
  }

  // RECOMIENDA · a quién llamar primero. Acá —y sólo acá— viven los dormidos:
  // los recurrentes que sostienen la base, las cuentas grandes detenidas y el
  // siguiente paso de seguimiento.
  if (recuperacion) {
    /* Las cuentas detenidas son la señal de esta tarjeta —`senal` ya las dice
       al pie—, así que el apoyo no las repite: suma el otro grupo dormido,
       el que compró una sola vez. */
    const unica = barra(recuperacion, "unica");
    const apoyo = unica ? `${unica.texto} con una sola compra en el año` : "";
    tarjetas.push({
      agente: recuperacion,
      color: COLOR_SLOT.recomienda,
      kpi: recuperacion.kpi,
      kpiEtiqueta: recuperacion.kpiEtiqueta,
      apoyo: apoyo.length > 0 ? apoyo : recuperacion.senal,
      mini: <MiniColumnas puntos={recuperacion.micro.map((m) => ({ etiqueta: m.etiqueta, alto: m.alto }))} color={COLOR_SLOT.recomienda} />,
      abre: "Abrir la acción: cuentas detenidas del Top 50, clientes de una sola compra y recuperación de dormidos",
      pie: recuperacion.accion,
    });
  }

  return tarjetas;
}

/**
 * La tarjeta es un botón entero y su único gesto es el CLIC. No hay una sola
 * cifra que aparezca al pasar el mouse: con teclado o en una tablet esa
 * información no existiría.
 */
function TarjetaAgente({ tarjeta, activa, onAbrir }: { tarjeta: Tarjeta; activa: boolean; onAbrir: () => void }) {
  const { agente } = tarjeta;
  return <button
    type="button"
    className={`b18-rol-card b18-rol-${agente.slot} ${est.tarjeta} ${activa ? "is-active" : ""}`}
    style={{ "--b18-role": tarjeta.color } as CSSProperties}
    onClick={onAbrir}
    aria-pressed={activa}
    aria-label={`${NOMBRE_SLOT[agente.slot]} · ${agente.nombre}. ${tarjeta.kpi} ${tarjeta.kpiEtiqueta}. ${tarjeta.abre}`}
  >
    <span className="b18-connector" aria-hidden="true" />
    <div className="b18-rol-visual">
      <div className="b18-rol-heading"><span>{agente.iniciales}</span><strong>{NOMBRE_SLOT[agente.slot]}</strong></div>
      <div className="b18-rol-content">
        <div className="b18-rol-kpi">
          <strong>{tarjeta.kpi}</strong>
          <span>{tarjeta.kpiEtiqueta}</span>
          <em className={est.tarjetaApoyo}>{tarjeta.apoyo}</em>
        </div>
        {tarjeta.mini}
      </div>
      <p className="b18-rol-resumen">{agente.senal}</p>
      {tarjeta.pie ? <p className={est.tarjetaPie}><b>Siguiente</b>{tarjeta.pie}</p> : null}
    </div>
  </button>;
}

// ── Reporte ejecutivo central ──────────────────────────────────────────────

/**
 * El centro es UN reporte, no un resumen de las siete pestañas de B18: una
 * lectura ejecutiva, la comparación contra la misma ventana del año anterior,
 * el gráfico de recencia de la cartera, tres cifras de apoyo y la procedencia.
 * Todo lo demás —serie mensual, composición, CxC, cobertura— se consulta en
 * B18, que se abre desde el riel.
 *
 * EL ENCABEZADO NO SE REPITE. Quién es esta pantalla y a qué corte está lo
 * dice UNA sola vez el encabezado del lienzo (`.b18-map-header`). El centro
 * arranca directo en su lectura ejecutiva, igual que el de /ventas: ahí el
 * primer renglón del centro tampoco vuelve a decir "Reporte general", dice la
 * conclusión. Un título repetido a dos centímetros de sí mismo no orienta:
 * ocupa el lugar donde debería estar la primera frase que sí informa.
 */
function ReporteCentral({ mapa, activo, onAbrirAgente }: {
  mapa: PropsMapaB18Clientes["mapa"];
  activo: LecturaAgenteClienteB18 | null;
  onAbrirAgente: (id: AgenteClientesB18) => void;
}) {
  const porId = (id: AgenteClientesB18) => mapa.agentes.find((a) => a.id === id) ?? null;
  const recencia = porId("recencia");
  const comparable = porId("comparable");

  /* El porcentaje del anillo es el KPI de recencia, que ya viene formateado
     ("66.94%"): se lee para dibujar el ángulo, no se recalcula. Si el mapa no
     trae lectura, el anillo queda en cero y el texto lo dice. */
  const pctSinCompra = Number.parseFloat((recencia?.kpi ?? "").replace(",", "."));
  const anillo = Number.isFinite(pctSinCompra) ? pctSinCompra : 0;

  const frase = comparable && recencia
    ? `La base de compradores se mueve ${comparable.kpi} contra la misma ventana del año anterior, pero ${recencia.senal}.`
    : "El snapshot no trae pedidos confirmados suficientes para una lectura ejecutiva.";

  const apoyoBuscado = ["clientes con venta histórica", "pedidos confirmados", "ticket mediano por pedido"]
    .map((etiqueta) => mapa.b18.cartera.metricas.find((m) => m.etiqueta === etiqueta))
    .filter((m): m is MetricaClientesB18 => Boolean(m));
  const apoyo = apoyoBuscado.length === 3 ? apoyoBuscado : mapa.b18.cartera.metricas.slice(0, 3);

  const cxc = mapa.b18.cxc;

  return <article className={`b18-centro ${est.centro}`} aria-label="Reporte ejecutivo de la cartera de clientes">
    <p className={est.lecturaEjecutiva}>{frase}</p>

    {comparable ? <div className={est.comparacion}>
      <p>
        <span>{comparable.comparativo?.titulo ?? "Año en curso contra la misma ventana del año anterior"}</span>
        <em>{comparable.procedencia.periodo}</em>
      </p>
      {/* Cada factor abre la evidencia del agente que lo calcula. */}
      <div className="b18-vt-historia">
        {comparable.barras.map((b) => <button
          key={b.clave}
          type="button"
          onClick={() => onAbrirAgente("comparable")}
          style={{ "--b18-chip": COLOR_SLOT.explica } as CSSProperties}
          aria-label={`${b.etiqueta}: ${b.texto}, ${b.detalle}. Abrir la evidencia del comparable`}
        >
          <strong>{b.texto}</strong><span>{b.etiqueta}</span><small>{b.detalle}</small>
        </button>)}
      </div>
    </div> : null}

    {recencia ? <div className="b18-centro-viz">
      <div
        className="b18-dona-principal"
        role="img"
        aria-label={`${recencia.kpi} de la cartera histórica sin compra confirmada en más de 90 días`}
        style={{ "--b18-color": COLOR_SLOT.detecta, "--b18-pct": `${Math.min(anillo, 100) * 3.6}deg` } as CSSProperties}
      >
        <span>{recencia.kpi}</span>
        <em>+90 días</em>
      </div>
      <div className={est.tramosCentro} role="group" aria-label="Recencia de la cartera">
        {recencia.barras.map((b) => <button
          key={b.clave}
          type="button"
          onClick={() => onAbrirAgente("recencia")}
          data-frio={b.clave === "90+" || undefined}
          aria-label={`${b.etiqueta}: ${b.texto}. Abrir el listado de recencia`}
        >
          <span>{b.etiqueta}</span>
          <b>{b.texto}</b>
          <i style={{ width: `${Math.max(b.ancho, 3)}%` }} />
        </button>)}
      </div>
    </div> : null}

    <div className="b18-centro-metricas">
      {apoyo.map((m) => <div key={m.etiqueta}><b>{m.valor}</b><span>{m.etiqueta}</span></div>)}
    </div>

    {activo ? <div className="b18-decision">
      <p>Siguiente decisión · {activo.nombre}</p>
      <strong>{activo.accion}</strong>
    </div> : null}

    <div className={est.notasCentro}>
      <p className={est.notaCentro}><b>Límite del snapshot</b>{mapa.procedencia.limite}</p>
      <p className={est.notaCxc}>
        <b>Cuentas por cobrar es otra capa</b>
        {cxc.advertencia}
        {cxc.estado === "pendiente" && cxc.pendiente ? ` ${cxc.pendiente.mensaje}` : ""}
        {cxc.pendiente?.enlace ? <a href={cxc.pendiente.enlace.href}>{cxc.pendiente.enlace.texto} →</a> : null}
      </p>
    </div>

    <dl className="b18-metadatos">
      <div><dt>Fuente</dt><dd>{mapa.procedencia.fuente}</dd></div>
      <div><dt>Período</dt><dd>{mapa.procedencia.periodo}</dd></div>
      <div><dt>Última venta</dt><dd>{mapa.procedencia.corte}</dd></div>
      <div><dt>Moneda</dt><dd>{mapa.procedencia.moneda}</dd></div>
      <div><dt>Capa</dt><dd>{mapa.procedencia.capa}</dd></div>
      <div><dt>Cobertura</dt><dd>{mapa.procedencia.cobertura.valor.toFixed(2)}% {mapa.procedencia.cobertura.etiqueta}</dd></div>
    </dl>
  </article>;
}

// ── Raíz ───────────────────────────────────────────────────────────────────

/**
 * LA JERARQUÍA DE ESTA PANTALLA, EN UNA LÍNEA:
 * riel interno · dos agentes a la izquierda · reporte ejecutivo al centro ·
 * dos agentes a la derecha · B18 cerrado hasta que alguien lo pida.
 *
 * Es el mismo molde que /ventas/productos y /ventas: las clases `.b18-map*`
 * son las del molde, y lo único que agrega este módulo es lo que el molde no
 * tiene —la lectura ejecutiva, el bloque comparativo y las notas de capa—.
 */
export function MapaB18Clientes({ mapa, fmt, onVerFicha }: PropsMapaB18Clientes) {
  const tarjetas = construirTarjetas(mapa);
  const [activo, setActivo] = useState<AgenteClientesB18>(mapa.agentes[0]?.id ?? "recencia");
  const [drilldown, setDrilldown] = useState<AgenteClientesB18 | null>(null);
  // B18 arranca CERRADO. Sólo lo abre el botón del riel.
  const [b18Abierto, setB18Abierto] = useState(false);
  const [seccion, setSeccion] = useState<SeccionB18Clientes>("cartera");

  const agenteActivo = mapa.agentes.find((a) => a.id === activo) ?? mapa.agentes[0] ?? null;
  const abierto = drilldown ? mapa.agentes.find((a) => a.id === drilldown) ?? null : null;

  const abrirAgente = (id: AgenteClientesB18) => { setActivo(id); setDrilldown(id); };

  return <section className={`b18-map ${est.mapa}`} aria-label="Mapa comercial B18 de clientes">
    <aside className="b18-map-lateral">
      <div className="b18-map-marca">{agenteActivo?.iniciales ?? "CL"}</div>
      <p>Clientes</p>
      <div className="b18-map-lista">
        {mapa.agentes.map((a) => <button
          key={a.id}
          type="button"
          onClick={() => setActivo(a.id)}
          aria-pressed={a.id === activo}
        ><span>{a.iniciales}</span>{a.nombre}</button>)}
      </div>
      <div className={`b18-map-status ${est.estadoAgente}`}>
        <span>Agent status</span>
        <b>● {agenteActivo?.titulo ?? "Sin lectura"}</b>
        <p>{agenteActivo?.senal ?? "El snapshot no trae pedidos confirmados."}</p>
      </div>
      <button
        type="button"
        className={`b18-map-b18 ${est.botonB18}`}
        onClick={() => setB18Abierto(true)}
        aria-label="Abrir B18, el dashboard integral de Clientes"
        aria-expanded={b18Abierto}
      >B<span>18</span></button>
    </aside>

    <div className="b18-map-canvas">
      <header className="b18-map-header">
        <div><p>Reporte general</p><h2>Cartera comercial de clientes</h2></div>
        {/* "Corte: 2026-08-19" a secas se confunde con el corte de snapshot
            (2026-08-24) que usan Cuadro de mando/Aging/Prioritarios
            (FECHA_CORTE_DATOS_REALES, lib/datosReales.ts). Acá el corte es
            OTRO concepto, legítimo pero distinto: la fecha de la última venta
            confirmada del dataset (`lib/lecturas-clientes-reales.ts:342`,
            `movimientos.at(-1).dia`). El rótulo lo dice explícito. */}
        <span>Última venta registrada: {mapa.procedencia.corte}</span>
      </header>

      <div className="b18-map-grid">
        {tarjetas.map((t) => <TarjetaAgente
          key={t.agente.id}
          tarjeta={t}
          activa={t.agente.id === activo}
          onAbrir={() => abrirAgente(t.agente.id)}
        />)}
        <ReporteCentral mapa={mapa} activo={agenteActivo} onAbrirAgente={abrirAgente} />
      </div>
    </div>

    {abierto ? <DrilldownAgente
      agente={abierto}
      color={COLOR_SLOT[abierto.slot]}
      onCerrar={() => setDrilldown(null)}
      onVerFicha={onVerFicha ? (id) => { setDrilldown(null); onVerFicha(id); } : undefined}
    /> : null}

    {b18Abierto ? <PanelB18
      mapa={mapa}
      fmt={fmt}
      seccion={seccion}
      onSeccion={setSeccion}
      onCerrar={() => setB18Abierto(false)}
      onVerFicha={onVerFicha}
    /> : null}
  </section>;
}
