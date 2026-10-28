/** Only the isolated Render index is published here; production data is untouched. */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  directory = resolve(root, "dist/preview-catalog");
const manifest = JSON.parse(await readFile(resolve(root, "src/generated/manifest.json"), "utf8"));
const sha = (body) => createHash("sha256").update(body).digest("hex");
if (manifest.schemaVersion !== 4) throw Error("Expected CSV catalog");
await rm(directory, { recursive: true, force: true });
await mkdir(resolve(directory, "countries"), { recursive: true });
for (const [country, entry] of Object.entries(manifest.countries)) {
  const text = await readFile(resolve(root, "data/generated/countries", entry.key + ".js"), "utf8");
  if (
    entry.file !== `country-${country}.${sha(text).slice(0, 16)}.js` ||
    sha(text) !== entry.transportSha256 ||
    Buffer.byteLength(text) !== entry.transportBytes
  )
    throw Error("Country JS transport mismatch");
  await writeFile(resolve(directory, "countries", entry.file), text);
}
const index = `export default ${JSON.stringify(manifest)};\n`,
  indexFile = `manifest.${sha(index).slice(0, 16)}.js`;
await writeFile(resolve(directory, indexFile), index);
await writeFile(resolve(directory, "manifest.js"), index);
await writeFile(
  resolve(directory, "pointer.js"),
  `export default ${JSON.stringify({ available: true, repository: "MrTreasure/oss-files", commit: sha(index).slice(0, 40), manifest: { path: "war-thunder/catalog/" + indexFile, sha256: sha(index), bytes: Buffer.byteLength(index) } })};\n`,
);
console.log("Prepared CSV JS preview catalog; production pointers unchanged.");
