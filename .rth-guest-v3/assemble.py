"""Verify reviewed transport and source versions; never update main here."""
from pathlib import Path
import base64
import hashlib
import json
import lzma
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TARGET = Path('/tmp/rth-guest-candidate')

def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()

encoded = ''.join((HERE / f'part-{i}.b64').read_text().strip() for i in range(5))
compressed = base64.b64decode(encoded, validate=True)
assert hashlib.sha256(compressed).hexdigest() == '000f09740215aba16f9e2e7f574c6544e3228e6482fe0851075fb668c8258cd0', 'Transport checksum mismatch'
patch = lzma.decompress(compressed)
assert hashlib.sha256(patch).hexdigest() == '2406cce4ecec85699c0b8efe28f63a503c2aac9305952baa0f70a65bd5b32d8c', 'Patch checksum mismatch'
Path('/tmp/rth-guest.patch').write_bytes(patch)
subprocess.run(['git', 'fetch', 'origin', 'main'], cwd=ROOT, check=True)
base = git('rev-parse', 'FETCH_HEAD')
Path('/tmp/rth-guest-base.txt').write_text(base)
subprocess.run(['git', 'worktree', 'add', '--detach', str(TARGET), base], cwd=ROOT, check=True)
manifest = json.loads((HERE / 'manifest.json').read_text())
for path, expected in manifest.items():
    result = subprocess.run(['git', 'rev-parse', '--verify', f'HEAD:{path}'], cwd=TARGET, text=True, capture_output=True)
    actual = result.stdout.strip() if result.returncode == 0 else None
    assert actual == expected, f'Concurrent source change: {path}; expected {expected}, found {actual}'
subprocess.run(['git', 'apply', '--index', '/tmp/rth-guest.patch'], cwd=TARGET, check=True)
print(f'Verified guest lecture edition against current main {base}', flush=True)
