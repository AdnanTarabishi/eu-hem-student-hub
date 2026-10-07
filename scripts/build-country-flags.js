// Build the local flag atlas from flag-icons 7.5.0 (MIT). No runtime CDN or emoji fonts.
// Download/extract that npm package outside the repository, then run:
// node scripts/build-country-flags.js /absolute/path/to/flag-icons/package
// Requires the existing Playwright development dependency and Chromium.
const fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const { EUHEM_COUNTRIES } = require("../countries.js");
const source = path.resolve(process.argv[2] || "");
const metadata = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
if (metadata.name !== "flag-icons" || metadata.version !== "7.5.0") throw new Error("Use flag-icons 7.5.0");
const destination = path.join(__dirname, "../assets/flags");
const codes = EUHEM_COUNTRIES.map(country => country.code);
const columns = 14, rows = Math.ceil(codes.length / columns), width = 24, height = 18;
for (const code of codes) if (!fs.existsSync(path.join(source, "flags/4x3", code.toLowerCase() + ".svg"))) throw new Error("Flag missing: " + code);

(async () => {
  fs.mkdirSync(destination, { recursive: true });
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: columns * width, height: rows * height }, deviceScaleFactor: 3 });
    // SVG data URLs let Chromium render all source paths/gradients without fetching a CDN.
    const tiles = codes.map(code => {
      const svg = fs.readFileSync(path.join(source, "flags/4x3", code.toLowerCase() + ".svg"));
      return `<img src="data:image/svg+xml;base64,${svg.toString("base64")}" width="${width}" height="${height}">`;
    });
    await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}body{display:grid;grid-template-columns:repeat(${columns},${width}px)}img{display:block}</style>${tiles.join("")}`);
    await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
    await page.screenshot({ path: path.join(destination, "countries.png"), omitBackground: true });
    const css = [
      "/* Generated from flag-icons 7.5.0 (MIT); see LICENSE.txt and README.md. */",
      `.country-flag { display: inline-block; width: ${width}px; height: ${height}px; flex: 0 0 ${width}px; vertical-align: middle; border-radius: 2px; box-shadow: 0 0 0 1px rgba(80, 100, 120, .2); background-image: url(\"countries.png\"); background-repeat: no-repeat; background-size: ${columns * width}px ${rows * height}px; pointer-events: none; }`,
      ".country-label { display: inline-flex; align-items: center; gap: .45em; vertical-align: middle; max-width: 100%; }",
      ".country-label > span:last-child { min-width: 0; overflow-wrap: anywhere; }",
      ...codes.map((code, index) => `.country-flag[data-country-flag="${code}"] { background-position: -${index % columns * width}px -${Math.floor(index / columns) * height}px; }`),
      "",
    ];
    fs.writeFileSync(path.join(destination, "country-flags.css"), css.join("\n"));
    fs.copyFileSync(path.join(source, "LICENSE"), path.join(destination, "LICENSE.txt"));
    console.log(`Built ${codes.length} local flags: ${columns * width * 3} × ${rows * height * 3}px, ${fs.statSync(path.join(destination, "countries.png")).size} bytes.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
