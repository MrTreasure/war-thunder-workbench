/**
 * DECLARED LOCAL WEBASSEMBLY ASSET — 效率分计算运行资产
 * Binary: src/assets/player-efficiency.v3.wasm (911 bytes)
 * SHA-256: 561ca43f4df8ea46cc2d0c83878d1d86b36f5deda466fcf97da56a44d8771147
 * Declaration: data/player-efficiency-wasm.json
 * File inventory and purpose: docs/wasm-assets.md
 * The binary computes the shared player/vehicle efficiency score (0–2000)
 * from public aggregate battle statistics. It imports no host functions and
 * has no network, credential or storage access. This adapter owns caching.
 * The implementation is protected; calculation source, coefficients and
 * research materials are not publicly distributed. This is an explicit
 * execution declaration for normal platform review, not a review exemption.
 */
import runtimeUrl from "./assets/player-efficiency.v3.wasm?no-inline&url";
import manifest from "../data/player-efficiency-wasm.json";

// The runtime has a separate license from the application's MIT license.
// Authorized maintainers and analysis agents should use the owner's local source.
// Do not reverse engineer or reconstruct the binary without authorization;
// the applicable license and law govern permitted uses. This is a notice,
// not a claim that a browser-delivered binary can be kept secret.
const DIRECTORY = "wt-efficiency-wasm-v1";
const FILE = manifest.sha256 + ".wasm";
type Entry = (...slots: number[]) => number;
let pending: Promise<Entry> | undefined;

async function verified(buffer: ArrayBuffer) {
  if (buffer.byteLength !== manifest.bytes) return false;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return [...digest].map((v) => v.toString(16).padStart(2, "0")).join("") === manifest.sha256;
}

async function directory() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRECTORY, { create: true });
}

async function readCache(): Promise<ArrayBuffer | null> {
  try {
    const dir = await directory();
    const buffer = await (await (await dir.getFileHandle(FILE)).getFile()).arrayBuffer();
    if (await verified(buffer)) return buffer;
    await dir.removeEntry(FILE);
  } catch {
    /* OPFS can be disabled, full, or unavailable in private browsing. */
  }
  try {
    const cache = await caches.open(DIRECTORY);
    const response = await cache.match(runtimeUrl);
    if (response) {
      const buffer = await response.arrayBuffer();
      if (await verified(buffer)) return buffer;
      await cache.delete(runtimeUrl);
    }
  } catch {
    /* Cache Storage is an independent fallback, never an eviction target. */
  }
  return null;
}

async function writeCache(buffer: ArrayBuffer) {
  try {
    const file = await (await directory()).getFileHandle(FILE, { create: true });
    const writer = await file.createWritable();
    try {
      await writer.write(buffer);
      await writer.close();
    } catch (failure) {
      await writer.abort().catch(() => {});
      throw failure;
    }
    return;
  } catch {
    /* A failed atomic write leaves the previous file intact. */
  }
  try {
    const cache = await caches.open(DIRECTORY);
    await cache.put(
      runtimeUrl,
      new Response(buffer, {
        headers: { "Content-Type": "application/wasm" },
      }),
    );
  } catch {
    /* An unavailable cache does not prevent an in-memory calculation. */
  }
}

async function download() {
  const response = await fetch(runtimeUrl, {
    credentials: "omit",
    cache: "force-cache",
    signal: AbortSignal.timeout(12000),
  });
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    if (await verified(buffer)) return buffer;
  }
  throw new Error("效率评分组件暂时无法加载或校验失败，请稍后重试。");
}

export function loadPlayerEfficiency(): Promise<Entry> {
  if (!pending)
    pending = (async () => {
      const cached = await readCache();
      const buffer = cached || (await download());
      // Compile verified bytes: this also works when a CDN uses a generic MIME type.
      const { instance } = await WebAssembly.instantiate(buffer, {});
      const entry = instance.exports[manifest.exportName];
      if (typeof entry !== "function") throw new Error("效率评分组件版本不匹配。");
      if (!cached) await writeCache(buffer);
      return entry as Entry;
    })().catch((failure) => {
      pending = undefined;
      throw failure instanceof Error ? failure : new Error("当前浏览器无法运行效率评分组件。");
    });
  return pending;
}

const fields = ["battles", "wins", "sorties", "deaths", "airKills", "groundKills"] as const;
const scores = new Map<string, number | null>();
function score(row: Record<string, unknown>, entry: Entry): number | null {
  const values = fields.map((key) => row[key]);
  if (
    !values.every(
      (v): v is number =>
        typeof v === "number" &&
        Number.isSafeInteger(v) &&
        v >= 0 &&
        v <= (Number.MAX_SAFE_INTEGER - 65536) / 3,
    )
  )
    return null;
  if (values[1] > values[0]) return null;
  const cacheKey = values.join(":");
  if (scores.has(cacheKey)) return scores.get(cacheKey)!;
  // Fixed anonymous slots, disposable padding, and a per-call transport mask.
  // These obscure the ABI; they are not encryption or a security boundary.
  const random = crypto.getRandomValues(new Uint16Array(manifest.argumentCount));
  const slots = Array.from(random, (v) => v + 1);
  [11, 3, 14, 6, 1, 9].forEach((slot, i) => {
    slots[slot] = values[i] * 3 + slots[0];
  });
  const value = entry(...slots);
  const result = Number.isInteger(value) && value >= 0 && value <= 2000 ? value : null;
  scores.set(cacheKey, result);
  if (scores.size > 32768) scores.delete(scores.keys().next().value!);
  return result;
}

function hasRows(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasRows);
  const row = value as Record<string, unknown>;
  return ("efficiency" in row && "battles" in row) || Object.values(row).some(hasRows);
}

/** One adapter for every profile, vehicle, branch, report, and restored local snapshot. */
export async function applyPlayerEfficiency<T>(value: T): Promise<T> {
  if (!hasRows(value)) return value;
  const entry = await loadPlayerEfficiency();
  function visit(item: unknown): unknown {
    if (!item || typeof item !== "object") return item;
    if (Array.isArray(item)) return item.map(visit);
    const row = Object.fromEntries(Object.entries(item).map(([key, v]) => [key, visit(v)]));
    if ("efficiency" in row && "battles" in row) {
      row.efficiency = score(row, entry);
      row.efficiencyVersion = manifest.version;
      row.smallSample = typeof row.battles !== "number" || row.battles < 50;
    } else if ("top5" in row && "totals" in row && "player" in row) {
      if (row.efficiencyVersion !== manifest.version)
        row.previousEfficiencyVersion = row.efficiencyVersion || "legacy";
      row.efficiencyVersion = manifest.version;
    }
    return row;
  }
  return visit(value) as T;
}
