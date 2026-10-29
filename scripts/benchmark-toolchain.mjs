/** Local CLI timings only; no browser, network, deployment or user-data access. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, dirname, relative } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--report")
  throw Error("Usage: pnpm run benchmark:toolchain --report artifacts/<report>.json");
const target = resolve(root, args[1]);
if (!target.startsWith(resolve(root, "artifacts") + "/") || !target.endsWith(".json"))
  throw Error("Toolchain reports belong in ignored artifacts/");
const pkg = async (name) =>
  JSON.parse(await readFile(resolve(root, "node_modules", name, "package.json"), "utf8"));
const [typescript, vite, oxlint] = await Promise.all([
  pkg("typescript"),
  pkg("vite"),
  pkg("oxlint"),
]);
const config = JSON.parse(await readFile(resolve(root, "tsconfig.json"), "utf8"));
const report = {
  recordedAt: new Date().toISOString(),
  node: process.version,
  versions: { typescript: typescript.version, vite: vite.version, oxlint: oxlint.version },
  incremental: !!config.compilerOptions.incremental,
  timings: {},
};
for (const [name, file, flags] of [
  ["typecheck", "typescript/bin/tsc", ["--noEmit"]],
  ["lint", "oxlint/bin/oxlint", ["src", "vite.config.ts", "--deny-warnings"]],
]) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const result = spawnSync(process.execPath, [resolve(root, "node_modules", file), ...flags], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) throw Error(`${name} failed: ${result.stderr || result.stdout}`);
    samples.push(Math.round(performance.now() - start));
  }
  report.timings[name] = {
    samplesMs: samples,
    firstMs: samples[0],
    warmMeanMs: Math.round((samples[1] + samples[2]) / 2),
  };
}
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, report: relative(root, target) }));
