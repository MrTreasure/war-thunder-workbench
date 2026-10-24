/** Emit only the dedicated Render preview catalog. Does not touch the live API pointer or Git CDN. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "src/generated/manifest.json"), "utf8"));
const directory = resolve(root, "dist/preview-catalog");
await mkdir(resolve(directory, "countries"), { recursive: true });
const sha = (text) => createHash("sha256").update(text).digest("hex");
for (const [country, entry] of Object.entries(manifest.countries)) {
  if (!new RegExp(`^country-${country}\\.[a-f0-9]{16}\\.js$`).test(entry.file))
    throw Error("Invalid preview country transport");
  const text = await readFile(
    resolve(root, "data/generated/countries", entry.file.replace(/\.js$/, ".json")),
    "utf8",
  );
  if (Buffer.byteLength(text) !== entry.bytes || sha(text) !== entry.sha256)
    throw Error("Preview country hash mismatch");
  await writeFile(
    resolve(directory, "countries", entry.file),
    `export default ${JSON.stringify(text)};\n`,
  );
}
const index = `export default ${JSON.stringify(manifest)};\n`;
await writeFile(resolve(directory, "manifest.js"), index);
await writeFile(
  resolve(directory, "pointer.js"),
  `export default ${JSON.stringify({ available: true, repository: "MrTreasure/oss-files", commit: sha(index).slice(0, 40), manifest: { path: "war-thunder/catalog/manifest.js", sha256: sha(index), bytes: Buffer.byteLength(index) } })};\n`,
);
console.log("Prepared independently hashed preview data; production pointers are unchanged.");
