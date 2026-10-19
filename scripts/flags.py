"""Verify official flag URLs and retain online references in JSON."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess

root = Path(__file__).resolve().parents[1]
settings = json.loads((root / 'data/catalog-settings.json').read_text())

def verify(country):
    url = settings['flagSourceTemplate'].replace('{country}', country)
    response = subprocess.run([
        'curl', '-4', '-L', '--compressed', '-f', '-sS',
        '--connect-timeout', '12', '--max-time', '30',
        '-H', 'Referer: https://render.mrtreasure.cc/muse/war-thunder-trees/', url,
    ], capture_output=True, check=True)
    if b'<svg' not in response.stdout:
        raise ValueError('Invalid flag: ' + country)
    return country, url

with ThreadPoolExecutor(max_workers=4) as pool:
    flags = dict(pool.map(verify, settings['countries']))
path = root / 'data/flags.json'
temporary = path.with_suffix('.json.next')
temporary.write_text(json.dumps(flags, ensure_ascii=False, indent=2) + '\n')
temporary.replace(path)
print('Verified official online flags:', len(flags))
