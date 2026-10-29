import settings from "./config/player-stats.json";

type Manifest = {
  schemaVersion: number;
  resource: string;
  sha256: string;
  bytes: number;
  path: string;
};
type Saved = { manifest: Manifest; body: string };
const MEMORY_LIMIT = 96;
const memory = new Map<string, { value: unknown; until: number }>();
const pending = new Map<string, Promise<unknown>>();
const writes = new Map<string, Promise<void>>();
const prefix = "wt-public-resources-v1:";
function deadline<T>(request: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}
const resourceName =
  /^(calendar|config|appearance|research-catalog|(?:vehicles|prices)-(usa|germany|ussr|britain|japan|china|italy|france|sweden|israel)|price-history-[a-z0-9_-]{1,100})$/i;
function validManifest(value: unknown, resource: string): value is Manifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Manifest;
  return (
    m.schemaVersion === 1 &&
    m.resource === resource &&
    /^[a-f0-9]{64}$/.test(m.sha256) &&
    Number.isSafeInteger(m.bytes) &&
    m.bytes > 0 &&
    m.bytes <= 2_097_152 &&
    m.path === `public-data/objects/${m.sha256}`
  );
}
async function directory() {
  return (await navigator.storage.getDirectory()).getDirectoryHandle("wt-public-resources-v1", {
    create: true,
  });
}
async function stored(resource: string): Promise<Saved | null> {
  try {
    return await deadline(
      (async () => {
        const file = await (await (await directory()).getFileHandle(resource + ".json")).getFile();
        if (file.size > 2_200_000) throw new Error("缓存文件过大");
        return JSON.parse(await file.text()) as Saved;
      })(),
      250,
      "本地缓存读取超时",
    );
  } catch {
    /* OPFS may be unavailable in private browsing or storage-limited contexts. */
  }
  try {
    const text = localStorage.getItem(prefix + resource);
    return text && text.length <= 2_200_000 ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
function persist(resource: string, saved: Saved) {
  const previous = writes.get(resource) || Promise.resolve();
  const write = previous
    .catch(() => {})
    .then(async () => {
      const text = JSON.stringify(saved);
      try {
        const file = await (await directory()).getFileHandle(resource + ".json", { create: true });
        const output = await file.createWritable();
        try {
          await output.write(text);
          await output.close();
        } catch (error) {
          await output.abort().catch(() => {});
          throw error;
        }
        return;
      } catch {
        /* Only this resource's fallback key may be overwritten. */
      }
      try {
        localStorage.setItem(prefix + resource, text);
      } catch {
        /* Never evict user-owned data. */
      }
    });
  writes.set(resource, write);
  void write.finally(() => {
    if (writes.get(resource) === write) writes.delete(resource);
  });
}
async function decode(bytes: Uint8Array<ArrayBuffer>, manifest: Manifest) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  if (bytes.byteLength !== manifest.bytes || hash !== manifest.sha256)
    throw new Error("公共资料校验失败，请稍后重试。");
  const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { body, value: JSON.parse(body) as unknown };
}
function remember(resource: string, value: unknown) {
  memory.delete(resource);
  memory.set(resource, { value, until: Date.now() + 60_000 });
  while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value!);
  return value;
}
async function load(resource: string) {
  // Start the network budget before touching storage. OPFS can stall on some
  // browsers; neither a cache read nor a response stream may hold the UI forever.
  const signal = AbortSignal.timeout(15_000);
  const old = await stored(resource);
  const base =
    import.meta.env.VITE_WT_CATALOG_SOURCE === "preview" &&
    import.meta.env.VITE_WT_PRICE_SOURCE !== "production" &&
    /^(prices-|price-history-)/.test(resource)
      ? settings.apiBaseUrl + "/sales-prices-preview/prices"
      : settings.apiBaseUrl;
  try {
    // No account/device headers: these read models are identical for every visitor.
    const response = await fetch(`${base}/public-data/manifest/${resource}`, {
      credentials: "omit",
      signal,
    });
    if (!response.ok) throw new Error("公共资料暂时无法更新。");
    const manifest: unknown = await response.json();
    if (!validManifest(manifest, resource)) throw new Error("公共资料版本无效。");
    if (old && old.manifest?.sha256 === manifest.sha256 && typeof old.body === "string") {
      try {
        return remember(
          resource,
          (await decode(new TextEncoder().encode(old.body), manifest)).value,
        );
      } catch {
        /* Repair a damaged local copy from the immutable HTTP resource. */
      }
    }
    const object = await fetch(`${base}/${manifest.path}`, {
      credentials: "omit",
      cache: "force-cache",
      signal,
    });
    if (!object.ok) throw new Error("公共资料暂时无法读取。");
    const decoded = await decode(new Uint8Array(await object.arrayBuffer()), manifest);
    persist(resource, { manifest, body: decoded.body });
    return remember(resource, decoded.value);
  } catch (error) {
    // A failed update never destroys the last verified resource or changes its provenance.
    if (old && validManifest(old.manifest, resource) && typeof old.body === "string") {
      try {
        return remember(
          resource,
          (await decode(new TextEncoder().encode(old.body), old.manifest)).value,
        );
      } catch {
        /* Corrupt persisted data must not become an offline fallback. */
      }
    }
    throw error;
  }
}
export async function readPublicResource<T>(
  resource: string,
  signal?: AbortSignal,
  refresh = false,
): Promise<T> {
  if (!resourceName.test(resource)) throw new Error("不支持的公共资料类型。");
  signal?.throwIfAborted();
  if (refresh) memory.delete(resource);
  const cached = memory.get(resource);
  if (cached && cached.until > Date.now()) return cached.value as T;
  let request = pending.get(resource);
  if (!request) {
    request = deadline(load(resource), 18_000, "资料读取超时，请重试。").finally(() =>
      pending.delete(resource),
    );
    pending.set(resource, request);
  }
  if (!signal) return request as Promise<T>;
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    request!.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (!signal.aborted) resolve(value as T);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
