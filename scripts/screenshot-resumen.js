const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await desktop.screenshot({
    path: "../evidencias-auditoria-visual-worklio/resumen-cartera-despues-desktop.png",
    fullPage: true,
  });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: "../evidencias-auditoria-visual-worklio/resumen-cartera-despues-mobile.png",
    fullPage: true,
  });
  await mobile.close();

  await browser.close();
  console.log("done");
})();
