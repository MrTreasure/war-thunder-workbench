import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { DataFile, DownloadProgress } from "./data-loader.ts";
import { downloadText } from "./data-loader.ts";
export type CacheBackend = "opfs" | "localStorage" | "memory";
export interface CacheResult<T> {
  value: T;
  source: CacheBackend | "network";
  saved: CacheBackend;
}
interface RecordEntry {
  schemaVersion: 1;
  sha256: string;
  bytes: number;
  body: string;
  accessedAt: number;
}
const PREFIX = "wt-data-cache-v1:";
const encoder = new TextEncoder();
const hash = (text: string) => bytesToHex(sha256(encoder.encode(text)));
export class BrowserDataCache {
  private directoryPromise: Promise<FileSystemDirectoryHandle | null> | null = null;
  private writable = true;
  private memory = new Map<string, { sha256: string; body: string; saved: CacheBackend }>();
  private directory: () => Promise<FileSystemDirectoryHandle | null>;
  private local: () => Storage | null;
  private download: typeof downloadText;
  constructor(
    directory: () => Promise<FileSystemDirectoryHandle | null> = async () => {
      if (!globalThis.isSecureContext || typeof navigator.storage?.getDirectory !== "function")
        return null;
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("war-thunder-data-v1", { create: true });
    },
    local: () => Storage | null = () => {
      try {
        return localStorage;
      } catch {
        return null;
      }
    },
    download: typeof downloadText = downloadText,
  ) {
    this.directory = directory;
    this.local = local;
    this.download = download;
  }
  private storage() {
    try {
      return this.local();
    } catch {
      return null;
    }
  }

  private async root() {
    if (!this.directoryPromise)
      this.directoryPromise = Promise.resolve()
        .then(() => this.directory())
        .catch(() => null);
    return this.directoryPromise;
  }
  private parse(raw: string, entry: DataFile): RecordEntry | null {
    try {
      if (raw.length > entry.bytes * 2 + 8192) return null;
      const row: unknown = JSON.parse(raw);
      if (typeof row !== "object" || !row) return null;
      const value = row as Partial<RecordEntry>;
      if (
        value.schemaVersion !== 1 ||
        value.sha256 !== entry.sha256 ||
        value.bytes !== entry.bytes ||
        typeof value.body !== "string" ||
        encoder.encode(value.body).byteLength !== entry.bytes ||
        hash(value.body) !== entry.sha256
      )
        return null;
      return value as RecordEntry;
    } catch {
      return null;
    }
  }
  private async read(
    entry: DataFile,
  ): Promise<{ record: RecordEntry; saved: CacheBackend } | null> {
    const root = await this.root();
    if (root)
      try {
        const handle = await root.getFileHandle(entry.key + ".json");
        const file = await handle.getFile();
        const record =
          file.size <= entry.bytes * 2 + 8192 ? this.parse(await file.text(), entry) : null;
        if (record) return { record, saved: "opfs" };
        // A version mismatch must preserve the previous file until a verified
        // replacement has been downloaded and committed successfully.
      } catch {
        /* Missing or inaccessible OPFS entries must not block the localStorage path. */
      }
    const storage = this.storage();
    if (!storage) return null;
    try {
      const key = PREFIX + entry.key;
      const raw = storage.getItem(key);
      if (!raw) return null;
      const record = this.parse(raw, entry);
      if (!record) {
        return null;
      }
      record.accessedAt = Date.now();
      try {
        storage.setItem(key, JSON.stringify(record));
      } catch {
        /* A readable cache remains usable if recency cannot be saved. */
      }
      return { record, saved: "localStorage" };
    } catch {
      return null;
    }
  }
  private async write(entry: DataFile, body: string): Promise<CacheBackend> {
    const record: RecordEntry = {
        schemaVersion: 1,
        sha256: entry.sha256,
        bytes: entry.bytes,
        body,
        accessedAt: Date.now(),
      },
      raw = JSON.stringify(record);
    const root = await this.root();
    if (root && this.writable) {
      let stream: FileSystemWritableFileStream | undefined;
      try {
        const file = await root.getFileHandle(entry.key + ".json", { create: true });
        stream = await file.createWritable();
        await stream.write(raw);
        await stream.close();
        try {
          this.storage()?.removeItem(PREFIX + entry.key);
        } catch {
          /* Remove only this app's redundant data entry. */
        }
        return "opfs";
      } catch {
        this.writable = false;
        if (stream)
          try {
            await stream.abort();
          } catch {
            /* A failed write must still fall back safely. */
          }
      }
    }
    const storage = this.storage();
    if (!storage) return "memory";
    const key = PREFIX + entry.key;
    try {
      storage.setItem(key, raw);
      return "localStorage";
    } catch (error) {
      const name =
        error instanceof DOMException
          ? error.name
          : typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "";
      if (!["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(name)) return "memory";
    }
    // Evict only data-cache keys, oldest first. Never touch carts, profiles or preferences.
    try {
      const candidates: { key: string; accessedAt: number }[] = [];
      for (let i = 0; i < storage.length; i++) {
        const candidate = storage.key(i);
        if (!candidate?.startsWith(PREFIX) || candidate === key) continue;
        let accessedAt = 0;
        try {
          accessedAt = Number(JSON.parse(storage.getItem(candidate) || "{}").accessedAt) || 0;
        } catch {}
        candidates.push({ key: candidate, accessedAt });
      }
      candidates.sort((a, b) => a.accessedAt - b.accessedAt);
      for (const candidate of candidates) {
        storage.removeItem(candidate.key);
        try {
          storage.setItem(key, raw);
          return "localStorage";
        } catch (error) {
          const name =
            error instanceof DOMException ? error.name : (error as { name?: string })?.name;
          if (!["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(name || ""))
            return "memory";
        }
      }
    } catch {
      /* Storage may become unavailable while eviction runs. */
    }
    return "memory";
  }
  async load<T>(
    entry: DataFile,
    validate: (value: unknown) => value is T,
    signal?: AbortSignal,
    progress?: (value: DownloadProgress) => void,
  ): Promise<CacheResult<T>> {
    signal?.throwIfAborted();
    const memory = this.memory.get(entry.key);
    if (memory?.sha256 === entry.sha256) {
      const value: unknown = JSON.parse(memory.body);
      if (validate(value)) return { value, source: "memory", saved: memory.saved };
      this.memory.delete(entry.key);
    }
    const cached = await this.read(entry);
    signal?.throwIfAborted();
    if (cached) {
      try {
        const value: unknown = JSON.parse(cached.record.body);
        if (validate(value)) {
          let saved = cached.saved;
          if (saved === "localStorage" && (await this.root()) && this.writable) {
            const promoted = await this.write(entry, cached.record.body);
            if (promoted === "opfs") saved = "opfs";
          }
          this.memory.set(entry.key, {
            sha256: entry.sha256,
            body: cached.record.body,
            saved,
          });
          return { value, source: cached.saved, saved };
        }
      } catch {
        /* Invalid schemas are refreshed from the network. */
      }
    }
    const body = await this.download(entry, signal, progress);
    signal?.throwIfAborted();
    if (hash(body) !== entry.sha256) throw Error("资料校验未通过，请重新读取");
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      throw Error("资料格式异常，请重新读取");
    }
    if (!validate(value)) throw Error("资料版本或国家不匹配，请重新读取");
    const saved = await this.write(entry, body);
    signal?.throwIfAborted();
    this.memory.set(entry.key, { sha256: entry.sha256, body, saved });
    return { value, source: "network", saved };
  }
}
export const dataCache = new BrowserDataCache();
export function cacheLabel(source: CacheBackend) {
  return source === "opfs"
    ? "OPFS 本地缓存"
    : source === "localStorage"
      ? "localStorage 本地缓存"
      : "仅本次使用（本地缓存未写入）";
}
