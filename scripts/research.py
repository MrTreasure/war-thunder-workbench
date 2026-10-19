"""Read vehicle unlock RP from the official Wiki's top Research field only."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
import codecs, json, re, time, threading, sys
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'data/research.json'
cache=json.loads(path.read_text()) if path.exists() else {}
tree=json.loads((ROOT/'data/trees.json').read_text())
units={}
for trees in tree['trees'].values():
 for t in trees.values():
  if not t:continue
  for rank in t['ranks']:
   for node in rank['research']+rank['special']:
    for u in node['members']:
     if u['side']=='research' or u['kind']=='squadron':units[u['id']]=u
stop=threading.Event()
class HeaderResearch(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.depth=0;self.item=None;self.value_at=None;self.title_at=None;self.result=None
 def handle_starttag(self,tag,attrs):
  if tag!='div':return
  self.depth+=1;classes=dict(attrs).get('class','').split()
  if 'game-unit_card-info_item' in classes:self.item={'depth':self.depth,'value':[],'title':[]}
  if self.item:
   if 'game-unit_card-info_value' in classes:self.value_at=self.depth
   if 'game-unit_card-info_title' in classes:self.title_at=self.depth
 def handle_data(self,text):
  if self.item:
   if self.value_at:self.item['value'].append(text)
   if self.title_at:self.item['title'].append(text)
 def handle_endtag(self,tag):
  if tag!='div':return
  if self.item and self.depth==self.item['depth']:
   if ''.join(self.item['title']).strip()=='Research':
    text=''.join(self.item['value']).strip()
    if text.lower()=='free':self.result={'rp':0,'free':True}
    elif re.fullmatch(r'[\d,\s]+',text):self.result={'rp':int(re.sub(r'\D','',text)),'free':False}
   self.item=None
  if self.depth==self.value_at:self.value_at=None
  if self.depth==self.title_at:self.title_at=None
  self.depth-=1

def read(uid):
 if stop.is_set():return uid,{'error':'rate limit: not attempted'}
 source='https://wiki.warthunder.com/unit/'+uid
 try:
  parser=HeaderResearch();decoder=codecs.getincrementaldecoder('utf-8')();length=0
  request=Request(source,headers={'User-Agent':'MrTreasure-WT-Tree/1.0 (public Wiki reference)'})
  with urlopen(request,timeout=20) as response:
   while length<180000 and parser.result is None:
    chunk=response.read(8192)
    if not chunk:break
    length+=len(chunk);parser.feed(decoder.decode(chunk))
  if parser.result is None:raise ValueError('Research field unavailable')
  kind='squadron' if units[uid]['kind']=='squadron' else 'vehicle'
  time.sleep(.2)
  return uid,{**parser.result,'kind':kind,'source':source,'checkedAt':datetime.now(timezone.utc).isoformat()}
 except Exception as error:
  if getattr(error,'code',None)==429:stop.set()
  return uid,{'error':str(error),'source':source}

def stale(row):
 try:return (datetime.now(timezone.utc)-datetime.fromisoformat(row['checkedAt'])).total_seconds()>=86400
 except (KeyError,ValueError):return True
pending=[uid for uid in units if '--force' in sys.argv or uid not in cache or 'error' in cache[uid] or stale(cache[uid])]
network_errors=[]
with ThreadPoolExecutor(max_workers=4) as executor:
 futures=[executor.submit(read,uid) for uid in pending]
 for index,future in enumerate(as_completed(futures),1):
  uid,result=future.result()
  if 'error' in result and result['error']!='Research field unavailable':
   network_errors.append({'id':uid,**result})
   if 'rp' not in cache.get(uid,{}):cache[uid]=result
  else:cache[uid]=result
  if index%40==0 or index==len(pending):
   tmp=path.with_suffix('.json.next');tmp.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
   print(json.dumps({'checked':index,'of':len(pending),'values':sum('rp' in r for r in cache.values()),'errors':sum('error' in r for r in cache.values())}),flush=True)

(ROOT/'data/research-report.json').write_text(json.dumps({'checkedAt':datetime.now(timezone.utc).isoformat(),'errors':network_errors},ensure_ascii=False,indent=2)+'\n')
if network_errors:raise SystemExit('Vehicle RP refresh failed; prior verified values retained. See data/research-report.json')
