// ===== Updates helper: add a draft, then publish it after a successful deployment =====
// Full workflow: docs/roadmap.md → "Publishing an update".
//
//   node scripts/updates.js new <id> --title "..." --summary "..." --type new|improved --category <id>
//        [--highlight "..."]... [--link "Label|page.html"]...
//     Adds a hidden draft (date: null, evidence: null) to content/updates.json.
//
//   node scripts/updates.js publish <id> --run <GitHub Actions run id or URL> --commit <sha> [--commit <sha>]...
//     Looks the run up on GitHub (public, no token needed), and only if it is a successful "pages build and
//     deployment" from main, and every commit is part of the deployed version (checked with git), fills in
//     the date (Rome time) and the evidence, and marks the update "published".
//
// It only edits content/updates.json. It never commits, pushes or deploys: review the change, run
// `node scripts/check-content.js`, then commit and merge as usual.
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");
const R = require("../roadmap-data.js");

const ROOT = path.join(__dirname, "..");
// UPDATES_FILE lets the tests use a copy
const FILE = process.env.UPDATES_FILE || path.join(ROOT, "content", "updates.json");

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function options(args) {
  const result = { highlight: [], link: [], commit: [] };
  for (let i = 0; i < args.length; i += 2) {
    const key = (args[i] || "").replace(/^--/, "");
    const value = args[i + 1];
    if (!args[i].startsWith("--") || value === undefined) fail(`Expected --option value pairs, got "${args[i]}"`);
    if (Array.isArray(result[key])) result[key].push(value);
    else result[key] = value;
  }
  return result;
}

const readUpdates = () => JSON.parse(fs.readFileSync(FILE, "utf8"));

function writeUpdates(data) {
  const roadmap = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "roadmap.json"), "utf8"));
  const problems = R.validate(roadmap, data, { pageExists: (file) => fs.existsSync(path.join(ROOT, file)) });
  if (problems.length) fail(`Not saved, the result would be invalid:\n  ${problems.join("\n  ")}`);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
}

function addDraft(id, o) {
  const data = readUpdates();
  if (!R.ID_PATTERN.test(id || "")) fail("The id must be lowercase words joined by hyphens, e.g. student-experiences");
  if (data.items.some((item) => item.id === id)) fail(`"${id}" already exists in content/updates.json`);
  for (const key of ["title", "summary", "type", "category"]) if (!o[key]) fail(`--${key} is required`);
  const links = o.link.map((text) => {
    const [label, url] = text.split("|");
    return { label: (label || "").trim(), url: (url || "").trim() };
  });
  data.items.unshift({
    id, date: null, title: o.title, summary: o.summary, category: o.category, type: o.type, status: "draft",
    highlights: o.highlight, links, evidence: null,
  });
  writeUpdates(data);
  console.log(`✔ Draft "${id}" added to content/updates.json. It stays hidden until you publish it.`);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "eu-hem-student-hub-updates", Accept: "application/vnd.github+json" } }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`GitHub answered ${res.statusCode}`))));
    }).on("error", reject);
  });
}

function fullSha(sha) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", `${sha}^{commit}`], { cwd: ROOT }).toString().trim();
  } catch {
    return fail(`Commit ${sha} is not in your local copy. Run "git fetch" first.`);
  }
}

// "2026-10-06T04:30:06Z" -> "2026-10-06T06:30:06+02:00"
function romeTimestamp(utc) {
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", timeZoneName: "longOffset" })
    .formatToParts(new Date(utc)).find((p) => p.type === "timeZoneName").value.replace("GMT", "") || "+00:00";
  const [, sign, hours, minutes] = offset.match(/([+-])(\d\d):(\d\d)/);
  const shift = (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes)) * 60000;
  return new Date(Date.parse(utc) + shift).toISOString().slice(0, 19) + offset;
}

function isIncluded(sha, deployed) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, deployed], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

async function publish(id, o) {
  const data = readUpdates();
  const item = data.items.find((entry) => entry.id === id);
  if (!item) fail(`No update "${id}" in content/updates.json`);
  if (item.status !== "draft") fail(`"${id}" is already published`);
  const runId = String(o.run || "").match(/(\d+)\/?$/);
  if (!runId) fail("--run needs the GitHub Actions run id or its URL (Actions tab → pages build and deployment → the run)");
  if (!o.commit.length) fail("--commit is required (the commit(s) that contain this feature)");

  const run = await getJson(`https://api.github.com/repos/${R.REPOSITORY}/actions/runs/${runId[1]}`);
  if (run.name !== "pages build and deployment") fail(`Run ${runId[1]} is "${run.name}", not the GitHub Pages deployment`);
  if (run.status !== "completed" || run.conclusion !== "success") fail(`Run ${runId[1]} did not succeed (${run.status}, ${run.conclusion})`);
  if (run.head_branch !== "main") fail(`Run ${runId[1]} deployed "${run.head_branch}", not main`);
  const deployedHead = fullSha(run.head_sha);
  const commits = [...new Set(o.commit.map(fullSha))];
  for (const sha of commits) if (!isIncluded(sha, deployedHead)) fail(`Commit ${sha.slice(0, 7)} is not part of the deployed version ${deployedHead.slice(0, 7)}`);

  // The deployment's finishing time in Rome time ("2026-10-06T06:30:06+02:00"); the date is that day
  const date = R.dateInRome(run.updated_at);
  const deployedAt = romeTimestamp(run.updated_at);

  Object.assign(item, {
    status: "published",
    date,
    evidence: {
      deploymentUrl: `https://github.com/${R.REPOSITORY}/actions/runs/${runId[1]}`,
      deployedAt,
      commits: commits.map((sha) => ({ sha, url: `https://github.com/${R.REPOSITORY}/commit/${sha}` })),
    },
  });
  if (data.updatedAt < date) data.updatedAt = date;
  writeUpdates(data);
  console.log(`✔ "${id}" published with date ${date} (deployment ${runId[1]}).`);
  console.log("  Next: review the change, run node scripts/check-content.js, then commit and merge it.");
}

const [command, id, ...rest] = process.argv.slice(2);
if (command === "new") addDraft(id, options(rest));
else if (command === "publish") publish(id, options(rest)).catch((error) => fail(error.message));
else {
  console.log("Usage:\n  node scripts/updates.js new <id> --title \"...\" --summary \"...\" --type new|improved --category <id>\n" +
    "  node scripts/updates.js publish <id> --run <run id or URL> --commit <sha>\nSee docs/roadmap.md.");
}
