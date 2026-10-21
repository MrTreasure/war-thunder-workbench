"""Archive provided original game icons into the existing oss-files clone, then pin its pushed commit."""
import argparse,pathlib,hashlib,json,re
p=argparse.ArgumentParser();p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,default=pathlib.Path('artifacts/ground-maps/maps-source/战雷陆战地图/图标/游戏原版SVG'));p.add_argument('--apply-ref');a=p.parse_args();items=[]
for src in sorted(a.source.glob('*.svg')):
 name=src.stem;body=src.read_bytes();sha=hashlib.sha256(body).hexdigest();path=f'war-thunder/map-editor/v1/{sha[:24]}.svg'
 if 'capture' in name:group='占领点';label='占领点'
 elif 'base' in name:group='基地';label='基地'
 else:group='单位与队伍';label={'army_tank':'坦克','map_player_tank_hull':'玩家坦克','spawn_ally':'己方出生点','spawn_enemy':'敌方出生点','objective_tank':'坦克目标','objective_tank_outline':'坦克目标（轮廓）'}.get(name,'战场标记')
 letter=re.search(r'_mark_(?:no_bg_)?([a-p])$',name)
 if letter:label+=' '+letter.group(1).upper()
 if 'no_bg' in name:label+='（无底色）'
 if name.startswith('mp_'):label+='（任务）'
 for key,word in [('allies','同盟'),('axis','轴心'),('nuclear','核武器'),('rhombus','菱形'),('capturezone_small','占领区')]:
  if key in name and not letter:label=word
 if label=='战场标记':label+=' · '+name.replace('map_','').replace('_',' ')
 dest=a.repo/path
 if not a.apply_ref:dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(body)
 else:assert hashlib.sha256(dest.read_bytes()).hexdigest()==sha
 ref=a.apply_ref or 'PENDING'
 items.append({'id':name,'label':label,'group':group,'asset':{'url':f'https://cdn.jsdelivr.net/gh/MrTreasure/oss-files@{ref}/{path}','rawUrl':f'https://raw.githubusercontent.com/MrTreasure/oss-files/{ref}/{path}','sha256':sha,'bytes':len(body)}})
assert len(items)==79
if not a.apply_ref:
 for item in items:
  item['asset']['file']=item['asset'].pop('url').split('/war-thunder/')[1]
  item['asset']['file']='war-thunder/'+item['asset']['file']
  item['asset'].pop('rawUrl')
result={'schemaVersion':1,'source':'用户提供的游戏原版SVG图标，2026-10-21','repository':'https://github.com/MrTreasure/oss-files','commit':a.apply_ref,'icons':items}
if a.apply_ref:
 assert re.fullmatch('[0-9a-f]{40}',a.apply_ref);pathlib.Path('data/map-editor-icons.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
else:
 (a.repo/'war-thunder/map-editor/manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 (a.repo/'war-thunder/map-editor/README.md').write_text('# Original War Thunder map icons\n\n79 original SVG resources from the user-supplied game export. File contents are unchanged; filenames contain SHA-256 prefixes. These game assets remain the property of their respective rights holders. Used by the local map-route editor in war-thunder-workbench.\n')
print('Pinned' if a.apply_ref else 'Prepared',len(items),'original game icons')
