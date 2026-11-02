import {readFile, writeFile, mkdir, rename} from "node:fs/promises";
import {resolve, basename} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";

process.umask(0o077);
const project=fileURLToPath(new URL("../../",import.meta.url));
const captures=resolve(process.argv[2]||resolve(project,"artifacts/vehicle-weakpoints-20261102"));
const out=resolve(process.argv[3]||resolve(captures,"build"));
const assets=resolve(out,"assets");await mkdir(assets,{recursive:true});
const hash=body=>createHash("sha256").update(body).digest("hex");
const data=JSON.parse(await readFile(resolve(project,"data/tank-weakpoints-samples.json"),"utf8"));
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
const report={models:[],publishedFiles:[],noRemoteRequests:true};
for(const model of data.models){
  if(!/^[a-z0-9_]+$/.test(model.id)||basename(model.frame)!==model.frame)throw Error("Unsafe model or image reference");
  if(model.wikiUrl!==`https://wiki.warthunder.com/unit/${model.id}`)throw Error("Wrong Wiki variant");
  const wiki=JSON.parse(await readFile(resolve(captures,model.wikiSnapshot+".json"),"utf8"));
  const frame=JSON.parse(await readFile(resolve(captures,model.frameSnapshot+".json"),"utf8"));
  if(wiki.url!==model.wikiUrl||wiki.status!==200||wiki.challenge||!norm(wiki.title).includes(norm(model.name)))throw Error("Wiki source identity not verified");
  if(!wiki.text.includes(model.wikiGameVersion))throw Error("Wiki version mismatch");
  if(!frame.url.startsWith(data.source.url)||frame.error||frame.challenge||Math.abs(frame.decode.mediaTime-model.time)>.2)throw Error("Video frame time or source not verified");
  const raw=await readFile(resolve(captures,model.frame));
  if(raw.readUInt32BE(16)!==1920||raw.readUInt32BE(20)!==1080)throw Error("Unexpected video dimensions");
  const [x,y,w,h]=model.crop;
  if(!model.crop.every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>1920||y+h>1080)throw Error("Invalid crop");
  for(const pin of model.pins)if(![pin.x,pin.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error("Invalid annotation position");
  for(const [kind,filter]of [["photo",`crop=${w}:${h}:${x}:${y}`],["raw",null]]){
    const temporary=resolve(assets,`${model.id}-${kind}.next.webp`);
    execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-i",resolve(captures,model.frame),...(filter?["-vf",filter]:[]),"-frames:v","1","-c:v","libwebp","-quality","90","-y",temporary]);
    const body=await readFile(temporary),file=`weakpoints-${model.id}-${kind}.${hash(body).slice(0,16)}.webp`;
    await rename(temporary,resolve(assets,file));report.publishedFiles.push({file,bytes:body.length,sha256:hash(body)});
    model[kind==="photo"?"imageUrl":"rawUrl"]=`./assets/${file}`;
  }
  model.sourceFrameSHA256=hash(raw);
  report.models.push({id:model.id,wikiUrl:wiki.url,frameTime:frame.decode.mediaTime,frameSHA256:hash(raw),frameSize:raw.length});
  delete model.wikiSnapshot;delete model.frameSnapshot;delete model.frame;
}
const css=await readFile(new URL("preview.css",import.meta.url));
const js=Buffer.from("const SAMPLE = "+JSON.stringify(data)+";\n"+await readFile(new URL("preview.js",import.meta.url),"utf8"));
const cssFile=`weakpoints-preview.${hash(css).slice(0,16)}.css`,jsFile=`weakpoints-preview.${hash(js).slice(0,16)}.js`;
await writeFile(resolve(assets,cssFile),css);await writeFile(resolve(assets,jsFile),js);
const html=(await readFile(new URL("preview.html",import.meta.url),"utf8")).replace("__STYLE__","./assets/"+cssFile).replace("__SCRIPT__","./assets/"+jsFile);
if(/__STYLE__|__SCRIPT__|<script(?![^>]*src=)/.test(html))throw Error("Unresolved or inline script");
await writeFile(resolve(out,"weakpoints-preview.html"),html);
await writeFile(resolve(captures,"build-report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({output:out,models:report.models.length,images:report.publishedFiles.length,imageBytes:report.publishedFiles.reduce((n,f)=>n+f.bytes,0),html:"weakpoints-preview.html"}));
