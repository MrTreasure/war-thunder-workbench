"""Parse public Wiki stock/reference performance and suspended armament, offline.

Only text, allowlisted public URLs and numeric attributes are consumed. No page code
is executed. Crew qualifications not explicitly supplied by the Wiki remain null.
This module is also used by the private host bridge; it contains no server secrets.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
import hashlib
import json
import re
import sys

PARSER_VERSION = 'wiki-performance-loadouts-v3'
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
NUM = re.compile(r'^[−-]?\d[\d,]*(?:\.\d+)?$')

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    @property
    def text(self):
        return ' '.join(''.join(c if isinstance(c, str) else c.text for c in self.children).split())
    def cls(self, name):
        return name in self.attrs.get('class', '').split()
    def all(self, predicate):
        out = []
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child): out.append(child)
                out.extend(child.all(predicate))
        return out
    def find(self, predicate):
        return next(iter(self.all(predicate)), None)
    def ancestor(self, cls):
        parent = self.parent
        while parent:
            if parent.cls(cls): return parent
            parent = parent.parent
        return None

class Document(HTMLParser):
    def __init__(self, body):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(body)
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID: self.stack.append(node)
    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break
    def handle_data(self, data):
        self.stack[-1].children.append(data)

# Descriptive names are presentation metadata, not vehicle-specific values.
LABELS = {
    'Max speed': ('max-speed', '最大速度', 'km/h'),
    'Power-to-weight ratio': ('power-to-weight', '功重比', 'hp/t'),
    'Engine power': ('engine-power', '发动机功率', 'hp'),
    'Weight': ('weight', '重量', 't'),
    'Base weight': ('base-weight', '基础重量', 't'),
    'Rate of Climb': ('climb-rate', '爬升率', 'm/s'),
    'Turn time': ('turn-time', '盘旋时间', 's'),
    'Takeoff Run': ('takeoff-run', '起飞滑跑距离', 'm'),
    'Max altitude': ('max-altitude', '实用升限', 'm'),
    'Reload': ('reload', '装填时间', 's'),
    'Turret Rotation Speed': ('turret-rotation', '炮塔转速', '°/s'),
    'Fire rate': ('fire-rate', '射速', 'shots/min'),
    'One-second Burst Mass': ('burst-mass', '首秒投射质量', 'kg'),
}
SUBLABELS = {'Forward': ('forward','前进'), 'Backward': ('backward','后退'),
             'Horizontal': ('horizontal','水平'), 'Vertical': ('vertical','垂直')}
LIMITS = {'Max weight': ('max-weight','总挂载上限'), 'Maximum': ('wing-maximum','单侧翼载重上限'),
          'Max. difference': ('wing-max-difference','两翼载重差上限')}
PARAM_LABELS = {'Projectile Mass':'弹体质量','Guidance':'制导方式','Aspect':'导引角度',
                'Lock range in rear-aspect':'尾追锁定距离','Lock range in all-aspect':'全向锁定距离',
                'Launch range':'发射距离','Maximum speed':'最大速度','Maximum overload':'最大过载',
                'Missile guidance time':'制导时间','Explosive Type':'装药类型','Explosive Mass':'装药量',
                'TNT equivalent':'TNT当量','Band':'波段','Caliber':'口径','Fire rate':'射速',
                'Ammunition':'弹药数量','Armor penetration':'穿甲能力','Armour penetration':'穿甲能力',
                'Rate of fire':'射速','Shoot down':'可被拦截','Lock range':'锁定距离','Firing range':'射程','Maximum flight time':'最大飞行时间','Maximum launch range':'最大发射距离'}

def number(text):
    text = text.strip().replace('\xa0','')
    if not NUM.fullmatch(text): return None
    value = float(text.replace(',','').replace('−','-'))
    return int(value) if value.is_integer() else value

def only_number(text, unit):
    text = re.sub(r'\s*' + re.escape(unit) + r'\s*$', '', text).strip()
    return number(text)

def official_url(value, image=False):
    value = urljoin('https://wiki.warthunder.com', value or '')
    url = urlparse(value)
    hosts = {'static.encyclopedia.warthunder.com','staticfiles.warthunder.com'} if image else {'wiki.warthunder.com'}
    return value if url.scheme == 'https' and url.hostname in hosts and not url.username and not url.password and not url.port else None

def provenance(uid, proof):
    return {'schemaVersion':1,'vehicleId':uid,'source':proof['url'],'checkedAt':proof['checkedAt'],
            'htmlSha256':proof['sha256'],'parserVersion':PARSER_VERSION}

def performance(doc, uid, proof):
    metrics, seen = [], {}
    weapon_indices = {id(weapon):index+1 for index,weapon in enumerate(doc.all(lambda n:n.cls('game-unit_weapon')))}
    for block in doc.all(lambda n:n.cls('game-unit_chars-block')):
        # All values and rows must belong to this block, never nested popovers.
        header = block.find(lambda n:n.cls('game-unit_chars-header'))
        if not header or header.text not in LABELS: continue
        base_id, base_label, unit = LABELS[header.text]
        crew_endpoints = bool(block.find(lambda n:n.cls('game-unit_chars-info') and 'basic crew' in n.text.lower() and 'aces' in n.text.lower()))
        crew = crew_endpoints or base_id in ('reload','turret-rotation')
        weapon = block.ancestor('game-unit_weapon')
        weapon_title = weapon.find(lambda n:n.cls('game-unit_weapon-title')) if weapon else None
        for row in [c for c in block.children if isinstance(c,Node) and (c.cls('game-unit_chars-line') or c.cls('game-unit_chars-subline'))]:
            value = row.find(lambda n:n.cls('game-unit_chars-value'))
            if not value: continue
            own_header = row.find(lambda n:n.cls('game-unit_chars-header'))
            spans = [n for n in row.children if isinstance(n,Node)]
            subtext = spans[0].text if spans and spans[0] != value else ''
            metric_id, label, current_unit = base_id, base_label, unit
            if own_header and own_header.text in LABELS:
                metric_id, label, current_unit = LABELS[own_header.text]
            elif subtext in LABELS:
                metric_id, label, current_unit = LABELS[subtext]
            elif subtext in SUBLABELS:
                suffix, zh = SUBLABELS[subtext]; metric_id += '-'+suffix; label += ' · '+zh
            elif re.fullmatch(r'at [\d,]+ m',subtext,re.I):
                pass
            elif subtext and subtext not in ('',header.text):
                # Rows such as ammunition and RPM under Reload have different units.
                continue
            if current_unit not in value.text: continue
            modes = {}
            raw_classes = value.all(lambda n:any(c.startswith('show-char-') for c in n.attrs.get('class','').split()))
            for mode in ('ab','rb'):
                endpoint = {'stock':None,'spaded':None,'expert':None,'ace':None}
                if raw_classes:
                    grouped = {}
                    for part in raw_classes:
                        cls = next((c for c in part.attrs.get('class','').split() if c.startswith('show-char-'+mode)),None)
                        if not cls: continue
                        n = number(part.text)
                        if n is not None: grouped.setdefault(cls,[]).append(n)
                    basic, ref, fixed = (grouped.get('show-char-'+mode+s,[]) for s in ('-mod-basic','-mod-ref',''))
                    endpoint['stock'] = basic[0] if basic else fixed[0] if fixed else None
                    endpoint['spaded'] = ref[0] if ref else fixed[0] if fixed else None
                    if crew_endpoints:
                        endpoint['ace'] = ref[-1] if len(ref)==2 else fixed[-1] if len(fixed)==2 else None
                    elif not crew:
                        endpoint['expert'] = endpoint['spaded']; endpoint['ace'] = endpoint['spaded']
                else:
                    raw = re.sub(r'\s*'+re.escape(current_unit)+r'\s*$','',value.text).strip()
                    if crew_endpoints and '→' in raw:
                        ends = raw.split('→')
                        if len(ends)==2:
                            endpoint['stock']=endpoint['spaded']=number(ends[0]);endpoint['ace']=number(ends[1])
                    elif not crew:
                        n = number(raw)
                        endpoint = {key:n for key in endpoint}
                modes[mode] = endpoint
            if all(all(v is None for v in m.values()) for m in modes.values()): continue
            if weapon_title:
                label += ' · 武器' + str(weapon_indices[id(weapon)])
            direction_id = metric_id
            index = seen.get(metric_id,0); seen[metric_id] = index+1
            metric_id = metric_id + ('-'+str(index+1) if index else '')
            altitude = None
            info = block.find(lambda n:n.cls('game-unit_chars-info'))
            alt = re.search(r'at\s+([\d,]+)\s*m',subtext,re.I) or (re.search(r'at\s+([\d,]+)\s*m',info.text,re.I) if info else None)
            if alt: altitude = int(alt[1].replace(',',''))
            metrics.append({'id':metric_id,'label':label,'unit':current_unit,'altitudeM':altitude,'crewDependent':crew,
                            'modes':modes,'direction':'lower' if direction_id in ('reload','turn-time') else 'higher' if direction_id in ('max-speed','max-speed-forward','max-speed-backward','power-to-weight','engine-power','climb-rate','turret-rotation-horizontal','turret-rotation-vertical','fire-rate','burst-mass') else None,
                            'weaponName':weapon_title.text if weapon_title else None,'sourceBasis':{
                                'stock':('Wiki Basic；基础乘员组' if crew_endpoints else 'Wiki Basic；乘员条件未注明') if crew else 'Wiki Basic；乘员不影响此项',
                                'spaded':('Wiki Reference；基础乘员组' if crew_endpoints else 'Wiki Reference；乘员条件未注明') if crew else 'Wiki Reference；乘员不影响此项',
                                'expert':None if crew else '与完全体相同；乘员资格不影响此项',
                                'ace':('Wiki Reference；aces端点，技能条件未拆分' if crew_endpoints else None) if crew else '与完全体相同；乘员资格不影响此项'}})
    return {**provenance(uid,proof),'status':'available' if metrics else 'not_provided','metrics':metrics}

def weapon_parameters(popover):
    if not popover: return None,None,[]
    doc=Document(popover).root
    link=doc.find(lambda n:n.tag=='a' and n.attrs.get('href','').startswith('/collections/weapon/'))
    source=official_url(link.attrs.get('href')) if link else None
    weapon_id=source.rsplit('/',1)[-1] if source else None
    parameters=[]
    for row in doc.all(lambda n:n.cls('game-unit_chars-line')):
        h=row.find(lambda n:n.cls('game-unit_chars-header'));v=row.find(lambda n:n.cls('game-unit_chars-value'))
        if h and v and h.text and v.text:
            parameters.append({'id':re.sub(r'[^a-z0-9]+','-',h.text.lower()).strip('-'),
                               'label':PARAM_LABELS.get(h.text,h.text),'value':v.text})
    return weapon_id,source,parameters

def loadouts(doc, uid, proof, category):
    result={**provenance(uid,proof),'status':'not_provided','limits':[],'presets':[],'hardpoints':[],'compatibility':[]}
    if category not in ('aviation','helicopters'):
        result['status']='not_applicable'; return result
    header=doc.find(lambda n:n.cls('block-header') and n.text=='Suspended armament')
    if not header:
        # Absence is not evidence that the aircraft can carry nothing.
        explicit=doc.find(lambda n:'has no suspended armament' in n.text.lower() and len(n.text)<250)
        result['status']='none' if explicit else 'not_provided'; return result
    section=header.parent
    for line in section.all(lambda n:n.cls('game-unit_chars-line') or n.cls('game-unit_chars-subline')):
        value=line.find(lambda n:n.cls('game-unit_chars-value'))
        nodes=[c for c in line.children if isinstance(c,Node)]
        key=nodes[0].text if nodes else ''
        if value and key in LIMITS:
            ident,label=LIMITS[key]; n=only_number(value.text,'kg')
            if n is not None:result['limits'].append({'id':ident,'label':label,'value':n,'unit':'kg'})
    tables=section.all(lambda n:n.cls('game-unit_slot-list'))
    if not tables:
        for row in section.all(lambda n:n.cls('game-unit_chars-line')):
            heading=row.find(lambda n:n.cls('game-unit_chars-header'))
            value=row.find(lambda n:n.cls('game-unit_chars-value'))
            if not heading or not value or not re.fullmatch(r'Setup \d+',heading.text):continue
            items=[]
            for node in value.all(lambda n:'data-feature-popover' in n.attrs):
                weapon_id,source,parameters=weapon_parameters(node.attrs['data-feature-popover'])
                preceding=''
                for sibling in node.parent.children:
                    if sibling is node:break
                    preceding += sibling if isinstance(sibling,str) else sibling.text
                count_match=re.search(r'(\d+)\s*×\s*$',preceding)
                count=int(count_match[1]) if count_match else 1
                if not node.text:continue
                items.append({'name':node.text,'count':count,'weaponId':weapon_id,'source':source,'imageUrl':None,'parameters':parameters,'weightKg':None})
            if items:
                result['presets'].append({'id':'setup-'+heading.text.split()[-1],'label':'挂载方案 '+heading.text.split()[-1],'items':items})
        result['status']='available' if result['presets'] else 'parse_failed'
        return result
    try:
        for table_index,table in enumerate(tables):
            rows=table.all(lambda n:n.tag=='tr')
            head=next((r for r in rows if any(isinstance(c,Node) and c.tag=='th' for c in r.children)),None)
            colspan=next((int(c.attrs['colspan']) for c in head.children if isinstance(c,Node) and c.tag=='th' and 'colspan' in c.attrs),None) if head else None
            data=[r for r in rows if any(isinstance(c,Node) and c.tag=='td' for c in r.children)]
            if not data or colspan is None or not 0<colspan<=64: raise ValueError('Missing hardpoint heading')
            points=[{'id':f't{table_index+1}-s{i+1}','label':str(i+1),'side':None} for i in range(colspan)]
            for index,row in enumerate(data):
                cells=[c for c in row.children if isinstance(c,Node) and c.tag=='td']
                if len(cells)!=colspan+2: raise ValueError('Hardpoint column mismatch')
                name=cells[0].text
                if not name:raise ValueError('Missing weapon name')
                count_match=re.match(r'^(\d+)\s*×\s*',name)
                count=int(count_match[1]) if count_match else 1
                button=cells[0].find(lambda n:'data-feature-popover' in n.attrs)
                weapon_id,source,parameters=weapon_parameters(button.attrs['data-feature-popover'] if button else None)
                stations=[];image_url=None
                for slot,cell in enumerate(cells[2:]):
                    style=cell.attrs.get('style','')
                    if 'var(--bs-blue)' in style:points[slot]['side']='left'
                    elif 'solid red' in style:points[slot]['side']='right'
                    elif 'solid gray' in style:points[slot]['side']='center'
                    image=cell.find(lambda n:n.tag=='img' and official_url(n.attrs.get('src'),True))
                    if image:
                        url=official_url(image.attrs['src'],True)
                        stations.append({'hardpointId':points[slot]['id'],'count':count})
                        if image_url is None:image_url=url
                weight=only_number(cells[1].text,'kg')
                result['compatibility'].append({'optionId':f't{table_index+1}-o{index+1}','weaponId':weapon_id,'name':name,
                      'count':count,'source':source,'imageUrl':image_url,'weightKg':weight,'stations':stations,'parameters':parameters})
            result['hardpoints'].extend(points)
        result['status']='available'
    except (ValueError,KeyError,TypeError):
        result['status']='parse_failed'
    return result

def parse_reference(body, uid, category, proof):
    if isinstance(body,bytes):body=body.decode('utf-8')
    if not re.fullmatch('[A-Za-z0-9_-]+',uid):raise ValueError('Invalid vehicle ID')
    digest=hashlib.sha256(body.encode()).hexdigest()
    if digest != proof['sha256']:raise ValueError('Page SHA-256 mismatch')
    if not proof.get('checkedAt') or proof.get('url')!='https://wiki.warthunder.com/unit/'+uid:raise ValueError('Missing page provenance')
    doc=Document(body).root
    if not doc.find(lambda n:n.cls('game-unit_card')):raise ValueError('Missing vehicle card')
    return {'performance':performance(doc,uid,proof),'loadouts':loadouts(doc,uid,proof,category)}

if __name__=='__main__':
    value=json.load(sys.stdin)
    print(json.dumps(parse_reference(value['html'],value['vehicleId'],value['category'],value['proof']),ensure_ascii=False,separators=(',',':')))
