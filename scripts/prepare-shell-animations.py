"""Convert user-supplied game IVF diagrams; keep originals outside publication.

Usage: python3 scripts/prepare-shell-animations.py <extracted-folder> <output-folder>
The AV1 animation is remuxed without re-encoding. MP4 is a compatibility derivative.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

source, output = (Path(value).resolve() for value in sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)


def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def convert(path):
    assert re.fullmatch(r"[a-z0-9_]+\.ivf", path.name), "Unexpected source name"
    info = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)))
    stream = info["streams"][0]
    assert len(info["streams"]) == 1 and stream["codec_name"] == "av1", "Expected original AV1 IVF"
    assets = {}
    for kind, ext, options in [
        ("avif", "avif", ["-c:v", "copy", "-loop", "0"]),
        ("mp4", "mp4", ["-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "1"]),
        ("poster", "webp", ["-frames:v", "1", "-c:v", "libwebp", "-lossless", "1"]),
    ]:
        target = output / f"{path.stem}-{kind}.{ext}"
        if not target.exists():
            run("ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-map", "0:v:0", "-an", *options, str(target))
        sha = digest(target)
        final = output / f"{path.stem}-{kind}.{sha[:16]}.{ext}"
        target.replace(final)
        assets[kind] = {"file": final.name, "bytes": final.stat().st_size, "sha256": sha}
    avif_info = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output / assets["avif"]["file"])))
    animated = next(s for s in avif_info["streams"] if int(s.get("nb_frames", 0)) == int(stream["nb_frames"]))
    assert animated["width"] == stream["width"] and animated["height"] == stream["height"]
    assert abs(float(avif_info["format"]["duration"]) - float(info["format"]["duration"])) < 0.001
    record = {"width": stream["width"], "height": stream["height"], "frames": int(stream["nb_frames"]), "fps": stream["r_frame_rate"], "durationSeconds": float(info["format"]["duration"]), "sourceSha256": digest(path), **assets}
    print("Prepared", path.stem, flush=True)
    return path.stem, record


files = sorted(source.glob("*.ivf"))
assert files, "No IVF originals"
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    records = dict(pool.map(convert, files))
(output / "conversion-manifest.json").write_text(json.dumps({"schemaVersion": 1, "avifConversion": "AV1 bitstream copy, original dimensions and timing", "mp4Conversion": "H.264 CRF 17, yuv420p, original dimensions and frame rate", "assets": records}, indent=2) + "\n")
print("Prepared", len(records), "animations", flush=True)
