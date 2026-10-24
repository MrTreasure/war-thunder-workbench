"""Collect anonymous official Wiki snapshots with bounded concurrency and host-wide pacing.

Snapshots are gzip compressed under ignored artifacts. Challenges and HTTP limits
stop the run; the checkpoint allows continuation after ordinary network interruptions.
This manual command never schedules itself or publishes any collected data.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
from pathlib import Path
import random
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

def now():
    return datetime.now(timezone.utc).isoformat()

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.next')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)

class HostPacer:
    def __init__(self, low, high, resumed):
        self.low, self.high = low, high
        self.lock = threading.Lock()
        self.worker = threading.local()
        self.next = time.monotonic() + (random.uniform(.8, 1.2) if resumed else 0)
        self.stopped = threading.Event()

    def acquire(self):
        with self.lock:
            worker_ready = getattr(self.worker, "next", time.monotonic())
            start = max(time.monotonic(), self.next, worker_ready)
            self.next = start + random.uniform(.8, 1.2)
            self.worker.next = start + random.uniform(self.low, self.high)
        if self.stopped.wait(max(0, start - time.monotonic())):
            return False
        return not self.stopped.is_set()

def collect(entry, directory, pacer):
    kind, uid, url = entry
    key = f'{kind}/{uid}'
    if not pacer.acquire():
        return key, None, None, 'cancelled'
    try:
        request = urllib.request.Request(url, headers={
            'User-Agent': 'MrTreasure-WT-Workbench/1.0 (anonymous public Wiki reference)',
            'Accept-Language': 'en',
        })
        with urllib.request.urlopen(request, timeout=25) as response:
            if response.status != 200:
                raise ValueError('Unexpected HTTP status')
            body = response.read(4 * 1024 * 1024 + 1)
            if len(body) > 4 * 1024 * 1024:
                raise ValueError('Official page exceeds capture bound')
            final_url = response.url
        html = body.decode('utf-8')
        if any(marker in html.lower() for marker in ['cf-chl-', 'g-recaptcha', 'verify you are human']) or '/login' in final_url.lower():
            pacer.stopped.set()
            return key, None, {'checkedAt': now(), 'type': 'VerificationRequired'}, 'challenge'
        if ('window.WT_UnitList' if kind == 'trees' else 'game-unit_card') not in html:
            raise ValueError('Missing official vehicle data')
        path = directory / kind / (uid + '.html.gz')
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix('.next')
        temporary.write_bytes(gzip.compress(body, mtime=0))
        temporary.replace(path)
        result = {'url': url, 'finalUrl': final_url, 'checkedAt': now(),
                  'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}
        return key, result, None, None
    except Exception as error:
        code = getattr(error, 'code', None)
        issue = {'checkedAt': now(), 'type': type(error).__name__, 'httpStatus': code}
        stop = 'rate_limited' if code == 429 else 'challenge' if code in [401, 403] else None
        if stop:
            pacer.stopped.set()
        return key, None, issue, stop

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--concurrency', type=int, default=10, choices=range(1, 11))
    parser.add_argument('--min-interval', type=float, default=6)
    parser.add_argument('--max-interval', type=float, default=10)
    args = parser.parse_args()
    if not 6 <= args.min_interval <= args.max_interval <= 60:
        parser.error('Each worker uses 6 <= min-interval <= max-interval <= 60 seconds')
    directory = args.output.resolve()
    if ROOT / 'artifacts' not in directory.parents:
        parser.error('Raw captures must remain in this checkout ignored artifacts directory')
    directory.mkdir(parents=True, exist_ok=True)
    lock = (directory / '.collection.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    trees = json.loads((ROOT / 'data/trees.json').read_text())
    ids = list(dict.fromkeys(u['id'] for categories in trees['trees'].values()
               for tree in categories.values() if tree for rank in tree['ranks']
               for node in rank['research'] + rank['special'] for u in node['members']))
    modifications = json.loads((ROOT / 'data/modifications.json').read_text())
    presentation = json.loads((ROOT / 'data/modification-presentation.json').read_text())
    details = json.loads((ROOT / 'data/vehicle-details.json').read_text())
    complete_ids = set()
    for uid in ids:
        row = modifications.get(uid, {})
        layout = presentation['layouts'].get(uid, {})
        reward = details['vehicles'].get(uid, {}).get('rewards', {})
        items = row.get('items', [])
        layout_items = {item['id']: item for item in layout.get('items', [])}
        complete_layout = not items or all(item['id'] in layout_items and layout_items[item['id']].get('imageUrl') for item in items)
        if complete_layout and reward.get('rp') and reward.get('sl') and (row.get('itemCostsComplete') or row.get('status') == 'unavailable'):
            complete_ids.add(uid)
    priority = ['ussr_buk_m3_fcs' , 'germ_pzkpfw_iv_ausf_e', 'germ_pzkpfw_maus', 'germ_leopard_2a7v', 'ussr_t_80ud']
    ids.sort(key=lambda uid: (priority.index(uid) if uid in priority else len(priority), uid))
    queue = [('trees', category, f'https://wiki.warthunder.com/{category}')
             for category in ['ground', 'aviation', 'helicopters', 'ships', 'boats']]
    queue += [('units', uid, f'https://wiki.warthunder.com/unit/{uid}') for uid in ids if uid not in complete_ids]
    checkpoint = directory / 'manifest.json'
    state = json.loads(checkpoint.read_text()) if checkpoint.exists() else {
        'schemaVersion': 1, 'startedAt': now(), 'sources': {}, 'failures': {},
        'unitCount': len(ids), 'total': len(ids) + 5,
    }
    if state.get('state') in ['challenge', 'rate_limited']:
        raise SystemExit('Collection is paused at an official restriction; do not resume around it')
    pending = []
    for entry in queue:
        kind, uid, _ = entry
        previous = state['sources'].get(f'{kind}/{uid}')
        path = directory / kind / (uid + '.html.gz')
        if previous and path.exists():
            with gzip.open(path, 'rb') as stream:
                if hashlib.sha256(stream.read()).hexdigest() == previous['sha256']:
                    continue
        pending.append(entry)
    state.update(state='running', updatedAt=now(), concurrency=args.concurrency, reusedCompleteCards=len(complete_ids),
                 pacing={'scope': 'per_worker', 'hostMinimumSeconds': .8, 'hostMaximumSeconds': 1.2, 'minimumSeconds': args.min_interval,
                         'maximumSeconds': args.max_interval, 'distribution': 'uniform_random'})
    atomic(checkpoint, state)
    pacer = HostPacer(args.min_interval, args.max_interval, bool(state['sources']))
    failures = 0
    iterator = iter(pending)
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        active = {executor.submit(collect, entry, directory, pacer)
                  for entry in [next(iterator, None) for _ in range(args.concurrency)] if entry}
        while active:
            done, active = wait(active, return_when=FIRST_COMPLETED)
            for future in done:
                key, result, error, stop = future.result()
                if result:
                    state['sources'][key] = result
                    state['failures'].pop(key, None)
                    failures = 0
                elif error:
                    failures += 1
                    state['failures'][key] = error
                if stop and stop != 'cancelled':
                    state['state'] = stop
                if failures >= 3 and state['state'] == 'running':
                    state['state'] = 'transport_paused'
                    pacer.stopped.set()
                state.update(current=key, completed=len(state['sources']) + len(complete_ids - {k.split('/', 1)[1] for k in state['sources'] if k.startswith('units/')}), updatedAt=now())
                atomic(checkpoint, state)
                print(json.dumps({k: state[k] for k in ['state', 'current', 'completed', 'total', 'updatedAt']}), flush=True)
                if state['state'] == 'running' and not pacer.stopped.is_set():
                    entry = next(iterator, None)
                    if entry:
                        active.add(executor.submit(collect, entry, directory, pacer))
    if state['state'] == 'running':
        state['state'] = 'complete' if not state['failures'] else 'incomplete'
    state['updatedAt'] = now()
    atomic(checkpoint, state)
    if state['state'] != 'complete':
        raise SystemExit('Collection ended with state: ' + state['state'])

if __name__ == '__main__':
    main()
