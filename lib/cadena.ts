// Cadena Ventas ↔ Inventario ↔ CxC — Paso 11 (alcance declarado 2026-08-15).
//
// Principio: el hecho se guarda UNA vez y todo lo demás se DERIVA.
//   existencia  = Σ movimientos                 (nunca un campo editable)
//   total venta = Σ cantidad × precio           (nunca tecleado)
//   cuadre      = vendido − facturado           (si difieren, se muestra el monto)
// Un número guardado puede contradecir a su sujeto; uno derivado, no.
//
// Corrección 2026-08-23 — "total venta = Σ cantidad × precio" es verdad sólo
// si las líneas traen el descuento. En ESTE export de Odoo no lo traen: la
// columna descuento no existe ni en el esquema ni en los datos. Σ líneas es
// entonces el pedido A PRECIO DE LISTA (capa "composicion"), y el total
// vendido sale de ventas.total_odoo_referencia (capa "hecho"). Las dos capas
// se distinguen en el TIPO con `Cifra<C>` (ver bloque PROCEDENCIA en
// lib/types.ts): mezclarlas es un error de compilación, no de disciplina.
//
// ⚠️ Fórmulas PENDIENTES DE VALIDACIÓN POR FINANZAS, como todo el prototipo.

import { nombreDeCliente, saldoPendiente } from "./calculos";
import { Cifra } from "./types";
import type { Dataset, MovimientoInventario, Producto } from "./types";

const redondear2 = (n: number) => Math.round(n * 100) / 100;
const MS_POR_DIA = 86_400_000;
const dias = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / MS_POR_DIA);

/** El Paso 11 es opcional en el Dataset: un CSV solo-CxC no lo trae. */
export function hayCadena(d: Dataset): boolean {
  return !!(d.productos?.length && d.ventas?.length && d.ventaLineas?.length && d.movimientosInventario?.length);
}

/**
 * ¿Al menos una factura del dataset trae id_venta poblado? Si NINGUNA lo trae,
 * "ventas sin factura" no es una alarma de negocio: es que este export de Odoo
 * nunca capturó el vínculo venta↔factura. No se puede acusar a la venta de una
 * cadena rota que el propio dato es incapaz de mostrar.
 */
export function vinculoVentaFacturaDisponible(d: Dataset): boolean {
  return d.facturas.some((f) => f.id_venta);
}

// ── Inventario ──────────────────────────────────────────────────────────────

export interface FilaStock {
  producto: Producto;
  existencia: number;
  bajoMinimo: boolean;
  valorCosto: number;
  movimientos: MovimientoInventario[]; // el kardex: el desglose ES la existencia
}

export function stockPorProducto(d: Dataset): FilaStock[] {
  return (d.productos ?? []).map((p) => {
    const movimientos = (d.movimientosInventario ?? [])
      .filter((m) => m.id_producto === p.id_producto)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const existencia = movimientos.reduce((s, m) => s + m.cantidad, 0);
    return {
      producto: p,
      existencia,
      bajoMinimo: existencia <= p.stock_minimo,
      valorCosto: redondear2(existencia * p.costo_unitario),
      movimientos,
    };
  });
}

/** Salidas sin venta de origen: no son error fatal, pero se AUDITAN siempre. */
export function salidasSinVenta(d: Dataset): MovimientoInventario[] {
  return (d.movimientosInventario ?? []).filter((m) => m.tipo === "salida" && !m.id_venta);
}

// ── Ventas ──────────────────────────────────────────────────────────────────

export interface VentaConTotal {
  id_venta: string;
  id_cliente: string;
  cliente: string;
  fecha: string;
  lineas: { producto: string; sku: string; cantidad: number; precio: number; importe: number; costo: number }[];
  /**
   * ⚠ Capa "composicion" — Σ(cantidad × precio_unitario) de las líneas, es
   * decir el pedido A PRECIO DE LISTA. El export de líneas de Odoo no trae la
   * columna descuento, así que esto NO es lo vendido. Queda como `number`
   * suelto sólo porque lo consumen módulos que no se tocan en este cambio
   * (lib/argumento.ts, components/Agentes.tsx). Todo consumo NUEVO debe usar
   * `totalLista` / `totalReferencia`, que llevan la capa en el tipo.
   */
  total: number;
  costoTotal: number;
  /** ⚠ Capa "composicion": precio de lista − costo. NO es margen comercial: el descuento no está restado. */
  margen: number;
  margenPct: number | null;
  /** Capa "composicion", tipada: el mismo `total`, pero imposible de mezclar con la capa "hecho". */
  totalLista: Cifra<"composicion">;
  /** Capa "hecho": lo que Odoo cerró para este pedido. null si el export no lo trajo. */
  totalReferencia: Cifra<"hecho"> | null;
  id_factura: string | null;
}

export function ventasConTotal(d: Dataset): VentaConTotal[] {
  const nombreCliente = (id: string) =>
    nombreDeCliente(d.clientes, id);
  const producto = (id: string) => (d.productos ?? []).find((p) => p.id_producto === id);

  return (d.ventas ?? [])
    .map((v) => {
      const lineas = (d.ventaLineas ?? [])
        .filter((l) => l.id_venta === v.id_venta)
        .map((l) => {
          const p = producto(l.id_producto);
          return {
            producto: p?.nombre_producto ?? l.id_producto,
            sku: p?.sku ?? "?",
            cantidad: l.cantidad,
            precio: l.precio_unitario,
            importe: redondear2(l.cantidad * l.precio_unitario),
            costo: redondear2(l.cantidad * (p?.costo_unitario ?? 0)),
          };
        });
      const total = redondear2(lineas.reduce((s, l) => s + l.importe, 0));
      const costoTotal = redondear2(lineas.reduce((s, l) => s + l.costo, 0));
      const margen = redondear2(total - costoTotal);
      return {
        id_venta: v.id_venta,
        id_cliente: v.id_cliente,
        cliente: nombreCliente(v.id_cliente),
        fecha: v.fecha_venta,
        lineas,
        total,
        costoTotal,
        margen,
        totalLista: Cifra.composicion(total),
        totalReferencia: v.total_referencia ?? null,
        margenPct: total > 0 ? redondear2((margen / total) * 100) : null,
        id_factura: d.facturas.find((f) => f.id_venta === v.id_venta)?.id_factura ?? null,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// ── Las dos capas, cada una con su nombre ───────────────────────────────────
//
// Ver el bloque PROCEDENCIA en lib/types.ts. Acá viven las dos únicas maneras
// de totalizar ventas, cada una devolviendo su capa en el tipo, más la única
// función autorizada a poner las dos en la misma frase.

export interface TotalHecho {
  /** Σ ventas.total_odoo_referencia — descuento ya aplicado por Odoo. */
  total: Cifra<"hecho">;
  /** Pedidos que entraron en la suma. */
  pedidos: number;
  /** Pedidos SIN total de referencia en el export: no se inventa un total para ellos, se cuentan aparte. */
  pedidosSinReferencia: number;
}

/** TOTAL VENDIDO. La cifra correcta ya estaba en la base; no hacía falta ningún export nuevo. */
export function totalVendidoReferencia(d: Dataset): TotalHecho {
  const ventas = d.ventas ?? [];
  const conRef = ventas.filter((v) => v.total_referencia != null);
  return {
    total: Cifra.sumar("hecho", conRef.map((v) => v.total_referencia as Cifra<"hecho">)),
    pedidos: conRef.length,
    pedidosSinReferencia: ventas.length - conRef.length,
  };
}

export interface TotalComposicion {
  /** Σ(cantidad × precio_unitario) — el pedido a PRECIO DE LISTA, sin descuento. */
  total: Cifra<"composicion">;
  ventas: number;
  lineas: number;
}

/** Lo que se puede reconstruir desde las líneas. Se rotula siempre "a precio de lista". */
export function totalAPrecioDeLista(d: Dataset): TotalComposicion {
  const filas = ventasConTotal(d);
  return {
    total: Cifra.sumar("composicion", filas.map((v) => v.totalLista)),
    ventas: filas.length,
    lineas: filas.reduce((s, v) => s + v.lineas.length, 0),
  };
}

/**
 * Tolerancia de la brecha: 0.1% del total de referencia (mínimo un centavo).
 * Por debajo de eso, líneas y referencia describen el mismo hecho y la banda
 * de brecha no tiene nada que decir.
 */
export function toleranciaBrecha(referencia: number): number {
  return Math.max(0.01, Math.abs(referencia) * 0.001);
}

export interface BrechaCapas {
  /** Σ líneas, a precio de lista (capa "composicion"). */
  lista: number;
  /** Σ total_odoo_referencia (capa "hecho"). */
  referencia: number;
  /** lista − referencia. Positiva = las líneas cobran de más porque el descuento no está restado. */
  brecha: number;
  /** % de la referencia que representa la brecha. */
  brechaPct: number | null;
  tolerancia: number;
  /** true = las dos capas ya describen el mismo hecho; la banda de la UI debe desaparecer SOLA. */
  dentroDeTolerancia: boolean;
  ventas: number;
  lineas: number;
}

/**
 * LA ÚNICA función autorizada a cruzar capas — y no produce una magnitud
 * mezclada: produce la DISTANCIA entre las dos, que es exactamente lo que hay
 * que mirar. Al 2026-08-23 vale ~6.87 millones y su causa es conocida: el
 * export de sale.order.line no trae la columna descuento, así que las líneas
 * quedan a precio de lista.
 *
 * Cuando el export traiga el descuento, la brecha caerá bajo la tolerancia y
 * `dentroDeTolerancia` pasará a true sin que nadie edite nada: la banda de la
 * UI se apaga sola. No hay ningún aviso que haya que acordarse de borrar.
 */
export function brechaEntreCapas(d: Dataset): BrechaCapas {
  const composicion = totalAPrecioDeLista(d);
  const hecho = totalVendidoReferencia(d);
  const lista = composicion.total.valorParaMostrar();
  const referencia = hecho.total.valorParaMostrar();
  const brecha = redondear2(lista - referencia);
  const tolerancia = toleranciaBrecha(referencia);
  return {
    lista,
    referencia,
    brecha,
    brechaPct: referencia === 0 ? null : (brecha / referencia) * 100,
    tolerancia,
    dentroDeTolerancia: Math.abs(brecha) <= tolerancia,
    ventas: composicion.ventas,
    lineas: composicion.lineas,
  };
}

// ── El cuadre: la alarma de la juntura ──────────────────────────────────────

export interface Cuadre {
  totalVendido: number;
  totalFacturado: number;
  /** 0 = cuadran. Distinto de 0 = el monto EXACTO del descuadre, nunca un booleano mudo. */
  diferencia: number;
  cuadra: boolean;
}

/**
 * Vendido (Σ líneas, capa "composicion") contra facturado (Σ monto_original,
 * sin anuladas). Se deja EXACTAMENTE como estaba: compara dos poblaciones
 * distintas (pedidos contra facturas) y esa comparación es la que quiere hacer.
 * No se le cambia la fuente ni se le aplica la regla de procedencia acá.
 */
export function cuadreVentasFacturacion(d: Dataset): Cuadre {
  const totalVendido = redondear2(
    ventasConTotal(d).reduce((s, v) => s + v.total, 0)
  );
  const totalFacturado = redondear2(
    d.facturas.filter((f) => f.estado_factura !== "anulada").reduce((s, f) => s + f.monto_original, 0)
  );
  const diferencia = redondear2(totalVendido - totalFacturado);
  return { totalVendido, totalFacturado, diferencia, cuadra: Math.abs(diferencia) < 0.005 };
}

// ── El cruce: una operación seguida de punta a punta ────────────────────────

export interface PasoCadena {
  fecha: string;
  modulo: "Inventario" | "Ventas" | "CxC";
  hecho: string;
  monto?: string;
}

export interface CadenaFactura {
  id_factura: string;
  pasos: PasoCadena[];
  /** Días entre la entrada a bodega y el último cobro (o el corte si no hay cobro). */
  cicloDias: number | null;
  saldoHoy: number;
}

/** Reconstruye la historia completa de una factura a través de los tres módulos. */
export function cadenaDeFactura(d: Dataset, idFactura: string, fmtMoneda: (n: number) => string): CadenaFactura | null {
  const f = d.facturas.find((x) => x.id_factura === idFactura);
  if (!f) return null;
  const pasos: PasoCadena[] = [];

  const venta = (d.ventas ?? []).find((v) => v.id_venta === f.id_venta);
  const salidas = (d.movimientosInventario ?? []).filter((m) => m.id_venta === f.id_venta);
  const productosDe = new Set(salidas.map((m) => m.id_producto));
  const entradas = (d.movimientosInventario ?? []).filter(
    (m) => m.tipo === "entrada" && productosDe.has(m.id_producto)
  );

  for (const e of entradas) {
    const p = (d.productos ?? []).find((x) => x.id_producto === e.id_producto);
    pasos.push({ fecha: e.fecha, modulo: "Inventario", hecho: `entró ${p?.sku ?? e.id_producto} (+${e.cantidad})`, monto: e.motivo });
  }
  for (const s of salidas) {
    const p = (d.productos ?? []).find((x) => x.id_producto === s.id_producto);
    pasos.push({ fecha: s.fecha, modulo: "Inventario", hecho: `salió ${p?.sku ?? s.id_producto} (${s.cantidad}) por ${s.id_venta}` });
  }
  if (venta) {
    const vt = ventasConTotal(d).find((v) => v.id_venta === venta.id_venta);
    pasos.push({ fecha: venta.fecha_venta, modulo: "Ventas", hecho: `venta ${venta.id_venta}`, monto: vt ? fmtMoneda(vt.total) : undefined });
  }
  pasos.push({ fecha: f.fecha_emision, modulo: "CxC", hecho: `se facturó ${f.numero_factura}`, monto: fmtMoneda(f.monto_original) });
  if (f.fecha_vencimiento) pasos.push({ fecha: f.fecha_vencimiento, modulo: "CxC", hecho: "venció" });
  for (const p of d.pagos.filter((x) => x.id_factura === idFactura && x.estado_aplicacion !== "no_aplicado")) {
    pasos.push({ fecha: p.fecha_pago, modulo: "CxC", hecho: `cobro ${p.estado_aplicacion}`, monto: fmtMoneda(p.monto_pago) });
  }
  for (const di of d.disputas.filter((x) => x.id_factura === idFactura)) {
    pasos.push({ fecha: di.fecha_apertura, modulo: "CxC", hecho: `disputa ${di.estado_disputa}`, monto: fmtMoneda(di.monto_disputado) });
  }

  pasos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const primeraEntrada = entradas.map((e) => e.fecha).sort()[0] ?? null;
  const ultimoCobro = d.pagos
    .filter((x) => x.id_factura === idFactura && x.estado_aplicacion !== "no_aplicado")
    .map((p) => p.fecha_pago)
    .sort()
    .at(-1);

  return {
    id_factura: idFactura,
    pasos,
    cicloDias: primeraEntrada && ultimoCobro ? dias(primeraEntrada, ultimoCobro) : null,
    saldoHoy: saldoPendiente(f, d.pagos, d.notasCredito),
  };
}

// ── 2.6 · Lo que el inventario TODAVÍA NO PUEDE AFIRMAR ─────────────────────
//
// DEPENDE DE (R7): que el Frente 1 confirme en docs/hallazgos-odoo-en-vivo.md
// si Odoo puede entregar (a) un saldo inicial de existencias anterior a la
// ventana de movimientos importada y (b) el punto de reorden real por producto.
// Si resultara falso que faltan —es decir, si el export SÍ los trae—, nada de
// esto se cae: las dos funciones de abajo pasan a devolver `true` SOLAS, porque
// leen el dato en vez de afirmarlo. No hay ningún flag que acordarse de apagar.
//
// EL PRINCIPIO, que es el mismo del resto del archivo: el valor neutro se
// admite SÓLO donde es verdadero. Y de los dos casos, uno CAMBIÓ DE LADO:
//
//   descuento = 0   YA NO. Acá decía que no restar nada era literalmente
//                        correcto «porque no consta ningún descuento». El
//                        boletín del 2026-08-24 REFUTÓ esa premisa: sobre los
//                        pedidos no cancelados el descuento real es de
//                        Q8,974,256.21 (26,285,671.61 bruto contra 17,311,415.40
//                        neto). El descuento CONSTA; lo que falta es traerlo.
//                        Y ya no hace falta pedir la columna `discount` a nadie:
//                        Odoo entregó `price_subtotal` —el importe neto por
//                        línea— para las 24.349 líneas, y está en disco.
//                        Mientras `VentaLinea` no tenga ese campo, la suma de
//                        cantidad × precio_unitario NO es un neutro inocente:
//                        es una cifra que se sabe inflada, y por eso vive en la
//                        capa "composicion" y se rotula SIEMPRE "a precio de
//                        lista" — nunca "vendido".
//
//   saldo inicial = 0  NO, y el boletín lo confirmó. Poner 0 es AFIRMAR que la
//                        bodega arrancó vacía el día del primer movimiento
//                        importado, y eso es falso: la empresa ya operaba.
//                        `Σ movimientos` sobre una ventana recortada no es la
//                        existencia, es la VARIACIÓN de la existencia dentro de
//                        esa ventana. Son dos magnitudes distintas y la segunda
//                        no autoriza a hablar de stock. El Frente 1 tampoco
//                        cargó ninguno, y por la misma razón: tiene DOS cifras
//                        de Odoo para el mismo SKU en fechas distintas (714 al
//                        19-08, 658 al 23-08) y elegir una sería fabricar el
//                        número. El saldo inicial y la ventana de movimientos
//                        tienen que fecharse contra el MISMO instante.

/** Un producto cuya serie de movimientos NO alcanza para afirmar su existencia. */
export interface SerieTruncada {
  producto: Producto;
  /** El primer movimiento registrado. Si es una SALIDA, había stock antes: la serie empieza a mitad de la historia. */
  primerMovimiento: MovimientoInventario;
  /** La variación acumulada dentro de la ventana. NO es la existencia. */
  variacion: number;
}

export interface IntegridadInventario {
  /** Productos con al menos un movimiento. Los que no tienen ninguno no se juzgan. */
  productosConMovimiento: number;
  /**
   * Series que arrancan con una salida: para que salga mercadería tenía que
   * haber entrado antes, y esa entrada no está en el dataset. La conclusión no
   * se asume, se DERIVA del propio dato.
   */
  seriesTruncadas: SerieTruncada[];
  /**
   * ¿Se puede hablar de EXISTENCIA? Sólo si ninguna serie está truncada, es
   * decir si toda la historia de cada producto está dentro del dataset.
   */
  existenciaEsAfirmable: boolean;
  /** Fecha del primer movimiento del dataset — el borde de la ventana importada. */
  desde: string | null;
  /**
   * ¿Hay punto de reorden real? Si TODOS los productos traen stock_minimo = 0,
   * la columna nunca se pobló (scripts/importar-inventario-odoo.mjs la escribe
   * literalmente como 0). Un mínimo de 0 para todo el catálogo no es una
   * política de inventario: es una columna vacía. También se DERIVA del dato.
   */
  minimoEsAfirmable: boolean;
  productosConMinimoPositivo: number;
}

export function integridadInventario(d: Dataset): IntegridadInventario {
  const productos = d.productos ?? [];
  const movimientos = d.movimientosInventario ?? [];
  const seriesTruncadas: SerieTruncada[] = [];
  let productosConMovimiento = 0;

  for (const p of productos) {
    const propios = movimientos
      .filter((m) => m.id_producto === p.id_producto)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (propios.length === 0) continue;
    productosConMovimiento++;
    const primerMovimiento = propios[0];
    if (primerMovimiento.tipo === "salida") {
      seriesTruncadas.push({
        producto: p,
        primerMovimiento,
        variacion: propios.reduce((s, m) => s + m.cantidad, 0),
      });
    }
  }

  const productosConMinimoPositivo = productos.filter((p) => p.stock_minimo > 0).length;
  const fechas = movimientos.map((m) => m.fecha).sort();

  return {
    productosConMovimiento,
    seriesTruncadas,
    existenciaEsAfirmable: productosConMovimiento > 0 && seriesTruncadas.length === 0,
    desde: fechas[0] ?? null,
    minimoEsAfirmable: productos.length > 0 && productosConMinimoPositivo > 0,
    productosConMinimoPositivo,
  };
}
