/** Stage only the public UI/resources; reviewed data stays behind the role-checked API. */
import { readFile, writeFile, mkdir, copyFile, readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const build = resolve(root, "artifacts/vehicle-weakpoints-20261102/build");
const destination = resolve(root, process.argv[2] || "dist");
await mkdir(resolve(destination, "assets"), { recursive: true });
for (const name of await readdir(resolve(build, "assets"))) {
  if (!/^weakpoints[-.][a-zA-Z0-9_.-]+\.(?:webp|css|js|ttf)$/.test(name)) throw Error("Unexpected weakpoint output");
  const body = await readFile(resolve(build, "assets", name));
  if (!name.includes(createHash("sha256").update(body).digest("hex").slice(0, 16))) throw Error("Weakpoint output hash mismatch");
  if (name.endsWith(".js") && body.includes(Buffer.from("const SAMPLE = {"))) throw Error("Private models must not be embedded in a public script");
  await copyFile(resolve(build, "assets", name), resolve(destination, "assets", name));
}
await copyFile(resolve(build, "weakpoints-preview.html"), resolve(destination, "weakpoints-preview.html"));
// Retire only the old public data-bearing scripts. Existing unrelated hashes,
// image assets, user documents and country transports remain untouched.
const retired = [];
for (const name of await readdir(resolve(destination, "assets"))) {
  if (/^weakpoints-preview\.[a-f0-9]{16}\.js$/.test(name)) {
    await unlink(resolve(destination, "assets", name)); retired.push(name);
  }
}
await writeFile(resolve(root, "artifacts/private-weakpoints-handoff/20261105-paused/public-stage.json"), JSON.stringify({ at: new Date().toISOString(), destination, retiredDataScripts: retired, privatePayloadUploaded: false }, null, 2) + "\n");
console.log(JSON.stringify({ staged: true, retiredDataScripts: retired.length, privatePayloadUploaded: false }));
