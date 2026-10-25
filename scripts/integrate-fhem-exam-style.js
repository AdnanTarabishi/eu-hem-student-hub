// One-time integration for the advanced FHEM exam-style system.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function update(file, transform) {
  const before = read(file);
  const after = transform(before);
  if (before === after) {
    console.log(`${file}: unchanged`);
    return;
  }
  write(file, after);
  console.log(`${file}: updated`);
}

update('fhem-exam-v2.js', (text) => {
  const target = `    writeState(state);\n    render();\n  }\n\n  function persistAnswer`;
  const replacement = `    writeState(state);\n    renderActive(state.active);\n  }\n\n  function persistAnswer`;
  if (!text.includes(target)) throw new Error('startExam integration anchor not found');
  return text.replace(target, replacement);
});

update('fhem-exam.html', (text) => {
  if (!text.includes('fhem-exam-v2.css')) {
    text = text.replace(
      /(\s*<link rel="stylesheet" href="fhem-exam\.css[^>]*>)/,
      `$1\n  <link rel="stylesheet" href="fhem-exam-v2.css">`,
    );
  }
  text = text.replace(
    /\s*<script defer src="fhem-exam\.js[^>]*><\/script>/,
    `\n  <script defer src="fhem-exam-style-bank.js"></script>\n  <script defer src="fhem-exam-v2.js"></script>`,
  );
  text = text.replace(
    'Student-made exam practice for Fundamentals in Health Economics, including a 90-minute mixed mock exam.',
    'Advanced exam preparation for Fundamentals in Health Economics: two fixed original mocks, random official-format simulations, partial credit, negative marking and open-question rubrics.',
  );
  return text;
});

update('health-econ-management.js', (text) => {
  text = text.replace(
    /Run a 90-minute mixed mock or a 20-minute objective drill using the current Sessions 1–7 question bank\./,
    'Use two fixed original mocks, a random 6+2+1 simulation, partial-credit practice and a separate comprehensive drill.',
  );
  text = text.replace(
    /Sessions 1–7 mock ready →/,
    'Exam-style mocks and rubrics →',
  );
  return text;
});

update('sw.js', (text) => {
  text = text.replace(/const VERSION = "[^"]*";/, 'const VERSION = "fhem-exam-style-20261025";');
  if (!text.includes('"fhem-exam-style-bank.js"')) {
    const anchor = '"fhem-exam.css", "fhem-exam.js"';
    const replacement = '"fhem-exam.css", "fhem-exam.js", "fhem-exam-v2.css", "fhem-exam-style-bank.js", "fhem-exam-v2.js"';
    if (!text.includes(anchor)) throw new Error('service-worker FHEM exam asset anchor not found');
    text = text.replace(anchor, replacement);
  }
  return text;
});

update('package.json', (text) => {
  const pkg = JSON.parse(text);
  pkg.scripts['test:fhem-exam-style'] = 'node scripts/check-content.js && node tests/fhem-exam-style/data.test.js && node tests/fhem-exam-style/browser.test.js .';
  return JSON.stringify(pkg, null, 2) + '\n';
});

console.log('FHEM exam-style integration complete.');
