/** Remove only obsolete public vehicle payloads from this application's publication input. */
import { readdir, unlink } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
const countries = "(?:usa|germany|ussr|britain|japan|china|italy|france|sweden|israel)";
const dataModule = new RegExp(
  `^(?:country-${countries}|vehicle-facts-${countries})\\.[a-f0-9]{16}(?:\\.[A-Za-z0-9_-]{8,})?\\.js$`,
);
const oldCsv = new RegExp(
  `^country-${countries}-(?:core|modifications|rewards|performance|loadouts)\\.[a-f0-9]{16}\\.csv\\.gz$`,
);
async function files(directory) {
  try {
    return await readdir(directory, { recursive: true, withFileTypes: false });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
export async function cleanRetiredVehicleAssets(root, dist, { flatAssets = false } = {}) {
  const current = new Set((await files(dist)).map((file) => file.replaceAll("\\", "/")));
  const removed = [];
  for (const file of await files(root)) {
    const path = file.replaceAll("\\", "/");
    const base = path.endsWith(".js.gz") ? path.slice(0, -3) : path;
    if (current.has(flatAssets ? "assets/" + base : base) || current.has(path)) continue;
    const segments = (flatAssets ? "assets/" + base : base).split("/");
    const retiredAsset =
      segments.length === 2 &&
      segments[0] === "assets" &&
      (dataModule.test(segments[1]) || /^chunk\.[A-Za-z0-9_-]{8,}\.gz$/.test(segments[1]));
    const retiredCatalog =
      segments[0] === "preview-catalog" &&
      ((segments.length === 3 &&
        segments[1] === "countries" &&
        (dataModule.test(segments[2]) || oldCsv.test(segments[2]))) ||
        (segments.length === 2 && /^manifest\.[a-f0-9]{16}\.js$/.test(segments[1])));
    if (!retiredAsset && !retiredCatalog) continue;
    await unlink(resolve(root, file));
    removed.push(path);
  }
  return removed;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(import.meta.dirname, "../dist");
  for (const target of process.argv.slice(2)) {
    const removed = await cleanRetiredVehicleAssets(resolve(target), dist);
    console.log(
      JSON.stringify({
        retiredVehicleResourcesRemoved: removed.length,
        target: relative(resolve(import.meta.dirname, ".."), target),
      }),
    );
  }
}
