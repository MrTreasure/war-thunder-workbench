import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

process.umask(0o077);
const project = fileURLToPath(new URL("../../", import.meta.url));
const captures = resolve(process.argv[2] || resolve(project, "artifacts/vehicle-weakpoints-20261102"));
const out = resolve(process.argv[3] || resolve(captures, "build"));
const assets = resolve(out, "assets");
await mkdir(assets, { recursive: true });
const hash = (body) => createHash("sha256").update(body).digest("hex");
const data = JSON.parse(await readFile(resolve(project, "data/tank-weakpoints-samples.json"), "utf8"));
let registry;
try { registry = JSON.parse(await readFile(resolve(project, "data/tank-weakpoint-assets.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function privatePath(path) {
  const target = resolve(project, path);
  if (!target.startsWith(resolve(project, "artifacts") + sep)) throw Error("Source proof must stay in local artifacts");
  return target;
}
const report = { models: [], publishedFiles: [], noRemoteRequests: true };
for (const model of data.models) {
  if (model.scopeRole === "light_tank" && model.specialistWeakpointVerified !== true) throw Error("Scout/light vehicle needs verified specialist weakpoint evidence");
  if (!/^[a-z0-9_]+$/.test(model.id)) throw Error("Unsafe model identity");
  if (model.wikiUrl !== `https://wiki.warthunder.com/unit/${model.id}`) throw Error("Wrong Wiki variant");
  const wikiPath = model.wikiSnapshotPath ? privatePath(model.wikiSnapshotPath) : resolve(captures, model.wikiSnapshot + ".json");
  const wikiBytes = await readFile(wikiPath);
  if (model.wikiSnapshotSHA256 && hash(wikiBytes) !== model.wikiSnapshotSHA256) throw Error("Wiki proof hash mismatch");
  const wiki = JSON.parse(wikiBytes);
  if (wiki.url !== model.wikiUrl || wiki.status !== 200 || wiki.challenge || !norm(wiki.title).includes(norm(model.name))) throw Error("Wiki source identity not verified");
  if (!wiki.text.includes(model.wikiGameVersion)) throw Error("Wiki version mismatch");
  const weapon = wiki.text.slice(wiki.text.indexOf("Armaments\n")).split("Available ammunition")[0];
  if (!weapon.includes(model.reload.gun.replace(" 主炮", " cannon"))) throw Error("Wrong main gun: " + model.id);
  const reload = weapon.match(/Reload\n(?:basic crew → aces\n)?([\d.]+)(?: → ([\d.]+))? s/);
  if (!reload) throw Error("Missing main-gun reload source");
  if (model.reload.mechanism === "automatic") {
    if (!weapon.includes("Autoloader") || Number(reload[1]) !== model.reload.seconds || reload[2]) throw Error("Automatic reload mismatch");
  } else if (Number(reload[1]) !== model.reload.basicSeconds || Number(reload[2]) !== model.reload.aceSeconds) throw Error("Crew reload mismatch");
  const item = { id: model.id, wikiUrl: wiki.url, reload: model.reload, illustrated: false };
  const source = model.source || data.source;
  if (model.frame || model.framePath) {
    if (model.frame && basename(model.frame) !== model.frame) throw Error("Unsafe image reference");
    const framePath = model.framePath ? privatePath(model.framePath) : resolve(captures, model.frame);
    const proofPath = model.frameSnapshotPath ? privatePath(model.frameSnapshotPath) : resolve(captures, model.frameSnapshot + ".json");
    const frame = JSON.parse(await readFile(proofPath, "utf8"));
    if (!source?.url || !frame.url.startsWith(source.url) || frame.error || frame.challenge || frame.blocked || !frame.decode || Math.abs(frame.decode.mediaTime - model.time) > .2) throw Error("Video frame source/time not verified: " + model.id);
    const raw = await readFile(framePath);
    if (model.captureSHA256 && hash(raw) !== model.captureSHA256) throw Error("Capture image hash mismatch");
    const isPng = raw.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = raw.toString("ascii", 0, 4) === "RIFF" && raw.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isWebp) throw Error("Capture must be PNG or WebP");
    const dimensions = isPng ? { width: raw.readUInt32BE(16), height: raw.readUInt32BE(20) } : JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", framePath], { encoding: "utf8" })).streams[0];
    const { width, height } = dimensions;
    if (width < 1920 || height < 1080 || frame.decode.width !== width || frame.decode.height !== height || model.imageView !== "front") throw Error("Verified HD front view required: " + model.id);
    model.sourceDimensions = [width, height];
    const [x, y, w, h] = model.crop;
    if (!model.crop.every(Number.isInteger) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) throw Error("Invalid crop");
    for (const pin of model.pins) if (![pin.x, pin.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) throw Error("Invalid annotation position");
    for (const [kind, filter] of [["photo", `crop=${w}:${h}:${x}:${y}`], ["raw", null]]) {
      const temporary = resolve(assets, `${model.id}-${kind}.next.webp`);
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", framePath, ...(filter ? ["-vf", filter] : []), "-frames:v", "1", "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", "-y", temporary]);
      const body = await readFile(temporary), digest = hash(body), file = `weakpoints-${model.id}-${kind}.${digest.slice(0, 16)}.webp`;
      await rename(temporary, resolve(assets, file));
      report.publishedFiles.push({ file, bytes: body.length, sha256: digest, modelId: model.id, kind });
      const hosted = registry?.models?.[model.id]?.[kind];
      if (hosted) {
        if (hosted.sha256 !== digest || hosted.bytes !== body.length || !/^[a-f0-9]{40}$/.test(hosted.commit)) throw Error("Pinned image identity mismatch");
        for (const url of [hosted.url, hosted.rawUrl]) if (!url?.startsWith("https://") || !url.includes(hosted.commit)) throw Error("Unpinned image URL");
      }
      model[kind === "photo" ? "imageUrl" : "rawUrl"] = hosted?.url || `./assets/${file}`;
      if (hosted) model[kind === "photo" ? "imageFallbackUrl" : "rawFallbackUrl"] = hosted.rawUrl;
    }
    model.sourceFrameSHA256 = model.originalFrameSHA256 || hash(raw);
    Object.assign(item, { illustrated: true, frameTime: frame.decode.mediaTime, frameSHA256: hash(raw), sourceFrameSHA256: model.sourceFrameSHA256, frameSize: raw.length, imageQuality: model.imageQuality });
  } else if (model.pins?.length) throw Error("Do not publish pins without their matching front image");
  report.models.push(item);
  for (const key of ["wikiSnapshot", "wikiSnapshotPath", "wikiSnapshotSHA256", "frameSnapshot", "frameSnapshotPath", "frame", "framePath", "testContextEvidence", "captureSHA256", "originalFrameSHA256", "overview", "comparison", "limits", "ammo", "evidenceFrames"]) delete model[key];
  for (const advice of model.videoAdvice || []) delete advice.evidence;
}
const css = await readFile(new URL("preview.css", import.meta.url));
const js = Buffer.from("const SAMPLE = " + JSON.stringify(data) + ";\n" + await readFile(new URL("preview.js", import.meta.url), "utf8"));
const cssFile = `weakpoints-preview.${hash(css).slice(0, 16)}.css`, jsFile = `weakpoints-preview.${hash(js).slice(0, 16)}.js`;
await writeFile(resolve(assets, cssFile), css); await writeFile(resolve(assets, jsFile), js);
const html = (await readFile(new URL("preview.html", import.meta.url), "utf8")).replace("__STYLE__", "./assets/" + cssFile).replace("__SCRIPT__", "./assets/" + jsFile);
if (/__STYLE__|__SCRIPT__|<script(?![^>]*src=)/.test(html)) throw Error("Unresolved or inline script");
await writeFile(resolve(out, "weakpoints-preview.html"), html);
await writeFile(resolve(captures, "build-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: out, wikiModels: report.models.length, illustratedModels: report.models.filter((m) => m.illustrated).length, images: report.publishedFiles.length, imageBytes: report.publishedFiles.reduce((n, f) => n + f.bytes, 0) }));
