import type { PricePreferenceDocument } from "./sale-price-api";
import type { PricePreferences } from "./sale-price-model";

const guestKey = "wt-sale-cart-preferences-v1:guest";
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PendingDocument = PricePreferenceDocument & { error?: string };
type Snapshot = PricePreferenceDocument & { ready: boolean; error: string };
type Remote = {
  read: () => Promise<PricePreferenceDocument>;
  write: (document: PricePreferenceDocument) => Promise<PricePreferenceDocument>;
  captureIdentity?: () => () => boolean;
};

function validItems(value: PricePreferences): PricePreferences {
  const result: PricePreferences = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [id, row] of Object.entries(value).slice(0, 60)) {
    if (!/^[a-z0-9_-]{1,100}$/i.test(id) || !row || typeof row.selected !== "boolean") continue;
    result[id] = { selected: row.selected };
  }
  return result;
}
function document(value: PricePreferenceDocument): PricePreferenceDocument {
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0)
    throw Error("购车计划版本无效，请导出待办后重新读取云端。");
  return { revision: value.revision, items: validItems(value.items) };
}
function sameSelection(a: PricePreferences, b: PricePreferences) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(
    (id) => (a[id]?.selected !== false) === (b[id]?.selected !== false),
  );
}

/** Stage locally; close/unmount flushes the final selection. A cached instance
 * keeps quick reopen and late acknowledgements from erasing newer edits. */
export class SalePreferenceDraft {
  readonly pendingKey: string;
  private snapshot: Snapshot = { revision: 0, items: {}, ready: false, error: "" };
  private baseline: PricePreferences = {};
  private dirty = false;
  private edits = 0;
  private epoch = 0;
  private pendingRaw: string | null = null;
  private flight: Promise<void> | null = null;
  private loading: Promise<void> | null = null;
  private submittedEdits = -1;
  private listeners = new Set<() => void>();
  readonly owner: string;
  private storage: StoragePort;
  private remote?: Remote;

  constructor(owner: string, storage: StoragePort, remote?: Remote) {
    this.owner = owner;
    this.storage = storage;
    this.remote = remote;
    this.pendingKey = "wt-sale-cart-preferences-v1:" + owner + ":pending";
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(change: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }
  private persist(error?: string) {
    const next: PendingDocument = { revision: this.snapshot.revision, items: this.snapshot.items };
    if (error) next.error = error;
    const raw = JSON.stringify(this.remote ? next : next.items);
    this.storage.setItem(this.remote ? this.pendingKey : guestKey, raw);
    this.pendingRaw = this.remote ? raw : null;
  }
  private clearPending(raw: string | null) {
    if (raw !== null && this.storage.getItem(this.pendingKey) === raw)
      this.storage.removeItem(this.pendingKey);
  }
  exportPending = () => {
    const memory = JSON.stringify({ revision: this.snapshot.revision, items: this.snapshot.items });
    try {
      return this.dirty ? memory : this.storage.getItem(this.pendingKey) || memory;
    } catch {
      return memory;
    }
  };

  load(discard = false) {
    const task = this.loadDocument(discard);
    this.loading = task;
    void task.finally(() => {
      if (this.loading === task) this.loading = null;
    });
    return task;
  }
  private async loadDocument(discard: boolean) {
    const epoch = ++this.epoch;
    const sameIdentity = this.remote?.captureIdentity?.();
    const previousError = this.snapshot.error;
    this.publish({ ready: false, error: "" });
    try {
      while (this.flight) await this.flight;
      if (epoch !== this.epoch) return;
      if (sameIdentity && !sameIdentity())
        throw Error("账号会话已变化，修改已保留；请重新打开购物车。");
      const next = this.remote
        ? document(await this.remote.read())
        : { revision: 0, items: validItems(JSON.parse(this.storage.getItem(guestKey) || "{}")) };
      if (epoch !== this.epoch) return;
      let raw = this.remote ? this.storage.getItem(this.pendingKey) : null;
      let pending: PendingDocument | null = this.dirty
        ? { ...this.snapshot, error: this.snapshot.error || previousError }
        : raw
          ? JSON.parse(raw)
          : null;
      if (discard) {
        this.clearPending(raw);
        raw = null;
        pending = null;
      }
      this.baseline = next.items;
      this.dirty = false;
      if (pending) {
        pending = { ...document(pending), error: pending.error };
        if (sameSelection(pending.items, next.items)) {
          this.clearPending(raw);
        } else if (pending.revision !== next.revision) {
          this.dirty = true;
          this.pendingRaw = raw;
          this.publish({
            ...pending,
            ready: false,
            error: "另一设备已修改购车计划。请先导出本机待同步记录，再重新读取云端。",
          });
          return;
        } else {
          this.dirty = true;
          this.pendingRaw = raw;
          this.publish({
            ...pending,
            ready: true,
            error: pending.error ? "上次同步失败，修改已保留；关闭购物车时重试。" : "",
          });
          return;
        }
      }
      this.pendingRaw = null;
      this.publish({ ...next, ready: true, error: "" });
    } catch (reason) {
      if (epoch === this.epoch)
        this.publish({ error: reason instanceof Error ? reason.message : "购车计划读取失败" });
    }
  }

  stage(items: PricePreferences) {
    if (!this.snapshot.ready) return;
    this.edits++;
    const next = validItems(items);
    this.dirty = !sameSelection(this.baseline, next);
    this.publish({ items: next, error: "" });
    try {
      if (this.remote && !this.dirty) {
        this.clearPending(this.pendingRaw);
        this.pendingRaw = null;
      } else this.persist();
    } catch {
      this.publish({ error: "本机无法保存待同步记录；请先导出清单，关闭时仍会尝试云端同步。" });
    }
  }

  flush = (): Promise<void> => {
    const sameIdentity = this.remote?.captureIdentity?.();
    const continueFlush = () => (sameIdentity && !sameIdentity() ? undefined : this.flush());
    if (this.loading) return this.loading.then(continueFlush);
    if (this.flight)
      return this.edits === this.submittedEdits ? this.flight : this.flight.then(continueFlush);
    if (!this.remote || !this.dirty || !this.snapshot.ready) return Promise.resolve();
    const submitted = { revision: this.snapshot.revision, items: this.snapshot.items };
    const edits = this.edits,
      raw = this.pendingRaw;
    this.submittedEdits = edits;
    this.flight = this.remote
      .write(submitted)
      .then((value) => {
        const saved = document(value);
        this.baseline = saved.items;
        if (edits === this.edits) {
          this.dirty = false;
          this.publish({ ...saved, error: "" });
          try {
            this.clearPending(raw);
          } catch {
            this.publish({ error: "云端已保存，本机待办暂时无法清理。" });
          }
          this.pendingRaw = null;
        } else {
          this.dirty = !sameSelection(saved.items, this.snapshot.items);
          this.publish({ revision: saved.revision });
          if (this.storage.getItem(this.pendingKey) === this.pendingRaw) this.persist();
        }
      })
      .catch((reason: unknown) => {
        const error = reason instanceof Error ? reason.message : "同步失败，已保留本账号待办";
        this.publish({ error });
        try {
          if (this.storage.getItem(this.pendingKey) === this.pendingRaw) this.persist(error);
        } catch {
          /* Retain the in-memory draft until storage becomes available. */
        }
      })
      .finally(() => {
        this.flight = null;
      });
    return this.flight;
  };
}
