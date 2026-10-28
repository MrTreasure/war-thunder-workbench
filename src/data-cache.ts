export type CacheBackend = "indexedDB" | "memory";
export const cacheLabel = (source: CacheBackend) =>
  source === "indexedDB" ? "IndexedDB 本地缓存" : "仅本次使用（本地缓存未写入）";
