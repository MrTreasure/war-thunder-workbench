import settings from "./config/player-stats.json";
import { statsHeaders, StatsError, setStatsToken } from "./player-stats-api";

export type DecalKind = "configured" | "localization" | "announcement";
export type Decal = {
  id: string;
  kind: DecalKind;
  nameZh: string | null;
  nameEn: string | null;
  descriptionZh: string | null;
  descriptionEn: string | null;
  category: string;
  categoryName: string;
  groupName: string | null;
  priceGold: number | null;
  unlockId: string | null;
  unlockResolution: string;
  unlockSummary: { unlock_id: string; lines: string[] }[];
  unlockRules?: unknown[];
  attributes?: Record<string, unknown>;
  configurationBlocks?: unknown[];
  hideUntilUnlocked?: boolean | null;
  hiddenLanguages?: string[];
  imageUrl: string | null;
  sourceLabel: string;
  sourceUrls: string[];
  nameZhBasis?: string;
  acquisitions: {
    conditionZh: string;
    conditionOriginal: string;
    minimumRank: number;
    startAt: string;
    endAt: string;
    sourceUrl: string;
    newOrReturning: string;
  }[];
};
export type DecalPage = {
  items: Decal[];
  total: number;
  offset: number;
  limit: number;
  revision: string;
  summary: {
    configured: number;
    localization: number;
    announcement: number;
    images: number;
    sourceExportedAt: string;
    categories: { id: string; name: string; count: number }[];
  };
};
export type DecalDetail = { item: Decal; revision: string };
type Cached = { body: string; sha256: string; savedAt: number };
const prefix = "wt-decal-cache-v2:";
const memory = new Map<string, Cached>();
const pending = new Map<string, Promise<unknown>>();
const writes = new Map<string, Promise<void>>();
async function hash(text: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function directory() {
  return (await navigator.storage.getDirectory()).getDirectoryHandle("wt-decal-cache-v2", {
    create: true,
  });
}
async function saved(key: string): Promise<Cached | null> {
  if (memory.has(key)) return memory.get(key)!;
  let value: Cached | null = null;
  try {
    const file = await (await (await directory()).getFileHandle(key)).getFile();
    if (file.size <= 500_000) value = JSON.parse(await file.text());
  } catch {
    /* OPFS is optional; only this cache's own keys are used below. */
  }
  if (!value)
    try {
      const text = localStorage.getItem(prefix + key);
      if (text && text.length <= 500_000) value = JSON.parse(text);
    } catch {
      /* Cache cannot block queries. */
    }
  if (
    !value ||
    typeof value.body !== "string" ||
    !Number.isFinite(value.savedAt) ||
    value.savedAt > Date.now() ||
    value.sha256 !== (await hash(value.body))
  )
    return null;
  return value;
}
function store(key: string, entry: Cached) {
  memory.delete(key);
  memory.set(key, entry);
  while (memory.size > 24) memory.delete(memory.keys().next().value!);
  const write = (writes.get(key) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      try {
        const dir = await directory(),
          file = await dir.getFileHandle(key, { create: true });
        const output = await file.createWritable();
        try {
          await output.write(JSON.stringify(entry));
          await output.close();
        } catch (error) {
          await output.abort().catch(() => {});
          throw error;
        }
        // Evict this directory's oldest verified query files only.
        const files: { name: string; at: number }[] = [];
        for await (const [name, handle] of dir.entries())
          if (handle.kind === "file")
            files.push({ name, at: (await handle.getFile()).lastModified });
        files.sort((a, b) => b.at - a.at);
        await Promise.all(
          files
            .slice(24)
            .filter((f) => f.name !== key)
            .map((f) => dir.removeEntry(f.name)),
        );
        return;
      } catch {
        /* Browsers without OPFS retain a bounded localStorage fallback. */
      }
      try {
        localStorage.setItem(prefix + key, JSON.stringify(entry));
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
        if (keys.length > 12) {
          keys.sort((a, b) => {
            try {
              return (
                JSON.parse(localStorage.getItem(a)!).savedAt -
                JSON.parse(localStorage.getItem(b)!).savedAt
              );
            } catch {
              return 0;
            }
          });
          for (const name of keys.slice(0, keys.length - 12))
            if (name !== prefix + key) localStorage.removeItem(name);
        }
      } catch {
        /* Do not evict any user-owned data for cache quota. */
      }
    });
  writes.set(key, write);
  void write.finally(() => {
    if (writes.get(key) === write) writes.delete(key);
  });
}
function valid(value: unknown): value is DecalPage | DecalDetail {
  if (!value || typeof value !== "object") return false;
  const v = value as DecalPage & DecalDetail;
  return (
    /^[a-f0-9]{64}$/.test(v.revision) &&
    ((Array.isArray(v.items) && Number.isSafeInteger(v.total) && !!v.summary) ||
      (!!v.item && typeof v.item.id === "string"))
  );
}
export async function readDecals<T extends DecalPage | DecalDetail>(
  path: string,
  signal: AbortSignal,
  cached: (value: T) => void,
): Promise<T> {
  const headers = statsHeaders();
  if (!headers.Authorization) throw new StatsError("登录后可使用贴花查询。", "LOGIN_REQUIRED");
  const scope = headers.Authorization;
  const key = await hash(scope + ":" + path),
    old = await saved(key);
  signal.throwIfAborted();
  if (old) {
    const value: unknown = JSON.parse(old.body);
    if (valid(value)) {
      cached(value as T);
      if (Date.now() - old.savedAt < 60_000) return value as T;
    }
  }
  const flightKey = scope + ":" + path;
  let request = pending.get(flightKey);
  if (!request) {
    request = (async () => {
      const response = await fetch(`${settings.apiBaseUrl}/decals${path}`, {
        credentials: "omit",
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        if (response.status === 401 && statsHeaders().Authorization === scope) {
          setStatsToken("");
          window.dispatchEvent(new Event("wt-account-expired"));
        }
        throw new StatsError(
          failure?.message || "贴花资料暂时无法读取，请稍后重试。",
          failure?.code || "REQUEST_FAILED",
        );
      }
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > 500_000)
        throw new Error("贴花资料超过读取上限。");
      const value: unknown = JSON.parse(body),
        digest = await hash(body);
      const expected =
        response.headers.get("X-WT-Content-SHA256") ||
        response.headers.get("ETag")?.replace(/^W\//, "").replace(/^"|"$/g, "");
      if (!valid(value) || expected !== digest) throw new Error("贴花资料校验失败。");
      store(key, { body, sha256: digest, savedAt: Date.now() });
      return value;
    })().finally(() => pending.delete(flightKey));
    pending.set(flightKey, request);
  }
  const result = await request;
  signal.throwIfAborted();
  return result as T;
}
