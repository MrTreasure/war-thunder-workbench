import { prepareStatsDevice, statsRequest, StatsError } from "./player-stats-api";
import { serializeProject } from "./map-editor-model";
import type { MapProject } from "./map-editor-model";

export type DrawingView = { x: number; y: number; w: number; h: number; crop: number[]; contours: boolean; grid: boolean; points: boolean };
type Completion = { requestId: string; ownerKey: string; planName: string; project: MapProject; view: DrawingView };
type Pending = Completion & { attempts: number; nextAt: number };
const databaseName = "wt-map-completion-outbox-v1";
let running = false;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pending", { keyPath: "requestId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function pending(): Promise<Pending[]> {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readonly");
    const request = tx.objectStore("pending").getAll();
    tx.oncomplete = () => resolve(request.result as Pending[]);
    tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
}
async function write(value: Pending | string, isNew = false) {
  const db = await open();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite"), store = tx.objectStore("pending");
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    if (typeof value === "string") store.delete(value);
    else if (!isNew) store.put(value);
    else {
      const count = store.count();
      count.onsuccess = () => { if (count.result >= 20) tx.abort(); else store.add(value); };
    }
  }); } finally { db.close(); }
}
/** Local queue contains JSON geometry only. Never mix records across account identities. */
export async function flushMapDrawingLogs() {
  if (running || !navigator.onLine) return;
  running = true;
  try {
    const queued = await pending();
    // Drop old low-content queue entries without sending them or touching saved plans.
    for (const row of queued) {
      if (row.project.items.length < 3) await write(row.requestId);
    }
    const rows = queued.filter(row => row.project.items.length >= 3 && row.nextAt <= Date.now());
    if (!rows.length) return;
    const session = await prepareStatsDevice();
    const ownerKey = session.user ? `user:${session.user.id}` : "guest";
    for (const row of rows.filter(row => row.ownerKey === ownerKey)) {
      const { attempts, nextAt: _nextAt, ...payload } = row;
      try {
        await statsRequest("map-drawings", payload, AbortSignal.timeout(20000));
        await write(row.requestId);
      } catch (error) {
        // Invalid data cannot become valid by retrying; the independently saved local plan is retained.
        if (error instanceof StatsError && ["INVALID_MAP_DRAWING", "DRAWING_CONFLICT", "BODY_TOO_LARGE"].includes(error.code)) await write(row.requestId);
        else await write({ ...row, attempts: attempts + 1, nextAt: Date.now() + Math.min(300000, 5000 * 2 ** Math.min(attempts, 6)) });
        break;
      }
    }
  } catch { /* Collection must never interrupt editing or show UI messages. */ }
  finally { running = false; }
}
export async function recordMapCompletion(completion: Omit<Completion, "requestId">) {
  if (completion.project.items.length < 3) return;
  try {
    serializeProject(completion.project);
    await write({ ...completion, requestId: crypto.randomUUID(), attempts: 0, nextAt: 0 }, true);
    await flushMapDrawingLogs();
  } catch { /* OPFS plans remain authoritative even when queue storage is unavailable. */ }
}
