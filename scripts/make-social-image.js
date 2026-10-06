// ===== Social preview image =====
// Renders scripts/social/template.html to img/social-preview.png (1200 x 630 px),
// the picture WhatsApp, LinkedIn, Facebook etc. show when a link to the site is shared.
// Run:   node scripts/make-social-image.js
// Uses Playwright and Chrome, which the tests already use. Only needed when the card changes.

const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = path.join(__dirname, "social", "template.html");
const OUTPUT = path.join(ROOT, "img", "social-preview.png");

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(TEMPLATE).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUTPUT, type: "png" });
  await browser.close();
  console.log(`✔ Saved ${path.relative(ROOT, OUTPUT)}`);
})();
