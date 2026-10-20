"""Extract modification RP and total from official Wiki; cache verified per-unit JSON.
Usage: python3 scripts/modifications.py [--force] [--unit=unit_id]
No server or account credentials required. Failed fetches retain prior verified data.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone
import json,re,time,threading,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/'data/modifications.json'
cache=json.loads(PATH.read_text()) if PATH.exists() else {}
trees=json.loads((ROOT/'data/trees.json').read_text())
units={u['id']:u for ts in trees['trees'].values() for tree in ts.values() if tree for rank in tree['ranks'] for node in rank['research']+rank['special'] for u in node['members']}
category=next((v.split('=',1)[1] for v in sys.argv if v.startswith('--category=')),None)
source_dir=next((Path(v.split('=',1)[1]) for v in sys.argv if v.startswith('--source-dir=')),None)
if category and category not in trees['trees']:raise ValueError('Unknown category: '+category)
scope={u['id'] for tree in trees['trees'].get(category,{}).values() if tree for rank in tree['ranks'] for node in rank['research']+rank['special'] for u in node['members']} if category else set(units)
stop=threading.Event()
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,s):self.parts.append(s)
def plain(s):
 p=Text();p.feed(s);return ''.join(p.parts).strip()
class Mods(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.items={};self.names={};self.active=None;self.parts=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='button' and 'game-unit_mod' in a.get('class','').split():
   uid=a['data-mod-id'];popover=a.get('data-feature-popover','')
   match=re.search(r'Research:\s*</span>\s*<span>([\d,\s]+)<img[^>]+item_type_rp',popover)
   rp=int(re.sub(r'\D','',match[1])) if match else None
   self.items[uid]={'id':uid,'rp':rp};self.active=uid;self.parts=[]
 def handle_data(self,s):
  if self.active:self.parts.append(s)
 def handle_endtag(self,tag):
  if tag=='button' and self.active:
   self.items[self.active]['name']=''.join(self.parts).strip() or self.active;self.active=None

def extract(html,uid):
 p=Mods();p.feed(html)
 m=re.search(r'Total cost of modifications</span>\s*<span[^>]*>([\d,\s]+)<img[^>]+item_type_rp',html)
 total=int(re.sub(r'\D','',m[1])) if m else None
 items=list(p.items.values())
 # Wiki omits zero / already-included RP for some modifications; do not infer a numeric cost.
 summed=sum(x['rp'] for x in items if x['rp'] is not None)
 complete=total is not None and all(x['rp'] is not None for x in items) and summed==total
 if not re.search(r'class="game-unit_card"',html):raise ValueError('Missing vehicle card')
 return {'unitId':uid,'totalRp':total,'items':items,'itemSumRp':summed,'itemCostsComplete':complete,
  'status':'verified' if total is not None else 'unavailable','source':'https://wiki.warthunder.com/unit/'+uid,
  'checkedAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(html.encode()).hexdigest()}

def normalize(row,unit):
 row['allUnlockedByDefault']=bool(unit.get('premium',False))
 if row.get('totalRp') is not None and row.get('itemSumRp')==row['totalRp']:
  for item in row['items']:
   if item['rp'] is None:item['rp']=0;item['rpBasis']='zero_from_verified_total'
 row['itemCostsComplete']=row.get('totalRp') is not None and all(x['rp'] is not None for x in row['items']) and row.get('itemSumRp')==row['totalRp']
 return row

def fetch(uid):
 if stop.is_set():return uid,None,'rate limited: not attempted'
 try:
  req=Request('https://wiki.warthunder.com/unit/'+uid,headers={'User-Agent':'MrTreasure-WT-Workbench/1.0 (public Wiki reference)'})
  if source_dir:html=(source_dir/(uid+'.html')).read_text()
  else:
   with urlopen(req,timeout=25) as r:html=r.read().decode('utf-8')
  result=normalize(extract(html,uid),units[uid])
  if not source_dir:time.sleep(.2)
  return uid,result,None
 except Exception as e:
  if getattr(e,'code',None)==429:stop.set()
  return uid,None,str(e)
def fresh(row):
 try:return row.get('status') in ['verified','unavailable'] and (datetime.now(timezone.utc)-datetime.fromisoformat(row['checkedAt'])).total_seconds()<86400
 except (KeyError,ValueError):return False

def main():
 for uid,row in cache.items():normalize(row,units.get(uid,{}))
 if '--normalize-only' in sys.argv:
  temp=PATH.with_suffix('.json.next');temp.write_text(json.dumps(cache,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(PATH);print('Normalized cached modification records');return
 selected=next((v.split('=',1)[1] for v in sys.argv if v.startswith('--unit=')),None)
 pending=[uid for uid in units if uid in scope and (not selected or uid==selected) and ('--force'in sys.argv or not fresh(cache.get(uid,{})))]
 errors=[]
 with ThreadPoolExecutor(max_workers=4) as executor:
  futures=[executor.submit(fetch,uid) for uid in pending]
  for count,future in enumerate(as_completed(futures),1):
   uid,result,error=future.result()
   if result:cache[uid]=result
   else:errors.append({'id':uid,'error':error})
   if count%40==0 or count==len(pending):
    temp=PATH.with_suffix('.json.next');temp.write_text(json.dumps(cache,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(PATH)
    print(json.dumps({'checked':count,'of':len(pending),'totals':sum(v.get('totalRp') is not None for v in cache.values()),'errors':len(errors)}),flush=True)
 temp=PATH.with_suffix('.json.next');temp.write_text(json.dumps(cache,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(PATH)
 report={'checkedAt':datetime.now(timezone.utc).isoformat(),'requested':len(pending),'errors':errors}
 (ROOT/'data/modifications-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 if errors:raise SystemExit('Modification refresh failed; old verified values retained. See data/modifications-report.json')
if __name__=='__main__':main()
