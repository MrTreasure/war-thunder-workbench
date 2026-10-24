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
  if (!userId || storage.getItem(marker)) return {};
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
  return next;
}
