import { saleWatchKey, normalizeSaleWatch } from "./sale-watch-storage";
import { workspaceKey } from "./workspace-context";
import type { WorkspaceDocument } from "./workspace-context";
import { validCart } from "./quotes";
import { validLineups } from "./lineups";
import { object, strings } from "./validation";

type Defaults = Record<string, { value: unknown; revision: number }>;
/** Fill only missing cloud keys once; never resurrect deletions or inherit another account's imports. */
export function collectGuestDefaults(
  storage: Storage,
  userId: string,
  documents: WorkspaceDocument[],
  pendingKeys: string[],
): Defaults {
  const marker = `wt-account-workspace-v1:${userId}:automatic-import`;
  if (!userId) return {};
  const imported = !!storage.getItem(marker);
  const watchMarker = `wt-account-workspace-v1:${userId}:sale-watch-import`;
  const importedWatch = !!storage.getItem(watchMarker);
  const claimKey = "wt-account-workspace-v1:guest-import-owners";
  const parsed: unknown = JSON.parse(storage.getItem(claimKey) || "{}");
  const owners: Record<string, string> = {};
  if (object(parsed)) {
    for (const [key, owner] of Object.entries(parsed)) {
      if (typeof owner === "string") owners[key] = owner;
    }
  }
  const next: Defaults = {};
  for (const key of Object.keys(storage).filter(workspaceKey)) {
    if (key === saleWatchKey) {
      if (importedWatch || pendingKeys.includes(key) || (owners[key] && owners[key] !== userId))
        continue;
      try {
        const raw = storage.getItem(key);
        if (!raw || raw.length > 1_000_000) continue;
        const local = normalizeSaleWatch(JSON.parse(raw));
        if (!local.length) continue;
        const remote = documents.find((d) => d.key === key);
        // A cleared/deleted cloud list stays cleared; old local snapshots cannot resurrect it.
        if (remote && !normalizeSaleWatch(remote.value).length) continue;
        const merged = normalizeSaleWatch([...normalizeSaleWatch(remote?.value), ...local]);
        if (JSON.stringify(merged) !== JSON.stringify(normalizeSaleWatch(remote?.value)))
          next[key] = { value: merged, revision: remote?.revision || 0 };
        owners[key] = userId;
      } catch {
        /* Malformed guest entries never replace an account list. */
      }
      continue;
    }
    if (imported) continue;
    if (
      documents.some((d) => d.key === key) ||
      pendingKeys.includes(key) ||
      (owners[key] && owners[key] !== userId)
    )
      continue;
    try {
      const raw = storage.getItem(key);
      if (!raw || raw.length > 1_000_000) continue;
      const value: unknown = JSON.parse(raw);
      const valid =
        key === "wt-workbench-cart-v1"
          ? validCart(value)
          : key.startsWith("wt-lineups-v1:")
            ? validLineups(value, 11)
            : object(value) &&
              typeof value.target === "string" &&
              value.target.length > 0 &&
              strings(value.owned) &&
              strings(value.pins) &&
              strings(value.banned);
      if (!valid) continue;
      owners[key] = userId;
      next[key] = { value, revision: 0 };
    } catch {
      /* Invalid guest data remains local. */
    }
  }
  storage.setItem(claimKey, JSON.stringify(owners));
  storage.setItem(marker, "1");
  storage.setItem(watchMarker, "1");
  return next;
}
