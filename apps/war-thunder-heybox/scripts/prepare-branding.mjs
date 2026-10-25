import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const root = new URL("../../../", import.meta.url);
const configURL = new URL("data/heybox-branding.json", root);
const branding = JSON.parse(await readFile(configURL, "utf8"));
const sourceDir = new URL("artifacts/heybox-branding-sky-odyssey/", root);
const output = new URL("../assets/", import.meta.url);
await mkdir(sourceDir, { recursive: true });
await mkdir(output, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function source(id, file) {
  const record = branding.sources[id];
  const url = new URL(record.source);
  if (
    url.protocol !== "https:" ||
    !["warthunder.com", "staticfiles.warthunder.com"].includes(url.hostname)
  )
    throw Error("Unexpected branding source");
  const cache = new URL(file, sourceDir);
  let bytes;
  try {
    bytes = await readFile(cache);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error("Branding source unavailable: " + id);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== record.sha256) throw Error("Branding source integrity mismatch: " + id);
    await writeFile(cache, bytes);
  }
  if (hash(bytes) !== record.sha256) throw Error("Branding source integrity mismatch: " + id);
  return bytes;
}
// Only crop/resize/composite the supplied official artwork and original logo.
const background = await source("background", "source.jpg");
const logo = await source("logo", "logo.svg");
const metadata = await sharp(background).metadata();
if (
  metadata.width !== branding.sources.background.width ||
  metadata.height !== branding.sources.background.height
)
  throw Error("Unexpected background dimensions");
async function logoLayers(spec) {
  const original = await sharp(logo)
    .resize({ width: spec.width, height: spec.height, fit: "inside" })
    .png()
    .toBuffer();
  // The black shadow uses the same official logo alpha, without drawing new geometry.
  const shadow = await sharp(original).blur(2).png().toBuffer();
  const white = await sharp(original).negate({ alpha: false }).png().toBuffer();
  return [
    { input: shadow, left: spec.left + 1, top: spec.top + 2 },
    { input: white, left: spec.left, top: spec.top },
  ];
}
const icon = branding.recipe.icon;
const working = await sharp(background)
  .extract(icon.crop)
  .resize(icon.workingSize, icon.workingSize)
  .composite(await logoLayers(icon.logo))
  .png()
  .toBuffer();
await writeFile(new URL("icon-master.png", sourceDir), working);
await sharp(working)
  .resize(icon.outputSize, icon.outputSize)
  .png()
  .toFile(new URL("workbench-icon.png", output).pathname);
const cover = branding.recipe.cover;
await sharp(background)
  .extract(cover.crop)
  .resize(cover.width, cover.height)
  .composite(await logoLayers(cover.logo))
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toFile(new URL("workbench-cover.jpg", output).pathname);
branding.assets = [];
for (const file of ["workbench-icon.png", "workbench-cover.jpg"]) {
  const bytes = await readFile(new URL(file, output));
  const info = await sharp(bytes).metadata();
  branding.assets.push({
    path: "apps/war-thunder-heybox/assets/" + file,
    sha256: hash(bytes),
    bytes: bytes.byteLength,
    width: info.width,
    height: info.height,
  });
}
await writeFile(configURL, JSON.stringify(branding, null, 2) + "\n");
console.log("Prepared J-16 icon and cover from SHA256-verified official artwork.");
