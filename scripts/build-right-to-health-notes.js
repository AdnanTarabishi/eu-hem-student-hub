// Keep the native searchable Markdown notes in sync with the course reader.
// Source: workspace.json. Run after editing guides; no network or student data.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'content/modules/right-to-health');
function renderNote(unit, workspace) {
  const refs = new Map(workspace.sources.map(s => [s.id, s]));
  function citation(id) {
    const s = refs.get(id);
    if (!s) throw new Error('Unknown Right to Health source: ' + id);
    return `[${s.title}](${s.url}) — ${s.locator}`;
  }
  const lines = [
    '---', 'topic: ' + unit.id, 'author: EU-HEM Student Hub (AI-assisted)',
    'updated: ' + workspace.updated, '---', '',
    '## 5-minute review', '', ...unit.review.map(t => '- ' + t), '',
    '## Study edition', '',
    'Student-made, AI-assisted; not lecturer-reviewed. Based on the supplied readings, with source dates preserved. Not legal or medical advice.', '', unit.intro, ''
  ];
  for (const s of unit.sections) {
    lines.push('## ' + s.title, '');
    if (s.edition) lines.push('*' + s.edition + '*', '');
    for (const paragraph of s.paragraphs) lines.push(paragraph, '');
    if (s.locator) lines.push('Reading location: ' + s.locator, '');
    lines.push('Sources: ' + s.sources.map(citation).join(' · '), '');
  }
  lines.push('## Reading and source notes', '');
  for (const id of unit.sources) lines.push(citation(id) + '. ' + refs.get(id).note, '');
  return lines.join('\n').trimEnd() + '\n';
}
if (require.main === module) {
  const workspace = JSON.parse(fs.readFileSync(path.join(folder, 'workspace.json'), 'utf8'));
  const topics = JSON.parse(fs.readFileSync(path.join(folder, 'topics.json'), 'utf8'));
  for (const unit of workspace.units) {
    const topic = topics.find(t => t.id === unit.id);
    if (!topic || !/^notes\/[a-z-]+\.md$/.test(topic.notes)) throw new Error('Invalid notes path for ' + unit.id);
    fs.writeFileSync(path.join(folder, topic.notes), renderNote(unit, workspace));
  }
  console.log(`Generated ${workspace.units.length} Right to Health notes from workspace.json.`);
}
module.exports = { renderNote };
