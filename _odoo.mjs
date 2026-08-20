import { chromium } from "playwright";

const b = await chromium.connectOverCDP("http://127.0.0.1:9444");
const ctx = b.contexts()[0];
const pages = ctx.pages();
const p = pages.find((x) => x.url().includes("3digitalgt-benserca")) || pages[0];
await p.bringToFront();
await p.waitForTimeout(400);

await p.goto("https://3digitalgt-benserca.odoo.com/web#cids=1&menu_id=191&action=203&model=account.payment&view_type=list", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);

const destino = process.argv[2];
const [descarga] = await Promise.all([
  p.waitForEvent("download", { timeout: 20000 }),
  p.locator(".fa-download, [title*='xport'], button:has(.fa-download)").first().click({ timeout: 8000, force: true }),
]);
await p.waitForTimeout(500);
await descarga.saveAs(destino);
console.log("archivo:", descarga.suggestedFilename());
console.log("guardado en:", destino);
await b.close();
