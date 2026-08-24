// INSTRUMENTO DE VERIFICACION — linea base de las pruebas de aceptacion.
//
// Se escribe ANTES de que empiece cualquier reparacion, y a proposito: si el
// instrumento se construyera despues de ver la reparacion, se amoldaria a ella.
// La medida debe fijarse antes que lo medido.
//
// Solo LEE. No escribe en ninguna tabla ni toca el dashboard.
//
// Los valores esperados de Odoo vienen de la auditoria del 2026-08-21 y estan
// marcados como REFERENCIA: hay que reconfirmarlos contra Odoo antes de dar por
// cerrada cualquier prueba, porque amount_residual es un campo vivo.

const URL = "https://jfvmuemyjcdesnoqeaix.supabase.co";
const KEY = "sb_publishable_7l3WptofYtgvkDUHKyfwPQ_x0nl0lc1";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// La REST de Supabase corta en 1000 filas. venta_lineas tiene 23.869: sin
// paginar, el total de ventas saldria ~24 veces mas chico y la prueba mentiria.
async function traerTodo(tabla, select, filtro = "") {
  const filas = [];
  const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    const res = await fetch(`${URL}/rest/v1/${tabla}?select=${select}${filtro}&limit=${paso}&offset=${desde}`, { headers: H });
    if (!res.ok) throw new Error(`${tabla}: HTTP ${res.status}`);
    const lote = await res.json();
    filas.push(...lote);
    if (lote.length < paso) break;
  }
  return filas;
}

const q2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => "Q" + q2(n).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pruebas = [];
function prueba({ id, frente, nombre, hoy, debe, pasa, nota }) {
  pruebas.push({ id, frente, nombre, hoy, debe, pasa, nota });
}

console.log("Levantando linea base contra Supabase...\n");

// ─────────────────────────────────────────────────────────────────────────────
// FRENTE C1 · VENTAS
// ─────────────────────────────────────────────────────────────────────────────
const lineas = await traerTodo("venta_lineas", "id_venta,cantidad,precio_unitario");
const ventas = await traerTodo("ventas", "id_venta,total_odoo_referencia,estado_odoo");

const totalPorLineas = q2(lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_unitario), 0));
const totalReferencia = q2(ventas.reduce((s, v) => s + Number(v.total_odoo_referencia || 0), 0));

prueba({
  id: 11, frente: "C1 Ventas", nombre: "Total vendido (lineas vs referencia de Odoo)",
  hoy: fmt(totalPorLineas), debe: fmt(totalReferencia),
  pasa: Math.abs(totalPorLineas - totalReferencia) < 1,
  nota: `${lineas.length} lineas · brecha ${fmt(totalPorLineas - totalReferencia)}`,
});

// Cuantas ordenes NO cuadran: por orden, suma de sus lineas vs su referencia.
const porOrden = new Map();
for (const l of lineas) {
  porOrden.set(l.id_venta, (porOrden.get(l.id_venta) || 0) + Number(l.cantidad) * Number(l.precio_unitario));
}
let cuadran = 0, noCuadran = 0, sinLineas = 0;
for (const v of ventas) {
  const suma = porOrden.get(v.id_venta);
  if (suma === undefined) { sinLineas++; continue; }
  if (Math.abs(q2(suma) - Number(v.total_odoo_referencia || 0)) < 0.5) cuadran++; else noCuadran++;
}
prueba({
  id: 13, frente: "C1 Ventas", nombre: "Ordenes que cuadran contra total_odoo_referencia",
  hoy: `${cuadran} de ${ventas.length}`, debe: `${ventas.length} de ${ventas.length}`,
  pasa: noCuadran === 0,
  nota: `${noCuadran} no cuadran · ${sinLineas} sin lineas`,
});

// La columna que falta, comprobada por su ausencia en el esquema.
const colsLinea = Object.keys(lineas[0] || {});
prueba({
  id: "C1-esquema", frente: "C1 Ventas", nombre: "venta_lineas tiene columna de descuento",
  hoy: colsLinea.includes("discount") || colsLinea.includes("descuento") ? "si" : "NO",
  debe: "si", pasa: colsLinea.includes("discount") || colsLinea.includes("descuento"),
  nota: `columnas: ${colsLinea.join(",")}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// FRENTE C2 · INVENTARIO
// ─────────────────────────────────────────────────────────────────────────────
const productos = await traerTodo("productos", "id_producto,sku,costo_unitario,stock_minimo");
const movs = await traerTodo("movimientos_inventario", "id_producto,tipo,cantidad,id_venta");

const tipos = [...new Set(movs.map((m) => m.tipo))];
// El signo YA viene dentro de la columna cantidad: las salidas se guardan en
// negativo. lib/cadena.ts (stockPorProducto) suma cantidad sin mirar el tipo.
// Aplicarle ademas un signo por tipo convertiria las salidas en entradas — es
// el error que cometio la primera version de este instrumento, y es exactamente
// la falla de unidad de analisis que este proyecto vino a corregir.
const stock = new Map();
for (const m of movs) {
  stock.set(m.id_producto, (stock.get(m.id_producto) || 0) + Number(m.cantidad));
}
const unidades = q2([...stock.values()].reduce((a, b) => a + b, 0));
const negativos = [...stock.values()].filter((v) => v < 0).length;
const costoPorId = new Map(productos.map((p) => [p.id_producto, Number(p.costo_unitario || 0)]));
const valor = q2([...stock.entries()].reduce((s, [id, u]) => s + u * (costoPorId.get(id) || 0), 0));

prueba({
  id: 15, frente: "C2 Inventario", nombre: "Valor a costo",
  hoy: fmt(valor), debe: "Q2,635,102.99 (REFERENCIA Odoo)",
  pasa: Math.abs(valor - 2635102.99) < 1,
  nota: `tipos de movimiento: ${tipos.join(",")}`,
});
prueba({
  id: 16, frente: "C2 Inventario", nombre: "Unidades totales",
  hoy: unidades.toLocaleString("es-GT"), debe: "25,986 (REFERENCIA Odoo)",
  pasa: Math.abs(unidades - 25986) < 1, nota: "",
});
prueba({
  id: 17, frente: "C2 Inventario", nombre: "Productos con existencia negativa",
  hoy: String(negativos), debe: "0", pasa: negativos === 0,
  nota: "una existencia negativa no es un hecho: es la firma del saldo inicial ausente",
});

const ed = productos.find((p) => p.sku === "ED-11.7.3");
if (ed) {
  const u = q2(stock.get(ed.id_producto) || 0);
  prueba({
    id: "17b", frente: "C2 Inventario", nombre: "Testigo ED-11.7.3 (el que manda reponer)",
    hoy: `${u} u`, debe: "658 u (REFERENCIA Odoo)", pasa: Math.abs(u - 658) < 1,
    nota: "es el unico defecto que MANDA OBRAR: comprar lo que ya se tiene",
  });
}

const conMinimo = productos.filter((p) => Number(p.stock_minimo || 0) > 0).length;
prueba({
  id: "C2-umbral", frente: "C2 Inventario", nombre: "Productos con stock_minimo definido",
  hoy: `${conMinimo} de ${productos.length}`, debe: `${productos.length} de ${productos.length}`,
  pasa: conMinimo === productos.length,
  nota: "sin umbral, la alarma '547 bajo minimo (73%)' no tiene referente",
});

const movsConVenta = movs.filter((m) => m.id_venta).length;
prueba({
  id: "C2-vinculo", frente: "C2 Inventario", nombre: "Movimientos con id_venta poblado",
  hoy: String(movsConVenta), debe: "> 0", pasa: movsConVenta > 0,
  nota: "si es 0, 'salidas sin venta 100%' es artefacto del ETL, no hallazgo",
});

// ─────────────────────────────────────────────────────────────────────────────
// FRENTE C3 · DATOS
// ─────────────────────────────────────────────────────────────────────────────
const facturas = await traerTodo("facturas", "id_factura,fecha_emision,fecha_vencimiento,monto_original,saldo_pendiente_odoo,id_venta");
const sinVenc = facturas.filter((f) => !f.fecha_vencimiento).length;
const epoch = facturas.filter((f) => f.fecha_emision === "1970-01-01").length;
const montoNoPos = facturas.filter((f) => Number(f.monto_original) <= 0).length;

prueba({
  id: 18, frente: "C3 Datos", nombre: "Facturas cargadas vs existentes en Odoo (completitud)",
  hoy: `${facturas.length} cargadas, declara "100% limpio"`,
  debe: "3,199 en Odoo · declarar 3,182 de 3,199 (99.47%)",
  pasa: false,
  nota: `las 3 reglas dan 0 (sin venc ${sinVenc}, epoch ${epoch}, monto<=0 ${montoNoPos}) sobre un universo ya filtrado`,
});

const conIdVenta = facturas.filter((f) => f.id_venta).length;
prueba({
  id: "C3-vinculo", frente: "C3 Datos", nombre: "Facturas con id_venta poblado",
  hoy: String(conIdVenta), debe: "> 0", pasa: conIdVenta > 0,
  nota: "si es 0, 'ventas sin factura' no es alarma de negocio sino hueco del export",
});

// ─────────────────────────────────────────────────────────────────────────────
// FRENTE B · lo que va a reparar el otro agente (linea base para verificarlo)
// ─────────────────────────────────────────────────────────────────────────────
const clientes = await traerTodo("clientes", "id_cliente,nombre_cliente");
const idsReales = new Set(clientes.map((c) => c.id_cliente));
const semilla = ["CLI-004", "CLI-002"];
const fantasmas = semilla.filter((id) => !idsReales.has(id));
prueba({
  id: 10, frente: "B4 Seguimiento", nombre: "Ids de la semilla de demo que no existen",
  hoy: fantasmas.join(", ") || "ninguno", debe: "ninguno", pasa: fantasmas.length === 0,
  nota: `${clientes.length} clientes reales; la Bitacora imprime el id crudo como nombre`,
});

// Saturacion de los techos del score de prioritarios, sobre datos reales.
const TECHO_SALDO = 5000, TECHO_DIAS = 120;
const corte = new Date("2026-08-21");
const saldoPorCliente = new Map(), diasPorCliente = new Map();
for (const f of facturas) {
  const s = Number(f.saldo_pendiente_odoo || 0);
  if (s <= 0) continue;
  const idc = facturas.find((x) => x.id_factura === f.id_factura)?.id_cliente;
  void idc;
}
const facturasConCliente = await traerTodo("facturas", "id_cliente,fecha_vencimiento,saldo_pendiente_odoo", "&saldo_pendiente_odoo=gt.0");
for (const f of facturasConCliente) {
  const s = Number(f.saldo_pendiente_odoo);
  saldoPorCliente.set(f.id_cliente, (saldoPorCliente.get(f.id_cliente) || 0) + s);
  if (f.fecha_vencimiento) {
    const d = Math.floor((corte - new Date(f.fecha_vencimiento)) / 86400000);
    diasPorCliente.set(f.id_cliente, Math.max(diasPorCliente.get(f.id_cliente) || 0, Math.max(0, d)));
  }
}
const cuentas = [...saldoPorCliente.keys()];
const satSaldo = cuentas.filter((c) => saldoPorCliente.get(c) >= TECHO_SALDO).length;
const satDias = cuentas.filter((c) => (diasPorCliente.get(c) || 0) >= TECHO_DIAS).length;

prueba({
  id: 6, frente: "B2 Prioritarios", nombre: `Cuentas que saturan TECHO_SALDO (${TECHO_SALDO})`,
  hoy: `${satSaldo} de ${cuentas.length}`, debe: `menos del 5% (${Math.ceil(cuentas.length * 0.05)})`,
  pasa: satSaldo <= cuentas.length * 0.05,
  nota: "techo calibrado para el dataset ficticio EN DOLARES",
});
prueba({
  id: 7, frente: "B2 Prioritarios", nombre: `Cuentas que saturan TECHO_DIAS (${TECHO_DIAS})`,
  hoy: `${satDias} de ${cuentas.length}`, debe: `menos del 5% (${Math.ceil(cuentas.length * 0.05)})`,
  pasa: satDias <= cuentas.length * 0.05, nota: "",
});

// ─────────────────────────────────────────────────────────────────────────────
// FRENTE A · estabilidad del corte (la prueba que gobierna a todas)
// ─────────────────────────────────────────────────────────────────────────────
function ponderada(fecha) {
  const c = new Date(fecha);
  let num = 0, den = 0;
  for (const f of facturasConCliente) {
    if (!f.fecha_vencimiento) continue;
    const s = Number(f.saldo_pendiente_odoo);
    const d = Math.max(0, Math.floor((c - new Date(f.fecha_vencimiento)) / 86400000));
    num += s * d; den += s;
  }
  return den > 0 ? q2(num / den) : null;
}
const p20 = ponderada("2026-08-20"), p21 = ponderada("2026-08-21");
prueba({
  id: 1, frente: "A Corte", nombre: "Antiguedad ponderada estable sin datos nuevos",
  hoy: `corte 20/08 = ${p20} d · corte 21/08 = ${p21} d`, debe: "el mismo numero",
  pasa: p20 === p21,
  nota: "los datos estan congelados al 19/08; la cartera envejece sola porque store.tsx usa new Date()",
});

// ─────────────────────────────────────────────────────────────────────────────
// INFORME
// ─────────────────────────────────────────────────────────────────────────────
console.log("═".repeat(100));
console.log("LINEA BASE — " + new Date().toISOString().slice(0, 10) + " · antes de cualquier reparacion");
console.log("═".repeat(100));
let ok = 0;
for (const p of pruebas) {
  const marca = p.pasa ? "PASA  " : "FALLA ";
  if (p.pasa) ok++;
  console.log(`\n[${marca}] #${p.id} · ${p.frente} — ${p.nombre}`);
  console.log(`         hoy:  ${p.hoy}`);
  console.log(`         debe: ${p.debe}`);
  if (p.nota) console.log(`         nota: ${p.nota}`);
}
console.log("\n" + "═".repeat(100));
console.log(`RESULTADO: ${ok} pasan · ${pruebas.length - ok} fallan · de ${pruebas.length} pruebas corridas`);
console.log("═".repeat(100));

// Hasta 2026-08-24 este archivo imprimia "0 pasan · 15 fallan" y SALIA CON
// CODIGO 0. Encadenado con `&&` en package.json, eso significaba que quince
// comprobaciones en rojo se daban por buenas y no cortaban nada: fallaban en
// silencio. Un fallo que no se ve no es una prueba.
//
// El codigo de salida ahora refleja lo que el propio informe acaba de decir.
// Si esto pone el `npm test` en rojo, NO es una regresion: es la linea base
// que siempre estuvo rota, ahora audible.
if (ok < pruebas.length) {
  process.exitCode = 1;
}
