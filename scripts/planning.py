"""Refresh rank gates from a public mirror of the game's extracted rank.blkx.
The Wiki does not publish rank purchase gates. Keep provenance and allow UI overrides.
"""
from pathlib import Path
from urllib.request import urlopen
from datetime import datetime,timezone
import json,hashlib,sys
root=Path(__file__).resolve().parents[1]
url='https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/master/char.vromfs.bin_u/config/rank.blkx'
if len(sys.argv)>1: raw=Path(sys.argv[1]).read_bytes()
else:
 with urlopen(url,timeout=45) as response:raw=response.read()
config=json.loads(raw)['needBuyToOpenNextInEra']
trees=json.loads((root/'data/trees.json').read_text())
result={'source':url,'sourceLabel':'游戏配置公开镜像（非官方 API）','sha256':hashlib.sha256(raw).hexdigest(),'checkedAt':datetime.now(timezone.utc).isoformat(),'gates':{}}
for category,kind in json.loads((root/'data/catalog-settings.json').read_text())['rankConfigKinds'].items():
 result['gates'][category]={}
 for country,tree in trees['trees'][category].items():
  if not tree:continue
  settings=config['country_'+country]
  result['gates'][category][country]={}
  for rank in tree['ranks'][:-1]:
   number=['I','II','III','IV','V','VI','VII','VIII','IX','X'].index(rank['rank'])+1
   key='needBuyToOpenNextInEra'+kind+str(number)
   value=settings.get(key)
   if not isinstance(value,int) or value<0:raise ValueError(f'Missing gate {category}/{country}/{key}')
   result['gates'][category][country][rank['rank']]=value
(root/'data/planning.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Saved exact rank gates for',sum(map(len,result['gates'].values())),'trees')
