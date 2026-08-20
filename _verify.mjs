// Verifica una página del dashboard: status HTTP, errores de consola, conteo
// de .lienzo-referencia y .fichas-asomadas, y captura fullPage 1500x1050.
// Uso: node verify.mjs <ruta> <archivoSalida.png>
// Ej:  node verify.mjs /prioritarios despues-prioritarios.png

import { chromium } from "playwright";
import path from "node:path";

const ruta = process.argv[2];
const salida = process.argv[3];
const OUT_DIR = "C:\\Users\\juand\\AppData\\Local\\Temp\\claude\\C--Users-juand\\f8fe8781-28b7-4986-9aac-1f7bba873751\\scratchpad\\m6";
const BASE = "http://localhost:3111";

if (!ruta || !salida) {
  console.error("Uso: node verify.mjs <ruta> <archivoSalida.png>");
  process.exit(1);
}

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => {
  pageErrors.push(err.message);
});

let status = null;
try {
  const resp = await page.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 30000 });
  status = resp ? resp.status() : null;
} catch (e) {
  console.error("ERROR navegando:", e.message);
  await browser.close();
  process.exit(1);
}

// Esperar a que el skeleton de carga desaparezca y el contenido real aparezca.
await page.waitForTimeout(800);

const lienzos = await page.locator(".lienzo-referencia").count();
const fichas = await page.locator(".fichas-asomadas").count();

const outPath = path.join(OUT_DIR, salida);
await page.screenshot({ path: outPath, fullPage: true });

await browser.close();

console.log(JSON.stringify({
  ruta,
  status,
  lienzos,
  fichas,
  consoleErrors,
  pageErrors,
  screenshot: outPath,
}, null, 2));
