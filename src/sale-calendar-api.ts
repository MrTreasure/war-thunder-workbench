import { t } from "./i18n/core";
import { readPublicResource } from "./public-resource-api";
import type { SaleCalendarData, SaleVehicle } from "./sale-calendar-model";
import { vehicleStore } from "./vehicle-store";
const KEY = "wt-sale-read-cache-v3";
const CALENDAR_KEY = "wt-sale-calendar-cache-v1";
type Entry = { value: unknown; savedAt: number; expiresAt: number };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
let restored = false;
function validValue(path: string, value: unknown) {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return path === "sales"
    ? Array.isArray(data.events) &&
        typeof data.serverNow === "string" &&
        Number.isFinite(Date.parse(data.serverNow))
    : path.startsWith("sales/vehicles?") &&
        Array.isArray(data.items) &&
        typeof data.total === "number" &&
        Number.isFinite(data.total);
}
function validEntry(path: string, entry: unknown): entry is Entry {
  if (!entry || typeof entry !== "object") return false;
  const item = entry as Entry;
  return (
    Number.isFinite(item.savedAt) &&
    item.savedAt > 0 &&
    item.savedAt <= Date.now() &&
    Number.isFinite(item.expiresAt) &&
    item.expiresAt >= item.savedAt &&
    item.expiresAt <= item.savedAt + 30 * 60_000 &&
    validValue(path, item.value)
  );
}
function restore() {
  if (restored) return;
  restored = true;
  try {
    const text = localStorage.getItem(CALENDAR_KEY);
    const item: unknown = text && text.length <= 2_000_000 ? JSON.parse(text) : null;
    if (validEntry("sales", item)) entries.set("sales", item);
  } catch {
    /* Fall back to this tab's cache when persistent storage is unavailable. */
  }
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (Array.isArray(value))
      for (const row of value.slice(-48)) {
        if (
          Array.isArray(row) &&
          typeof row[0] === "string" &&
          validEntry(row[0], row[1]) &&
          (row[0] === "sales" || row[1].expiresAt > Date.now()) &&
          (!entries.has(row[0]) || entries.get(row[0])!.savedAt < row[1].savedAt)
        )
          entries.set(row[0], row[1]);
      }
  } catch {
    /* A broken transient cache cannot block the page. */
  }
}
function save(key: string, entry: Entry) {
  entries.delete(key);
  entries.set(key, entry);
  // Expiry controls freshness, not whether the last successful calendar is usable.
  for (const [name, item] of entries)
    if (name !== "sales" && item.expiresAt <= Date.now()) entries.delete(name);
  while (entries.size > 48) {
    const oldest = [...entries.keys()].find((name) => name !== "sales");
    if (!oldest) break;
    entries.delete(oldest);
  }
  if (key === "sales") {
    try {
      localStorage.setItem(CALENDAR_KEY, JSON.stringify(entry));
    } catch {
      /* Never evict watch lists, lineups, profiles or carts to make room. */
    }
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...entries]));
  } catch {
    /* Retain memory cache; do not evict other user data. */
  }
}
function observe<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
function cachedValue<T>(path: string, item: Entry): T {
  const value = item.value as T & { serverNow?: string };
  // Advance only the clock; official verification/provenance dates stay unchanged.
  return path === "sales" && value.serverNow
    ? {
        ...value,
        serverNow: new Date(Date.parse(value.serverNow) + Date.now() - item.savedAt).toISOString(),
      }
    : value;
}
/** Synchronous first paint, including expired data. Refresh separately without clearing it. */
export function cachedSaleCalendar(): SaleCalendarData | null {
  restore();
  const item = entries.get("sales");
  return item ? cachedValue<SaleCalendarData>("sales", item) : null;
}
async function loadPublicSaleData(path: string): Promise<unknown> {
  if (path === "sales") {
    const value = await readPublicResource<Omit<SaleCalendarData, "serverNow">>("calendar");
    return { ...value, serverNow: new Date().toISOString() };
  }
  const query = new URLSearchParams(path.split("?")[1]);
  const country = query.get("country") || "china";
  const state = await vehicleStore.ensure(country);
  const data: { country: string; items: SaleVehicle[]; checkedAt: string } = {
    country,
    items: [],
    checkedAt: state.value.checkedAt,
  };
  for (const [category, tree] of Object.entries(state.value.trees))
    for (const rank of tree?.ranks || [])
      for (const node of [...rank.research, ...rank.special])
        for (const unit of node.members) {
          const channel =
            unit.kind === "squadron"
              ? "excluded"
              : unit.market
                ? "market"
                : unit.store
                  ? "pack"
                  : unit.side === "research"
                    ? "sl"
                    : unit.kind === "gold" || (unit.premium && unit.price !== null)
                      ? "ge"
                      : "unknown";
          data.items.push({
            id: unit.id,
            name: unit.name,
            nameEn: unit.nameEn || "",
            country,
            category,
            channel,
            image: unit.thumbnailUrl || unit.imageUrl,
            rank: unit.rank,
            store: unit.store,
            market: unit.market,
            originalPrice:
              channel === "ge"
                ? {
                    currency: "GE",
                    amount: unit.price,
                    checkedAt: state.value.checkedAt,
                    source: state.value.sources?.[category]?.url || null,
                  }
                : channel === "pack"
                  ? {
                      currency: "CNY",
                      amount: unit.packPrice?.regularAmountCents ?? null,
                      checkedAt: unit.packPrice?.checkedAt ?? null,
                      source: unit.packPrice?.source || unit.store,
                    }
                  : null,
          });
        }
  const category = query.get("category") || "all",
    rank = query.get("rank") || "all";
  const search = (query.get("q") || "").toLowerCase().replace(/ /g, "").slice(0, 80);
  const items = data.items.filter(
    (v) =>
      ["ge", "pack", "bundle"].includes(v.channel) &&
      v.country === country &&
      (category === "all" || v.category === category) &&
      (rank === "all" || v.rank === rank) &&
      (v.id + v.name + (v.nameEn || "")).toLowerCase().replace(/ /g, "").includes(search),
  );
  return { items, total: items.length, checkedAt: data.checkedAt };
}
async function read<T>(path: string, ttl: number, signal?: AbortSignal, force = false): Promise<T> {
  restore();
  const item = entries.get(path);
  if (!force && item && item.expiresAt > Date.now()) {
    const result = cachedValue<T>(path, item);
    return observe(Promise.resolve(result), signal);
  }
  let request = pending.get(path);
  if (!request) {
    request = loadPublicSaleData(path)
      .then((value) => {
        if (!validValue(path, value)) throw new Error(t("日历资料格式异常，请稍后重试"));
        const savedAt = Date.now();
        save(path, { value, savedAt, expiresAt: savedAt + ttl });
        return value;
      })
      .finally(() => pending.delete(path));
    pending.set(path, request);
  }
  return observe(request as Promise<T>, signal);
}
export const readSaleCalendar = (signal?: AbortSignal, force = false) =>
  read<SaleCalendarData>("sales", 10 * 60_000, signal, force);
// Catalog versions are cached by country/hash. Per-query result TTLs would hide
// catalog updates and are unnecessary now that filtering is entirely local.
export const readSaleVehicles = (query: string, signal?: AbortSignal) =>
  observe(
    loadPublicSaleData("sales/vehicles?" + query) as Promise<{
      items: SaleVehicle[];
      total: number;
    }>,
    signal,
  );
