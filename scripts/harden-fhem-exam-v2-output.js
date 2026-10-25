const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'fhem-exam-v2.js');
let text = fs.readFileSync(file, 'utf8');

const clampLine = '  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));\n';
const escapeLine = `  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({\n    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",\n  })[character]);\n`;
if (!text.includes('const escapeHtml =')) {
  if (!text.includes(clampLine)) throw new Error('escapeHtml insertion anchor not found');
  text = text.replace(clampLine, clampLine + escapeLine);
}

const oldOpen = '${(active.answers?.[question.id] || "No answer written.").replace(/\\n/g, "<br>")}';
const newOpen = '${escapeHtml(active.answers?.[question.id] || "No answer written.").replace(/\\n/g, "<br>")}';
const oldNormal = '${(state.active.answers?.[question.id] || "No answer written.").replace(/\\n/g, "<br>")}';
const newNormal = '${escapeHtml(state.active.answers?.[question.id] || "No answer written.").replace(/\\n/g, "<br>")}';
if (!text.includes(oldOpen) && !text.includes(newOpen)) throw new Error('exam-open response anchor not found');
if (!text.includes(oldNormal) && !text.includes(newNormal)) throw new Error('normal-open response anchor not found');
text = text.replace(oldOpen, newOpen).replace(oldNormal, newNormal);
fs.writeFileSync(file, text);
console.log('Hardened FHEM Exam Centre written-response rendering.');
