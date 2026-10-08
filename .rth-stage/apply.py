"""Transport-only helper. Never include this file or transport data in the release."""
from pathlib import Path, PurePosixPath
import base64, hashlib, json, lzma, os, subprocess, sys, tempfile

ROOT = Path.cwd()
MANIFEST = json.loads((ROOT / '.rth-stage/manifest.json').read_text())
BASE = MANIFEST['base']
FILES = MANIFEST['files']
PATCH = Path(os.environ['RUNNER_TEMP']) / 'right-to-health-reviewed.patch'
READY = 'codex/right-to-health-ready-20261008'

def git(*args, env=None, data=None):
    result = subprocess.run(['git', *args], input=data, capture_output=True, check=True, env=env)
    return result.stdout.decode().strip()

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def validate_manifest():
    if len(FILES) != 44 or len(BASE) != 40:
        raise RuntimeError('Unexpected manifest scope')
    for name in FILES:
        p = PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or name.startswith('.'):
            raise RuntimeError('Unsafe path: ' + name)
        allowed = (len(p.parts) == 1 and p.suffix in ['.html', '.js', '.css']) or name == 'content/index.json' or name == 'docs/right-to-health.md' or name.startswith('content/modules/right-to-health/') or name.startswith('tests/right-to-health/')
        if not allowed:
            raise RuntimeError('Out-of-scope path: ' + name)

def verify():
    validate_manifest()
    changed = set(git('diff', '--cached', '--name-only').splitlines())
    if changed != set(FILES):
        raise RuntimeError('Changed file set differs: ' + str(changed.symmetric_difference(FILES)))
    for name, expected in FILES.items():
        if blob((ROOT / name).read_bytes()) != expected['after']:
            raise RuntimeError('Working file hash mismatch: ' + name)
        if git('rev-parse', ':' + name) != expected['after']:
            raise RuntimeError('Index hash mismatch: ' + name)
    if git('diff', '--name-only'):
        raise RuntimeError('Unexpected unstaged tracked changes')
    git('diff', '--cached', '--check')
    print('Verified all 44 staged output blobs against the reviewed manifest', flush=True)

def apply():
    validate_manifest()
    for name, expected in FILES.items():
        listing = git('ls-tree', BASE, '--', name)
        actual = listing.split()[2] if listing else None
        if actual != expected['before']:
            raise RuntimeError('Base hash mismatch: ' + name)
        current = (ROOT / name).read_bytes() if (ROOT / name).is_file() else None
        current_sha = blob(current) if current is not None else None
        if current_sha != expected['before']:
            raise RuntimeError('Staging branch conflicts with base: ' + name)
    parts = sorted((ROOT / '.rth-stage').glob('part-*.b64'))
    if [p.name for p in parts] != ['part-%02d.b64' % i for i in range(7)]:
        raise RuntimeError('Missing or extra transport chunks')
    encoded = ''.join(p.read_text().strip() for p in parts)
    raw = lzma.decompress(base64.b64decode(encoded, validate=True))
    if hashlib.sha256(raw).hexdigest() != MANIFEST['patchSha256']:
        raise RuntimeError('Patch checksum mismatch')
    PATCH.write_bytes(raw)
    git('apply', '--check', '--index', str(PATCH))
    git('apply', '--index', str(PATCH))
    verify()

def candidate():
    verify()
    if not PATCH.is_file() or hashlib.sha256(PATCH.read_bytes()).hexdigest() != MANIFEST['patchSha256']:
        raise RuntimeError('Reviewed patch is not available')
    with tempfile.TemporaryDirectory() as tmp:
        env = dict(os.environ, GIT_INDEX_FILE=str(Path(tmp) / 'clean-index'))
        git('read-tree', BASE, env=env)
        git('apply', '--cached', str(PATCH), env=env)
        tree = git('write-tree', env=env)
    git('config', 'user.name', 'github-actions[bot]')
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    message = '''feat: launch Right to Health learning workspace at the original course URL

Add 10 source-led original guides, 50 MCQs, 10 open-answer scaffolds,
40 flashcards, 24 glossary entries and a 24-record source register.
Add scoped responsive light/dark UI, qualitative country comparison,
AAAQ and risk-margin exercises, route comparison and local workshop drafts.
Preserve the six published topic IDs, shared metadata and UniBo readers.
Link official materials; do not republish PDFs or copyrighted figures.

Validation: 16 Node content tests and 93 adapted inline Chromium checks;
content integrity, shared contrast pairs, JS syntax and exact 44-file hash
verification. Browser tests do not prove live networking, real persistent
storage or service-worker delivery. Generated HTML fingerprints included.
Transport-only scripts, workflow and encoded payloads are excluded.
'''
    sha = git('commit-tree', tree, '-p', BASE, data=message.encode())
    changed = set(git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).splitlines())
    if changed != set(FILES):
        raise RuntimeError('Clean candidate has an unexpected diff')
    for name, expected in FILES.items():
        if git('rev-parse', sha + ':' + name) != expected['after']:
            raise RuntimeError('Clean candidate hash mismatch: ' + name)
    for forbidden in ['.rth-stage', '.github/workflows/rth-stage.yml']:
        if git('ls-tree', sha, '--', forbidden):
            raise RuntimeError('Transport leaked into candidate')
    git('push', 'origin', sha + ':refs/heads/' + READY)
    print('CLEAN_CANDIDATE=' + sha, flush=True)
    print('CLEAN_TREE=' + tree, flush=True)
    print('Main remains unchanged; candidate is on ' + READY, flush=True)

if __name__ == '__main__':
    {'apply': apply, 'verify': verify, 'candidate': candidate}[sys.argv[1]]()
