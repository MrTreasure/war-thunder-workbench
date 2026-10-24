"""Extract presentation only from saved anonymous official Wiki pages; never alter RP costs."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
class Presentation(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.on=False;self.head=False;self.group=-1;self.row=0;self.col=-1;self.mod=None;self.groups=[];self.items=[]
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t=='table' and 'game-unit_mods-table' in a.get('class','').split():self.on=True;self.group+=1;self.row=0;self.groups.append({'name':'','columns':0})
  if not self.on:return
  if t=='thead':self.head=True
  if t=='tr' and not self.head:self.row+=1;self.col=-1
  if t=='td':self.col+=1;self.groups[self.group]['columns']=max(self.groups[self.group]['columns'],self.col+1)
  if t=='button' and a.get('data-mod-id'):self.mod={'id':a['data-mod-id'],'group':self.group,'row':self.row,'column':self.col};self.items.append(self.mod)
  if t=='img' and self.mod and 'imageUrl' not in self.mod:
   url=a.get('src','')
   if re.fullmatch(r'https://static\.encyclopedia\.warthunder\.com/gui_skin/[A-Za-z0-9_./-]+\.(png|svg|webp)',url):self.mod['imageUrl']=url
 def handle_data(self,s):
  if self.on and self.head and s.strip():self.groups[self.group]['name']+=s.strip()
 def handle_endtag(self,t):
  if t=='thead':self.head=False
  if t=='button':self.mod=None
  if t=='table':self.on=False

def extract(page):
 s=page.read_text();p=Presentation();p.feed(s)
 match=re.search(r'<link[^>]*rel="canonical"[^>]*href="https://wiki\.warthunder\.com/unit/([^"/?]+)',s) or re.search(r'https://wiki\.warthunder\.com/unit/([^"/?<> ]+)',s)
 uid=match[1] if match else page.stem
 canonical=json.loads((ROOT/'data/modifications.json').read_text())
 if uid not in canonical:uid=next((key for key in canonical if key.casefold()==uid.casefold()),page.stem)
 if not p.items:return None
 return uid,{'groups':p.groups,'items':p.items,'source':'https://wiki.warthunder.com/unit/'+uid,'checkedAt':'2026-10-24','htmlSha256':hashlib.sha256(s.encode()).hexdigest()}

def main():
 previous=ROOT/'data/modification-presentation.json';data=json.loads(previous.read_text()) if previous.exists() else {'schemaVersion':1,'images':{},'layouts':{}}
 for folder in sys.argv[1:]:
  path=Path(folder);files=[path] if path.is_file() else sorted(path.glob('*.html'))
  for page in files:
   result=extract(page)
   if not result:continue
   uid,layout=result;data['layouts'][uid]=layout
   for item in layout['items']:
    if item.get('imageUrl'):
     existing=data['images'].get(item['id'])
     shared=not existing or (existing.get('universal',True) and existing['url']==item['imageUrl'])
     data['images'][item['id']]={'url':item['imageUrl'],'source':layout['source'],'checkedAt':layout['checkedAt'],'universal':shared}
 trees=json.loads((ROOT/'data/trees.json').read_text())
 countries={u['id']:country for categories in trees['trees'].values() for country,tree in categories.items() if tree for rank in tree['ranks'] for node in rank['research']+rank['special'] for u in node['members']}
 data['countryImages']={}
 for uid,layout in data['layouts'].items():
  for item in layout['items']:
   if item['id']=='tank_medical_kit' and item.get('imageUrl') and countries.get(uid):
    data['countryImages'].setdefault(item['id'],{})[countries[uid]]={'url':item['imageUrl'],'source':layout['source'],'checkedAt':layout['checkedAt']}
 previous.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'verifiedUnitLayouts':len(data['layouts']),'verifiedModificationImages':len(data['images'])}))
if __name__=='__main__':main()
