"""Candidate-only file transport: validate the reviewed payload before any write.

This does not execute code from the payload. It reconstructs the 19 reviewed UTF-8
source files against their exact base hashes and validates every output hash.
Remove this installer and its four data chunks before the main release.
"""
from pathlib import Path
import hashlib
import json
import lzma
import subprocess
import sys

ROOT = Path.cwd().resolve()
PAYLOAD_HASH = 'c9b4c1080823e1782b50744d6debb9b7363a086829f3c16dfaa6b671ea2ad1ea'
TARGETS = [
    'content/index.json',
    'content/modules/fund-health-economics/resources.json',
    'content/modules/fund-statistics/resources.json',
    'content/modules/statistics/resources.json',
    'docs/student-toolkit-v3.md',
    'sw.js',
    'tests/toolkit-browser.py',
    'tests/toolkit-organiser-browser.py',
    'tests/toolkit-solve-browser.py',
    'tests/toolkit-solve.test.js',
    'tests/toolkit.test.js',
    'toolkit-data.js',
    'toolkit-formulas.js',
    'toolkit-organiser.js',
    'toolkit-solve-core.js',
    'toolkit-solve.css',
    'toolkit-solve.js',
    'toolkit.html',
    'toolkit.js',
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def path(name):
    if not isinstance(name, str) or Path(name).is_absolute() or '..' in Path(name).parts:
        raise SystemExit('Unsafe payload path')
    p = ROOT / name
    if not p.resolve().is_relative_to(ROOT):
        raise SystemExit('Path escapes repository')
    return p

raw = b''.join(path(f'scripts/tk3-payload-{i}.bin').read_bytes() for i in range(1, 5))
if len(raw) > 1000000:
    raise SystemExit('Payload unexpectedly large')
decoded = lzma.decompress(raw, memlimit=268435456)
if sha(decoded) != PAYLOAD_HASH:
    raise SystemExit('Payload checksum mismatch; no writes performed')
data = json.loads(decoded)
if set(data['manifest']) != set(TARGETS) or set(data['edits']) != set(TARGETS):
    raise SystemExit('Payload does not match the reviewed 19-file allowlist')

if '--verify' in sys.argv or '--stage' in sys.argv:
    for name in TARGETS:
        if sha(path(name).read_bytes()) != data['manifest'][name]['after']:
            raise SystemExit('Tested source mismatch: ' + name)
    print('All 19 release files match the locally tested source byte-for-byte.')
    if '--stage' in sys.argv:
        subprocess.run(['git', 'add', '--', *TARGETS], check=True)
    raise SystemExit(0)

# Prepare ALL outputs from the untouched bases first. Several new test files
# intentionally share portions of the old browser harness.
outputs = {}
for name in TARGETS:
    target = path(name)
    spec = data['manifest'][name]
    if spec['before'] is None:
        if target.exists():
            raise SystemExit('New target already exists: ' + name)
    elif not target.is_file() or sha(target.read_bytes()) != spec['before']:
        raise SystemExit('Base changed; no writes performed: ' + name)
    edit = data['edits'][name]
    if 'text' in edit:
        text = edit['text']
    else:
        if edit['base'] not in TARGETS:
            raise SystemExit('Unapproved source path')
        base = path(edit['base']).read_bytes()
        if sha(base) != edit['baseHash']:
            raise SystemExit('Shared base changed: ' + edit['base'])
        lines = base.decode('utf-8').splitlines(keepends=True)
        pieces = []
        for op in edit['ops']:
            if op[0] == '=' and len(op) == 3 and 0 <= op[1] <= op[2] <= len(lines):
                pieces.append(''.join(lines[op[1]:op[2]]))
            elif op[0] == '+' and len(op) == 2 and isinstance(op[1], str):
                pieces.append(op[1])
            else:
                raise SystemExit('Invalid reconstruction operation')
        text = ''.join(pieces)
    output = text.encode('utf-8')
    if sha(output) != spec['after']:
        raise SystemExit('Reconstruction mismatch: ' + name)
    outputs[name] = output

for name, output in outputs.items():
    target = path(name)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output)
print('Reconstructed and hash-verified all 19 reviewed files.')
