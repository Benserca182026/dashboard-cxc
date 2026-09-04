#!/usr/bin/env node
// VERIFICACIÓN DE SOLO LECTURA contra Odoo en vivo (no contra Supabase) de la
// tarjeta "Dependencia de clientes · Top 5 de Todo el período" que se ve en
// /ventas. Se conecta por CDP a la ventana ya autenticada que abre
// `node _odoo.mjs abrir` (puerto 9333) y usa ÚNICAMENTE search_read/read_group
// contra /web/dataset/call_kw — igual que _odoo.mjs, mismo método, misma
// lista blanca. No escribe nada, en ningún momento.
//
// Uso: node scripts/verificar-dependencia-odoo.mjs

import { chromium } from "playwright";

const HOST = "https://3digitalgt-benserca.odoo.com";
const PUERTO = 9333;

// Los 5 clientes tal como los tiene Supabase (de dato.clientes en
// lib/agentes-ventas-b18.ts), y lo que muestra hoy el dashboard para
// "Todo el período" (corte 2026-08-19).
const CLIENTES_DASHBOARD = [
  { nombre: "WALMART", monto: 2613933.77, pct: 13.55 },
  { nombre: "NOVEX", monto: 943218.60, pct: 4.89 },
  { nombre: "MOTOS Y AUTOS  SOCIEDAD ANONIMA - MOAUTO", monto: 773962.20, pct: 4.01 },
  { nombre: "ENMOTO (ERIC ACU)", monto: 662878.13, pct: 3.44 },
  { nombre: "ZORROS REVOLUTION BIKER- BODEGA CENTRAL-OFICINAS", monto: 646400.54, pct: 3.35 },
];
const FACTURACION_DASHBOARD = 19292422.91;
const CLIENTES_TOTALES_DASHBOARD = 363;
const DESDE = "2022-08-08";
const HASTA = "2026-08-19";

function fmt(n) {
  return `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  let navegador;
  try {
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO}`);
  } catch (e) {
    console.error(`No hay navegador escuchando en el puerto ${PUERTO}. Corré primero: node _odoo.mjs abrir`);
    process.exit(1);
  }
  const ctx = navegador.contexts()[0];
  if (!ctx) { console.error("El navegador no tiene ningún contexto abierto."); process.exit(1); }

  let page = ctx.pages().find((p) => p.url().includes("3digitalgt-benserca"));
  if (!page) {
    page = await ctx.newPage();
    await page.goto(`${HOST}/web`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  }

  const autenticado = await page.evaluate(
    () => typeof window.odoo !== "undefined" && !!document.querySelector(".o_web_client, .o_action_manager")
  );
  if (!autenticado) {
    console.error("La página de Odoo no está autenticada todavía. Iniciá sesión a mano en esa ventana y volvé a correr esto.");
    process.exit(1);
  }
  console.log("✓ Sesión de Odoo autenticada. Consultando (solo lectura)...\n");

  const resultado = await page.evaluate(
    async ({ desde, hasta }) => {
      const csrf = window.odoo && window.odoo.csrf_token ? window.odoo.csrf_token : null;
      const METODOS_PERMITIDOS = new Set(["search_read", "search_count", "read", "read_group", "fields_get"]);
      const llamar = async (modelo, metodo, args, kwargs) => {
        if (!METODOS_PERMITIDOS.has(metodo)) throw new Error(`metodo no permitido: ${metodo}`);
        const resp = await fetch("/web/dataset/call_kw", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
          body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { model: modelo, method: metodo, args, kwargs } }),
        });
        const j = await resp.json();
        if (j.error) throw new Error(JSON.stringify(j.error));
        return j.result;
      };

      const dominioBase = [
        ["state", "=", "sale"],
        ["date_order", ">=", desde],
        ["date_order", "<=", hasta + " 23:59:59"],
      ];

      // 1 · Total y cantidad de clientes distintos, agrupado por partner_id.
      const grupos = await llamar("sale.order", "read_group", [dominioBase, ["amount_total:sum"], ["partner_id"]], { limit: 0 });

      // 2 · Moneda: cuántos pedidos del rango NO son GTQ (para declarar el mismo aviso que ya tiene el dashboard).
      const noGtq = await llamar(
        "sale.order",
        "search_read",
        [[...dominioBase, ["currency_id.name", "!=", "GTQ"]], ["name", "amount_total", "currency_id", "date_order"]],
        { limit: 50 }
      );

      return { grupos, noGtq };
    },
    { desde: DESDE, hasta: HASTA }
  );

  const { grupos, noGtq } = resultado;
  const totalOdoo = grupos.reduce((s, g) => s + (g.amount_total || 0), 0);
  const clientesOdoo = grupos.length;

  console.log("=".repeat(78));
  console.log(`ODOO EN VIVO · sale.order, estado='sale', ${DESDE} → ${HASTA}`);
  console.log("=".repeat(78));
  console.log(`Facturación total (todas las monedas, sin filtrar): ${fmt(totalOdoo)}`);
  console.log(`Clientes distintos (partner_id): ${clientesOdoo}`);
  console.log(`Pedidos en otra moneda que no es GTQ: ${noGtq.length}`);
  for (const o of noGtq) console.log(`  - ${o.name} · ${fmt(o.amount_total)} · ${o.currency_id?.[1] ?? o.currency_id} · ${o.date_order}`);
  console.log("");

  console.log("=".repeat(78));
  console.log("COMPARACIÓN CONTRA EL DASHBOARD (corte declarado 2026-08-19)");
  console.log("=".repeat(78));
  console.log(`Facturación total — dashboard: ${fmt(FACTURACION_DASHBOARD)} · Odoo: ${fmt(totalOdoo)} · diferencia: ${fmt(totalOdoo - FACTURACION_DASHBOARD)}`);
  console.log(`Clientes totales — dashboard: ${CLIENTES_TOTALES_DASHBOARD} · Odoo (por partner_id): ${clientesOdoo} · diferencia: ${clientesOdoo - CLIENTES_TOTALES_DASHBOARD}`);
  console.log("");

  console.log("=".repeat(78));
  console.log("LOS 5 CLIENTES DEL TOP 5 (búsqueda por nombre en Odoo, no por ID)");
  console.log("=".repeat(78));
  for (const c of CLIENTES_DASHBOARD) {
    const candidatos = grupos
      .filter((g) => g.partner_id && String(g.partner_id[1] || "").toUpperCase().includes(c.nombre.slice(0, 6).toUpperCase()))
      .map((g) => ({ nombre: g.partner_id[1], monto: g.amount_total }));
    console.log(`\n[Dashboard] ${c.nombre}: ${fmt(c.monto)} (${c.pct}%)`);
    if (candidatos.length === 0) {
      console.log("  [Odoo] SIN COINCIDENCIA por nombre parecido — revisar a mano.");
    } else {
      for (const cand of candidatos) {
        const dif = cand.monto - c.monto;
        console.log(`  [Odoo] ${cand.nombre}: ${fmt(cand.monto)} · diferencia: ${fmt(dif)} ${Math.abs(dif) < 1 ? "✓ COINCIDE" : "⚠ NO COINCIDE"}`);
      }
    }
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
