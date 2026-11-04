"""Parse public Wiki stock/reference performance and suspended armament, offline.

Only text, allowlisted public URLs and numeric attributes are consumed. No page code
is executed. Crew qualifications not explicitly supplied by the Wiki remain null.
This module is also used by the private host bridge; it contains no server secrets.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
import hashlib
import html
import json
import re
import sys
from pathlib import Path

PARSER_VERSION = 'wiki-performance-loadouts-v3'
GROUND_COMBAT_VERSION = 'wiki-ground-combat-v2'
EQUIPMENT_VERSION = 'wiki-vehicle-equipment-v1'
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

def mass_kg(text):
    for unit, divisor in (('kg',1),('g',1000),('mg',1000000)):
        value = only_number(text,unit)
        if value is not None: return value/divisor
    return None

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
                    else:
                        # A fixed reload (for example an autoloader) is a real
                        # published value, even without crew qualification ends.
                        # Do not extrapolate it to expert/ace qualifications.
                        endpoint['stock'] = endpoint['spaded'] = number(raw)
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

def explicit_value(node):
    yes = bool(node.find(lambda n:n.cls('bi-check-circle-fill') or n.cls('bi-check-lg')))
    no = bool(node.find(lambda n:n.cls('bi-x-circle-fill') or n.cls('bi-x-lg')))
    if node.text: return ('Yes · ' if yes else 'No · ' if no else '')+node.text
    if yes: return 'Yes'
    if no: return 'No'
    return None

def vehicle_equipment(doc, uid, proof):
    result = {**provenance(uid,proof), 'parserVersion':EQUIPMENT_VERSION,
              'status':'not_provided','features':[],'properties':[],'optics':[]}
    seen = set()
    for node in doc.all(lambda n:'data-feature-popover' in n.attrs and
                        (n.cls('game-unit_feature') or n.cls('gunit_specs-table_btn'))):
        pop = Document(node.attrs['data-feature-popover']).root
        header = pop.find(lambda n:n.cls('game-unit_popover-header'))
        if not header: continue
        weapon = node.ancestor('game-unit_weapon')
        weapon_title = weapon.find(lambda n:n.cls('game-unit_weapon-title')) if weapon else None
        # Optics cells are represented with explicit crew positions below.
        if node.ancestor('gunit_specs-table'): continue
        link = pop.find(lambda n:n.tag=='a' and n.attrs.get('href','').startswith('/collections/feature/'))
        source = official_url(link.attrs['href']) if link else None
        kind = source.rsplit('/',1)[-1] if source else re.sub(r'[^a-z0-9]+','-',header.text.lower()).strip('-')
        context = weapon_title.text if weapon_title else None
        identity = header.text+'\0'+(context or '')
        if identity in seen: continue
        seen.add(identity)
        parameters, scope = [], ''
        for row in pop.all(lambda n:n.cls('game-unit_chars-line') or n.cls('game-unit_chars-subline')):
            value = row.find(lambda n:n.cls('game-unit_chars-value'))
            cells = [c for c in row.children if isinstance(c,Node)]
            if not value or not cells: continue
            label = cells[0].text
            if label in ('Radar','Optical Detection'): scope = label
            local_scope = ''
            for sibling in row.parent.children:
                if sibling is row: break
                if isinstance(sibling,Node):
                    if sibling.tag=='hr': local_scope=''
                    elif sibling.cls('form-text') and sibling.text in ('Cannons','Rockets','Bombs','Missiles'):
                        local_scope=sibling.text
            current_scope = local_scope or scope
            content = explicit_value(value)
            if not content: continue
            ident = re.sub(r'[^a-z0-9]+','-',(current_scope+' '+label if current_scope and label!=current_scope else label).lower()).strip('-')
            if any(p['id']==ident for p in parameters): ident += '-'+str(len(parameters))
            parameters.append({'id':ident,'label':current_scope+' · '+label if current_scope and label!=current_scope else label,'value':content})
        # Features often put a compact value grid in the popup (thermal optics).
        grids = {id(row.parent):row.parent for row in pop.all(lambda n:n.cls('gunit_specs-table_row'))}
        for grid in grids.values():
            rows = [c for c in grid.children if isinstance(c,Node) and c.cls('gunit_specs-table_row')]
            if len(rows)<2: continue
            columns = [c.text for c in rows[0].children if isinstance(c,Node)]
            for row in rows[1:]:
                cells = [c for c in row.children if isinstance(c,Node)]
                if len(cells)!=len(columns): continue
                for title,cell in zip(columns,cells):
                    if title and cell.text and cell.text not in ('—','-'):
                        parameters.append({'id':'grid-'+str(len(parameters)), 'label':title, 'value':cell.text})
        result['features'].append({'id':hashlib.sha256(identity.encode()).hexdigest()[:16],
                                   'kind':kind,'name':header.text,'weaponName':context,'source':source,'parameters':parameters})
    fixed = {'Crew','Engine','Length','Wingspan','Wing Loading','Fuel in main tanks','Fuel in drop tanks',
             'Max Speed Limit (IAS)','Mach Number Limit','G limit','Flap Speed Limit (IAS)',
             'Gear Speed Limit (IAS)','Visibility','First-order','Vertical guidance'}
    for row in doc.all(lambda n:n.cls('game-unit_chars-line')):
        if row.ancestor('game-unit_weapon'): continue
        header = row.find(lambda n:n.cls('game-unit_chars-header'))
        value = row.find(lambda n:n.cls('game-unit_chars-value'))
        if not header or header.text not in fixed or not value or not value.text: continue
        if value.find(lambda n:any(c.startswith('show-char-') for c in n.attrs.get('class','').split())): continue
        ident = re.sub(r'[^a-z0-9]+','-',header.text.lower()).strip('-')
        if any(p['id']==ident for p in result['properties']): continue
        result['properties'].append({'id':ident,'label':header.text,'value':value.text})
    for grid in doc.all(lambda n:n.cls('gunit_specs-table')):
        rows = grid.all(lambda n:n.cls('gunit_specs-table_row'))
        if not rows: continue
        headings = [c.text for c in rows[0].children if isinstance(c,Node)]
        if not any(h in ('Gunner','Commander','Driver') for h in headings): continue
        for index,title in enumerate(headings):
            values = []
            for row in rows[1:]:
                cells = [c for c in row.children if isinstance(c,Node)]
                if index < len(cells) and cells[index].text not in ('','—','-'): values.append(cells[index].text)
                if index < len(cells):
                    for popup in cells[index].all(lambda n:'data-feature-popover' in n.attrs):
                        inner = Document(popup.attrs['data-feature-popover']).root
                        content = inner.find(lambda n:n.cls('game-unit_popover-content'))
                        if not content: continue
                        subgrids = {id(line.parent):line.parent for line in content.all(lambda n:n.cls('gunit_specs-table_row'))}
                        for subgrid in subgrids.values():
                            subrows = [c for c in subgrid.children if isinstance(c,Node) and c.cls('gunit_specs-table_row')]
                            if len(subrows)<2: continue
                            headers = [c.text for c in subrows[0].children if isinstance(c,Node)]
                            if title not in headers: continue
                            pos = headers.index(title)
                            for line in subrows[1:]:
                                parts = [c for c in line.children if isinstance(c,Node)]
                                if pos<len(parts) and parts[pos].text not in ('','—','-'): values.append('Optics resolution '+parts[pos].text)
            if title and values: result['optics'].append({'id':title.lower(),'label':title,'value':' · '.join(dict.fromkeys(values))})
    if result['features'] or result['properties'] or result['optics']: result['status']='available'
    return result

def ground_combat(doc, uid, proof, metrics=None):
    if metrics is None: metrics = performance(doc,uid,proof)['metrics']
    result = {**provenance(uid, proof), 'parserVersion': GROUND_COMBAT_VERSION,
              'status': 'not_provided', 'armorStatus': 'not_provided',
              'weaponsStatus': 'not_provided', 'armor': [], 'weapons': [],
              'armorTypes': [], 'equivalentArmorStatus': 'not_provided'}
    for node in doc.all(lambda n:n.cls('game-unit_feature') and 'data-feature-popover' in n.attrs):
        pop = Document(node.attrs['data-feature-popover']).root
        header = pop.find(lambda n:n.cls('game-unit_popover-header'))
        if header and re.search(r'armou?r',header.text,re.I) and header.text not in result['armorTypes']:
            result['armorTypes'].append(header.text)
    for block in doc.all(lambda n:n.cls('game-unit_chars-block')):
        header = block.find(lambda n:n.cls('game-unit_chars-header'))
        if not header or header.text not in ('Armour', 'Armor'): continue
        for row in block.children:
            if not isinstance(row, Node) or not row.cls('game-unit_chars-subline'): continue
            cells = [n for n in row.children if isinstance(n,Node)]
            value = row.find(lambda n:n.cls('game-unit_chars-value'))
            if not cells or not value or cells[0].text not in ('Hull','Turret'): continue
            parts = re.sub(r'\s*mm\s*$', '', value.text).split('/')
            if len(parts) != 3:
                result['armorStatus'] = 'parse_failed'
                continue
            ident = cells[0].text.lower()
            result['armor'].append({'id':ident, 'label':{'hull':'车体','turret':'炮塔'}[ident],
                                    'front':parts[0].strip(), 'side':parts[1].strip(),
                                    'rear':parts[2].strip()})
    if result['armor'] and result['armorStatus'] != 'parse_failed': result['armorStatus'] = 'available'
    for wi, weapon in enumerate(doc.all(lambda n:n.cls('game-unit_weapon'))):
        title = weapon.find(lambda n:n.cls('game-unit_weapon-title'))
        if not title: continue
        current = {'id':f'weapon-{wi+1}', 'name':title.text, 'ammunition':None, 'shells':[],
                   'reload':next((m for m in metrics if m.get('weaponName') == title.text and re.fullmatch(r'reload(?:-\d+)?',m['id'])),None)}
        for line in weapon.all(lambda n:n.cls('game-unit_chars-line')):
            header = line.find(lambda n:n.cls('game-unit_chars-header'))
            value = line.find(lambda n:n.cls('game-unit_chars-value'))
            if header and value and header.text == 'Ammunition':
                count = re.match(r'^([\d,]+)\s+(?:rounds?|missiles?|rockets?)$',value.text)
                if count: current['ammunition'] = int(count[1].replace(',',''))
        for table in weapon.all(lambda n:n.cls('game-unit_belt-list')):
            rows = table.all(lambda n:n.tag=='tr')
            if len(rows)<2: continue
            distances = [only_number(c.text,'m') for c in rows[1].children if isinstance(c,Node) and c.tag=='th']
            if not distances or any(d is None for d in distances):
                result['weaponsStatus'] = 'parse_failed'
                continue
            is_belt = 'Belt filling' in rows[0].text
            for row in rows[2:]:
                cells = [n for n in row.children if isinstance(n,Node) and n.tag=='td']
                if len(cells) != len(distances)+2:
                    result['weaponsStatus'] = 'parse_failed'
                    continue
                name, kind = cells[0].text, 'belt' if is_belt else cells[1].text
                if not name: continue
                button = cells[0].find(lambda n:'data-feature-popover' in n.attrs)
                pop = Document(button.attrs['data-feature-popover']).root if button else None
                parameters, angles = [], []
                if pop:
                    for line in pop.all(lambda n:n.cls('game-unit_chars-line')):
                        head = line.find(lambda n:n.cls('game-unit_chars-header'))
                        value = line.find(lambda n:n.cls('game-unit_chars-value'))
                        if head and value and head.text and value.text:
                            parameters.append({'id':re.sub(r'[^a-z0-9]+','-',head.text.lower()).strip('-'),
                                               'label':PARAM_LABELS.get(head.text,head.text), 'value':value.text})
                    for detail in pop.all(lambda n:'data-bs-content' in n.attrs):
                        inner = Document(html.unescape(detail.attrs['data-bs-content'])).root
                        for grid in inner.all(lambda n:n.tag=='table'):
                            lines = grid.all(lambda n:n.tag=='tr')
                            if not lines: continue
                            headings = [c for c in lines[0].children if isinstance(c,Node) and c.tag=='th']
                            degrees = [only_number(c.text,'°') for c in headings[1:]]
                            if not degrees or any(a is None for a in degrees): continue
                            for line in lines[1:]:
                                values = [c for c in line.children if isinstance(c,Node) and c.tag in ('th','td')]
                                if len(values)!=len(degrees)+1: continue
                                distance = only_number(values[0].text,'m')
                                if distance is None: continue
                                angles.extend({'distanceM':distance,'angleDeg':angle,'mm':number(value.text)}
                                              for angle,value in zip(degrees,values[1:]))
                base = pop.find(lambda n:n.cls('game-unit_b-icon_base')) if pop else None
                image = base.find(lambda n:n.tag=='img' and official_url(n.attrs.get('src'),True)) if base else None
                lookup = {p['id']:p['value'] for p in parameters}
                caliber = only_number(lookup.get('caliber',''),'mm')
                if caliber is None:
                    nominal = re.search(r'([\d,.]+)\s+mm\b', title.text)
                    if nominal: caliber = number(nominal[1])
                ident = hashlib.sha256((title.text+'\0'+name+'\0'+kind).encode()).hexdigest()[:16]
                current['shells'].append({'id':ident, 'name':name, 'type':kind,
                    'beltFilling':cells[1].text if is_belt else None,
                    'imageUrl':official_url(image.attrs['src'],True) if image else None,
                    'caliberMm':caliber,
                    'velocityMps':only_number(lookup.get('muzzle-velocity',''),'m/s'),
                    'massKg':mass_kg(lookup.get('projectile-mass','')),
                    'tntKg':mass_kg(lookup.get('tnt-equivalent','')),
                    'parameters':parameters, 'penetration':[
                        {'distanceM':d,'mm':number(c.text)} for d,c in zip(distances,cells[2:])],
                    'penetrationAngles':angles})
        # Weapon entries without penetration tables are still real armament.
        result['weapons'].append(current)
    if any(w['shells'] for w in result['weapons']) and result['weaponsStatus']!='parse_failed':
        result['weaponsStatus'] = 'available'
    result['status'] = 'parse_failed' if 'parse_failed' in (result['armorStatus'],result['weaponsStatus']) else (
        'available' if result['armor'] or any(w['shells'] for w in result['weapons']) else 'not_provided')
    return result

def loadouts(doc, uid, proof, category):
    result={**provenance(uid,proof),'status':'not_provided','limits':[],'presets':[],'hardpoints':[],'compatibility':[], 'rulesSchemaVersion':1, 'rules':[], 'constraintNotes':[]}
    rule_file = Path(__file__).resolve().parents[1] / 'data/loadout-rules.json'
    registry = json.loads(rule_file.read_text())
    if registry.get('schemaVersion') != 1:
        raise ValueError('Unsupported loadout rule registry')
    result['rules'] = registry.get('vehicles', {}).get(uid, [])
    if category not in ('aviation','helicopters'):
        result['status']='not_applicable'; return result
    header=doc.find(lambda n:n.cls('block-header') and n.text=='Suspended armament')
    if not header:
        # Absence is not evidence that the aircraft can carry nothing.
        explicit=doc.find(lambda n:'has no suspended armament' in n.text.lower() and len(n.text)<250)
        result['status']='none' if explicit else 'not_provided'; return result
    section=header.parent
    # Preserve explicit constraint prose for review; absence is not permission.
    for note in section.all(lambda n:n.tag in ('p','li') and not n.find(lambda c:'data-feature-popover' in c.attrs)):
        if len(note.text) <= 3000 and re.search(r'cannot|incompatib|mutually|requires?|occupies|blocked', note.text, re.I):
            if note.text not in result['constraintNotes']:
                result['constraintNotes'].append(note.text)
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
    result = {'performance':performance(doc,uid,proof),'loadouts':loadouts(doc,uid,proof,category)}
    result['performance']['equipment'] = vehicle_equipment(doc,uid,proof)
    if category == 'ground':
        result['performance']['groundCombat'] = ground_combat(doc,uid,proof,result['performance']['metrics'])
        if result['performance']['groundCombat']['status'] == 'parse_failed':
            result['performance']['status'] = 'parse_failed'
    return result

if __name__=='__main__':
    value=json.load(sys.stdin)
    print(json.dumps(parse_reference(value['html'],value['vehicleId'],value['category'],value['proof']),ensure_ascii=False,separators=(',',':')))
