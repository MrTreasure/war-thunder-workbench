"""Cross-check supplied contour coordinates/SVGs and corrected map projection.

Read-only verification of both local exports. Writes a report under artifacts only.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=Path('artifacts/ground-maps/maps-source/战雷陆战地图'))
parser.add_argument('--canonical', type=Path, default=Path('data/ground-maps.json'))
parser.add_argument('--output', type=Path, default=Path('artifacts/ground-maps/point-audit/projection-report.json'))
args = parser.parse_args()
catalog = json.loads(args.canonical.read_text())
report = []
for m in catalog['maps']:
    root = args.source / '等高线' / m['id']
    contours = json.loads((root / 'contours.json').read_text())
    assert contours['bounds_xz_m'] == m['bounds']
    svg = (root / 'contours.svg').read_bytes()
    assert hashlib.sha256(svg).hexdigest() == m['contourImage']['sourceSha256']
    anchors = re.findall(r'M\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)', svg.decode())
    lines = [line for feature in contours['features'] for line in feature['lines']]
    assert len(anchors) == len(lines) == m['contours']['polylines']
    [[x0, z0], [x1, z1]] = m['bounds']
    max_error = 0
    for (sx, sy), line in zip(anchors, lines):
        wx, wz = line[0]
        u = (wx - x0) / (x1 - x0) * 1000
        v = (z1 - wz) / (z1 - z0) * 1000
        # Source SVG uses +Z-down. Its reflected anchor must match the same
        # source world point under the corrected texture projection.
        error = max(abs(float(sx) - u), abs(1000 - float(sy) - v))
        max_error = max(max_error, error)
        assert error < 0.000052, (m['id'], error)
    point_count = 0
    for layout in m['layouts']:
        for point in layout['marks']:
            wx, wz = point['world']
            assert math.isclose(point['x'], (wx - x0) / (x1 - x0), abs_tol=1e-12)
            assert math.isclose(point['y'], (z1 - wz) / (z1 - z0), abs_tol=1e-12)
            point_count += 1
    report.append({'mapId': m['id'], 'layouts': len(m['layouts']), 'marks': point_count,
                   'contourPaths': len(lines), 'maxAnchorErrorSvgUnits': max_error,
                   'sourceSvgSha256': hashlib.sha256(svg).hexdigest(),
                   'sourceHeightPayloadSha256': contours['source_height_payload_sha256']})
summary = {'maps': len(report), 'layouts': sum(r['layouts'] for r in report),
           'marks': sum(r['marks'] for r in report), 'contourPaths': sum(r['contourPaths'] for r in report),
           'worldZDirection': 'up', 'sourceSvgReflectionCount': 1,
           'maxAnchorErrorSvgUnits': max(r['maxAnchorErrorSvgUnits'] for r in report)}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({'summary': summary, 'maps': report}, indent=2) + '\n')
print(json.dumps(summary))
