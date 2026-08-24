// PRUEBA DE CIFRAS DE CONTROL — la unica cobertura de la CAPA DE CARGA.
//
// Las otras 76 pruebas del repo corren todas contra `datosDemo`: verifican que
// la aritmetica es correcta sobre numeros que nosotros mismos inventamos. Eso
// deja sin cubrir la pregunta que de verdad importa: ¿los datos que la app
// carga de Supabase se parecen a lo que dice Odoo? Esta prueba es la unica que
// llama a cargarDatasetReal().
//
// Se lee junto con fixtures/cifras-odoo.json, que es a la vez la lista de
// cifras capturadas y la lista de las que faltan pedirle a Odoo.
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE TOLERANCIA PORCENTUAL Y NUNCA assert.equal EXACTO
// ─────────────────────────────────────────────────────────────────────────────
// lib/verificacionOdoo.ts ya documenta el precedente, verificado el 2026-08-19:
// el total que arma la app suma saldo por FACTURA, mientras que el total que
// declara Odoo es por CLIENTE y ahi Odoo tambien descuenta pagos recibidos que
// todavia no estan aplicados a ninguna factura puntual (anticipos, pagos sin
// conciliar). Esa diferencia es REAL, no un bug.
//
// Un `assert.equal` exacto contra un sistema externo tiene entonces dos
// destinos posibles, los dos malos: o falla siempre por centavos legitimos y
// se termina ignorando (o borrando), o alguien "lo arregla" ajustando el
// calculo hasta que cuadre, escondiendo el bug de verdad. La tolerancia
// porcentual traza la linea explicita: por debajo de ella la diferencia se
// considera de conciliacion y se INFORMA; por encima es un error de mapeo y
// FALLA. Cada cifra trae su propia tolerancia en el fixture, porque no es lo
// mismo un monto multi-moneda (0.5%) que un conteo de pedidos (0%: si sobran o
// faltan pedidos, no hay nada que redondear).
//
// ─────────────────────────────────────────────────────────────────────────────
// TRES DESENLACES DISTINTOS, A PROPOSITO
// ─────────────────────────────────────────────────────────────────────────────
//   OK        el numero calculado cae dentro de la tolerancia de la cifra Odoo.
//   PENDIENTE la cifra Odoo todavia es null. Se imprime el valor calculado hoy
//             al lado, para que el fixture funcione como lista de compras. NO
//             es un fallo, pero NUNCA pasa en silencio.
//   FALLO     los numeros no cuadran, o una guarda de mapeo se rompio.
//
// Y aparte, fuera de la escala: SKIP. Si no hay red o no hay credenciales no se
// verifico NADA, y eso jamas debe leerse como verde. Sale con un cartel enorme.
//
// Ejecutar con: npm test

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cargarDatasetReal } from "../lib/datosReales";
import { stockPorProducto } from "../lib/cadena";
import type { Dataset } from "../lib/types";

// ── Fixture ─────────────────────────────────────────────────────────────────

interface CifraControl {
  valor: number | null;
  tolerancia_pct: number;
  unidad: string;
  fuente: string;
  fecha_captura: string | null;
  nota?: string;
}

// npm test corre desde la raiz del proyecto, pero no se da por sentado.
const RUTA_FIXTURE = [
  path.resolve(process.cwd(), "fixtures/cifras-odoo.json"),
  path.resolve(__dirname, "../fixtures/cifras-odoo.json"),
].find((r) => existsSync(r));
if (!RUTA_FIXTURE) {
  throw new Error("No se encontro fixtures/cifras-odoo.json — sin fixture no hay cifras de control.");
}
const fixture = JSON.parse(readFileSync(RUTA_FIXTURE, "utf8")) as {
  moneda: string;
  cifras: Record<string, CifraControl>;
};

function cifra(clave: string): CifraControl {
  const c = fixture.cifras[clave];
  if (!c) throw new Error(`fixtures/cifras-odoo.json no define la cifra "${clave}".`);
  return c;
}

// ── Reporte ─────────────────────────────────────────────────────────────────

let ok = 0;
const fallos: string[] = [];
const pendientes: string[] = [];

/** Mismo helper que scripts/test-calculos.ts, pero acumula en vez de cortar:
 *  si la primera guarda tira, igual queremos ver la lista completa de
 *  pendientes que hay que pedirle a Odoo. */
function prueba(nombre: string, fn: () => void) {
  try {
    fn();
    ok++;
    console.log(`  OK        ${nombre}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fallos.push(`${nombre}\n            ${msg.split("\n")[0]}`);
    console.log(`  FALLO     ${nombre}`);
    console.log(`            ${msg.split("\n").join("\n            ")}`);
  }
}

const num = (n: number, dec = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/**
 * Compara un valor calculado contra una cifra de control de Odoo.
 * Si la cifra es null, no compara: la reporta como PENDIENTE con el calculado
 * al lado. Si no, exige |calc - odoo| <= odoo * tolerancia_pct / 100.
 */
function contraOdoo(clave: string, nombre: string, calculado: number, decimales = 2) {
  const c = cifra(clave);

  if (c.valor === null) {
    pendientes.push(clave);
    console.log(`  PENDIENTE ${nombre}`);
    console.log(`            calculado hoy: ${num(calculado, decimales)} ${c.unidad}`);
    console.log(`            falta capturar de: ${c.fuente}`);
    return;
  }

  prueba(`${nombre} (Odoo ${num(c.valor, decimales)} ${c.unidad}, tol ${c.tolerancia_pct}%, capturado ${c.fecha_captura})`, () => {
    const esperado = c.valor as number;
    const margen = Math.abs(esperado) * (c.tolerancia_pct / 100);
    const dif = calculado - esperado;
    assert.ok(
      Math.abs(dif) <= margen,
      `calculado ${num(calculado, decimales)} vs Odoo ${num(esperado, decimales)} — ` +
        `diferencia ${num(dif, decimales)} (${((dif / (esperado || 1)) * 100).toFixed(2)}%), ` +
        `margen permitido ±${num(margen, decimales)}.\n` +
        `Fuente Odoo: ${c.fuente}` +
        (c.nota ? `\nNota: ${c.nota}` : "")
    );
  });
}

// ── Carga: SKIP ruidoso si no hay red / credenciales ────────────────────────

/** "No pude preguntar" y "la respuesta no cuadra" son cosas distintas y se
 *  reportan distinto. Solo lo primero es SKIP. */
function esProblemaDeAcceso(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e);
  const causa = (e as { cause?: { code?: string } } | null)?.cause?.code ?? "";
  const red = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|getaddrinfo|socket hang up/i;
  const auth = /HTTP 40[13]|HTTP 5\d\d|apikey|JWT|permission denied|not authorized/i;
  if (red.test(msg) || red.test(causa)) return `sin red hacia Supabase (${msg})`;
  if (auth.test(msg)) return `sin credenciales validas contra Supabase (${msg})`;
  return null;
}

function skipRuidoso(motivo: string): never {
  const linea = "!".repeat(78);
  console.log(`\n${linea}`);
  console.log("!! SKIP — NO SE VERIFICO NINGUNA CIFRA DE CONTROL.");
  console.log(`!! Motivo: ${motivo}`);
  console.log("!!");
  console.log("!! Esto NO es un visto bueno: es la prueba que NO pudo correr. Los numeros");
  console.log("!! de la app quedan sin contrastar contra Odoo. Con red y credenciales,");
  console.log("!! volve a correr `npm test`.");
  console.log(`${linea}\n`);
  process.exit(0);
}

async function main() {
  console.log("\n=== Cifras de control contra Odoo (capa de carga: cargarDatasetReal) ===");
  console.log(`Fixture: fixtures/cifras-odoo.json — moneda ${fixture.moneda}\n`);

  let dataset: Dataset;
  try {
    dataset = await cargarDatasetReal();
  } catch (e) {
    const acceso = esProblemaDeAcceso(e);
    if (acceso) skipRuidoso(acceso);
    throw e; // otra cosa: es un bug de verdad, que reviente.
  }

  // ── 1. GUARDAS DE MAPEO ───────────────────────────────────────────────────
  // Van PRIMERO y a proposito: no tiene sentido discutir si un total cuadra al
  // 0.5% si lo que se cargo no es siquiera el dataset real, o si la existencia
  // que se esta sumando no es una existencia. Estas guardas no necesitan
  // ninguna cifra nueva de Odoo: se verifican contra el dataset mismo, y HOY
  // fallan. Ese es el punto.

  console.log("— Guardas de mapeo (se verifican solas, sin cifras de Odoo) —");

  prueba("el dataset cargado declara fuente `odoo-real`", () =>
    assert.equal(
      dataset.fuente,
      "odoo-real",
      `fuente = "${dataset.fuente}". La prueba de cifras de control solo tiene sentido ` +
        `contra datos reales; contra el demo seria autocomplacencia.`
    )
  );

  const productos = dataset.productos ?? [];
  const movimientos = dataset.movimientosInventario ?? [];

  prueba("hay catalogo y movimientos de inventario cargados", () => {
    assert.ok(productos.length > 0, "cargarDatasetReal() no trajo ningun producto.");
    assert.ok(movimientos.length > 0, "cargarDatasetReal() no trajo ningun movimiento de inventario.");
  });

  const conMinimo = productos.filter((p) => p.stock_minimo > 0);
  prueba("al menos un producto tiene stock_minimo > 0", () =>
    assert.ok(
      conMinimo.length > 0,
      `los ${productos.length} tienen minimo 0, la regla degenero a existencia<=0. ` +
        `stock_minimo esta hardcodeado en 0 en scripts/importar-inventario-odoo.mjs:119 y :245; ` +
        `mientras siga asi, "bajoMinimo" no significa "hay que reponer", significa "no queda nada", ` +
        `que es otra cosa.`
    )
  );

  // Saldo inicial: un movimiento de apertura que cargue con lo que habia ANTES
  // de que arranque la ventana importada. Sin el, sumar los movimientos da el
  // flujo neto del periodo, no la existencia.
  const fechas = movimientos.map((m) => m.fecha).sort();
  const inicioVentana = fechas[0] ?? "(sin movimientos)";
  const esSaldoInicial = (motivo: string | undefined) =>
    /saldo\s*inicial|apertura|opening|inventario\s*inicial|existencia\s*inicial/i.test(motivo ?? "");
  const aperturas = movimientos.filter((m) => esSaldoInicial(m.motivo));

  prueba("existen movimientos de saldo inicial", () =>
    assert.ok(
      aperturas.length > 0,
      `existencia es flujo neto de la ventana, no existencia. No hay un solo movimiento de ` +
        `apertura: el movimiento mas antiguo es ${inicioVentana} y todo lo anterior a esa fecha ` +
        `simplemente no existe para la app. stock.quant se lee solo para SKU y nombre — su ` +
        `"cantidad a mano" nunca se usa. Por eso hay existencias negativas.`
    )
  );

  const stock = stockPorProducto(dataset);
  const bajoMinimo = stock.filter((f) => f.bajoMinimo);
  const bajoMinimoSinUmbral = bajoMinimo.filter((f) => f.producto.stock_minimo === 0);

  prueba("ningun producto marcado bajoMinimo tiene stock_minimo === 0", () =>
    assert.ok(
      bajoMinimoSinUmbral.length === 0,
      `${bajoMinimoSinUmbral.length} de ${bajoMinimo.length} productos marcados "bajo minimo" ` +
        `tienen umbral 0. Con umbral 0 la comparacion existencia <= stock_minimo no responde ` +
        `"¿hay que reponer?" sino "¿se agoto?", y la alerta pierde todo su significado. ` +
        `Ejemplos: ${bajoMinimoSinUmbral.slice(0, 5).map((f) => f.producto.sku).join(", ")}.`
    )
  );

  const pctBajoMinimo = productos.length ? (bajoMinimo.length / productos.length) * 100 : 0;
  prueba("menos del 50% del catalogo esta bajo minimo", () =>
    assert.ok(
      pctBajoMinimo < 50,
      `${bajoMinimo.length} de ${productos.length} SKU (${pctBajoMinimo.toFixed(0)}%) figuran bajo ` +
        `minimo. Una alerta que se enciende para tres cuartos del catalogo no es una alerta: es ` +
        `ruido, y se ignora. Es sintoma de las dos guardas anteriores (minimo 0 + existencia sin ` +
        `saldo inicial), no un problema de abastecimiento.`
    )
  );

  // ── 2. MONTOS CONTRA CIFRAS DE ODOO ───────────────────────────────────────

  console.log("\n— Cifras de control (calculado vs Odoo, con tolerancia) —");

  const ventas = dataset.ventas ?? [];
  const lineas = dataset.ventaLineas ?? [];

  // Total segun las lineas: Σ(cantidad x precio_unitario). Es lo que muestra la
  // app hoy. No resta descuento porque venta_lineas no tiene columna de
  // descuento (ver verificacion/linea-base.mjs, que falla justamente por eso).
  const totalPorLineas =
    Math.round(lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0) * 100) / 100;

  // Total de referencia: el que Odoo ya calculo por pedido y que vive en
  // ventas.total_odoo_referencia. Se lee de forma defensiva porque el mapeo de
  // ese campo en lib/datosReales.ts puede llamarse de mas de una manera.
  const leerReferencia = (v: unknown): number | null => {
    const o = v as Record<string, unknown>;
    for (const k of ["total_odoo_referencia", "totalOdooReferencia", "total_referencia", "totalReferencia"]) {
      const x = o?.[k];
      if (typeof x === "number" && Number.isFinite(x)) return x;
      if (typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x))) return Number(x);
    }
    return null;
  };
  const referencias = ventas.map(leerReferencia);
  const hayReferencia = referencias.some((r) => r !== null);
  const totalReferencia =
    Math.round(referencias.reduce<number>((s, r) => s + (r ?? 0), 0) * 100) / 100;

  if (hayReferencia) {
    console.log(
      `  (usando ventas.total_odoo_referencia: ${referencias.filter((r) => r !== null).length}/${ventas.length} pedidos lo traen)`
    );
  } else {
    console.log(
      "  (ventas.total_odoo_referencia NO llega a traves de cargarDatasetReal; se compara " +
        "contra el total por lineas, que es el que muestra la pagina)"
    );
  }

  const totalVentas = hayReferencia ? totalReferencia : totalPorLineas;
  contraOdoo("ventas_total_confirmado", "Total de ventas confirmadas", totalVentas);

  if (hayReferencia) {
    console.log(
      `            referencia Odoo en base: ${num(totalReferencia)} · ` +
        `Σ(cantidad x precio) sin descuento: ${num(totalPorLineas)} · ` +
        `brecha: ${num(totalPorLineas - totalReferencia)}`
    );
  }

  contraOdoo("ventas_pedidos_confirmados", "Cantidad de pedidos de venta", ventas.length, 0);

  const testigo = stock.find((f) => f.producto.sku.trim().toUpperCase() === "ED-11.7.3");
  if (!testigo) {
    fallos.push(
      'Producto testigo ED-11.7.3\n            no esta en el catalogo cargado; sin el no se puede medir el hueco de saldo inicial.'
    );
    console.log("  FALLO     Producto testigo ED-11.7.3 no esta en el catalogo cargado.");
  } else {
    contraOdoo("inventario_existencia_ed_11_7_3", "Existencia de ED-11.7.3", testigo.existencia, 0);
  }

  const unidadesTotales = stock.reduce((s, f) => s + f.existencia, 0);
  contraOdoo("inventario_unidades_totales", "Unidades totales en existencia", unidadesTotales, 0);

  const valorCosto = Math.round(stock.reduce((s, f) => s + f.valorCosto, 0) * 100) / 100;
  contraOdoo("inventario_valor_costo_total", "Valor de inventario a costo", valorCosto);

  contraOdoo("inventario_skus_bajo_minimo", "SKU bajo minimo", bajoMinimo.length, 0);

  // Saldo pendiente por factura: monto original menos las notas de credito
  // aplicadas — que es como lib/datosReales.ts representa el "Importe adeudado"
  // que Odoo ya calculo (ver el comentario de cabecera de ese archivo).
  const saldoVencido =
    Math.round(
      dataset.facturas.reduce((s, f) => {
        const nc = dataset.notasCredito
          .filter((n) => n.id_factura === f.id_factura && n.estado_nota_credito === "aplicada")
          .reduce((a, n) => a + n.monto_nota_credito, 0);
        return s + Math.max(0, f.monto_original - nc);
      }, 0) * 100
    ) / 100;
  contraOdoo("cxc_saldo_vencido_total", "Saldo de cuentas por cobrar", saldoVencido);

  const costoVentas =
    Math.round(
      lineas.reduce((s, l) => {
        const p = productos.find((x) => x.id_producto === l.id_producto);
        return s + l.cantidad * (p?.costo_unitario ?? 0);
      }, 0) * 100
    ) / 100;
  contraOdoo("ventas_margen_bruto", "Margen bruto de ventas", Math.round((totalVentas - costoVentas) * 100) / 100);

  // ── 3. Cierre ─────────────────────────────────────────────────────────────

  console.log("\n=== Resumen ===");
  console.log(`  OK:        ${ok}`);
  console.log(`  PENDIENTE: ${pendientes.length}`);
  console.log(`  FALLO:     ${fallos.length}`);

  if (pendientes.length) {
    console.log("\nCifras que faltan pedirle a Odoo (valor: null en fixtures/cifras-odoo.json):");
    for (const k of pendientes) {
      console.log(`  - ${k}`);
      console.log(`      ${cifra(k).fuente}`);
    }
  }

  if (fallos.length) {
    console.log("\nFallos:");
    for (const f of fallos) console.log(`  - ${f}`);
    console.log(
      "\nEsto es el sistema hablando en voz alta, no una regresion sorpresa: mientras las\n" +
        "guardas de mapeo esten en rojo, los numeros de la app no representan lo que dice\n" +
        "Odoo. El verde se gana arreglando el mapeo, no bajando la guarda.\n"
    );
    process.exit(1);
  }

  console.log("\nTodas las cifras capturadas cuadran dentro de su tolerancia.\n");
}

main().catch((e) => {
  console.error("\nError inesperado en la prueba de cifras de control:");
  console.error(e);
  process.exit(1);
});
