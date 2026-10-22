"""Redraw the supplied table with fresh type and rules, never enlarged source pixels.

uv run --no-project --with pillow==11.3.0 python scripts/render-sale-calendar-reference.py
Text, merged cells, emphasis and geometry: data/sale-calendar-reference-layout.json.
The OFL font downloads into ignored artifacts; every render verifies its SHA256.
"""
from functools import lru_cache
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib
import json
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
layout = json.loads((ROOT / 'data/sale-calendar-reference-layout.json').read_text())
out = ROOT / 'artifacts/sales-calendar/reference'
out.mkdir(parents=True, exist_ok=True)
font_path = out / 'fonts/LXGWWenKai-Regular.ttf'
font_path.parent.mkdir(parents=True, exist_ok=True)
if not font_path.exists():
    request = Request(layout['font']['url'], headers={'User-Agent': 'WarThunderWorkbench/1.0'})
    with urlopen(request, timeout=90) as response:
        body = response.read(30 * 1024 * 1024 + 1)
    if hashlib.sha256(body).hexdigest() != layout['font']['sha256']:
        raise ValueError('Downloaded font hash mismatch')
    font_path.write_bytes(body)
if hashlib.sha256(font_path.read_bytes()).hexdigest() != layout['font']['sha256']:
    raise ValueError('Cached font hash mismatch')

scale = layout['scale']
width, height = [round(value * scale) for value in layout['canvas']]
colors = layout['colors']
canvas = Image.new('RGB', (width, height), colors['white'])
draw = ImageDraw.Draw(canvas)

@lru_cache(maxsize=256)
def font(size):
    return ImageFont.truetype(str(font_path), size)

def spans(line, default_color, default_bold):
    color, bold = default_color, default_bold
    for item in re.split(r'(</?(?:r|blue|b)>)', line):
        if item == '<r>': color = colors['red']
        elif item == '<blue>': color = colors['blue']
        elif item in ('</r>', '</blue>'): color = default_color
        elif item == '<b>': bold = True
        elif item == '</b>': bold = default_bold
        elif item: yield item, color, bold

for cell in layout['cells']:
    box = tuple(round(value * scale) for value in cell['box'])
    draw.rectangle(box, fill=colors[cell['fill']])
# Merged cells have no hidden internal rules.
for cell in layout['cells']:
    box = tuple(round(value * scale) for value in cell['box'])
    draw.rectangle(box, outline=colors['grid'], width=round(1.3 * scale))

minimum_size = 1000
text_blocks = [block for cell in layout['cells'] for block in cell.get('textBlocks', [cell])]
for index, cell in enumerate(text_blocks):
    x1, y1, x2, y2 = [round(value * scale) for value in cell['box']]
    pad = 3 * scale
    available_width, available_height = x2 - x1 - 2 * pad, y2 - y1 - 2 * pad
    default_color = colors['white'] if cell['fill'] == 'header' else colors['ink']
    lines = [list(spans(line, default_color, cell['bold'])) for line in cell['text'].split('\n')]
    size = round(cell['fontSize'] * scale)
    while size >= 8 * scale:
        face = font(size)
        stroke = max(1, round(size * 0.016))
        measured = [sum(draw.textlength(text, font=face) + (stroke * 2 if bold else 0)
                        for text, _, bold in line) for line in lines]
        line_height = size * 1.14
        total_height = size + line_height * (len(lines) - 1)
        if max(measured) <= available_width and total_height <= available_height:
            break
        size -= 1
    else:
        raise ValueError(f'Cell {index} cannot fit at readable size: {cell["text"]}')
    minimum_size = min(minimum_size, size)
    top = y1 + (y2 - y1 - total_height) / 2
    for row, (line, length) in enumerate(zip(lines, measured)):
        left = x1 + pad if cell['align'] == 'left' else x1 + (x2 - x1 - length) / 2
        for text, color, bold in line:
            draw.text((round(left), round(top + row * line_height + size / 2)), text,
                      font=face, fill=color, anchor='lm',
                      stroke_width=stroke if bold else 0, stroke_fill=color)
            left += draw.textlength(text, font=face) + (stroke * 2 if bold else 0)

for x1, y1, x2, y2 in layout['dottedLines']:
    draw.line((x1 * scale, y1 * scale + 2 * scale, x1 * scale, y2 * scale - 2 * scale),
              fill=colors['white'], width=3 * scale)
    for y in range(round(y1 * scale + 3 * scale), round(y2 * scale - 2 * scale), 4 * scale):
        draw.ellipse((x1 * scale - scale / 2, y, x1 * scale + scale / 2, y + scale), fill=colors['grid'])

png = out / 'war-thunder-sale-calendar-retypeset.png'
webp = png.with_suffix('.webp')
canvas.save(png, optimize=True)
canvas.save(webp, format='WEBP', lossless=True, method=6)
# The modal uses a smaller copy; the freshly typeset full-resolution PNG remains downloadable.
preview = out / 'war-thunder-sale-calendar-preview.webp'
preview_image = canvas.resize((1700, 1456), Image.Resampling.LANCZOS)
preview_image.save(preview, format='WEBP', quality=86, method=6)
report = {'width': width, 'height': height, 'cells': len(layout['cells']),
          'minimumFontPixels': minimum_size, 'retypeset': True,
          'layoutSha256': hashlib.sha256((ROOT / 'data/sale-calendar-reference-layout.json').read_bytes()).hexdigest()}
for key, file in [('png', png), ('webp', webp), ('preview', preview)]:
    report[key] = {'path': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                   'bytes': file.stat().st_size,
                   'width': 1700 if key == 'preview' else width,
                   'height': 1456 if key == 'preview' else height}
(out / 'retypeset-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
