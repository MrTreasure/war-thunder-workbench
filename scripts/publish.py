"""Publish this Vite build to the existing Muse route, assets before atomic HTML.
Keep old content-addressed assets for already-open sessions; versions live in Git.
"""
from pathlib import Path
import shutil,os,json,hashlib,gzip,subprocess
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
destination=Path('/vol1/1000/appdata/nginx/public/resume/muse/war-thunder-trees')
workspace=Path('/home/Treasure/.picoclaw/workspace/war-thunder-tree')
subprocess.run(['node','scripts/check-data.mjs'],cwd=root,check=True)
content=(dist/'index.html').read_bytes()
if b'/assets/' not in content or b'id="root"' not in content:raise RuntimeError('Run pnpm run build before publishing')
# Ensure dist contains the current generated data, not an older successful build.
manifest=json.loads((root/'src/generated/manifest.json').read_text())
if manifest['schemaVersion']!=3:raise RuntimeError('Expected country data manifest v3')
subprocess.run(['node','scripts/check-build.mjs'],cwd=root,check=True)
def atomic(path,data,mode=0o644):
 path.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
 temp=path.with_name(path.name+'.next');temp.write_bytes(data);temp.chmod(mode);os.replace(temp,path)
destination.mkdir(parents=True,exist_ok=True,mode=0o755);destination.chmod(0o755)
for file in sorted(dist.rglob('*'),key=lambda path:(path.suffix.lower()=='.html',str(path))):
 if not file.is_file() or file==dist/'index.html':continue
 target=destination/file.relative_to(dist)
 atomic(target,file.read_bytes());atomic(target.with_name(target.name+'.gz'),gzip.compress(file.read_bytes(),mtime=0))
 atomic(workspace/file.relative_to(dist),file.read_bytes())
atomic(destination/'index.html.gz',gzip.compress(content,mtime=0));atomic(destination/'index.html',content)
# Keep Muse's compatibility entry pointed at the new canonical React project.
workspace.mkdir(parents=True,exist_ok=True)
compat=f'''#!/usr/bin/env python3
"""Muse compatibility entry. Canonical React project: {root}"""
from pathlib import Path
import subprocess,shutil
subprocess.run(['pnpm','run','refresh'],cwd={str(root)!r},check=True)
subprocess.run(['pnpm','run','build'],cwd={str(root)!r},check=True)
root=Path({str(root)!r})
for file in (root/'dist').rglob('*'):
 if file.is_file():
  target=Path(__file__).parent/file.relative_to(root/'dist');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
print('Built React static assets. Publish with pnpm run publish from the canonical project.')
'''
atomic(workspace/'build.py',compat.encode(),0o755)
atomic(workspace/'index.html',content)
record={'project':str(root),'destination':str(destination),'sha256':hashlib.sha256(content).hexdigest(),'assets':sum(p.is_file() for p in dist.rglob('*'))}
print(json.dumps(record))
