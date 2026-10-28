/** Local-only, reproducible data benchmark. Never queries the game or user accounts. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import os from "node:os";

const phase = process.argv[2] || "baseline";
if (!["baseline", "after"].includes(phase)) throw Error("Expected baseline or after");
const folder = "artifacts/vehicle-loading-benchmark-20261028";
await mkdir(folder, { recursive: true });
const digest = (x) => createHash("sha256").update(x).digest("hex");
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
function time(fn, iterations = 21) {
  for (let i = 0; i < 3; i++) fn();
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  return { iterations, p50Ms: percentile(times, 0.5), p95Ms: percentile(times, 0.95) };
}
const manifest = JSON.parse(await readFile("src/generated/manifest.json", "utf8"));
if (phase === "baseline") {
  try {
    await readFile(`${folder}/baseline.json`);
    throw Error("Baseline already frozen; do not overwrite it");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const rows = [];
for (const [country, entry] of Object.entries(manifest.countries)) {
  const input = await readFile(`data/generated/countries/${entry.key}.json`, "utf8");
  const sha256 = digest(input);

  if (phase === "baseline") await writeFile(`${folder}/${country}.json`, input);
  else if (digest(await readFile(`${folder}/${country}.json`)) !== sha256)
    throw Error("Benchmark source changed: " + country);
  const transport = `export default ${JSON.stringify(input)};\n`;
  const row = {
    country,
    sha256,
    jsonBytes: Buffer.byteLength(input),
    gzipBytes: gzipSync(input, { level: 9 }).length,
    brotliBytes: brotliCompressSync(input, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      .length,
    jsTransportGzipBytes: gzipSync(transport, { level: 9 }).length,
    jsonParse: time(() => JSON.parse(input)),
    oldCacheReadCpu: time(() => {
      const record = JSON.parse(
        JSON.stringify({
          schemaVersion: 1,
          sha256,
          bytes: Buffer.byteLength(input),
          body: input,
          accessedAt: 0,
        }),
      );
      digest(record.body);
      JSON.parse(record.body);
    }, 11),
  };
  if (phase === "after") {
    const { countryBody, encodeCsv, decodeCsv, restoreCountry } =
      await import("../src/country-csv.mjs");
    const payload = JSON.parse(input),
      csv = encodeCsv(countryBody(payload));
    row.csvBytes = Buffer.byteLength(csv);
    row.csvGzipBytes = gzipSync(csv, { level: 9 }).length;
    row.csvJsGzipBytes = gzipSync(`export default ${JSON.stringify(csv)};\n`, { level: 9 }).length;
    row.csvDecode = time(() => restoreCountry(decodeCsv(csv), payload), 11);
  }
  rows.push(row);
}
const report = {
  phase,
  at: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
  },
  scope:
    "Local CPU/serialization only; excludes network, rendering and browser storage. Warmup 3, p50/p95 from repeated runs; oldCacheReadCpu includes envelope serialization cost as a conservative composite.",
  rows,
};
await writeFile(`${folder}/${phase}.json`, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    phase,
    countries: rows.length,
    jsonBytes: rows.reduce((n, x) => n + x.jsonBytes, 0),
    gzipBytes: rows.reduce((n, x) => n + x.gzipBytes, 0),
    csvGzipBytes: phase === "after" ? rows.reduce((n, x) => n + x.csvGzipBytes, 0) : undefined,
    report: `${folder}/${phase}.json`,
  }),
);
