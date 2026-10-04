// ===== Read a simple .xlsx spreadsheet without any library =====
// An .xlsx file is a ZIP archive of XML files. This unpacks it with Node's built-in zlib and
// reads the first sheet into rows of text: [["cohort", "Track", …], ["2020-2022", "EEH", …], …].
// Enough for plain tables of text (no formulas, dates or merged cells needed).
// Used only by import scripts on your computer; the website never reads Excel files.

const fs = require("fs");
const zlib = require("zlib");

// All files inside the ZIP: { "xl/worksheets/sheet1.xml": Buffer, … }
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); // "end of central directory"
  if (end < 0) throw new Error("This is not a valid .xlsx file (no ZIP directory found).");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16); // where the list of files starts
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(at + 10); // 0 = stored, 8 = compressed
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const localHeader = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    const dataStart = localHeader + 30 + buffer.readUInt16LE(localHeader + 26) + buffer.readUInt16LE(localHeader + 28);
    const data = buffer.subarray(dataStart, dataStart + size);
    files[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

// XML text -> normal text ("&amp;" -> "&"). Excel's own "_x0002_" codes are kept as they are.
function decodeXml(text) {
  return text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

// The text of one cell or shared string: all <t> pieces joined (rich text has several)
function textOf(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
}

// "AB" -> 27 (column letters to a 0-based index)
function columnIndex(letters) {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

// Reads the first sheet: an array of rows, each an array of cell texts
function readXlsx(path) {
  const files = unzip(fs.readFileSync(path));
  const shared = files["xl/sharedStrings.xml"]
    ? [...files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const sheetName = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!sheetName) throw new Error("No worksheet found in the .xlsx file.");
  const sheet = files[sheetName].toString("utf8");
  const rows = [];
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, letters, attributes, inner = ""] = cell;
      const type = (attributes.match(/\bt="(\w+)"/) || [])[1];
      const value = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let text = "";
      if (type === "s") text = shared[Number(value)] ?? "";
      else if (type === "inlineStr") text = textOf(inner);
      else if (value !== undefined) text = decodeXml(value);
      cells[columnIndex(letters)] = text;
    }
    rows.push(Array.from(cells, (c) => c ?? ""));
  }
  return rows;
}

module.exports = { readXlsx };
