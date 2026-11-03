import { readFile, writeFile, mkdir, rename, copyFile } from "node:fs/promises";
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
// One original video is encoded at 1920×1078; retain its native size.
const isHdSource = (width, height) => (width >= 1920 && height >= 1080)
  || (width === 1920 && height === 1078);
function privatePath(path) {
  const target = resolve(project, path);
  if (!target.startsWith(resolve(project, "artifacts") + sep)) throw Error("Source proof must stay in local artifacts");
  return target;
}
function isForumPostUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "forum.warthunder.com"
      && /^\/t\/[^/]+\/\d+\/\d+\/?$/.test(url.pathname);
  } catch { return false; }
}
function isArticleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "wiki.warthunder.com"
      && /^\/(?:\d+-[^/]+|tips\/\d+)\/?$/.test(url.pathname);
  } catch { return false; }
}
function validateStaticCase(item) {
  if (item.sourceTime !== null || !isForumPostUrl(item.sourceUrl)
    || !item.sourceImageUrl?.startsWith("https://")
    || !Number.isFinite(Date.parse(item.sourcePublishedAt))) throw Error("Static screenshot needs a post, image and publication date, without a video time");
}
async function validateStaticFrame(proof, source, digest) {
  if (source.kind === "article-image") {
    if (proof.kind !== "article-image" || !isArticleUrl(source.url) || proof.url !== source.url
      || proof.sourceImageUrl !== source.imageUrl || proof.sourcePublishedAt !== source.publishedAt
      || !Number.isFinite(Date.parse(proof.sourcePublishedAt)) || !Number.isFinite(Date.parse(proof.capturedAt))
      || proof.image?.sha256 !== digest || !proof.sourcePacket?.file || !proof.sourcePageProof?.file) throw Error("Article image provenance is incomplete");
    const packetBytes = await readFile(privatePath(proof.sourcePacket.file));
    const pageBytes = await readFile(privatePath(proof.sourcePageProof.file));
    if (hash(packetBytes) !== proof.sourcePacket.sha256 || hash(pageBytes) !== proof.sourcePageProof.sha256) throw Error("Article image source proof changed");
    const record = JSON.parse(packetBytes).records?.find((entry) => entry.webpSHA256 === digest);
    const page = JSON.parse(pageBytes);
    if (!record || record.status !== 200 || (record.sourceArticle ?? record.sourcePostProof?.URL) !== source.url || record.url !== source.imageUrl
      || record.articlePublishedAt !== source.publishedAt || record.capturedAt !== proof.capturedAt
      || record.sourceTime !== null || record.sourceguard?.challenge !== false || record.nativeResized !== false
      || record.sourceOriginalSHA256 !== proof.originalImageSHA256
      || record.sourcePostProof?.snapshotSHA256 !== proof.sourcePageProof.sha256
      || page.url !== source.url || page.status !== 200 || page.blocked || page.error
      || record.dimensions?.width !== proof.image.width || record.dimensions?.height !== proof.image.height) throw Error("Article image differs from the captured original");
    return proof.image;
  }
  if (proof.kind !== "forum-image" || proof.url !== source.url || !isForumPostUrl(proof.url)
    || proof.sourceImageUrl !== source.imageUrl || proof.sourcePublishedAt !== source.publishedAt
    || !Number.isFinite(Date.parse(proof.sourcePublishedAt)) || !Number.isFinite(Date.parse(proof.capturedAt))
    || proof.image?.sha256 !== digest || !proof.sourcePacket?.file || !proof.sourcePageProof?.file) throw Error("Static screenshot provenance is incomplete");
  const packetBytes = await readFile(privatePath(proof.sourcePacket.file));
  const pageBytes = await readFile(privatePath(proof.sourcePageProof.file));
  if (hash(packetBytes) !== proof.sourcePacket.sha256 || hash(pageBytes) !== proof.sourcePageProof.sha256) throw Error("Static screenshot source proof changed");
  const record = JSON.parse(packetBytes).imageRecords?.find((entry) => entry.webpSHA256 === digest);
  if (!record || record.sourcePost !== source.url || record.originalImageURL !== source.imageUrl
    || record.postedAt !== source.publishedAt || record.collectedAt !== proof.capturedAt
    || record.accessBlocked !== false || record.mediaTime !== null
    || record.parentDOMProofSHA256 !== proof.sourcePageProof.sha256
    || record.dimensions?.width !== proof.image.width || record.dimensions?.height !== proof.image.height) throw Error("Static screenshot differs from the public attachment record");
  return proof.image;
}
function validateShellTypeReference(item, originalCase) {
  const reference = item?.shellTypeReference;
  if (!reference) return;
  const attacker = item.attackerVehicleId || originalCase?.attackerVehicleId;
  if (reference.sourceBasis !== "official-Wiki-reference" || !attacker
    || reference.attackerVehicleId !== attacker || reference.url !== `https://wiki.warthunder.com/unit/${attacker}`
    || reference.sourceShellLabelOriginal !== item.shell || item.rawUIType !== null
    || !item.shellTypeCode || !Number.isFinite(Date.parse(reference.checkedAt))
    || !reference.mainGun || !reference.officialShellName) throw Error("Ammunition reference must match the exact attacker and source shell");
}
const report = { models: [], publishedFiles: [], noRemoteRequests: true };
for (const model of data.models) {
  if (model.scopeRole === "light_tank" && model.specialistWeakpointVerified !== true) throw Error("Scout/light vehicle needs verified specialist weakpoint evidence");
  if (!/^[a-z0-9_]+$/.test(model.id)) throw Error("Unsafe model identity");
  const cases = new Map();
  for (const item of model.testCases || []) {
    if (typeof item.id !== "string" || !item.id.startsWith(model.id + ":") || cases.has(item.id)) throw Error("Invalid or duplicate test case: " + model.id);
    if (item.sourceKind === "forum-image") validateStaticCase(item);
    else if ((item.sourceKind && item.sourceKind !== "video") || !Number.isFinite(item.sourceTime) || item.sourceTime < 0 || !item.sourceUrl?.startsWith("https://")) throw Error("Missing test-case source: " + model.id);
    for (const key of ["distanceMeters", "displayedPenetrationMm"]) if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < 0)) throw Error("Invalid test-case measurement: " + model.id);
    validateShellTypeReference(item);
    cases.set(item.id, item);
  }
  validateShellTypeReference(model.testContext, cases.get(model.testContext?.caseId));
  if (model.testContext?.sourceKind === "forum-image") validateStaticCase(model.testContext);
  for (const advice of model.videoAdvice || []) {
    if (advice.sourceKind === "article-text") {
      if (advice.sourceTime !== null || advice.caseId !== null || advice.sourceClaimNotCanonicalFact !== true
        || !isArticleUrl(advice.sourceUrl)
        || !Number.isFinite(Date.parse(advice.sourcePublishedAt))) throw Error("Article commentary needs its actual publication date and no invented test clock");
      continue;
    }
    if (advice.sourceKind === "forum-image") {
      const related = cases.get(advice.caseId || advice.relatedCaseId);
      if (advice.sourceTime !== null || !isForumPostUrl(advice.sourceUrl)
        || (advice.caseId && !related) || !Number.isFinite(Date.parse(advice.sourcePublishedAt || related?.sourcePublishedAt))) throw Error("Static advice must retain its post provenance and null video time");
      continue;
    }
    if (advice.kind === "author-general-front-ammunition-recommendation") {
      const evidence = advice.evidence?.sourceEvidence;
      if (advice.caseId != null || !Number.isFinite(advice.sourceTime) || !advice.sourceUrl?.startsWith("https://") || !evidence?.file || hash(await readFile(privatePath(evidence.file))) !== evidence.sha256) throw Error("General ammunition advice needs its own verified source, without an invented test case");
    }
    if (advice.caseId == null) continue;
    const item = cases.get(advice.caseId);
    if (!item) throw Error("Advice refers to another or missing test case: " + model.id);
    if (!Number.isFinite(advice.sourceTime)) throw Error("Missing advice source time: " + model.id);
    if (advice.conditionMatch === "same-frame" && Math.abs(advice.sourceTime - item.sourceTime) > .2) throw Error("Advice and test case are not the same frame: " + model.id);
  }
  const wikiUnitId = model.wikiUnitId || model.id;
  if (wikiUnitId.toLowerCase() !== model.id || model.wikiUrl !== `https://wiki.warthunder.com/unit/${wikiUnitId}`) throw Error("Wrong Wiki variant: " + model.id);
  const wikiPath = model.wikiSnapshotPath ? privatePath(model.wikiSnapshotPath) : resolve(captures, model.wikiSnapshot + ".json");
  const wikiBytes = await readFile(wikiPath);
  if (model.wikiSnapshotSHA256 && hash(wikiBytes) !== model.wikiSnapshotSHA256) throw Error("Wiki proof hash mismatch");
  const wiki = JSON.parse(wikiBytes);
  if (wiki.url !== model.wikiUrl || wiki.status !== 200 || wiki.challenge || !norm(wiki.title).includes(norm(model.name))) throw Error("Wiki source identity not verified");
  if (!wiki.text.includes(model.wikiGameVersion)) throw Error("Wiki version mismatch");
  const armamentStart = wiki.text.indexOf("Armaments\n");
  const armaments = armamentStart < 0 ? "" : wiki.text.slice(armamentStart);
  const gunStart = armaments.indexOf(model.reload.gun.replace(" 主炮", " cannon"));
  if (gunStart < 0) throw Error("Wrong main gun: " + model.id);
  const weapon = armaments.slice(gunStart).split("Available ammunition")[0];
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
    const proofBytes = await readFile(proofPath);
    const frame = JSON.parse(proofBytes);
    const staticImage = source?.kind === "forum-image" || source?.kind === "article-image";
    if (source?.kind === "article-image" && (model.mainViewKind !== "author-diagram" || model.completeIllustration !== false || model.pins?.length || model.testContext != null)) throw Error("Author diagram cannot invent a tested green map or completed illustration");
    if (frame.error || frame.challenge || frame.blocked) throw Error("Source capture was blocked: " + model.id);
    if (staticImage) {
      if (model.time !== null || !model.frameSnapshotSHA256 || hash(proofBytes) !== model.frameSnapshotSHA256) throw Error("Static image must retain its proof hash and null video time");
    } else if (!source?.url || !frame.url?.startsWith(source.url) || !frame.decode || !Number.isFinite(model.time) || Math.abs(frame.decode.mediaTime - model.time) > .2) throw Error("Video frame source/time not verified: " + model.id);
    const raw = await readFile(framePath);
    if (model.captureSHA256 && hash(raw) !== model.captureSHA256) throw Error("Capture image hash mismatch");
    const geometry = staticImage ? await validateStaticFrame(frame, source, hash(raw)) : frame.decode;
    const isPng = raw.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = raw.toString("ascii", 0, 4) === "RIFF" && raw.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isWebp) throw Error("Capture must be PNG or WebP");
    const dimensions = isPng ? { width: raw.readUInt32BE(16), height: raw.readUInt32BE(20) } : JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", framePath], { encoding: "utf8" })).streams[0];
    const { width, height } = dimensions;
    if (!isHdSource(width, height) || model.imageView !== "front") throw Error("Verified HD front view required: " + model.id);
    if (geometry.width !== width || geometry.height !== height) {
      const transform = model.frameCaptureTransform;
      const scale = width / geometry.width;
      if (staticImage || !transform || transform.kind !== "downsample" || !(scale > 0 && scale < 1)
        || transform.sourceWidth !== geometry.width || transform.sourceHeight !== geometry.height
        || transform.width !== width || transform.height !== height || !Number.isFinite(transform.scale) || Math.abs(transform.scale - scale) > 1e-8
        || Math.abs(geometry.height * scale - height) > 1e-6) throw Error("Verified proportional downsample required; upscaling is forbidden: " + model.id);
    }
    model.sourceDimensions = [width, height];
    const [x, y, w, h] = model.crop;
    if (!model.crop.every(Number.isInteger) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) throw Error("Invalid crop");
    for (const pin of model.pins) if (![pin.x, pin.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) throw Error("Invalid annotation position");
    const photoFilter = x === 0 && y === 0 && w === width && h === height ? null : `crop=${w}:${h}:${x}:${y}`;
    for (const [kind, filter] of [["photo", photoFilter], ["raw", null]]) {
      const temporary = resolve(assets, `${model.id}-${kind}.next.webp`);
      if (!filter && isWebp) await copyFile(framePath, temporary);
      else execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", framePath, ...(filter ? ["-vf", filter] : []), "-frames:v", "1", "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", "-y", temporary]);
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
    Object.assign(item, { illustrated: true, sourceKind: staticImage ? source.kind : "video", frameTime: staticImage ? null : frame.decode.mediaTime, sourcePublishedAt: staticImage ? source.publishedAt : undefined, frameSHA256: hash(raw), sourceFrameSHA256: model.sourceFrameSHA256, frameSize: raw.length, imageQuality: model.imageQuality });
  } else if (model.pins?.length) throw Error("Do not publish pins without their matching front image");
  const evidenceIds = new Set();
  for (const evidence of model.protectionEvidence || []) {
    if (!/^[a-z0-9-]+$/.test(evidence.id) || evidenceIds.has(evidence.id)) throw Error("Invalid protection evidence identity");
    evidenceIds.add(evidence.id);
    const testCase = cases.get(evidence.caseId);
    const staticEvidence = testCase?.sourceKind === "forum-image";
    const hosted = registry?.assets?.find((asset) => asset.path === evidence.assetPath);
    const original = registry?.assets?.find((asset) => asset.path === (evidence.rawAssetPath || evidence.assetPath));
    if (!testCase || !hosted || !original || hosted.vehicleId !== model.id || original.vehicleId !== model.id
      || (staticEvidence ? evidence.sourceTime !== null : !Number.isFinite(evidence.sourceTime) || Math.abs(testCase.sourceTime - evidence.sourceTime) > .000001)) throw Error("Protection screenshot and case mismatch");
    const framePath = privatePath(evidence.framePath);
    let body = await readFile(framePath);
    const proofBytes = await readFile(privatePath(evidence.frameSnapshotPath));
    const proof = JSON.parse(proofBytes);
    if (hash(body) !== original.sha256 || body.length !== original.bytes || hash(proofBytes) !== evidence.frameSnapshotSHA256) throw Error("Protection screenshot byte/proof mismatch");
    if (proof.error || proof.blocked || proof.challenge) throw Error("Protection screenshot source was blocked");
    const geometry = staticEvidence ? await validateStaticFrame(proof, { url: testCase.sourceUrl, imageUrl: testCase.sourceImageUrl, publishedAt: testCase.sourcePublishedAt }, hash(body)) : proof.decode;
    if (!staticEvidence && (!proof.url?.startsWith(testCase.sourceUrl) || !geometry || Math.abs(geometry.mediaTime - evidence.sourceTime) > .000001)) throw Error("Protection screenshot source/time mismatch");
    if (original.width !== geometry.width || original.height !== geometry.height || !isHdSource(original.width, original.height)) throw Error("Native HD protection screenshot required");
    if (evidence.crop) {
      const [x, y, w, h] = evidence.crop;
      if (evidence.crop.length !== 4 || !evidence.crop.every(Number.isInteger) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > original.width || y + h > original.height || hosted.width !== w || hosted.height !== h) throw Error("Invalid protection screenshot crop");
      body = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", framePath, "-vf", `crop=${w}:${h}:${x}:${y}`, "-frames:v", "1", "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", "-f", "webp", "pipe:1"], { maxBuffer: 32 * 1024 * 1024 });
    }
    if (hash(body) !== hosted.sha256 || body.length !== hosted.bytes) throw Error("Protection crop differs from its pinned asset");
    for (const asset of [hosted, original]) for (const url of [asset.url, asset.rawUrl]) if (!/^[a-f0-9]{40}$/.test(asset.commit) || !url?.startsWith("https://") || !url.includes(asset.commit)) throw Error("Unpinned protection screenshot");
    const file = `weakpoints-${model.id}-evidence-${evidence.id}.${hosted.sha256.slice(0, 16)}.webp`;
    await writeFile(resolve(assets, file), body);
    report.publishedFiles.push({ file, bytes: body.length, sha256: hosted.sha256, modelId: model.id, evidenceId: evidence.id, kind: "protection-evidence" });
    evidence.imageUrl = hosted.url;
    evidence.imageFallbackUrl = hosted.rawUrl;
    evidence.rawUrl = original.url;
    evidence.rawFallbackUrl = original.rawUrl;
    evidence.sourceDimensions = [hosted.width, hosted.height];
    for (const key of ["framePath", "frameSnapshotPath", "frameSnapshotSHA256"]) delete evidence[key];
  }
  if (model.defaultEvidenceId && !evidenceIds.has(model.defaultEvidenceId)) throw Error("Default protection screenshot is missing");
  report.models.push(item);
  for (const key of ["wikiSnapshot", "wikiSnapshotPath", "wikiSnapshotSHA256", "frameSnapshot", "frameSnapshotPath", "frame", "framePath", "testContextEvidence", "testCaseEvidence", "captureSHA256", "originalFrameSHA256", "overview", "comparison", "limits", "ammo", "evidenceFrames"]) delete model[key];
  for (const advice of model.videoAdvice || []) delete advice.evidence;
}
if (data.coverage?.illustratedCount !== report.models.filter((model) => model.illustrated).length) throw Error("Illustration total must match the verified main images, including supplemental samples");
if (/\/vol1\/|\/home\/|artifacts\//.test(JSON.stringify(data))) throw Error("Private evidence paths must not enter the public sample payload");
const symbols = await readFile(resolve(project, "src/assets/WTSymbols.ttf"));
const fontFile = `weakpoints-symbols.${hash(symbols).slice(0, 16)}.ttf`;
await writeFile(resolve(assets, fontFile), symbols);
report.supportFiles = [{ file: fontFile, bytes: symbols.length, sha256: hash(symbols), kind: "symbol-font" }];
const css = Buffer.from((await readFile(new URL("preview.css", import.meta.url), "utf8")).replaceAll("__SYMBOL_FONT__", fontFile));
const js = Buffer.from("const SAMPLE = " + JSON.stringify(data) + ";\n" + await readFile(new URL("preview.js", import.meta.url), "utf8"));
const cssFile = `weakpoints-preview.${hash(css).slice(0, 16)}.css`, jsFile = `weakpoints-preview.${hash(js).slice(0, 16)}.js`;
await writeFile(resolve(assets, cssFile), css); await writeFile(resolve(assets, jsFile), js);
const html = (await readFile(new URL("preview.html", import.meta.url), "utf8")).replace("__STYLE__", "./assets/" + cssFile).replace("__SCRIPT__", "./assets/" + jsFile).replaceAll("__SYMBOL_FONT__", fontFile);
if (/__STYLE__|__SCRIPT__|__SYMBOL_FONT__|<script(?![^>]*src=)/.test(html)) throw Error("Unresolved or inline script");
await writeFile(resolve(out, "weakpoints-preview.html"), html);
await writeFile(resolve(captures, "build-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: out, wikiModels: report.models.length, illustratedModels: report.models.filter((m) => m.illustrated).length, images: report.publishedFiles.length, imageBytes: report.publishedFiles.reduce((n, f) => n + f.bytes, 0) }));
