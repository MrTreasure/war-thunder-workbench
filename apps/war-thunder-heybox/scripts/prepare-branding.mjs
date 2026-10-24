import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const root = new URL("../../../", import.meta.url);
// Existing artwork only: verify original bytes, crop/resize and composite the
// game logo geometry. No generated illustration or program-drawn substitute.
const branding = JSON.parse(await readFile(new URL("data/branding.json", root), "utf8"));
const sourceDir = new URL("artifacts/heybox-branding/", root);
const output = new URL("../assets/", import.meta.url);
await mkdir(output, { recursive: true });
const hashes = {};
for (const [id, file] of [
  ["logo", "logo.svg"],
  ["background", "background.jpg"],
]) {
  const asset = branding.assets.find((a) => a.id === id);
  const bytes = await readFile(new URL(file, sourceDir));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== asset.sourceSha256) throw Error("Branding source integrity mismatch: " + id);
  hashes[id] = { source: asset.source, sourcePage: asset.sourcePage, sha256: hash };
}
const background = await readFile(new URL("background.jpg", sourceDir));
const logo = await sharp(await readFile(new URL("logo.svg", sourceDir)))
  .resize({ width: 380, height: 180, fit: "inside" })
  .negate({ alpha: false })
  .png()
  .toBuffer({ resolveWithObject: true });
const icon = await sharp(background)
  .resize(512, 512, { fit: "cover", position: "centre" })
  .modulate({ brightness: 0.6 })
  .composite([
    {
      input: logo.data,
      left: Math.floor((512 - logo.info.width) / 2),
      top: 512 - logo.info.height - 38,
    },
  ])
  .png()
  .toBuffer();
await sharp(icon).resize(200, 200).png().toFile(new URL("workbench-icon.png", output).pathname);
await sharp(background)
  .resize(960, 540, { fit: "cover" })
  .jpeg({ quality: 88 })
  .toFile(new URL("workbench-cover.jpg", output).pathname);
const assets = [];
for (const file of ["workbench-icon.png", "workbench-cover.jpg"]) {
  const bytes = await readFile(new URL(file, output));
  assets.push({
    path: "apps/war-thunder-heybox/assets/" + file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.byteLength,
  });
}
await writeFile(
  new URL("data/heybox-branding.json", root),
  JSON.stringify(
    {
      schemaVersion: 1,
      sources: hashes,
      transforms: {
        icon: "512px center crop, brightness 0.6, downsampled to 200px; original logo resized, monochrome inverted and composited",
        cover: "960x540 crop and JPEG encoding",
      },
      assets,
    },
    null,
    2,
  ) + "\n",
);
console.log("Prepared Heybox metadata artwork from verified existing assets.");
