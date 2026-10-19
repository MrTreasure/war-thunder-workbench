"""Verify original remote artwork and refresh locally served fonts. Requires curl."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
path = root / 'data/branding.json'
record = json.loads(path.read_text())
pending = []
with tempfile.TemporaryDirectory(prefix='wt-brand-') as directory:
    for asset in record['assets']:
        source = Path(directory) / (asset['id'] + '.source')
        subprocess.run([
            'curl', '-4', '-L', '--compressed', '-f', '-sS',
            '--connect-timeout', '12', '--max-time', '40',
            '-H', 'Referer: https://render.mrtreasure.cc/muse/war-thunder-trees/',
            asset['source'], '-o', str(source),
        ], check=True)
        raw = source.read_bytes()
        kind = asset['id']
        if kind == 'logo' and b'<svg' not in raw:
            raise RuntimeError('Official logo unavailable')
        if kind in ('background', 'cover') and not raw.startswith(b'\xff\xd8\xff'):
            raise RuntimeError('Official wallpaper unavailable')
        if kind == 'favicon' and not raw.startswith(b'\x00\x00\x01\x00'):
            raise RuntimeError('Official favicon unavailable')
        if kind == 'font' and not raw.startswith(b'\x00\x01\x00\x00'):
            raise RuntimeError('Official font unavailable')
        asset['sourceSha256'] = hashlib.sha256(raw).hexdigest()
        if asset['delivery'] == 'local':
            pending.append((root / asset['path'], raw))
            asset['sha256'] = asset['sourceSha256']
    # Do not alter local assets or provenance when any remote verification fails.
    for target, raw in pending:
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.next')
        temporary.write_bytes(raw)
        temporary.replace(target)
record['checkedAt'] = datetime.now(timezone.utc).isoformat()
temporary = path.with_suffix('.json.next')
temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
temporary.replace(path)
print('Verified official remote logo, wallpaper and favicon; refreshed local font')
