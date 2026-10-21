"""Publish this Vite build to the existing Muse route, assets before atomic HTML.
Keep old content-addressed assets for already-open sessions; backup changed entry files.
"""
from pathlib import Path
from datetime import datetime
import shutil,os,json,hashlib,gzip,subprocess
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
destination=Path('/vol1/1000/appdata/nginx/public/resume/muse/war-thunder-trees')
workspace=Path('/home/Treasure/.picoclaw/workspace/war-thunder-tree')
backup=Path('/vol1/1000/appdata/war-thunder-trees/backups')/('react-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
subprocess.run(['node','scripts/check-data.mjs'],cwd=root,check=True)
content=(dist/'index.html').read_bytes()
if b'/assets/' not in content or b'id="root"' not in content:raise RuntimeError('Run pnpm run build before publishing')
# Ensure dist contains the current generated data, not an older successful build.
manifest=json.loads((root/'src/generated/manifest.json').read_text())
if manifest['schemaVersion']!=3:raise RuntimeError('Expected country data manifest v3')
subprocess.run(['node','scripts/check-build.mjs'],cwd=root,check=True)
backup.mkdir(parents=True,mode=0o700)
for path,name in [(destination/'index.html','published-index.html'),(destination/'index.html.gz','published-index.html.gz'),(workspace/'build.py','muse-build.py'),(workspace/'index.html','muse-index.html')]:
 if path.exists():shutil.copy2(path,backup/name)
def atomic(path,data,mode=0o644):
 path.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
 temp=path.with_name(path.name+'.next');temp.write_bytes(data);temp.chmod(mode);os.replace(temp,path)
destination.mkdir(parents=True,exist_ok=True,mode=0o755);destination.chmod(0o755)
for file in dist.rglob('*'):
 if not file.is_file() or file.name=='index.html':continue
 target=destination/file.relative_to(dist);atomic(target,file.read_bytes());atomic(target.with_name(target.name+'.gz'),gzip.compress(file.read_bytes(),mtime=0))
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
record={'project':str(root),'destination':str(destination),'backup':str(backup),'sha256':hashlib.sha256(content).hexdigest(),'assets':sum(p.is_file() for p in dist.rglob('*'))}
(backup/'publication.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
