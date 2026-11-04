"""Offline ground armour/ammunition preparation from verified existing Wiki archives.

No requests, collection, publication or scheduling. Raw evidence stays local.
Use --write only after reviewing the generated report.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wiki_reference', ROOT/'scripts/wiki-vehicle-reference.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)

def prepare(entry):
    uid, path, proof, category = entry
    raw = Path(path).read_bytes()
    if path.endswith('.gz'): raw = gzip.decompress(raw)
    if len(raw)!=proof['bytes'] or hashlib.sha256(raw).hexdigest()!=proof['sha256']:
        raise ValueError('Archive byte/hash mismatch: '+uid)
    doc = reference.Document(raw.decode('utf-8')).root
    if not doc.find(lambda n:n.cls('game-unit_card')): raise ValueError('Missing unit card: '+uid)
    performance = reference.performance(doc,uid,proof)
    performance['equipment'] = reference.vehicle_equipment(doc,uid,proof)
    if category == 'ground': performance['groundCombat'] = reference.ground_combat(doc,uid,proof)
    return uid, performance

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--report-dir', type=Path, required=True)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--include-equipment', action='store_true', help='Prepare existing equipment/radar snapshots for every branch')
    args = parser.parse_args()
    report = args.report_dir.resolve()
    if ROOT/'artifacts' not in report.parents: parser.error('Reports must stay in ignored artifacts')
    report.mkdir(parents=True,exist_ok=True)
    manifest = json.loads((args.archive/'manifest.json').read_text())
    if manifest.get('state') in ('challenge','rate_limited'): parser.error('Archive is paused by an official restriction')
    proofs = {}
    for entry in manifest.get('files',[]):
        url = entry.get('url','')
        if not url.startswith('https://wiki.warthunder.com/unit/'): continue
        uid = url.rsplit('/',1)[-1]
        path = args.archive/entry['path']
        if args.archive.resolve() not in path.resolve().parents: raise ValueError('Archive path escape')
        proofs[uid] = (str(path),{**entry,'checkedAt':entry['collectedAt']})
    for key,proof in manifest.get('sources',{}).items():
        if key.startswith('units/'):
            proofs[key.split('/',1)[1]] = (str(args.archive/(key+'.html.gz')),proof)
    trees = json.loads((ROOT/'data/trees.json').read_text())
    categories = {u['id']:category for category,countries in trees['trees'].items() for tree in countries.values() if tree
                  for rank in tree['ranks'] for node in rank['research']+rank['special'] for u in node['members']}
    ids = set(categories) if args.include_equipment else {uid for uid,category in categories.items() if category == 'ground'}
    missing = sorted(ids-proofs.keys())
    if missing: raise ValueError('Ground archive incomplete: '+str(missing))
    entries = [(uid,*proofs[uid],categories[uid]) for uid in sorted(ids)]
    patch = {}
    with ProcessPoolExecutor(max_workers=4) as pool:
        for uid,value in pool.map(prepare,entries,chunksize=4):
            patch[uid] = value
            if len(patch)%100==0: print(json.dumps({'parsed':len(patch),'total':len(ids)}),flush=True)
    ground = {uid:p for uid,p in patch.items() if categories[uid]=='ground'}
    issues = [uid for uid,p in ground.items() if p['groundCombat']['status']=='parse_failed']
    summary = {'groundVehicles':len(ground),'verifiedSnapshots':len(patch),'networkRequests':0,
               'armorAvailable':sum(bool(p['groundCombat']['armor']) for p in ground.values()),
               'ammunitionAvailable':sum(any(w['shells'] for w in p['groundCombat']['weapons']) for p in ground.values()),
               'weapons':sum(len(p['groundCombat']['weapons']) for p in ground.values()),
               'shells':sum(len(w['shells']) for p in ground.values() for w in p['groundCombat']['weapons']),
               'issues':issues,'canonicalWritten':False,
               'equipmentAvailable':sum(p['equipment']['status']=='available' for p in patch.values())}
    (report/'patch.json').write_text(json.dumps(patch,ensure_ascii=False,separators=(',',':'))+'\n')
    if args.write:
        if issues: raise ValueError('Review parser issues before canonical write: '+str(issues))
        path = ROOT/'data/vehicle-details.json'
        data = json.loads(path.read_text())
        for uid,value in patch.items():
            record = data['vehicles'].setdefault(uid,{})
            old = record.get('performance')
            if not old:
                record['performance'] = value
            else:
                # Enrichment preserves existing performance values and provenance.
                # Each extension carries independent source proof from the archive.
                if 'groundCombat' in value: old['groundCombat'] = value['groundCombat']
                old['equipment'] = value['equipment']
        temporary = path.with_suffix('.json.next')
        temporary.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
        temporary.replace(path)
        summary['canonicalWritten'] = True
    (report/'report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False),flush=True)

if __name__=='__main__': main()
