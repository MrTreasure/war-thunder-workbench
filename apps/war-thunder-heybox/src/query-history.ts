import type { PlayerProfile } from "../../../src/player-stats-api";
import type { SDK } from "./api";
export type QueryRecord = Pick<PlayerProfile, "uid" | "snapshotId" | "nickname" | "fetchedAt">;
const KEY = "wt_query_history_v1";
export function readQueryRecords(value: unknown): QueryRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((v): v is QueryRecord => {
      if (
        !v ||
        typeof v !== "object" ||
        !/^\d{1,24}$/.test(v.uid) ||
        typeof v.snapshotId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(v.snapshotId) ||
        typeof v.fetchedAt !== "string" ||
        !Number.isFinite(Date.parse(v.fetchedAt)) ||
        seen.has(v.uid)
      )
        return false;
      seen.add(v.uid);
      return true;
    })
    .slice(0, 20)
    .map((v) => ({
      uid: v.uid,
      snapshotId: v.snapshotId,
      fetchedAt: v.fetchedAt,
      // History labels never replay a nickname that may since have been moderated.
      nickname: "玩家 #" + v.uid,
    }));
}
export function createQueryHistory(storage: SDK["storage"]) {
  let tail = Promise.resolve();
  let revision = 0;
  return {
    async load() {
      const at = revision;
      await tail;
      const { data } = await storage.getStorage<unknown>({ key: KEY });
      return at === revision ? readQueryRecords(data) : null;
    },
    save(rows: QueryRecord[]) {
      revision++;
      const data = readQueryRecords(rows);
      const next = tail.catch(() => {}).then(() => storage.setStorage({ key: KEY, data }));
      tail = next;
      return next;
    },
  };
}
