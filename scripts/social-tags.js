// ===== Social preview tags =====
// Adds Open Graph and Twitter tags to every page, so a shared link shows a card
// (title, short description and img/social-preview.png) in WhatsApp, LinkedIn, Facebook, X ...
// Run:   node scripts/social-tags.js
// Run it again after adding a page, changing a title/description, or moving to a new domain
// (the address is "siteUrl" in content/settings.json). The block between the two
// "Social preview" comments is rewritten each time; nothing else in the page changes.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_NAME = "EU-HEM Student Hub";
const IMAGE = { file: "img/social-preview.png", width: 1200, height: 630,
  alt: "EU-HEM Student Hub: less searching, more learning, living and connecting." };
const START = "<!-- Social preview (scripts/social-tags.js) -->";
const END = "<!-- /Social preview -->";

const settings = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "settings.json"), "utf8"));
const siteUrl = settings.siteUrl.replace(/\/?$/, "/"); // always ends with "/"

// Text taken from the HTML is already escaped (&amp;); only quotes need care inside attributes
const attr = (text) => text.replace(/&(?![a-z]+;|#\d+;)/g, "&amp;").replace(/"/g, "&quot;").trim();

function socialBlock(file, html, indent) {
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/) || [])[1];
  if (!title || !description) throw new Error(`${file}: needs a <title> and a meta description`);
  const url = file === "index.html" ? siteUrl : siteUrl + file;
  const tags = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:url", url],
    ["property", "og:image", siteUrl + IMAGE.file],
    ["property", "og:image:width", String(IMAGE.width)],
    ["property", "og:image:height", String(IMAGE.height)],
    ["property", "og:image:alt", IMAGE.alt],
    ["name", "twitter:card", "summary_large_image"],
  ];
  return [START, ...tags.map(([kind, key, value]) => `<meta ${kind}="${key}" content="${attr(value)}">`), END]
    .map((line) => indent + line).join("\n");
}

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
for (const file of pages) {
  const full = path.join(ROOT, file);
  const original = fs.readFileSync(full, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let html = original.replace(/\r\n/g, "\n");
  // Remove an earlier block, then add the new one after the meta description
  html = html.replace(new RegExp(`\\n[ \\t]*${START.replace(/[()./]/g, "\\$&")}[\\s\\S]*?${END.replace(/[/]/g, "\\/")}`), "");
  // The whole description tag, even when it is spread over several lines (lecture.html)
  const descLine = html.match(/\n([ \t]*)<meta\s+name="description"[^>]*>/);
  if (!descLine) throw new Error(`${file}: no meta description`);
  html = html.replace(descLine[0], `${descLine[0]}\n${socialBlock(file, html, descLine[1])}`);
  html = html.replace(/\n/g, eol);
  if (html !== original) fs.writeFileSync(full, html);
}
console.log(`✔ Social preview tags on ${pages.length} pages (${siteUrl})`);
