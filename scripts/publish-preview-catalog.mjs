/** Publish only preview data resources; preserve the exact current application HTML. */
import { readFile, writeFile, mkdir, readdir, copyFile, rename, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "..");
const destination = "/vol1/1000/appdata/nginx/public/resume/muse/war-thunder-trees";
const before = await readFile(resolve(destination, "index.html"));
function run(args) {
  const p = spawnSync("pnpm", args, { cwd: root, stdio: "inherit" });
  if (p.status !== 0) throw Error("Preview data preparation failed");
}
run(["exec", "node", "scripts/prepare-data.mjs"]);
run(["exec", "node", "scripts/check-data.mjs"]);
run(["exec", "node", "scripts/build-preview-catalog.mjs"]);
const source = resolve(root, "dist/preview-catalog"),
  target = resolve(destination, "preview-catalog");
await mkdir(resolve(target, "countries"), { recursive: true, mode: 0o755 });
for (const country of await readdir(resolve(source, "countries"))) {
  if (!/^country-[a-z]+\.[a-f0-9]{16}\.js$/.test(country)) throw Error("Invalid country resource");
  const output = resolve(target, "countries", country);
  await copyFile(resolve(source, "countries", country), output);
  await chmod(output, 0o644);
}
for (const name of await readdir(source))
  if (name !== "countries" && name !== "pointer.js") {
    if (!/^manifest(?:\.[a-f0-9]{16})?\.js$/.test(name)) throw Error("Invalid manifest resource");
    await copyFile(resolve(source, name), resolve(target, name));
    await chmod(resolve(target, name), 0o644);
  }
await writeFile(resolve(target, "pointer.js.next"), await readFile(resolve(source, "pointer.js")), {
  mode: 0o644,
});
await rename(resolve(target, "pointer.js.next"), resolve(target, "pointer.js"));
if (!(await readFile(resolve(destination, "index.html"))).equals(before))
  throw Error("Preview HTML changed during data-only publication");
run(["--dir", "/vol1/1000/workspace/cloudflare-sites", "run", "publish:render"]);
console.log(
  "Preview data resources published; unchanged HTML SHA-256: " +
    createHash("sha256").update(before).digest("hex"),
);
