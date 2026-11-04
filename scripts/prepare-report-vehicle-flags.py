"""Reuse verified Wiki originals to record each vehicle's actual national flag.

No network access or publication. Usage: <archive-folder> <output-json>
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
archive, output = (Path(value) for value in sys.argv[1:3])
manifest = json.loads((archive / 'manifest.json').read_text())
trees = json.loads((root / 'data/trees.json').read_text())['trees']
ids = {u['id'] for countries in trees.values() for tree in countries.values() if tree
       for rank in tree['ranks'] for node in rank['research'] + rank['special'] for u in node['members']}


def parse(entry):
    raw = gzip.decompress((archive / entry['path']).read_bytes())
    assert len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256']
    matches = re.findall(r'<img\b[^>]*class="game-unit_template-flag"[^>]*src="(https://static\.encyclopedia\.warthunder\.com/unit_tooltip/country_([a-z0-9_]+)\.png)"', raw.decode())
    if len(set(matches)) != 1:
        return None
    url, flag = matches[0]
    return entry['url'].rsplit('/', 1)[-1], {
        'flagId': flag, 'source': entry['url'], 'checkedAt': entry['collectedAt'],
        'htmlSha256': entry['sha256'],
    }, url


entries = [f for f in manifest['files'] if f['url'].rsplit('/', 1)[-1] in ids]
with ThreadPoolExecutor(max_workers=4) as pool:
    parsed = [record for record in pool.map(parse, entries) if record]
vehicles = {vehicle: record for vehicle, record, _ in parsed}
sources = {record['flagId']: url for _, record, url in parsed}
previous = json.loads(output.read_text()) if output.exists() else {}
flags = {flag: {'source': url, **({'name': previous['flags'][flag]['name']} if flag in previous.get('flags', {}) else {})}
         for flag, url in sorted(sources.items())}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'schemaVersion': 1, 'parserVersion': 'wiki-report-vehicle-flag-v1',
    'basis': 'Verified Wiki game-unit_template-flag, independent of research-tree country and card background.',
    'flags': flags, 'vehicles': dict(sorted(vehicles.items()))}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'vehicles': len(vehicles), 'flags': len(flags), 'missing': sorted(ids - vehicles.keys())}))
