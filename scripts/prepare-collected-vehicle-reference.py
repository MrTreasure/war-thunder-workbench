"""Prepare local canonical records from this run's verified snapshots; never publish.

Use --allow-partial only for a review build while the full collection continues.
HTTP failures retain previous canonical records and their original provenance.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def load_script(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def atomic(path, data):
    temp = path.with_suffix('.json.next')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    temp.replace(path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--collection', type=Path, required=True)
    parser.add_argument('--allow-partial', action='store_true')
    args = parser.parse_args()
    directory = args.collection.resolve()
    if ROOT / 'artifacts' not in directory.parents:
        parser.error('Use the ignored local capture directory')
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest['state'] != 'complete' and not args.allow_partial:
        parser.error('Full collection is not complete; canonical records remain unchanged')
    mods = load_script('wiki_modifications', 'modifications.py')
    presentation = load_script('wiki_presentation', 'modification-presentation.py')
    target = ROOT / 'data/modifications.json'
    canonical = json.loads(target.read_text())
    images = ROOT / 'data/modification-presentation.json'
    view = json.loads(images.read_text())
    read = 0
    failures = []
    for key, proof in manifest['sources'].items():
        if not key.startswith('units/'):
            continue
        uid = key.split('/', 1)[1]
        if uid not in mods.units:
            continue
        file = directory / (key + '.html.gz')
        raw = gzip.decompress(file.read_bytes())
        if hashlib.sha256(raw).hexdigest() != proof['sha256']:
            raise ValueError('Capture hash mismatch: ' + uid)
        try:
            result = mods.normalize(mods.extract(raw.decode('utf-8'), uid), mods.units[uid])
            result['checkedAt'] = proof['checkedAt']
            layout = presentation.extract(file)
            if not layout and result['items']:
                raise ValueError('No verified modification layout')
        except Exception as error:
            failures.append({'id': uid, 'type': type(error).__name__})
            continue
        # Completed cost records are reused when fetching a page for missing rewards/layout.
        if not canonical.get(uid, {}).get('itemCostsComplete'):
            canonical[uid] = result
        if layout and uid not in view['layouts']:
            _, value = layout
            value['checkedAt'] = proof['checkedAt']
            view['layouts'][uid] = value
        read += 1
    # No write occurs before every captured object has passed its byte/hash check.
    atomic(target, canonical)
    atomic(images, view)
    # This also rebuilds shared and country-specific image registries from layouts.
    subprocess.run([sys.executable, str(ROOT / 'scripts/modification-presentation.py')], cwd=ROOT, check=True)
    subprocess.run(['node', str(ROOT / 'scripts/prepare-vehicle-details.mjs'),
                    '--trees-dir=' + str(directory / 'trees'),
                    '--units-dir=' + str(directory / 'units'),
                    '--collection-manifest=' + str(directory / 'manifest.json'), '--only-missing'], cwd=ROOT, check=True)
    report = {'state': manifest['state'], 'captured': len(manifest['sources']),
              'total': manifest['total'], 'preparedModificationCards': read,
              'parseFailures': failures, 'productionPublished': False}
    atomic(directory / 'preparation.json', report)
    print(json.dumps(report))
    if failures:
        raise SystemExit('Some captured cards need review; their old records were retained')

if __name__ == '__main__':
    main()
