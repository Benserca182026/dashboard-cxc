const { chromium } = require("playwright");

const puerto = process.argv[2] || "3100";
const sufijo = process.argv[3] || "despues";
const outDir = "../evidencias-auditoria-visual-worklio";

(async () => {
  const browser = await chromium.launch();

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(`http://localhost:${puerto}/aging`, { waitUntil: "networkidle" });
  await desktop.screenshot({
    path: `${outDir}/aging-${sufijo}-desktop.png`,
    fullPage: true,
  });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`http://localhost:${puerto}/aging`, { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: `${outDir}/aging-${sufijo}-movil.png`,
    fullPage: true,
  });
  await mobile.close();

  await browser.close();
  console.log("done:", sufijo);
})();
