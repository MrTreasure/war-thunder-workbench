import { t } from "./i18n/core";
import settings from "./config/player-stats.json";

type Manifest = {
  schemaVersion: number;
  resource: string;
  sha256: string;
  bytes: number;
  path: string;
};
type Saved = { manifest: Manifest; body: string };
const MEMORY_LIMIT = 16;
const memory = new Map<string, { value: unknown; until: number }>();
const pending = new Map<string, Promise<unknown>>();
const writes = new Map<string, Promise<void>>();
const prefix = "wt-public-resources-v1:";
const resourceName =
  /^(calendar|config|appearance|research-catalog|vehicles-(usa|germany|ussr|britain|japan|china|italy|france|sweden|israel))$/;
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
    const file = await (await (await directory()).getFileHandle(resource + ".json")).getFile();
    if (file.size <= 2_200_000) return JSON.parse(await file.text());
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
    throw new Error(t("公共资料校验失败，请稍后重试。"));
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
  const old = await stored(resource);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
  try {
    // No account/device headers: these read models are identical for every visitor.
    const response = await fetch(`${settings.apiBaseUrl}/public-data/manifest/${resource}`, {
      credentials: "omit",
      signal,
    });
    if (!response.ok) throw new Error(t("公共资料暂时无法更新。"));
    const manifest: unknown = await response.json();
    if (!validManifest(manifest, resource)) throw new Error(t("公共资料版本无效。"));
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
    const object = await fetch(`${settings.apiBaseUrl}/${manifest.path}`, {
      credentials: "omit",
      cache: "force-cache",
      signal,
    });
    if (!object.ok) throw new Error(t("公共资料暂时无法读取。"));
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
export async function readPublicResource<T>(resource: string, signal?: AbortSignal): Promise<T> {
  if (!resourceName.test(resource)) throw new Error(t("不支持的公共资料类型。"));
  signal?.throwIfAborted();
  const cached = memory.get(resource);
  if (cached && cached.until > Date.now()) return cached.value as T;
  let request = pending.get(resource);
  if (!request) {
    request = load(resource).finally(() => pending.delete(resource));
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
