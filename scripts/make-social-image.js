// ===== Social preview image =====
// Renders scripts/social/template.html to img/social-preview.png (1200 x 630 px),
// the picture WhatsApp, LinkedIn, Facebook etc. show when a link to the site is shared.
// Run:   node scripts/make-social-image.js
// Uses Playwright and Chrome, which the tests already use. Only needed when the card changes.

const path = require("path");
const fs = require("fs");
const http = require("http");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "img", "social-preview.png");

(async () => {
  // Serve local assets so fonts work in browsers that restrict file:// pages.
  const mime = { ".html": "text/html", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    const file = path.resolve(ROOT, "." + new URL(req.url, "http://localhost").pathname);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  let browser;
  try {
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/scripts/social/template.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: OUTPUT, type: "png" });
    console.log(`✔ Saved ${path.relative(ROOT, OUTPUT)}`);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
