"""Read public Wiki purchase links for premium vehicles with no GE price."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import time
import sys
from urllib.request import Request, urlopen
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/trees.json').read_text())
path = ROOT / 'data/purchases.json'
evidence = json.loads(path.read_text()) if path.exists() else {}
pending = {}
for trees in data['trees'].values():
    for tree in trees.values():
        if not tree:
            continue
        for rank in tree['ranks']:
            for node in rank['special']:
                for unit in node['members']:
                    if unit['premium'] and unit['kind'] != 'gold' and (unit['id'] not in evidence or evidence[unit['id']].get('error') or '--force' in sys.argv or (datetime.now(timezone.utc)-datetime.fromisoformat(evidence[unit['id']].get('checkedAt','1970-01-01T00:00:00+00:00'))).total_seconds()>=86400):
                        pending[unit['id']] = unit


class PurchaseLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag != 'a' or 'game-unit_link' not in attrs.get('class', '').split():
            return
        href = attrs.get('href', '')
        target = urlparse(href)
        if target.hostname == 'store.gaijin.net' and 'id' in parse_qs(target.query):
            self.links['store'] = 'https://store.gaijin.net/story.php?id=' + parse_qs(target.query)['id'][0]
        elif target.hostname in ('trade.gaijin.net', 'trade.gaijin.ru'):
            self.links['market'] = href


def read_purchase(uid):
    source = 'https://wiki.warthunder.com/unit/' + uid
    try:
        request = Request(source, headers={'User-Agent': 'MrTreasure-WT-Tree/1.0 (public Wiki reference)'})
        with urlopen(request, timeout=20) as response:
            html = response.read().decode('utf-8')
        parser = PurchaseLinks()
        parser.feed(html)
        if 'game-unit' not in html:
            raise RuntimeError('Missing vehicle data')
        result = {**parser.links, 'source': source, 'checkedAt': datetime.now(timezone.utc).isoformat()}
        time.sleep(.25)
        return uid, result
    except Exception as error:
        return uid, {'error': type(error).__name__, 'source': source}


errors=[]
with ThreadPoolExecutor(max_workers=3) as executor:
    futures = [executor.submit(read_purchase, uid) for uid in pending]
    for index, future in enumerate(as_completed(futures), 1):
        uid, result = future.result()
        if 'error' in result:
            errors.append({'id':uid,**result})
            if uid not in evidence:evidence[uid]=result
        else:evidence[uid] = result
        if index % 20 == 0 or index == len(futures):
            path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps({'checked': index, 'of': len(futures),
                              'storeLinks': sum(bool(row.get('store')) for row in evidence.values()),
                              'errors': sum(bool(row.get('error')) for row in evidence.values())}), flush=True)

(ROOT/'data/purchases-report.json').write_text(json.dumps({'checkedAt':datetime.now(timezone.utc).isoformat(),'errors':errors},ensure_ascii=False,indent=2)+'\n')
if errors:raise SystemExit('Purchase link refresh failed; prior verified evidence retained. See data/purchases-report.json')
