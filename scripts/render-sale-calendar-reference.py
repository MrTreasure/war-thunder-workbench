"""Enhance the supplied calendar pixels while preserving its layout and wording.
Run: uv run --no-project --with pillow==11.3.0 python scripts/render-sale-calendar-reference.py --source <original.png>
Without --source, downloads the immutable original registered in canonical metadata.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import argparse
import hashlib
import json
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
metadata = json.loads((ROOT / 'data/sale-calendar-reference.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path)
args = parser.parse_args()
output_dir = ROOT / 'artifacts/sales-calendar/reference'
output_dir.mkdir(parents=True, exist_ok=True)
source = args.source
if source is None:
    source = output_dir / 'community-calendar-original.png'
    request = Request(metadata['original']['rawUrl'], headers={'User-Agent': 'WarThunderWorkbench/1.0'})
    with urlopen(request, timeout=30) as response:
        body = response.read(5 * 1024 * 1024 + 1)
    if len(body) > 5 * 1024 * 1024:
        raise ValueError('Source image exceeds allowed size')
    source.write_bytes(body)
body = source.read_bytes()
if hashlib.sha256(body).hexdigest() != metadata['sourceImageSha256']:
    raise ValueError('Source image does not match the provided original')
with Image.open(source) as original:
    if original.size != (850, 728):
        raise ValueError('Unexpected original dimensions')
    enlarged = original.convert('RGB').resize((3400, 2912), Image.Resampling.LANCZOS)
# Sharpen luminance only; retain chroma, all original content and its placement.
luma, chroma_blue, chroma_red = enlarged.convert('YCbCr').split()
luma = luma.filter(ImageFilter.UnsharpMask(radius=2.0, percent=105, threshold=4))
enhanced = Image.merge('YCbCr', (luma, chroma_blue, chroma_red)).convert('RGB')
output = output_dir / 'war-thunder-sale-calendar-original-hd.png'
enhanced.save(output, optimize=True)
webp = output.with_suffix('.webp')
enhanced.save(webp, format='WEBP', lossless=True, method=6)
print(json.dumps({'path': str(output), 'width': enhanced.width, 'height': enhanced.height,
                  'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                  'sourceSha256': hashlib.sha256(body).hexdigest(), 'scale': 4, 'webpPath': str(webp), 'webpBytes': webp.stat().st_size,
                  'webpSha256': hashlib.sha256(webp.read_bytes()).hexdigest()}))
