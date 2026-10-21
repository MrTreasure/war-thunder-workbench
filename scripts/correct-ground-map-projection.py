"""Correct map projection and rebuild the 77 supplied DOM layout previews.

Use the original base textures and native symbols. Only world-to-image projection
changes; do not flip terrain, letter glyphs or user annotations. No network access.
Requires Pillow and CairoSVG.
"""
import argparse
import copy
import csv
import hashlib
import io
import json
from pathlib import Path

import cairosvg
from PIL import Image


def sha(body):
    return hashlib.sha256(body).hexdigest()


def correct(maps_dir, thumbs_dir, canonical, output):
    catalog = json.loads(canonical.read_text())
    source_text = (maps_dir / '地图数据.js').read_text()
    source_maps = json.loads(source_text.split('=', 1)[1].strip().rstrip(';'))
    source_by_id = {m['id']: m for m in source_maps}
    with (thumbs_dir / '地图名称清单.csv').open(encoding='utf-8-sig') as stream:
        rows = {row['布局ID']: row for row in csv.DictReader(stream)}
    output.mkdir(parents=True, exist_ok=True)
    icons = {p.stem: p.read_bytes() for p in (maps_dir / '图标/即用图标').glob('*.svg')}
    icon_cache = {}
    ref = catalog.get('assetRepository', {}).get('commit')
    records = []
    point_count = 0
    for m in catalog['maps']:
        source = source_by_id[m['id']]
        assert sha((maps_dir / source['image']).read_bytes()) == m['base'].get('sourceSha256', m['base']['sha256'])
        [[x0, z0], [x1, z1]] = m['bounds']
        m['layouts'] = copy.deepcopy(source['layouts'])
        for layout in m['layouts']:
            for mark in layout['marks']:
                mark['x'] = (mark['world'][0] - x0) / (x1 - x0)
                mark['y'] = (z1 - mark['world'][1]) / (z1 - z0)
                point_count += 1
            if layout['crop']:
                u0, v0, u1, v1 = layout['crop']
                layout['crop'] = [u0, 1 - v1, u1, 1 - v0]
        m['grid'] = copy.deepcopy(source['grid'])
        origin = m['grid']['default_reference']['origin_xz_m']
        origin[1] = z0 + z1 - origin[1]
        m['grid']['row_labels'] = 'A,B,C,...,Z from top to bottom (-worldZ)'
        m['grid']['note'] = ('Reference origin is the full texture upper-left (minX, maxZ); '
                             'rows move towards decreasing world Z. Match-specific origin '
                             'and spacing remain unverified; cropping does not reset numbering.')
        m['contours']['imageProjection'] = 'source-world-z-down; reflect-y-on-display'
        base = Image.open(maps_dir / source['image']).convert('RGBA')
        layouts = {layout['id']: layout for layout in m['layouts']}
        for thumb in m['thumbnails']:
            row = rows[thumb['layoutId']]
            assert row['地图ID'] == m['id']
            dom = thumbs_dir / row['图片路径']
            body = dom.read_bytes()
            digest = sha(body)
            assert digest == thumb['sourceSha256'], 'Original DOM export changed'
            with Image.open(dom) as original:
                assert original.size == (int(row['宽度']), int(row['高度']))
            layout = layouts[thumb['layoutId']]
            u0, v0, u1, v1 = layout['crop'] or [0, 0, 1, 1]
            crop_width = (u1 - u0) * base.width
            crop_height = (v1 - v0) * base.height
            scale = 512 / max(crop_width, crop_height)
            width, height = round(crop_width * scale), round(crop_height * scale)
            w, h = width * 3, height * 3
            image = base.crop((u0 * base.width, v0 * base.height,
                               u1 * base.width, v1 * base.height)).resize((w, h), Image.Resampling.LANCZOS)
            seen = set()
            for mark in layout['marks']:
                identity = (mark['kind'], mark['team'], mark['label'],
                            round(mark['x'], 6), round(mark['y'], 6))
                if identity in seen:
                    continue
                seen.add(identity)
                spawn = mark['kind'] == 'spawn'
                icon = ('spawn_ally' if mark['team'] == 1 else 'spawn_enemy') if spawn else 'capture_' + mark['label'].lower()
                size = max(1, round(w * (0.047 if spawn else 0.029)))
                key = (icon, size)
                if key not in icon_cache:
                    icon_cache[key] = Image.open(io.BytesIO(cairosvg.svg2png(
                        bytestring=icons[icon], output_width=size, output_height=size))).convert('RGBA')
                px = (mark['x'] - u0) / (u1 - u0) * w
                py = (mark['y'] - v0) / (v1 - v0) * h
                image.alpha_composite(icon_cache[key], (round(px - size / 2), round(py - size / 2)))
            image = image.resize((width, height), Image.Resampling.LANCZOS).convert('RGB')
            target = output / (thumb['layoutId'] + '.webp')
            image.save(target, 'WEBP', quality=90, method=6)
            body = target.read_bytes()
            digest = sha(body)
            relative = f'war-thunder/ground-maps/v1/{digest[:24]}.webp'
            if ref:
                asset = {
                    'url': f'https://cdn.jsdelivr.net/gh/MrTreasure/oss-files@{ref}/{relative}',
                    'rawUrl': f'https://raw.githubusercontent.com/MrTreasure/oss-files/{ref}/{relative}',
                }
            else:
                asset = {'url': f'https://wtmaps.mrtreasure.cc/ground-maps/v1/thumbs/{digest[:24]}.webp'}
            asset.update(sha256=digest, sourceSha256=digest, bytes=len(body))
            thumb.pop('imageProjection', None)
            thumb.update(image=asset, width=width, height=height,
                         projectionRevision=2,
                         sourcePath=row['图片路径'], sourceArchive='战雷陆战_DOM点位缩略图_20261021_010007.zip')
            records.append({'mapId': m['id'], 'layoutId': thumb['layoutId'], 'path': str(target),
                            'repositoryPath': relative, 'sha256': digest,
                            'sourceDomSha256': thumb['sourceSha256'], 'width': width, 'height': height})
    assert len(records) == 77 and point_count == 2242
    catalog['projection'] = {
        'revision': 2,
        'imageOrigin': 'top-left',
        'worldZDirection': 'up',
        'pointFormula': 'u=(worldX-minX)/(maxX-minX); v=(maxZ-worldZ)/(maxZ-minZ)',
        'contourSvgTransform': 'matrix(1 0 0 -1 0 1000)',
        'thumbnailDerivation': 'Original DOM layout association; reprojected native marks over original base texture, WebP quality 90',
        'evidence': 'User supplied in-game comparison: American Desert and Berlin, 2026-10-21',
    }
    canonical.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    (output / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    total = sum(t['image']['bytes'] for m in catalog['maps'] for t in m['thumbnails'])
    print(f'Corrected {point_count} detail marks / 309 layouts; rebuilt 77 corrected DOM previews, {total / 1048576:.2f} MiB')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--maps', type=Path, default=Path('artifacts/ground-maps/maps-source/战雷陆战地图'))
    parser.add_argument('--thumbs', type=Path, default=Path('artifacts/ground-maps/thumbs-source'))
    parser.add_argument('--canonical', type=Path, default=Path('data/ground-maps.json'))
    parser.add_argument('--output', type=Path, default=Path('artifacts/ground-maps/corrected-thumbnails'))
    args = parser.parse_args()
    correct(args.maps, args.thumbs, args.canonical, args.output)
