"""Integrate the validated course without replacing concurrent site changes."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys
M=json.loads(Path('.rth-stage/manifest.json').read_text())
BASE='a9dff382e59a44e17bd1d4238f3ad7bcbbfbbddc'
CANDIDATE='3b2d4396595a98b3b83791dcf0b07a961309afb4'
WORK=Path(os.environ['RUNNER_TEMP'])/'rth-release'
OWNED=[p for p in M['files'] if p.startswith('content/modules/right-to-health/') or p.startswith('tests/right-to-health/') or p in ['right-to-health.js','right-to-health.css','notes-course.js','docs/right-to-health.md']]

def git(*args,cwd=None,data=None):
    return subprocess.run(['git',*args],cwd=cwd,input=data,capture_output=True,check=True).stdout

def text(*args,cwd=None):
    return git(*args,cwd=cwd).decode().strip()

def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def unversioned(s):
    return re.sub(r'\?v=[0-9a-f]+','',s)

def prepare():
    git('worktree','add','--detach',str(WORK),BASE)
    for name in OWNED:
        row=text('ls-tree',BASE,'--',name)
        current=row.split()[2] if row else None
        if current != M['files'][name]['before']:
            raise RuntimeError('Concurrent course edit requires review: '+name)
        data=git('show',CANDIDATE+':'+name)
        if blob(data)!=M['files'][name]['after']:
            raise RuntimeError('Candidate changed: '+name)
        f=WORK/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(data)
    course=WORK/'course.html';html=course.read_text()
    original=git('show',M['base']+':course.html').decode()
    if unversioned(html)!=unversioned(original):
        raise RuntimeError('Unexpected concurrent template edit')
    if 'right-to-health.js' in html or 'right-to-health.css' in html:
        raise RuntimeError('Course integration already exists')
    html=html.replace('</head>','  <link rel="stylesheet" href="right-to-health.css">\n</head>')
    html,n=re.subn(r'(?m)^(\s*<script defer src="notes-course\.js[^\"]*"></script>)',r'  <script defer src="right-to-health.js"></script>\n\1',html,count=1)
    if n!=1:raise RuntimeError('Missing initializer anchor')
    course.write_text(html)
    sw=WORK/'sw.js';code=sw.read_text()
    if 'right-to-health.js' in code:raise RuntimeError('Worker already includes new assets')
    code,n=re.subn(r'const SITE_FILES = \[', 'const SITE_FILES = [\n  "right-to-health.js", "right-to-health.css",',code,count=1)
    if n!=1:raise RuntimeError('Missing worker anchor')
    sw.write_text(code)
    print('Integrated onto fixed main '+BASE+'; preserved all concurrent features',flush=True)

def verify():
    for name in OWNED:
        if blob((WORK/name).read_bytes())!=M['files'][name]['after']:
            raise RuntimeError('Course file changed during integration: '+name)
    changed=set(text('diff','--name-only',cwd=WORK).splitlines())|set(text('ls-files','--others','--exclude-standard',cwd=WORK).splitlines())
    for name in changed-set(OWNED)-{'course.html','sw.js','content/index.json'}:
        if '/' in name or not name.endswith('.html'):
            raise RuntimeError('Unrelated edit: '+name)
        old=git('show',BASE+':'+name).decode()
        if unversioned(old)!=unversioned((WORK/name).read_text()):
            raise RuntimeError('Non-fingerprint edit outside course: '+name)
    if any(n.startswith('.rth-stage') or n=='.github/workflows/rth-stage.yml' for n in changed):
        raise RuntimeError('Transport in release')
    git('diff','--check',cwd=WORK)
    print('Verified course blobs and preservation of concurrent site changes',flush=True)
    return sorted(changed)

def publish():
    changed=verify()
    git('config','user.name','github-actions[bot]',cwd=WORK)
    git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com',cwd=WORK)
    git('add','--',*changed,cwd=WORK)
    if set(text('diff','--cached','--name-only',cwd=WORK).splitlines())!=set(changed):
        raise RuntimeError('Unexpected staged files')
    message='''feat: add source-led Right to Health course workspace

Publish 10 original guides, 50 MCQs, 10 open-answer scaffolds, 40 flashcards,
24 glossary terms and 24 source records at the existing course URL.
Add responsive light/dark design, four-country comparison, AAAQ and
risk-margin exercises, mobility routes and local workshop drafting.
Preserve existing course IDs, shared metadata and live UniBo readers.
Official PDFs and recordings remain on their original platforms.

Rebased onto a9dff382 to preserve concurrent homepage, announcements and
roadmap updates. Other page changes are generated asset fingerprints only.
16 Node tests, 93 adapted inline Chromium checks, content integrity,
shared contrast pairs and syntax checks pass on the combined version.
Inline tests do not establish live networking, genuine storage persistence
or service-worker delivery. No staging transport or workflow is included.
'''
    git('commit','-m',message,cwd=WORK)
    sha=text('rev-parse','HEAD',cwd=WORK)
    git('push','origin',sha+':refs/heads/codex/right-to-health-ready-current-20261008',cwd=WORK)
    print('CLEAN_CANDIDATE='+sha,flush=True)
    print('BASE='+BASE,flush=True)
    print('FILES='+str(len(changed)),flush=True)
    for name in changed: print('BLOB '+blob((WORK/name).read_bytes())+' '+name,flush=True)

{'prepare':prepare,'verify':verify,'publish':publish}[sys.argv[1]]()
