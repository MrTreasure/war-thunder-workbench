"""Import presentation tiers only from an externally supplied game config export.

No prices, RP costs, reward coefficients or raw game configuration are copied.
Source exports stay outside Git and application packages.
"""
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    raw = args.source.read_bytes()
    source = json.loads(raw)
    units = {unit['name'].casefold(): unit for unit in source['children']}
    canonical = json.loads((ROOT / 'data/modifications.json').read_text())
    result = {'schemaVersion': 1, 'source': {
        'kind': 'original_game_configuration', 'resource': 'config/wpcost.blk',
        'exportSha256': hashlib.sha256(raw).hexdigest(),
        'extractedAt': datetime.now(timezone.utc).isoformat(),
        'fields': ['unit_id', 'modification_id', 'tier'],
    }, 'units': {}}
    missing = []
    for uid, row in canonical.items():
        unit = units.get(uid.casefold(), {})
        groups = [child for child in unit.get('children', []) if child['name'] == 'modifications']
        tiers = {item['name']: dict(item['params']).get('tier')
                 for group in groups for item in group['children']}
        result['units'][uid] = {}
        for item in row['items']:
            tier = tiers.get(item['id'])
            if type(tier) is int and 1 <= tier <= 6:
                result['units'][uid][item['id']] = tier
            else:
                missing.append((uid, item['id']))
    if missing:
        raise SystemExit(f'Missing verified tiers for {len(missing)} items; previous tier file retained')
    path = ROOT / 'data/modification-tiers.json'
    path.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'vehicles': len(result['units']), 'verifiedParts': sum(len(t) for t in result['units'].values())}))

if __name__ == '__main__':
    main()
