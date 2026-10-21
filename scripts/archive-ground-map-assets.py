"""Copy verified export assets into the existing image repository; no network credentials.
First prepare the repository, commit/push it, then run --apply-ref with that immutable commit.
"""
import argparse,hashlib,json,pathlib,re,shutil
p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,default=pathlib.Path('artifacts/ground-maps/maps-source/战雷陆战地图'));p.add_argument('--apply-ref');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];canonical=root/'data/ground-maps.json';data=json.loads(canonical.read_text());assets={}
for path in a.source.rglob('*'):
 if path.is_file() and path.suffix in ('.webp','.svg'):
  assets[hashlib.sha256(path.read_bytes()).hexdigest()]=path
for path in (root/'artifacts/ground-maps/publish').glob('*.webp'):assets[hashlib.sha256(path.read_bytes()).hexdigest()]=path
items=[*data['icons'].values()]
for m in data['maps']:items += [m['base'],m['contourImage']]+[t['image'] for t in m['thumbnails']]
records=[]
for item in items:
 original=item.get('sourceSha256',item['sha256']);source=assets[original];body=source.read_bytes()
 if source.name=='contours.svg':
  text=body.decode();text=re.sub(r'-?\d+\.\d+',lambda m:m.group(0).rstrip('0').rstrip('.'),text).replace(' L',' ')
  # Only compact SVG number syntax / implicit line-to commands; preserve all coordinates.
  assert [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?',body.decode())]==[float(n) for n in re.findall(r'-?\d+(?:\.\d+)?',text)]
  body=text.encode()
 h=hashlib.sha256(body).hexdigest();relative=f'war-thunder/ground-maps/v1/{h[:24]}{source.suffix}';dest=a.repo/relative
 if not a.apply_ref:
  dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(body)
 else:
  assert hashlib.sha256(dest.read_bytes()).hexdigest()==h
  assert re.fullmatch('[a-f0-9]{40}',a.apply_ref)
  fallback=item.get('fallbackUrl',item['url']);fallback_sha=item.get('fallbackSha256',item['sha256'])
  item.update(url=f'https://cdn.jsdelivr.net/gh/MrTreasure/oss-files@{a.apply_ref}/{relative}',rawUrl=f'https://raw.githubusercontent.com/MrTreasure/oss-files/{a.apply_ref}/{relative}',fallbackUrl=fallback,fallbackSha256=fallback_sha,sourceSha256=original,sha256=h,bytes=len(body))
 records.append({'path':relative,'sha256':h,'bytes':len(body),'sourceSha256':original})
if a.apply_ref:
 data['hosting']='GitHub MrTreasure/oss-files via jsDelivr (immutable commit), with raw GitHub and existing R2 fallback';data['assetRepository']={'url':'https://github.com/MrTreasure/oss-files','commit':a.apply_ref};canonical.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
else:
 (a.repo/'war-thunder/ground-maps/manifest.json').write_text(json.dumps({'source':'User-provided War Thunder ground map exports, 2026-10-21','assets':records},ensure_ascii=False,indent=2)+'\n')
 (a.repo/'war-thunder/ground-maps/README.md').write_text('# War Thunder ground maps\n\n55 base maps, 55 terrain contour SVG overlays, 77 DOM preview thumbnails, and 6 point icons.\n\nOriginal base maps are unchanged. Contour SVG syntax is compacted without changing numerical coordinates or line geometry. Filenames contain SHA-256 prefixes; full hashes and source hashes are in manifest.json. Game imagery remains the property of its respective rights holders.\n\nUsed by https://github.com/MrTreasure/war-thunder-workbench\n')
print('Prepared' if not a.apply_ref else 'Pinned',len(records),'assets;',round(sum(r['bytes'] for r in records)/1048576,1),'MiB; max file',max(r['bytes'] for r in records))
