"""Import the game's Simplified Chinese column, pinned to a verified datamine commit.
No RP or Wiki provenance is changed. Failure leaves the previous mapping untouched.
Usage: python3 scripts/localization.py [--source-dir=/path/to/complete/csv/files]
"""
import base64
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPO = 'gszabi99/War-Thunder-Datamine'
FILES = ['units', 'units_modifications', 'units_weaponry', 'menu']

def request(url):
    with urlopen(Request(url, headers={'User-Agent': 'WT-Workbench-localization/1.0'}), timeout=60) as response:
        return json.load(response)

def clean(value):
    return value.replace('\u200b', '').replace('\ufeff', '').strip()

def main():
    directory = next((Path(a.split('=', 1)[1]) for a in sys.argv if a.startswith('--source-dir=')), None)
    commit = (directory / 'sha').read_text().strip() if directory else request(f'https://api.github.com/repos/{REPO}/commits/master')['sha']
    if not re.fullmatch('[0-9a-f]{40}', commit):
        raise ValueError('Invalid commit')
    sources, tables = {}, {}
    for name in FILES:
        meta = json.loads((directory / f'{name}-meta.json').read_text()) if directory else request(f'https://api.github.com/repos/{REPO}/contents/lang.vromfs.bin_u/lang/{name}.csv?ref={commit}')
        raw = (directory / f'{name}.csv').read_bytes() if directory else base64.b64decode(request(meta['git_url'])['content'])
        blob_hash = hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest()
        if len(raw) != meta['size'] or blob_hash != meta['sha']:
            raise ValueError(f'Incomplete or corrupt language file: {name}')
        sources[name] = {'url': f'https://raw.githubusercontent.com/{REPO}/{commit}/lang.vromfs.bin_u/lang/{name}.csv', 'sha256': hashlib.sha256(raw).hexdigest(), 'gitBlob': blob_hash, 'bytes': len(raw)}
        rows = csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline=''), delimiter=';', strict=True)
        header = next(rows)
        en, zh = header.index('<English>'), header.index('<Chinese>')
        table = {}
        for row in rows:
            if not row or not any(row):
                continue
            if len(row) <= max(en, zh):
                raise ValueError(f'Truncated language row: {name}/{row[0]}')
            if row[0] in table:
                raise ValueError(f'Duplicate localization key: {name}/{row[0]}')
            table[row[0]] = {'english': row[en], 'chineseRaw': row[zh]}
        tables[name] = table
    entries = {}
    def record(file, key, name_en, method, parameters=None):
        source = tables[file][key]
        raw = source['chineseRaw']
        if not clean(raw):
            return None
        params = parameters or []
        for parameter in params:
            raw = raw.replace('%s', parameter, 1)
        if '%s' in raw or '{' in raw:
            return None
        entry_key = f'{file}:{key}'
        entries[entry_key] = source
        return {'nameEn': name_en, 'nameZhCN': clean(raw), 'entry': entry_key, 'method': method, 'parameters': params}
    settings = json.loads((ROOT / 'data/catalog-settings.json').read_text())
    categories = {}
    for category, key in settings['categoryLocalizationKeys'].items():
        proof = record('menu', key, tables['menu'][key]['english'], 'game_menu_key')
        if not proof or proof['nameZhCN'] != settings['categories'][category]:
            raise ValueError(f'Category name does not match the game menu: {category}')
        categories[category] = proof
    lower = {}
    for key in tables['units']:
        lower.setdefault(key.lower(), []).append(key)
    def vehicle_name(uid, name_en):
        for suffix in ['_shop', '_1', '_0']:
            exact = uid + suffix
            matches = [exact] if exact in tables['units'] else lower.get(exact.lower(), [])
            if len(matches) == 1:
                result = record('units', matches[0], name_en, 'vehicle_id_case_insensitive')
                if result:
                    return result
        return {'nameEn': name_en, 'nameZhCN': None, 'missing': 'No unambiguous game vehicle key'}
    trees = json.loads((ROOT / 'data/trees.json').read_text())
    vehicles, groups = {}, {}
    for countries in trees['trees'].values():
        for tree in countries.values():
            if not tree:
                continue
            for rank in tree['ranks']:
                for node in rank['research'] + rank['special']:
                    for unit in node['members']:
                        vehicles[unit['id']] = vehicle_name(unit['id'], unit['name'])
                    key = 'shop/group/' + node['id']
                    matches = lower.get(key.lower(), [])
                    if node['group'] and len(matches) == 1:
                        result = record('units', matches[0], node['name'], 'group_id_case_insensitive')
                        if result:
                            groups[node['id']] = result
    def modification_name(mid, name_en):
        # ID lookup has priority, including names changed by the game since the Wiki snapshot.
        for file in ['units_modifications', 'units_weaponry']:
            for key in ['modification/' + mid, mid + '/name', mid]:
                if key in tables[file]:
                    result = record(file, key, name_en, 'modification_id')
                    if result:
                        return result
        # The game constructs gun/belt labels using these exact localized templates.
        for key, row in tables['units_modifications'].items():
            if not key.startswith('modification/_') or key.endswith('/desc') or row['english'].count('%s') != 1:
                continue
            if ('belt_pack' in key and not mid.endswith('_belt_pack')) or ('new_gun' in key and not mid.endswith('_new_gun')):
                continue
            pattern = re.escape(row['english']).replace('%s', r'([0-9]+(?:\.[0-9]+)?)')
            match = re.fullmatch(pattern, name_en)
            if match:
                return record('units_modifications', key, name_en, 'game_template_and_modification_kind', [match[1]])
        # Shell packs may use a different internal shell ID. Require exact English AND
        # matching caliber in the ID, and reject different Chinese candidates.
        for key, row in tables['units_weaponry'].items():
            if not mid.endswith('_ammo_pack') or not key.endswith('/name') or row['english'].count('%s') != 1:
                continue
            pattern = re.escape(row['english']).replace('%s', r'([0-9]+(?:\.[0-9]+)?)')
            match = re.fullmatch(pattern, name_en)
            if match and mid.startswith(match[1].replace('.', '_') + 'mm_'):
                return record('units_weaponry', key, name_en, 'game_ammunition_template_and_caliber', [match[1]])
        caliber = re.match(r'([0-9]+(?:[._][0-9]+)?)mm_', mid)
        if caliber and mid.endswith('_ammo_pack'):
            candidates = []
            caliber_value = caliber[1].replace('_', '.')
            for key, row in tables['units_weaponry'].items():
                shell_caliber = re.match(r'([0-9]+)(?:_[0-9]+)?mm_', key)
                if shell_caliber and shell_caliber[1] == caliber_value and row['english'] == name_en and clean(row['chineseRaw']):
                    candidates.append(key)
            if candidates and len({clean(tables['units_weaponry'][key]['chineseRaw']) for key in candidates}) == 1:
                return record('units_weaponry', sorted(candidates)[0], name_en, 'exact_shell_name_and_caliber')
        # A Wiki modification pack can use a legacy or launcher caliber while its
        # shell/missile key uses another one. Accept only an exact full designation
        # within the ammunition/weapon-name table and a single Chinese result.
        # Never use substrings, edit distance or this fallback for generic mods.
        if mid.endswith('_ammo_pack'):
            candidates = [key for key, row in tables['units_weaponry'].items()
                          if row['english'] == name_en and clean(row['chineseRaw'])
                          and not key.endswith(('/desc', '/short'))]
            if candidates and len({clean(tables['units_weaponry'][key]['chineseRaw']) for key in candidates}) == 1:
                return record('units_weaponry', sorted(candidates)[0], name_en, 'exact_ammunition_designation_unique_chinese')
        return {'nameEn': name_en, 'nameZhCN': None, 'missing': 'No verified ID/template or unambiguous exact ammunition designation'}
    mods = json.loads((ROOT / 'data/modifications.json').read_text())
    modifications = {}
    for row in mods.values():
        for item in row['items']:
            # Names are scoped by BOTH ID and Wiki name; never collapse same-ID variants.
            key = item['id'] + '\t' + item['name']
            if key not in modifications:
                modifications[key] = modification_name(item['id'], item['name'])
    missing_vehicles = [key for key, value in vehicles.items() if not value['nameZhCN']]
    missing_mods = [key for key, value in modifications.items() if not value['nameZhCN']]
    output = {'schemaVersion': 1, 'language': 'zh-CN', 'column': '<Chinese>', 'sourceLabel': 'Game localization files preserved by community datamine (not an official API)', 'commit': commit, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'normalization': 'Remove U+200B and U+FEFF; trim surrounding whitespace. Original Chinese preserved in entries. Substitute only verified numeric game template parameters.', 'sources': sources, 'entries': entries, 'categories': categories, 'vehicles': vehicles, 'groups': groups, 'modifications': modifications, 'coverage': {'categories': len(categories), 'vehicles': len(vehicles), 'vehicleMissing': missing_vehicles, 'modificationNames': len(modifications), 'modificationMissing': missing_mods}}
    path = ROOT / 'data/localization.json'
    temp = path.with_suffix('.json.next')
    temp.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)
    print(json.dumps({key: len(value) if isinstance(value, list) else value for key, value in output['coverage'].items()}, ensure_ascii=False))

if __name__ == '__main__':
    main()
