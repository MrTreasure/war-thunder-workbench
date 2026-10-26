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
    parser.add_argument('--staging-only', action='store_true', help='Write reviewed performance/loadouts patch under artifacts without changing canonical data')
    parser.add_argument('--allow-partial', action='store_true')
    args = parser.parse_args()
    directory = args.collection.resolve()
    if ROOT / 'artifacts' not in directory.parents:
        parser.error('Use the ignored local capture directory')
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest['state'] != 'complete' and not args.allow_partial:
        parser.error('Full collection is not complete; canonical records remain unchanged')
    reference = load_script('wiki_reference', 'wiki-vehicle-reference.py')
    trees = json.loads((ROOT / 'data/trees.json').read_text())
    categories = {unit['id']:category for category,countries in trees['trees'].items()
                  for tree in countries.values() if tree for rank in tree['ranks']
                  for node in rank['research']+rank['special'] for unit in node['members']}
    patch, issues, statuses = {}, [], {'performance':{},'loadouts':{}}
    snapshot_count = 0
    parsed_dir = directory / 'parsed'
    parsed_dir.mkdir(exist_ok=True)
    for uid, category in categories.items():
        key = 'units/' + uid
        proof = manifest['sources'].get(key)
        if not proof:
            issues.append({'id':uid,'type':'missing_snapshot'})
            continue
        raw = gzip.decompress((directory / (key + '.html.gz')).read_bytes())
        if len(raw) != proof.get('bytes') or hashlib.sha256(raw).hexdigest() != proof.get('sha256'):
            raise ValueError('Capture byte/hash mismatch: ' + uid)
        snapshot_count += 1
        try:
            cached = parsed_dir / (uid + '.json')
            value = json.loads(cached.read_text()) if cached.exists() else None
            if not value or any(value.get(field,{}).get('parserVersion') != reference.PARSER_VERSION or value.get(field,{}).get('htmlSha256') != proof['sha256'] for field in ('performance','loadouts')):
                value = reference.parse_reference(raw,uid,category,proof)
                atomic(cached,value)
            patch[uid] = value
            for field in statuses:
                status=value[field]['status'];statuses[field][status]=statuses[field].get(status,0)+1
                if status=='parse_failed':issues.append({'id':uid,'type':field+'_parse_failed'})
        except (ValueError,KeyError,TypeError) as error:
            issues.append({'id':uid,'type':type(error).__name__})
        if snapshot_count % 100 == 0:
            print(json.dumps({'state':'parsing','parsed':snapshot_count,'total':len(categories),'issues':len(issues)}),flush=True)
    patch_path = directory / 'vehicle-reference-patch.json'
    atomic(patch_path,{'schemaVersion':1,'parserVersion':reference.PARSER_VERSION,'vehicles':patch})
    source_times = [manifest['sources']['units/'+uid]['checkedAt'] for uid in patch]
    reference_report = {'state':'complete' if len(patch)==len(categories) and not issues else 'needs_review',
                        'total':len(categories),'verifiedSnapshots':snapshot_count,'prepared':len(patch),
                        'statuses':statuses,'issues':issues,'sourceTimeMin':min(source_times) if source_times else None,
                        'sourceTimeMax':max(source_times) if source_times else None,
                        'networkRequestsNeeded':manifest.get('networkRequestsNeeded'),
                        'reusedVerifiedSnapshots':manifest.get('reusedVerifiedSnapshots'),
                        'productionPublished':False}
    atomic(directory / 'reference-report.json',reference_report)
    print(json.dumps(reference_report,ensure_ascii=False),flush=True)
    if args.staging_only:
        if len(patch)!=len(categories):raise SystemExit('Incomplete reference patch; canonical unchanged')
        return
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
    details_path = ROOT / 'data/vehicle-details.json'
    details = json.loads(details_path.read_text())
    for uid, value in patch.items():
        for field, record in value.items():
            if record['status'] != 'parse_failed':
                details['vehicles'].setdefault(uid,{})[field] = record
    atomic(details_path,details)
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
