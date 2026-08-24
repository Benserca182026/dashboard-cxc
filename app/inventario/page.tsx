"use client";

// M7 — Inventario (Paso 11). La existencia NUNCA es un campo: es la suma de los
// movimientos, y el kardex abrible lo demuestra fila por fila. Una pantalla
// donde el stock se calcula y una donde alguien lo tecleó se ven idénticas —
// el kardex es lo único que las distingue.
//
// Reestructuración (M6): mismo esqueleto de "/" y "/aging". De arriba abajo:
// Encabezado con menú interno y BarraUsuario → el motor de argumentación
// propio de este módulo (argumentoInventario, con los agentes
// AGENTES_INVENTARIO asomados en el mordisco) → las existencias por producto,
// envueltas en el mismo LienzoConAgentes del resto.
//
// argumentoInventario puede resolver en 3 o 4 etapas según si hay algún
// producto bajo mínimo (la etapa "¿con qué urgencia?" sólo se agrega cuando
// hace falta) — comportamiento propio de esa función, no se fuerza acá.

import { useState } from "react";
import { SkeletonPagina } from "@/components/Basicos";
import { BannerFicticioPremium, KpiPremiumCard } from "@/components/ResumenPremium";
import { hayCadena, integridadInventario, salidasSinVenta, stockPorProducto } from "@/lib/cadena";
import { argumentoInventario } from "@/lib/argumento";
import { useApp } from "@/lib/store";
import { Encabezado } from "@/components/Encabezado";
import { AGENTES_INVENTARIO, FilaAgentes } from "@/components/Agentes";
import { LienzoConAgentes, RecorridoArgumental } from "@/components/Argumento";

// ── LO QUE LA PANTALLA TIENE QUE CONFESAR ───────────────────────────────────
// Tres cifras de este módulo están contaminadas por cómo se importó el dato de
// Odoo, no por un error de fórmula. Mientras el export que falta no exista, la
// única salida honesta es rotularlas: que quien mira sepa que el número no es
// la existencia real y por qué. Las constantes viven acá arriba para que el
// texto de pantalla y este comentario no se separen nunca.
//
//  1. EXISTENCIA. Se calcula sumando los movimientos desde el 2025-08-22 y
//     nada más. El saldo que había en bodega ESE día no entra: `stock.quant`
//     se lee sólo para sacar el SKU y el nombre, la cantidad a mano nunca se
//     usa. Lo que la columna muestra es flujo neto de una ventana, no stock.
//  2. MÍNIMO. `stock_minimo` quedó fijo en 0 para los 751 productos
//     (scripts/importar-inventario-odoo.mjs:119 y :245). Con el mínimo en 0,
//     la regla "bajoMinimo" degeneró en "existencia <= 0" y marca 547 SKU.
//  3. VALOR A COSTO. El total incluye 280 productos con existencia negativa
//     que restan 872,681.75; por eso da −70.9 % contra el valor real.
const FECHA_INICIO_VENTANA = "2025-08-22";
const TOTAL_SKU_AUDITADOS = 751;
const SKU_BAJO_MINIMO_AUDITADOS = 547;
const SKU_TESTIGO = "ED-11.7.3";
const TESTIGO_CALCULADO = -149;
const TESTIGO_REAL_ODOO = 658;
const PRODUCTOS_NEGATIVOS = 280;
const RESTA_NEGATIVOS = "872,681.75";

const AVISO_EXISTENCIA =
  `La columna "existencia" NO es el stock que hay en bodega: es el flujo neto ` +
  `de una ventana. Suma únicamente los movimientos registrados desde el ` +
  `${FECHA_INICIO_VENTANA} y no incluye el saldo inicial que ya existía ese ` +
  `día, porque ese saldo no vino en la importación. Por eso hay existencias ` +
  `negativas: no significan faltante, significan que salió más de lo que esta ` +
  `ventana alcanzó a ver entrar.`;

const AVISO_MINIMO =
  `El "mínimo" está en 0 para los ${TOTAL_SKU_AUDITADOS} productos — la ` +
  `importación nunca trajo ese campo. Como el mínimo es 0, la regla "bajo ` +
  `mínimo" hoy significa en realidad "existencia ≤ 0", y por eso marca ` +
  `${SKU_BAJO_MINIMO_AUDITADOS} de ${TOTAL_SKU_AUDITADOS} SKU. No son ` +
  `${SKU_BAJO_MINIMO_AUDITADOS} productos por reponer.`;

const AVISO_VALOR =
  `El valor a costo suma también los ${PRODUCTOS_NEGATIVOS} productos con ` +
  `existencia negativa, que restan ${RESTA_NEGATIVOS}. El total mostrado ` +
  `queda ~70.9 % por debajo del valor real del inventario.`;

const AVISO_TESTIGO =
  `Caso testigo: ${SKU_TESTIGO} figura acá con ${TESTIGO_CALCULADO} unidades ` +
  `cuando en Odoo tiene ${TESTIGO_REAL_ODOO} reales. Es el número que manda ` +
  `obrar: ordenaría reponer algo que ya está en bodega. No se ordene ` +
  `reposición desde esta pantalla.`;

/** Bloque de advertencia. Va arriba de todo lo que muestra existencias, con
 *  las cifras dentro del texto: alguien que no leyó la auditoría tiene que
 *  poder entender, leyendo esto solo, que lo que ve no es la existencia. */
function AvisoInventarioContaminado() {
  return (
    <div
      className="entrada-suave rounded-tarjeta border px-4 py-3.5"
      style={{ borderColor: "rgba(192,57,43,.28)", background: "rgba(192,57,43,.055)" }}
      role="note"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "#c0392b" }}>
        ⚠ Cifras no auditables — leer antes de usar estos números
      </p>
      <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-[#5b5e64]">
        <li>
          <span className="font-semibold text-tinta">Existencia. </span>
          {AVISO_EXISTENCIA}
        </li>
        <li>
          <span className="font-semibold text-tinta">Bajo mínimo. </span>
          {AVISO_MINIMO}
        </li>
        <li>
          <span className="font-semibold text-tinta">Valor a costo. </span>
          {AVISO_VALOR}
        </li>
        <li>
          <span className="font-semibold text-tinta">Qué tan lejos queda. </span>
          {AVISO_TESTIGO}
        </li>
      </ul>
      <p className="mt-2 text-[10.5px] leading-snug text-[#85878c]">
        Las fórmulas no están mal: les falta el saldo inicial y el campo de mínimo,
        que dependen de un export de Odoo que todavía no existe. Hasta entonces estos
        números sirven para ver movimiento, no para decidir compras.
      </p>
    </div>
  );
}

const SECCIONES_SIN_CADENA = [{ id: "sec-aviso", etiqueta: "Aviso" }];
const SECCIONES = [
  { id: "sec-argumento", etiqueta: "El caso" },
  { id: "sec-existencias", etiqueta: "Existencias" },
];

export default function PaginaInventario() {
  const { dataset, cargando, fechaCorte, fmt } = useApp();
  // El dinero lo pinta el formateador del store: es el ÚNICO lugar donde una
  // cifra cambia de moneda, y lo hace al PINTAR. Todo lo de arriba (umbrales,
  // porcentajes, comparaciones, cuadres) se calculó en la moneda de registro y
  // no se entera de esta vista. Ver components/ControlMoneda.tsx.
  const [abierto, setAbierto] = useState<string | null>("PRD-C");

  if (cargando) return <SkeletonPagina />;

  if (!hayCadena(dataset)) {
    return (
      <div className="space-y-6">
        <Encabezado titulo="Inventario" secciones={SECCIONES_SIN_CADENA} dataset={dataset} modulo="inventario" />
        <section id="sec-aviso" className="scroll-mt-24">
          <div className="tarjeta-flotante entrada-suave p-8 text-center text-sm text-tintaSuave">
            Este dataset no trae la cadena de inventario (fuente: {dataset.fuente}).
            El módulo avisa en vez de mostrar ceros que parecerían datos — no se puede
            calcular ningún KPI de este módulo sin inventar cifras.
          </div>
        </section>
      </div>
    );
  }

  const argumento = argumentoInventario(dataset);
  const stock = stockPorProducto(dataset);
  const valorTotal = stock.reduce((s, x) => s + x.valorCosto, 0);
  const bajos = stock.filter((x) => x.bajoMinimo);
  const huerfanas = salidasSinVenta(dataset);
  // Los dos huecos que impiden hablar de EXISTENCIA y de MÍNIMO, DERIVADOS del
  // propio dato (ver lib/cadena.ts). No son un flag que alguien tenga que
  // apagar: el día que el import traiga saldo inicial y punto de reorden
  // reales, estas dos banderas se dan vuelta solas.
  const integridad = integridadInventario(dataset);

  // ── Las cifras de los cuatro anillos — derivadas del mismo stock que arma
  //    el argumento, no números sueltos. ──
  const mayorValor = [...stock].sort((a, b) => b.valorCosto - a.valorCosto)[0] ?? null;
  const pctMayorValor = mayorValor && valorTotal > 0 ? (mayorValor.valorCosto / valorTotal) * 100 : 0;
  const critico = [...bajos].sort(
    (a, b) =>
      b.movimientos.filter((m) => m.tipo === "salida").reduce((acc, m) => acc + Math.abs(m.cantidad), 0) -
      a.movimientos.filter((m) => m.tipo === "salida").reduce((acc, m) => acc + Math.abs(m.cantidad), 0)
  )[0] ?? null;
  const valorEnRiesgo = bajos.reduce((s, x) => s + x.valorCosto, 0);

  return (
    <div className="space-y-6">
      {/* Marca + menú interno + BarraUsuario, igual que "/" y "/aging". Las
          automatizaciones de acá hablan de kardex y reposición, no de cartera
          general. */}
      <Encabezado titulo="Inventario" secciones={SECCIONES} dataset={dataset} modulo="inventario" />

      {/* El aviso va PRIMERO, antes de cualquier cifra. Si estuviera al pie,
          quien mira ya habría creído los números de arriba. */}
      <AvisoInventarioContaminado />

      {/* El motor de argumentación del módulo: ¿el total dice algo, qué está
          por faltar, con qué urgencia, y qué se sigue de eso? argumento nunca
          es null acá porque ya se filtró !hayCadena arriba. */}
      {argumento && (
        <section id="sec-argumento" className="scroll-mt-24">
          <RecorridoArgumental
            rotulo="El caso del inventario"
            arg={argumento}
            agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_INVENTARIO} />}
            kpis={[
              mayorValor
                ? {
                    etiqueta: "SKU líder por valor · del valor total",
                    valor: fmt(mayorValor.valorCosto),
                    pct: pctMayorValor,
                    advertencia: `Proporción sobre un total contaminado: incluye ${PRODUCTOS_NEGATIVOS} SKU con existencia negativa que restan ${RESTA_NEGATIVOS}.`,
                  }
                : {
                    etiqueta: "SKU líder por valor · del valor total",
                    valor: "",
                    sinDato: {
                      queFalta:
                        "No hay ni un producto con movimientos en el dataset: no hay catálogo del cual elegir un SKU líder.",
                      consecuencia:
                        "No hay valor de inventario que repartir. El «—» anterior no distinguía esto de un fallo de carga.",
                      comoSeLlena:
                        "Importando productos y movimientos con scripts/importar-inventario-odoo.mjs.",
                    },
                  },
              // "bajo mínimo" ya no muestra un número con una advertencia que
              // lo desmiente. Si el mínimo no está declarado, la regla degenera
              // a "existencia ≤ 0" y el conteo no mide el inventario: mide el
              // hueco en los datos. Es el mismo criterio que aplica el agente
              // Mínimo, para que tarjeta y agente no se contradigan en pantalla.
              integridad.existenciaEsAfirmable && integridad.minimoEsAfirmable
                ? {
                    etiqueta: "bajo mínimo · de los SKU",
                    valor: `${bajos.length} de ${stock.length}`,
                    pct: stock.length > 0 ? (bajos.length / stock.length) * 100 : 0,
                  }
                : {
                    etiqueta: "bajo mínimo · de los SKU",
                    valor: "",
                    sinDato: {
                      queFalta: !integridad.minimoEsAfirmable
                        ? `El punto de reorden: el mínimo está en 0 para los ${TOTAL_SKU_AUDITADOS} productos porque el importador lo escribe así, no porque sea la política.`
                        : `El saldo inicial: ${integridad.seriesTruncadas.length} SKU arrancan su serie con una salida${integridad.desde ? `, con movimientos sólo desde ${integridad.desde}` : ""}.`,
                      consecuencia: `Con el mínimo en 0 la regla degenera a "existencia ≤ 0" y marca ${SKU_BAJO_MINIMO_AUDITADOS} de ${TOTAL_SKU_AUDITADOS} SKU. Ese número no son productos por reponer: es el hueco de los datos contado como si fuera inventario.`,
                      comoSeLlena:
                        "Trayendo de Odoo el punto de reorden real (stock.warehouse.orderpoint) y un saldo inicial por producto, en vez del 0 que hoy escribe el importador.",
                    },
                  },
              {
                // El Math.min(100, …) que había acá era el mismo engaño que el
                // clamp del anillo, un piso más arriba: tapaba un cociente
                // desbordado antes de que el anillo pudiera mostrarlo. El
                // recorte ahora es sólo del DIBUJO, dentro de <Anillo>.
                etiqueta: "existencia del urgente · del mínimo",
                ...(critico && critico.producto.stock_minimo > 0
                  ? {
                      valor: `${critico.existencia} u (mín. ${critico.producto.stock_minimo})`,
                      pct: (critico.existencia / critico.producto.stock_minimo) * 100,
                      advertencia: `La existencia no es real: ${SKU_TESTIGO}, p. ej., figura en ${TESTIGO_CALCULADO} u y en Odoo tiene ${TESTIGO_REAL_ODOO}.`,
                    }
                  : {
                      // Antes decía "sin producto urgente" con un "—" y el
                      // anillo en 0%. Eso mezclaba DOS cosas opuestas: que no
                      // haya ningún producto urgente (buena noticia) y que el
                      // mínimo esté en 0 y la razón no signifique nada.
                      valor: "",
                      sinDato: {
                        queFalta: critico
                          ? `El punto de reorden de ${critico.producto.sku}: su mínimo es 0, así que no hay contra qué medir su existencia.`
                          : "Ningún producto quedó marcado como urgente, así que no hay caso que mostrar.",
                        consecuencia: critico
                          ? "La razón existencia ÷ mínimo sería una división por cero. Un anillo en 0% la presentaría como una proporción medida."
                          : "No hay urgencia que describir. El «—» anterior no distinguía «no hay ninguno» de «no se pudo calcular».",
                        comoSeLlena:
                          "Trayendo de Odoo el punto de reorden real (stock.warehouse.orderpoint) en vez del 0 que hoy escribe scripts/importar-inventario-odoo.mjs.",
                      },
                    }),
              },
              {
                etiqueta: "valor en riesgo · del valor total",
                valor: fmt(valorEnRiesgo),
                pct: valorTotal > 0 ? (valorEnRiesgo / valorTotal) * 100 : 0,
                advertencia: `Negativo y fuera de escala: el numerador acumula existencias negativas, que son ventana sin saldo inicial (desde ${FECHA_INICIO_VENTANA}), no faltantes.`,
              },
            ]}
          />
        </section>
      )}

      {/* Existencias por producto: mismo kardex abrible de siempre — la
          existencia sigue siendo la suma exacta de sus movimientos. */}
      <section id="sec-existencias" className="scroll-mt-24">
        <LienzoConAgentes
          titulo={`Existencias por producto — flujo neto desde ${FECHA_INICIO_VENTANA}, sin saldo inicial`}
          agentes={<FilaAgentes dataset={dataset} fechaCorte={fechaCorte} agentes={AGENTES_INVENTARIO} />}
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiPremiumCard etiqueta="Productos" valor={String(stock.length)} nota="en catálogo ficticio" variante="soft" />
            <KpiPremiumCard
              etiqueta="Bajo mínimo — en realidad “existencia ≤ 0”"
              valor={String(bajos.length)}
              tono={bajos.length > 0 ? "critico" : "normal"}
              nota={`mínimo = 0 en los ${TOTAL_SKU_AUDITADOS} productos, así que la regla degeneró a "existencia ≤ 0" y marca ${SKU_BAJO_MINIMO_AUDITADOS} de ${TOTAL_SKU_AUDITADOS}; no son productos por reponer`}
              variante="warm"
            />
            <KpiPremiumCard
              etiqueta="Salidas sin venta de origen"
              valor={String(huerfanas.length)}
              tono={huerfanas.length > 0 ? "alerta" : "normal"}
              nota="toda salida debe decir qué venta la produjo"
              variante="cool"
            />
            <KpiPremiumCard
              etiqueta="Valor a costo — ~70.9 % por debajo del real"
              valor={fmt(valorTotal)}
              tono="alerta"
              nota={`derivado, no almacenado; suma ${PRODUCTOS_NEGATIVOS} productos con existencia negativa que restan ${RESTA_NEGATIVOS}`}
              variante="soft"
            />
          </div>

          <p className="mb-2 mt-5 text-[11.5px] leading-snug text-[#85878c]">
            Clic en un producto abre su kardex — el desglose que ES esta cifra. Ojo:{" "}
            <span className="font-semibold" style={{ color: "#c0392b" }}>
              la columna no es la existencia en bodega.
            </span>{" "}
            Es la suma de los movimientos desde el {FECHA_INICIO_VENTANA} y no incluye el
            saldo que ya había ese día, porque ese saldo no vino en la importación. Un
            número negativo no es faltante: es una salida cuya entrada quedó fuera de la
            ventana. Caso testigo: {SKU_TESTIGO} figura acá en {TESTIGO_CALCULADO} u y en
            Odoo tiene {TESTIGO_REAL_ODOO} reales.
          </p>

          <div className="space-y-2.5">
            {stock.map((s, i) => {
              const estaAbierto = abierto === s.producto.id_producto;
              return (
                <div
                  key={s.producto.id_producto}
                  className={`entrada-suave rounded-tarjeta transition-shadow ${
                    estaAbierto
                      ? "border border-white/90 bg-white/80 shadow-flotanteAlta"
                      : "border border-white/70 bg-white/55 shadow-flotante"
                  }`}
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <button
                    onClick={() => setAbierto(estaAbierto ? null : s.producto.id_producto)}
                    aria-expanded={estaAbierto}
                    className="grid w-full grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 rounded-tarjeta px-4 py-3.5 text-left transition hover:bg-white/60 sm:gap-6"
                  >
                    <span className="font-mono text-xs text-tintaSuave">{s.producto.sku}</span>
                    <span className="text-sm font-semibold text-tinta">{s.producto.nombre_producto}</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${s.bajoMinimo ? "text-red-600" : "text-tinta"}`}
                    >
                      {s.existencia} u
                      {s.bajoMinimo && (
                        <span
                          className="ml-1.5 rounded-pastilla bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white"
                          title={`El mínimo llegó en 0 desde la importación (los ${TOTAL_SKU_AUDITADOS} productos), así que esta marca sólo dice "existencia ≤ 0"`}
                        >
                          ▲ mín. {s.producto.stock_minimo} — la marca sólo dice “≤ 0”
                        </span>
                      )}
                      {s.producto.sku === SKU_TESTIGO && (
                        <span className="mt-1 block text-[9.5px] font-semibold leading-snug text-red-600">
                          ⚠ Verificado contra Odoo: acá {TESTIGO_CALCULADO} u, en bodega{" "}
                          {TESTIGO_REAL_ODOO} u reales. La diferencia es el saldo previo al{" "}
                          {FECHA_INICIO_VENTANA}, que no se importó.
                        </span>
                      )}
                    </span>
                    <span className="hidden text-xs tabular-nums text-tintaSuave sm:block">{fmt(s.valorCosto)}</span>
                    <span
                      className={`text-[11px] transition ${
                        estaAbierto ? "pastilla-activa px-2 py-0.5 opacity-90" : "text-tintaSuave opacity-45"
                      }`}
                    >
                      {estaAbierto ? "▾" : "▸"}
                    </span>
                  </button>

                  {estaAbierto && (
                    <div className="border-t border-black/[.06] px-4 py-3">
                      <p className="etiqueta-fase mb-2 uppercase">
                        <span className="mr-1 opacity-50">◆</span>
                        Kardex — los movimientos que suman la cifra
                      </p>
                      <p className="mb-2 text-[10.5px] leading-snug" style={{ color: "#c0392b" }}>
                        Falta la primera fila: el saldo inicial al {FECHA_INICIO_VENTANA}. El
                        kardex arranca ahí porque la importación no trajo la existencia previa,
                        así que este total es flujo de la ventana, no lo que hay en bodega.
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-borde/60 text-left text-[10px] uppercase tracking-wide text-tintaSuave">
                            <th className="py-1.5 pr-3 font-semibold">Fecha</th>
                            <th className="py-1.5 pr-3 font-semibold">Tipo</th>
                            <th className="py-1.5 pr-3 font-semibold">Origen</th>
                            <th className="py-1.5 text-right font-semibold">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.movimientos.map((m) => (
                            <tr key={m.id_movimiento} className="border-b border-borde/30 last:border-0">
                              <td className="py-1.5 pr-3 tabular-nums">{m.fecha}</td>
                              <td className="py-1.5 pr-3">{m.tipo}</td>
                              <td className="py-1.5 pr-3 font-mono">
                                {/* El origen del movimiento: la venta que lo
                                    produjo, o el motivo escrito a mano. Si no
                                    hay ninguno de los dos, se DICE — el "—" que
                                    había acá se leía como una celda vacía de
                                    formato, no como un movimiento sin origen
                                    registrado, que es lo que de verdad es. */}
                                {m.id_venta ?? (
                                  <span className="text-tintaSuave">
                                    {m.motivo ?? "sin origen registrado"}
                                  </span>
                                )}
                              </td>
                              <td className={`py-1.5 text-right font-semibold tabular-nums ${m.cantidad < 0 ? "text-red-600" : "text-emerald-700"}`}>
                                {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-borde/60 font-bold">
                            <td className="py-1.5 pr-3" colSpan={3}>
                              Flujo neto desde el {FECHA_INICIO_VENTANA} (suma exacta de las
                              filas) — no es la existencia: falta el saldo inicial
                            </td>
                            <td className={`py-1.5 text-right tabular-nums ${s.bajoMinimo ? "text-red-600" : ""}`}>{s.existencia} u</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t border-[rgba(22,24,29,.07)] pt-4">
            <BannerFicticioPremium fuente={dataset.fuente} />
          </div>
        </LienzoConAgentes>
      </section>
    </div>
  );
}
