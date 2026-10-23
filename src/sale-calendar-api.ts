import { statsRequest } from "./player-stats-api";
import type { SaleCalendarData, SaleVehicle } from "./sale-calendar-model";
const KEY = "wt-sale-read-cache-v3";
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
function restore() {
  if (restored) return;
  restored = true;
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (Array.isArray(value))
      for (const row of value.slice(-48)) {
        if (
          Array.isArray(row) &&
          typeof row[0] === "string" &&
          row[1] &&
          typeof row[1].savedAt === "number" &&
          row[1].savedAt <= Date.now() &&
          Number.isFinite(row[1].expiresAt) &&
          row[1].expiresAt <= row[1].savedAt + 30 * 60_000 &&
          row[1].expiresAt > Date.now() &&
          validValue(row[0], row[1].value)
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
  for (const [name, item] of entries) if (item.expiresAt <= Date.now()) entries.delete(name);
  while (entries.size > 48) entries.delete(entries.keys().next().value!);
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
async function read<T>(path: string, ttl: number, signal?: AbortSignal, force = false): Promise<T> {
  restore();
  const item = entries.get(path);
  if (!force && item && item.expiresAt > Date.now()) {
    // A cached schedule must not turn the browser clock back to its fetch time.
    const value = item.value as T & { serverNow?: string };
    const result =
      path === "sales" && value.serverNow
        ? {
            ...value,
            serverNow: new Date(
              Date.parse(value.serverNow) + Date.now() - item.savedAt,
            ).toISOString(),
          }
        : value;
    return observe(Promise.resolve(result), signal);
  }
  let request = pending.get(path);
  if (!request) {
    request = statsRequest<T>(path)
      .then((value) => {
        if (!validValue(path, value)) throw new Error("日历资料格式异常，请稍后重试");
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
export const readSaleVehicles = (query: string, signal?: AbortSignal) =>
  read<{ items: SaleVehicle[]; total: number }>("sales/vehicles?" + query, 30 * 60_000, signal);
