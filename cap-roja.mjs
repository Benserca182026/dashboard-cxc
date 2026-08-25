import { chromium } from "playwright";
const DIR = "C:/Users/juand/SAAAS-Marketing/proyectos/dashboard-cxc/evidencias-paso-11";
const nav = await chromium.launch();
const p = await (await nav.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await p.goto("http://localhost:3005/ventas", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const franja = p.locator("text=DESCUADRE").locator("xpath=ancestor::div[1]");
const n = await franja.count();
if (!n) { console.log("LA ALARMA NO SONO — revisar"); process.exit(1); }
await franja.screenshot({ path: `${DIR}/11d-1-alarma-roja.png` });
console.log("📸 11d-1 ALARMA ROJA:", (await franja.innerText()).slice(0, 130));
await nav.close();
