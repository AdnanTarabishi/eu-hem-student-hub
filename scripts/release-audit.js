// Read-only publication audit for release-history maintenance. No writes to the site.
// Usage: node scripts/release-audit.js 2026-10-08 output.json
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const repo = 'AdnanTarabishi/eu-hem-student-hub';
const since = process.argv[2], output = process.argv[3];
if (!/^\d{4}-\d{2}-\d{2}$/.test(since || '') || !output) throw new Error('Supply a since date and output JSON path.');
const headers = { Accept:'application/vnd.github+json', 'User-Agent':'euhem-release-audit' };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
async function get(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, { headers, signal:AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`GitHub publication audit: HTTP ${response.status}`);
  return response.json();
}
(async () => {
  const runs=[];
  for (let page=1;page<=10;page++) {
    const data=await get(`actions/workflows/371794970/runs?branch=main&status=success&created=${since}..${new Date().toISOString().slice(0,10)}&per_page=100&page=${page}`);
    runs.push(...data.workflow_runs.filter(r=>r.name==='pages build and deployment' && r.status==='completed' && r.conclusion==='success' && r.head_branch==='main'));
    if(data.workflow_runs.length<100) break;
    if(page===10) throw new Error('Audit result exceeds bounded pagination; narrow the date window.');
  }
  const included=[];
  for (const run of runs) {
    try { execFileSync('git',['merge-base','--is-ancestor',run.head_sha,'HEAD'],{stdio:'ignore'}); }
    catch { continue; }
    included.push({id:run.id,sha:run.head_sha,deployedAt:run.updated_at,url:run.html_url,title:run.head_commit.message.split('\n')[0]});
  }
  const commits=execFileSync('git',['log','--first-parent',`--since=${since}T00:00:00Z`,'--format=%H %cI %s'],{encoding:'utf8'}).trim().split('\n');
  fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),since,runs:included,commits},null,2)+'\n');
  console.log(`Read-only audit: ${included.length} successful main-branch deployments in this history. No release records were changed.`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
