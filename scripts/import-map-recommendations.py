"""Import reviewed route SVGs; match mission points without stretching map geometry.
Usage: python3 scripts/import-map-recommendations.py /path/to/portable-vectors
Raw archive captures, source matrices and unmatched items remain private artifacts.
"""
import sys,json,math,hashlib,re
from pathlib import Path
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1])
manifest=json.loads((source/'manifest.json').read_text())
maps={m['id']:m for m in json.loads((root/'data/ground-maps.json').read_text())['maps']}
out=root/'data/map-recommendations';out.mkdir(exist_ok=True)
rows=[];report=[]
allowed={'svg','title','defs','marker','path','circle','ellipse','rect','line','polyline','polygon','text','tspan','g'}
for item in manifest['items']:
    record={'postId':item['postId'],'side':item['side']}
    def skip(reason): report.append({**record,'status':'unmatched','reason':reason})
    reg=item.get('registration');m=maps.get(reg['mapId']) if reg else None
    if not m: skip('地图尚未收录');continue
    if reg['baseSha256']!=m['base']['sha256']: skip('底图版本不一致');continue
    a,c,tx=reg['basePixelsToOverlayPixels'][0];b,d,ty=reg['basePixelsToOverlayPixels'][1]
    det=a*d-b*c
    if not math.isfinite(det) or abs(det)<1e-9:raise ValueError('Invalid registration')
    # SVG pixels -> full-map 1000-unit drawing space. No extra Y reflection.
    matrix=[1000*d/det/reg['baseWidth'],-1000*b/det/reg['baseHeight'],-1000*c/det/reg['baseWidth'],1000*a/det/reg['baseHeight'],1000*(c*ty-d*tx)/det/reg['baseWidth'],1000*(b*tx-a*ty)/det/reg['baseHeight']]
    def xy(p):return ((matrix[0]*p['x']+matrix[2]*p['y']+matrix[4])/1000,(matrix[1]*p['x']+matrix[3]*p['y']+matrix[5])/1000)
    caps=[(p,xy(p)) for p in item['nativeMarks'] if p['kind']=='capture']
    choices=[]
    for l in m['layouts']:
        lc=[p for p in l['marks'] if p['kind']=='capture']
        if {p['label'] for p in lc}!={p['label'] for p,_ in caps} or not caps:continue
        error=max(min(math.dist(q,(p['x'],p['y'])) for p in lc if p['label']==cp['label']) for cp,q in caps)
        choices.append((error,l))
    choices.sort(key=lambda v:v[0])
    if not choices or choices[0][0]>0.025:skip('攻略点位与现有任务布局不匹配');continue
    error,layout=choices[0]
    direction=re.search(r'[上下左右]+(?=方|侧|边|复活|出生)',item['label'])
    if not direction:skip('出生方向待核对');continue
    direction=direction[0];dx=('右' in direction)-('左' in direction);dy=('下' in direction)-('上' in direction)
    centers={}
    for team in (1,2):
        marks=[p for p in layout['marks'] if p['kind']=='spawn' and p['team']==team]
        if marks:centers[team]=(sum(p['x'] for p in marks)/len(marks),sum(p['y'] for p in marks)/len(marks))
    # Diagonal source captions can straddle the center; use the dominant separation axis.
    if dx and dy and len(centers)==2:
        delta_x=abs(centers[1][0]-centers[2][0]);delta_y=abs(centers[1][1]-centers[2][1])
        if delta_y>delta_x:dx=0
        else:dy=0
    scores=sorted(((x*dx+y*dy,t) for t,(x,y) in centers.items()),reverse=True)
    if len(scores)!=2 or scores[0][0]-scores[1][0]<0.05:skip('出生方向与现有任务不匹配');continue
    svg=(source/item['svg']).read_bytes()
    assert hashlib.sha256(svg).hexdigest()==item['svgSha256']
    tree=ET.fromstring(svg)
    for node in tree.iter():
        if node.tag.rsplit('}',1)[-1] not in allowed:raise ValueError('Unsafe SVG element')
        for key,value in node.attrib.items():
            if key.lower().startswith('on') or 'href' in key or '<' in value or re.search(r'url\((?!#[\w-]+\))|javascript:|https?:|data:',value,re.I):raise ValueError('Unsafe SVG attribute')
    text=svg.decode()
    text=text.replace('<svg ',f'<svg width="{item["width"]}" height="{item["height"]}" ',1)
    filename=f'{item["postId"]}-{item["side"]}.svg';(out/filename).write_text(text)
    meta=json.loads((source/item['metadata']).read_text())
    side=meta['sides'][item['side']-1]
    rows.append({**record,'id':f'{item["postId"]}-{item["side"]}','mapId':m['id'],'layoutId':layout['id'],'team':scores[0][1],'label':item['label'],'title':item['title'],'sourceUrl':side.get('sourceUrl') or item['sourceUrl'],'sourceDate':side.get('sourceGuideDate') or '', 'svg':filename,'width':item['width'],'height':item['height'],'matrix':[round(v,9) for v in matrix],'pointError':round(error,6)})
    report.append({**record,'status':'matched','layoutId':layout['id'],'team':scores[0][1],'pointError':round(error,6)})
keys=[(r['mapId'],r['layoutId'],r['team']) for r in rows]
assert len(keys)==len(set(keys)), 'Ambiguous routes for same mission/team'
(root/'data/map-recommendations.json').write_text(json.dumps({'schemaVersion':1,'source':'用户采集攻略的矢量重绘，2026-10-25','routes':rows},ensure_ascii=False,indent=2)+'\n')
p=root/'artifacts/map-recommendations';p.mkdir(parents=True,exist_ok=True);(p/'import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'routes':len(rows),'maps':len(set(r['mapId'] for r in rows)),'unmatched':[r for r in report if r['status']=='unmatched']},ensure_ascii=False))
