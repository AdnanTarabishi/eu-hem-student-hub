"""Staging-only transport: verify exact patch and current source blobs."""
from pathlib import Path
import base64
import hashlib
import json
import lzma
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TARGET = Path('/tmp/rth-v2-candidate')

def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()

encoded = ''.join((HERE / f'part-{i}.b64').read_text().strip() for i in range(6))
compressed = base64.b64decode(encoded, validate=True)
assert hashlib.sha256(compressed).hexdigest() == '052666df800f2615fa004ae170e0898c6c1e199f6faf4a7ee66f6c5785cbff7d', 'Transport checksum mismatch'
patch = lzma.decompress(compressed)
assert hashlib.sha256(patch).hexdigest() == '9b86f2556e4ee05979128a1df00a9ca6c05f7f2b7a635198fdc0f15a0349e5bd', 'Patch checksum mismatch'
Path('/tmp/rth-v2.patch').write_bytes(patch)
subprocess.run(['git', 'fetch', 'origin', 'main'], cwd=ROOT, check=True)
base = git('rev-parse', 'FETCH_HEAD')
Path('/tmp/rth-v2-base.txt').write_text(base)
subprocess.run(['git', 'worktree', 'add', '--detach', str(TARGET), base], cwd=ROOT, check=True)
manifest = json.loads((HERE / 'manifest.json').read_text())
for path, expected in manifest.items():
    result = subprocess.run(['git', 'rev-parse', '--verify', f'HEAD:{path}'], cwd=TARGET, text=True, capture_output=True)
    actual = result.stdout.strip() if result.returncode == 0 else None
    assert actual == expected, f'Concurrent source change: {path}; expected {expected}, found {actual}'
subprocess.run(['git', 'apply', '--unidiff-zero', '--index', '/tmp/rth-v2.patch'], cwd=TARGET, check=True)
print(f'Verified reviewed expansion on current main {base}', flush=True)
