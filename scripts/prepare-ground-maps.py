"""Prepare provided ground-map exports. Requires Pillow/CairoSVG; upload additionally needs boto3/PyYAML.
Run with the two extracted export folders and optionally --upload. Credentials stay in password book.
"""
import argparse,csv,hashlib,json,mimetypes,pathlib,concurrent.futures,gzip,subprocess,sys,os
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('maps',type=pathlib.Path);p.add_argument('thumbs',type=pathlib.Path);p.add_argument('--upload',action='store_true');a=p.parse_args()
out=pathlib.Path('artifacts/ground-maps/publish');out.mkdir(parents=True,exist_ok=True)
s=(a.maps/'地图数据.js').read_text();maps=json.loads(s[s.index('=')+1:].strip().rstrip(';'))
assets={}
def asset(path,kind):
 b=path.read_bytes();h=hashlib.sha256(b).hexdigest();key=f'ground-maps/v1/{kind}/{h[:24]}{path.suffix}'
 assets[key]=(path,h);return {'url':'https://wtmaps.mrtreasure.cc/'+key,'sha256':h,'bytes':len(b)}
icons={f.stem:asset(f,'icons') for f in (a.maps/'图标/即用图标').glob('*.svg')}
rows=list(csv.DictReader((a.thumbs/'地图名称清单.csv').open(encoding='utf-8-sig')))
current=json.loads(pathlib.Path('data/map-atlas.json').read_text());archive=json.loads(pathlib.Path('data/map-collections.json').read_text())
posts=[{'title':g['name'],'source':g['source'],'edition':'2026'} for g in current['guides']]+[{'title':e['title'],'source':e['source'],'edition':'2025'} for c in archive['collections'] for e in c['entries'] if e['category']=='routes']
alias={'avg_africa_desert':['阿拉曼'],'avg_american_valley':['美国沙漠小镇','美国 • 沙漠之城'],'avg_eastern_europe':['东欧'],'avg_israel':['日曜之城','日耀之城'],'avg_lazzaro_italy_new_city':['意大利','坎帕尼亚'],'avg_sector_montmedy':['马奇诺','马其诺'],'avg_sector_montmedy_snow':[], 'avg_poland':['波兰','镜湖'],'avg_korea_lake':['朝鲜'],'avg_western_europe':['航天港'],'avg_northern_valley':['黄金矿场'],'avg_kursk_villages':['库尔斯克'],'avg_syria':['中东']}
for m in maps:
 m['base']=asset(a.maps/m.pop('image'),'base');m['contourImage']=asset(a.maps/m['contours']['svg'],'contours');m['contours'].pop('json',None);m['contours'].pop('svg',None)
 m['thumbnails']=[]
 for r in rows:
  if r['地图ID']!=m['id']:continue
  src=a.thumbs/r['图片路径']
  with Image.open(src) as im:width,height=im.size
  m['thumbnails'].append({'layoutId':r['布局ID'],'name':r['布局名称'],'image':asset(src,'dom'),'width':width,'height':height,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest()})
 names=alias.get(m['id'],[m['name'].split(' • ')[0].split(' - ')[0]])
 # Seasonal variants resolve guides through seasonalVariants in the frontend.
 if m['id'].endswith('_snow'):names=[m['name']]
 m['guides']=[g for g in posts if any(n in g['title'] for n in names)]
 m['legacyGuideIds']=[g['id'] for g in current['guides'] if g['source'] in {v['source'] for v in m['guides']}]
 assert m['thumbnails'] and all(t['layoutId'] in {l['id'] for l in m['layouts']} for t in m['thumbnails'])
assert len(maps)==55 and sum(len(m['thumbnails']) for m in maps)==77
variants=[{'mapId':m['id'],'sourceMapId':m['id'][:-5],
           'layouts':{l['id']:l['id'].replace('_snow','',1) for l in m['layouts']}}
          for m in maps if m['id'].endswith('_snow')]
result={'schemaVersion':1,'source':'用户提供的陆战地图与 DOM 点位导出，2026-10-21','hosting':'Cloudflare R2 / wt-map-atlas','contourIntervalM':5,'majorContourIntervalM':25,'icons':icons,'maps':maps,'seasonalVariants':variants}
pathlib.Path('data/ground-maps.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
# Correct world-Z direction and rebuild previews over unmodified source terrain.
subprocess.run([sys.executable,str(pathlib.Path(__file__).with_name('correct-ground-map-projection.py')),
                '--maps',str(a.maps),'--thumbs',str(a.thumbs)],check=True)
for key in list(assets):
 if '/dom/' in key:del assets[key]
for path in pathlib.Path('artifacts/ground-maps/corrected-thumbnails').glob('*.webp'):asset(path,'thumbs')
print('Prepared',len(maps),'maps,',sum(len(m['layouts']) for m in maps),'layouts,',len(assets),'assets,',round(sum(p.stat().st_size for p,h in assets.values())/1048576,1),'MiB',flush=True)
if a.upload:
 import boto3,yaml
 from botocore.config import Config
 credential_file=os.environ.get('WT_ASSET_CREDENTIALS_FILE')
 if not credential_file: raise SystemExit('Set WT_ASSET_CREDENTIALS_FILE in the private local environment before uploading.')
 c=yaml.safe_load(pathlib.Path(credential_file).read_text())['cloudflare']['r2_admin']
 client=boto3.client('s3',endpoint_url=c['endpoint'],aws_access_key_id=c['access_key_id'],aws_secret_access_key=c['secret_access_key'],region_name='auto',config=Config(max_pool_connections=4,retries={'max_attempts':4}))
 def upload(item):
  key,(path,h)=item
  body=gzip.compress(path.read_bytes(),compresslevel=9,mtime=0) if path.suffix=='.svg' else None
  stored_bytes=len(body) if body is not None else path.stat().st_size
  try:
   head=client.head_object(Bucket='wt-map-atlas',Key=key)
   if head.get('Metadata',{}).get('sha256')==h and head['ContentLength']==stored_bytes:return
  except client.exceptions.ClientError as e:
   if e.response['Error']['Code'] not in ['404','NoSuchKey']:raise
  extra={'ContentType':mimetypes.guess_type(path)[0] or 'application/octet-stream','CacheControl':'public, max-age=31536000, immutable','Metadata':{'sha256':h}}
  if body is not None: client.put_object(Bucket='wt-map-atlas',Key=key,Body=body,ContentEncoding='gzip',**extra)
  else: client.upload_file(str(path),'wt-map-atlas',key,ExtraArgs=extra)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for i,_ in enumerate(pool.map(upload,assets.items()),1):
   if i%20==0:print('Uploaded/verified',i,'/',len(assets),flush=True)
 print('Upload complete',flush=True)
