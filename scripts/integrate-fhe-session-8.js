// One-time repository integration for FHEM Session 8.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const bundleParts = fs.readdirSync(__dirname).filter((name) => /^fhe-session-8-bundle\.br\.part\d+$/.test(name)).sort();
if (!bundleParts.length) throw new Error('Session 8 bundle parts not found.');
const encoded = bundleParts.map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8')).join('');
const payload = JSON.parse(zlib.brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8'));

for (const [file, content] of Object.entries(payload.files || {})) {
  const destination = path.join(root, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
  console.log(`${file}: written from bundle`);
}
const TOPIC = 'fund-health-economics.moral-hazard';

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function updateJson(file, mutate) {
  const value = JSON.parse(read(file));
  mutate(value);
  write(file, JSON.stringify(value, null, 2) + '\n');
  console.log(`${file}: updated`);
}

function appendUnique(target, items) {
  const ids = new Set(target.map((item) => item.id));
  for (const item of items) {
    if (!ids.has(item.id)) {
      target.push(item);
      ids.add(item.id);
    }
  }
}

function updateText(file, transform) {
  const before = read(file);
  const after = transform(before);
  if (before === after) {
    console.log(`${file}: unchanged`);
    return;
  }
  write(file, after);
  console.log(`${file}: updated`);
}

updateJson('content/modules/fund-health-economics/topics.json', (topics) => {
  const topic = topics.find((item) => item.id === TOPIC);
  if (!topic) throw new Error('Session 8 topic placeholder not found.');
  topic.title = 'Session 8: Insurance III — Moral Hazard, Cost Sharing and Managed Care';
  topic.notes = 'notes/moral-hazard.md';
  topic.lecture = 'lectures/session-8.json';
});

updateJson('content/modules/fund-health-economics/learning-path.json', (learningPath) => {
  const session = learningPath.sessions.find((item) => item.number === 8);
  if (!session) throw new Error('Session 8 learning-path record not found.');
  Object.assign(session, {
    stage: 'providers-insurance',
    topic: TOPIC,
    title: 'Insurance III: Moral Hazard, Cost Sharing and Managed Care',
    shortTitle: 'Insurance III',
    summary: 'Ex-ante and ex-post moral hazard, coinsurance and deadweight loss, risk-spreading versus incentives, VBID, managed-care structures and empirical evidence.',
    keywords: [
      'moral hazard', 'ex ante', 'ex post', 'coinsurance', 'copayment', 'deductible',
      'deadweight loss', 'elasticity', 'VBID', 'managed care', 'HMO', 'PPO', 'POS',
      'utilisation review', 'gatekeeping'
    ],
    status: 'available'
  });
});

updateJson('content/modules/fund-health-economics/flashcards.json', (items) => {
  appendUnique(items, payload.flashcards);
});

updateJson('content/modules/fund-health-economics/questions.json', (items) => {
  appendUnique(items, payload.questions);
});

updateJson('content/modules/fund-health-economics/resources.json', (items) => {
  appendUnique(items, [payload.resource]);
});

updateJson('content/concepts.json', (items) => {
  const moralHazard = items.find((item) => item.id === 'concept.moral-hazard');
  if (moralHazard) {
    moralHazard.explanation = 'When insurance protection changes prevention, treatment choice or healthcare utilisation, increasing expected loss relative to behaviour under undistorted incentives.';
    moralHazard.topics = [...new Set([...(moralHazard.topics || []), TOPIC])];
    delete moralHazard.sample;
  }
  const costSharing = items.find((item) => item.id === 'concept.cost-sharing');
  if (costSharing) {
    costSharing.explanation = 'Rules that make patients or providers bear part of the cost or responsibility for care, including coinsurance, copayments, deductibles, quantity limits and provider-side controls.';
    costSharing.topics = [...new Set([...(costSharing.topics || []), TOPIC])];
    delete costSharing.sample;
  }
  appendUnique(items, payload.concepts);
});

updateText('notes-data.js', (text) => {
  const activities = [
    'mh-expected-loss',
    'mh-coinsurance-dwl',
    'mh-elasticity',
    'mh-control-mix',
    'mh-plan-compare',
  ];
  const match = text.match(/const LECTURE_ACTIVITIES = \[([^\]]*)\];/);
  if (!match) throw new Error('LECTURE_ACTIVITIES list not found.');
  const existing = new Set([...match[1].matchAll(/\"([^\"]+)\"/g)].map((item) => item[1]));
  const missing = activities.filter((activity) => !existing.has(activity));
  if (!missing.length) return text;
  const addition = missing.map((activity) => `\"${activity}\"`).join(',');
  return text.replace(/const LECTURE_ACTIVITIES = \[([^\]]*)\];/, `const LECTURE_ACTIVITIES = [$1,${addition}];`);
});

updateText('lecture.html', (text) => {
  if (!text.includes('fhe-session-8.css')) {
    text = text.replace(
      /(<link rel="stylesheet" href="study-practice\.css[^>]*>)/,
      `$1\n    <link rel="stylesheet" href="fhe-session-8.css">`,
    );
  }
  if (!text.includes('fhe-session-8.js')) {
    text = text.replace(
      /(<script defer src="lecture-activities\.js[^>]*><\/script>)/,
      `$1\n    <script defer src="fhe-session-8.js"></script>`,
    );
  }
  return text;
});

updateText('fhem-exam.html', (text) => {
  if (!text.includes('fhe-session-8-exam.js')) {
    text = text.replace(
      /(<script defer src="fhem-exam-style-bank\.js[^>]*><\/script>)/,
      `$1\n  <script defer src="fhe-session-8-exam.js"></script>`,
    );
  }
  return text;
});

updateText('sw.js', (text) => {
  const marker = '"fhe-session-7-advanced.css", "fhe-session-7-advanced.js",';
  const replacement = `${marker}\n  "fhe-session-8.css", "fhe-session-8.js", "fhe-session-8-exam.js",`;
  if (!text.includes('"fhe-session-8.css"')) {
    if (!text.includes(marker)) throw new Error('Service-worker Session 7 marker not found.');
    text = text.replace(marker, replacement);
  }
  return text;
});

updateJson('package.json', (pkg) => {
  pkg.scripts['test:fhe-session-8'] = 'node scripts/check-content.js && node tests/fhe-session-8/data.test.js && node tests/fhe-session-8/browser.test.js .';
});

updateText('tests/fhem-exam-style/data.test.js', (text) => {
  if (!text.includes("fhe-session-8-exam.js")) {
    text = text.replace(
      "vm.runInNewContext(source, context, { filename: 'fhem-exam-style-bank.js' });",
      "vm.runInNewContext(source, context, { filename: 'fhem-exam-style-bank.js' });\nconst session8 = fs.readFileSync(path.join(root, 'fhe-session-8-exam.js'), 'utf8');\nvm.runInNewContext(session8, context, { filename: 'fhe-session-8-exam.js' });",
    );
  }
  text = text.replace('assert.equal(bank.mcqs.length, 24);', 'assert.equal(bank.mcqs.length, 30);');
  text = text.replace('assert.equal(bank.binaries.length, 12);', 'assert.equal(bank.binaries.length, 15);');
  text = text.replace('assert.equal(bank.opens.length, 8);', 'assert.equal(bank.opens.length, 10);');
  text = text.replace(
    "console.log('PASS: 24 MCQs, 12 binary traps, 8 open cases, two fixed 6+2+1 mocks and 60-point rubrics validate.');",
    "console.log('PASS: 30 MCQs, 15 binary traps, 10 open cases, two fixed 6+2+1 mocks and 60-point rubrics validate.');",
  );
  return text;
});

console.log('FHEM Session 8 integration complete.');
