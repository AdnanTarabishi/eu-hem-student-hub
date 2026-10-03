// ===== Local preview server =====
// Shows the website on your own computer, exactly as GitHub Pages would.
// Run:   node scripts/preview.js
// Open:  http://localhost:8000
// Stop:  press Ctrl+C in the terminal
//
// Why not just double-click index.html? Pages opened as files can't load the
// data files (JSON, Markdown, CSV) - browsers block that for safety.

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  let filePath = path.normalize(path.join(ROOT, urlPath));
  // Never serve files outside the project folder
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");

  fs.readFile(filePath, (problem, content) => {
    if (problem) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Not found");
    }
    response.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store", // always show your latest changes
    });
    response.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Preview running at http://localhost:${PORT}`);
  console.log(`Notes & Resources: http://localhost:${PORT}/notes.html`);
  console.log("Press Ctrl+C to stop.");
});
