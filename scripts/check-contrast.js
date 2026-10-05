// ===== Colour contrast check =====
// Reads the colour variables from style.css (light and dark mode) and checks that every
// text colour is readable on the backgrounds it is used on.
// The rule is WCAG AA, the usual accessibility standard: a contrast ratio of at least
// 4.5 : 1 for normal text (3 : 1 for large text and icons).
//
// Run:  node scripts/check-contrast.js
// Exit code 1 when a pair fails, so it can also run automatically.

const fs = require("fs");
const path = require("path");

// [text colour, background colour, minimum ratio]
const PAIRS = [
  ["--color-text", "--color-background", 4.5],
  ["--color-text", "--color-card", 4.5],
  ["--color-text", "--color-surface-alt", 4.5],
  ["--color-muted", "--color-card", 4.5],
  ["--color-muted", "--color-background", 4.5],
  ["--color-muted", "--color-surface-alt", 4.5],
  ["--color-muted", "--color-surface-muted", 4.5],
  ["--color-primary", "--color-surface-alt", 4.5],
  ["--color-primary", "--color-card", 4.5],
  ["--color-primary", "--color-background", 4.5],
  ["--color-primary", "--color-primary-light", 4.5],
  ["--color-on-primary", "--color-primary", 4.5],
  ["--color-header-text", "--color-header-bg", 4.5],
  ["--color-success-text", "--color-success-bg", 4.5],
  // City guide: the "Your next city" box and the sticky Contents menu
  ["--color-text", "--color-success-bg", 4.5],
  ["--color-primary", "--color-success-bg", 4.5],
  ["--color-text", "--color-primary-light", 4.5],
  ["--color-danger-text", "--color-danger-bg", 4.5],
  ["--color-text", "--color-warning-bg", 4.5],
  ["--pill-blue-text", "--pill-blue-bg", 4.5],
  ["--pill-purple-text", "--pill-purple-bg", 4.5],
  ["--pill-amber-text", "--pill-amber-bg", 4.5],
  ["--pill-orange-text", "--pill-orange-bg", 4.5],
  ["--pill-pink-text", "--pill-pink-bg", 4.5],
];

// The colour variables inside every block that starts with `selector {`
function readBlock(css, selector) {
  const vars = {};
  let start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`Not found in style.css: ${selector}`);
  while (start !== -1) {
    const body = css.slice(start, css.indexOf("}", start));
    for (const match of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,6}|var\(--[\w-]+\))\s*;/g)) vars[match[1]] = match[2];
    start = css.indexOf(selector + " {", start + 1);
  }
  return vars;
}

// "var(--brand-ink)" -> that variable's colour (the brand palette is referenced by name)
function resolve(vars) {
  const out = {};
  for (const [name, value] of Object.entries(vars)) {
    let v = value;
    for (let i = 0; i < 5 && v.startsWith("var("); i++) v = vars[v.slice(4, -1)] || v;
    out[name] = v;
  }
  return out;
}

// "#1f4e79" -> relative luminance (how bright the colour looks), as defined by WCAG
function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function checkTheme(name, vars) {
  const failures = [];
  for (const [text, background, minimum] of PAIRS) {
    if (!vars[text] || !vars[background]) continue; // not defined in this theme
    const ratio = contrast(vars[text], vars[background]);
    const ok = ratio >= minimum;
    console.log(`  ${ok ? "✔" : "✖"} ${ratio.toFixed(2).padStart(5)} : 1  ${text} on ${background}`);
    if (!ok) failures.push(`${name}: ${text} on ${background} is ${ratio.toFixed(2)} (needs ${minimum})`);
  }
  return failures;
}

function main() {
  const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");
  const light = resolve(readBlock(css, ":root"));
  const dark = resolve({ ...readBlock(css, ":root"), ...readBlock(css, ':root:not([data-theme="light"])') });
  console.log("Light mode");
  const failures = checkTheme("light", light);
  console.log("Dark mode");
  failures.push(...checkTheme("dark", dark));
  if (failures.length) {
    console.log(`\n✖ ${failures.length} colour pair(s) are hard to read:\n  ` + failures.join("\n  "));
    process.exitCode = 1;
  } else {
    console.log("\n✔ All colour pairs pass WCAG AA.");
  }
}

if (require.main === module) main();
module.exports = { contrast, luminance };
