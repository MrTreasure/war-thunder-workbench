import type { Valuation } from "./AccountValuation";
import type { PlayerProfile, StatsSession } from "./player-stats-api";
import rules from "../data/account-valuation-rules.json";
import { object } from "./validation";

const CACHE = "wt-stats-valuations-v1";
const TTL = 2 * 60 * 60 * 1000;
const MAX_BYTES = 2_000_000;
const scenarioKeys = ["normal", "discount", "secondHand"] as const;
const text = (v: unknown): v is string => typeof v === "string";
const optionalText = (v: unknown) => v == null || text(v);
const integer = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const nullableInteger = (v: unknown) => v === null || integer(v);
const date = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
const list = (v: unknown, check: (item: unknown) => boolean): v is unknown[] =>
  Array.isArray(v) && v.length <= 15000 && v.every(check);
const item = (v: unknown) =>
  object(v) && [v.id, v.name, v.country, v.category].every(text) && optionalText(v.rank);
function valid(value: unknown): value is Valuation {
  if (
    !object(value) ||
    !text(value.id) ||
    !text(value.snapshotId) ||
    !object(value.player) ||
    !text(value.player.uid) ||
    !text(value.player.nickname) ||
    !date(value.fetchedAt) ||
    !date(value.calculatedAt) ||
    !text(value.notice)
  )
    return false;
  if (
    ![
      value.observedCount,
      value.researchCount,
      value.geTotal,
      value.marketKnownGjnCents,
      value.marketUnpricedCount,
    ].every(integer)
  )
    return false;
  if (
    !object(value.scenarios) ||
    !object(value.rules) ||
    !object(value.rules.ge) ||
    !integer(value.rules.ge.cents) ||
    !integer(value.rules.ge.units) ||
    value.rules.ge.units === 0 ||
    !integer(value.rules.rpUnit) ||
    value.rules.rpUnit === 0 ||
    !object(value.rules.scenarios) ||
    !object(value.rpByCategory) ||
    !Object.values(value.rpByCategory).every(integer)
  )
    return false;
  for (const key of scenarioKeys) {
    const s = value.scenarios[key],
      rate = value.rules.scenarios[key];
    if (
      !object(s) ||
      !text(s.label) ||
      !integer(s.rpCents) ||
      !integer(s.geCents) ||
      !integer(s.packCents) ||
      !integer(s.knownCents) ||
      (s.manualCents !== undefined && !integer(s.manualCents)) ||
      !nullableInteger(s.totalCents)
    )
      return false;
    if (
      BigInt(s.rpCents) +
        BigInt(s.geCents) +
        BigInt(s.packCents) +
        BigInt((s.manualCents as number | undefined) || 0) !==
        BigInt(s.knownCents) ||
      (s.totalCents !== null && s.totalCents !== s.knownCents)
    )
      return false;
    if (
      !object(rate) ||
      !integer(rate.purchasePercent) ||
      rate.purchasePercent > 100 ||
      !object(rate.rpCents) ||
      !Object.values(rate.rpCents).every(integer)
    )
      return false;
  }
  if (
    value.ownership !== undefined &&
    (!object(value.ownership) ||
      typeof value.ownership.verified !== "boolean" ||
      !nullableInteger(value.ownership.ownedCount) ||
      !nullableInteger(value.ownership.unplayedCount) ||
      !optionalText(value.ownership.fetchedAt) ||
      !optionalText(value.ownership.notice))
  )
    return false;
  if (value.policyVersion !== undefined && !text(value.policyVersion)) return false;
  if (
    value.excluded !== undefined &&
    !list(value.excluded, (v) => item(v) && object(v) && text(v.reason) && optionalText(v.source))
  )
    return false;
  if (
    value.manual !== undefined &&
    !list(
      value.manual,
      (v) =>
        item(v) &&
        object(v) &&
        text(v.reason) &&
        optionalText(v.source) &&
        object(v.prices) &&
        scenarioKeys.every((key) => object(v.prices) && nullableInteger(v.prices[key])),
    )
  )
    return false;
  if (Array.isArray(value.manual)) {
    for (const key of scenarioKeys) {
      const total = value.manual.reduce((sum: bigint, entry: unknown) => {
        if (!object(entry) || !object(entry.prices) || !integer(entry.prices[key])) return sum;
        return sum + BigInt(entry.prices[key]);
      }, 0n);
      const scenario = (value.scenarios as Record<string, Record<string, number>>)[key];
      if (total !== BigInt(scenario.manualCents || 0)) return false;
    }
  }
  return (
    list(
      value.gold,
      (v) =>
        item(v) &&
        object(v) &&
        nullableInteger(v.ge) &&
        nullableInteger(v.amountCents) &&
        optionalText(v.source) &&
        optionalText(v.checkedAt),
    ) &&
    list(
      value.packs,
      (v) =>
        object(v) &&
        text(v.productId) &&
        text(v.title) &&
        list(v.vehicles, item) &&
        nullableInteger(v.amountCents) &&
        optionalText(v.checkedAt) &&
        optionalText(v.source),
    ) &&
    list(
      value.market,
      (v) =>
        item(v) &&
        object(v) &&
        nullableInteger(v.averageGjnCents) &&
        nullableInteger(v.sampleCount) &&
        optionalText(v.checkedAt) &&
        optionalText(v.method) &&
        optionalText(v.source),
    ) &&
    list(
      value.research,
      (v) =>
        item(v) &&
        object(v) &&
        nullableInteger(v.rp) &&
        optionalText(v.rpSource) &&
        optionalText(v.rpCheckedAt),
    ) &&
    list(
      value.unpriced,
      (v) =>
        object(v) &&
        text(v.id) &&
        text(v.name) &&
        text(v.reason) &&
        optionalText(v.country) &&
        optionalText(v.category) &&
        optionalText(v.rank) &&
        (v.rp === undefined || nullableInteger(v.rp)) &&
        optionalText(v.rpSource) &&
        optionalText(v.rpCheckedAt) &&
        (v.vehicles === undefined || list(v.vehicles, item)),
    )
  );
}
type Entry = {
  scope: string;
  uid: string;
  snapshotId: string;
  savedAt: number;
  expiresAt: number;
  value: Valuation;
};
export function valuationCacheScope(session: StatsSession | null) {
  return session ? (session.user ? `user:${session.user.id}` : "guest") : null;
}
function signature(value: Valuation["rules"]) {
  return JSON.stringify([
    value.ge.cents,
    value.ge.units,
    value.rpUnit,
    ...scenarioKeys.map((key) => [
      value.scenarios[key].purchasePercent,
      Object.entries(value.scenarios[key].rpCents).sort(([a], [b]) => a.localeCompare(b)),
    ]),
  ]);
}
function readEntries(): Entry[] {
  try {
    const body = localStorage.getItem(CACHE);
    if (!body || body.length > MAX_BYTES) return [];
    const parsed: unknown = JSON.parse(body);
    if (!object(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    const now = Date.now();
    return parsed.entries
      .filter(
        (entry): entry is Entry =>
          object(entry) &&
          text(entry.scope) &&
          text(entry.uid) &&
          text(entry.snapshotId) &&
          integer(entry.savedAt) &&
          integer(entry.expiresAt) &&
          entry.savedAt <= now + 60000 &&
          entry.expiresAt > now &&
          entry.expiresAt <= entry.savedAt + TTL &&
          valid(entry.value) &&
          entry.value.player.uid === entry.uid &&
          entry.value.snapshotId === entry.snapshotId,
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}
export function cachedValuation(
  scope: string | null,
  profile: Pick<PlayerProfile, "uid" | "snapshotId">,
): Valuation | null {
  if (!scope) return null;
  const found = readEntries().find(
    (entry) =>
      entry.scope === scope &&
      entry.uid === profile.uid &&
      entry.snapshotId === profile.snapshotId &&
      signature(entry.value.rules) === signature(rules),
  );
  return found ? { ...found.value, cached: true, localCached: true } : null;
}
export function cacheValuation(
  scope: string | null,
  profile: Pick<PlayerProfile, "uid" | "snapshotId">,
  value: Valuation,
) {
  if (
    !scope ||
    !valid(value) ||
    value.player.uid !== profile.uid ||
    value.snapshotId !== profile.snapshotId
  )
    return false;
  const savedAt = Date.now(),
    expiresAt = savedAt + TTL;
  if (!Number.isFinite(expiresAt) || expiresAt <= savedAt) return false;
  const entries = [
    { scope, uid: profile.uid, snapshotId: profile.snapshotId, savedAt, expiresAt, value },
    ...readEntries().filter(
      (entry) =>
        !(
          entry.scope === scope &&
          entry.uid === profile.uid &&
          entry.snapshotId === profile.snapshotId
        ),
    ),
  ].slice(0, 8);
  while (entries.length) {
    try {
      const body = JSON.stringify({ version: 1, entries });
      if (body.length > MAX_BYTES) {
        entries.pop();
        continue;
      }
      localStorage.setItem(CACHE, body);
      return true;
    } catch {
      entries.pop();
    }
  }
  return false;
}

export function forgetCachedValuation(
  scope: string | null,
  profile: Pick<PlayerProfile, "uid" | "snapshotId">,
) {
  try {
    localStorage.setItem(
      CACHE,
      JSON.stringify({
        version: 1,
        entries: readEntries().filter(
          (entry) =>
            !(
              entry.scope === scope &&
              entry.uid === profile.uid &&
              entry.snapshotId === profile.snapshotId
            ),
        ),
      }),
    );
  } catch {
    /* A failed cache cleanup does not affect server permissions. */
  }
}
