"""Typeset the supplied community calendar in high resolution (Pillow==11.3.0).
Run: uv run --no-project --with pillow==11.3.0 python scripts/render-sale-calendar-reference.py
"""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
from itertools import groupby
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'data/sale-calendar-reference.json').read_text())
OUT=ROOT/'artifacts/sales-calendar/reference';OUT.mkdir(parents=True,exist_ok=True)
W=2520;PAD=100;GAP=28
FONT='/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'
colors={'page':'#171e24','surface':'#242e37','alt':'#202a33','ink':'#edf0ee','muted':'#b8c2c9','gold':'#e6c578','line':'#4c5a65'}
im=Image.new('RGB',(W,4500),colors['page']);draw=ImageDraw.Draw(im)
@lru_cache(maxsize=64)
def font(size,latin=False):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf' if latin else FONT,size)
def runs(value,size):
 return [("".join(chars),font(size,latin)) for latin,chars in groupby(value,lambda c:ord(c)<0x2e80)]
def measure(value,size):return sum(draw.textlength(chars,font=f) for chars,f in runs(value,size))
def text(x,y,value,size=32,fill='ink'):
 for chars,f in runs(value,size):
  draw.text((x,y+size),chars,font=f,fill=colors.get(fill,fill),anchor='ls')
  x+=draw.textlength(chars,font=f)
def wrap(value,width,size):
 lines=['']
 for char in value:
  if char=='\n':lines.append('');continue
  if measure(lines[-1]+char,size)>width and lines[-1]:lines.append(char)
  else:lines[-1]+=char
 return lines
def paragraph(x,y,value,width,size=32,fill='muted',leading=15):
 for line in wrap(value,width,size):text(x,y,line,size,fill);y+=size+leading
 return y

def section(y,num,title):
 text(PAD,y,num,30,'gold');text(PAD+76,y-7,title,46);return y+76

def table(y,headers,rows,widths):
 x=PAD;hh=74
 for i,h in enumerate(headers):
  draw.rectangle((x,y,x+widths[i],y+hh),fill=colors['surface']);text(x+20,y+18,h,29,'gold');x+=widths[i]
 y+=hh
 for ri,row in enumerate(rows):
  h=max(len(wrap(value,widths[i]-40,29)) for i,value in enumerate(row))*44+36
  x=PAD
  for i,value in enumerate(row):
   draw.rectangle((x,y,x+widths[i],y+h),fill=colors['alt' if ri%2==0 else 'surface'])
   paragraph(x+20,y+18,value,widths[i]-40,29,'gold' if value in ['5折','7折','半价'] else 'ink')
   if i:draw.line((x,y,x,y+h),fill=colors['line'],width=1)
   x+=widths[i]
  draw.line((PAD,y+h,W-PAD,y+h),fill=colors['line'],width=1);y+=h
 return y
text(PAD,82,'WAR THUNDER  /  COMMUNITY SALE GUIDE',27,'gold')
text(PAD,145,data['title'],80)
text(PAD,255,data['subtitle'],32,'muted')
y=330
draw.rounded_rectangle((PAD,y,W-PAD,y+102),radius=10,fill=colors['surface'])
text(PAD+26,y+26,data['notice'],35,'gold');y+=153
y=section(y,'01','全系固定活动 · 历史常见折扣')
y=table(y,data['regularHeaders'],data['regularRows'],[330,620,390,280,330,370])+22
y=paragraph(PAD,y,data['regularNote'],W-2*PAD,30)+54
y=section(y,'02','参与条件与购入提醒')
for title,body in data['rules']:
 text(PAD,y,title,35,'gold');y+=57
 y=paragraph(PAD,y,body,W-2*PAD,32)+25
y+=22
y=section(y,'03','国家与纪念日专题 · 历史时间窗口')
y=table(y,data['nationalHeaders'],data['nationalRows'],[430,740,1150])+28
for note in data['nationalNotes']:
 y=paragraph(PAD,y,'· '+note,W-2*PAD,32)+15
y+=32
draw.line((PAD,y,W-PAD,y),fill=colors['line'],width=2);y+=34
y=paragraph(PAD,y,data['attribution']+' · 高清重绘',W-2*PAD,32,'gold')+15
y=paragraph(PAD,y,data['correction'],W-2*PAD,27)+20
y=paragraph(PAD,y,'历史整理不代表本年度的活动承诺。具体开始、结束、折扣力度、平台和参与名单，以官方公布为准。',W-2*PAD,27)+60
im=im.crop((0,0,W,y));output=OUT/'war-thunder-sale-calendar-hd.png';im.save(output,optimize=True)
print(json.dumps({'path':str(output),'width':W,'height':y,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
