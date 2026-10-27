import { getLocale } from "./i18n/core";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { statsRequest } from "./player-stats-api";
import type {
  Counters,
  Metrics,
  PlayerProfile,
  PlayerVehicle,
  RadarAxis,
} from "./player-stats-api";

export type CareerCounters = Counters & Metrics & { radar?: RadarAxis[] };
export type OfficialMetric = { value: number; rank: number | null };
export type CareerPeriod = { counters: CareerCounters; metrics: Record<string, OfficialMetric> };
export type CareerScope = {
  id: string;
  mode: string;
  branch: string;
  label: string;
  periods: Partial<Record<"career" | "recent", CareerPeriod>>;
};
export type PlayerMedal = {
  id: string;
  country: string;
  names: Partial<Record<"zh-CN" | "en" | "ru" | "ja", string>>;
};
export type PlayerMedals = { items: PlayerMedal[]; unmatchedCount: number };
export type PlayerDetails = {
  medals?: PlayerMedals | null;
  uid: string;
  snapshotId: string;
  fetchedAt: string;
  expiresAt: string;
  registeredAt: number | null;
  scopes: CareerScope[];
  vehicles: (Counters & Metrics & Pick<PlayerVehicle, "id" | "mode">)[];
  usage: {
    id: string;
    label: string;
    mode: string;
    battles: number | null;
    wins: number | null;
    roles: {
      id: string;
      label: string;
      seconds: number;
      sorties?: number | null;
      airKills?: number | null;
      groundKills?: number | null;
      navalKills?: number | null;
    }[];
  }[];
};
export type RankPoint = { percentile: number; value: number; rank?: number };
export type PlayerRank = {
  uid: string;
  snapshotId: string;
  value: number | null;
  rank: number | null;
  total?: number;
  metric: string;
  label?: string;
  unit?: string;
  period?: string;
  fetchedAt: string | null;
  expiresAt?: string;
  stale?: boolean;
  notice: string;
  position: { topPercent: number; basis: string } | null;
  references?: { points: RankPoint[]; fetchedAt: string; approximate: boolean } | null;
  referenceState?: string;
  points?: RankPoint[];
  sampleCount?: number;
  minimumBattles?: number;
  minimumPlayers?: number;
  version?: string;
};
export type OwnedVehicle = {
  id: string;
  name: string;
  country: string;
  category: string | null;
  rank: string | null;
  kind: string | null;
  elite: boolean;
  observed: boolean;
  image: string;
  thumbnail?: string;
};
export type OwnedGarage = {
  uid: string;
  snapshotId: string;
  fetchedAt: string;
  source: string;
  vehicles: OwnedVehicle[];
  unmatchedCount: number;
};

// Bounded read cache, cleared whenever the active account changes.
type ReadState = { data: unknown; busy: boolean; error: string; until: number };
const empty: ReadState = { data: null, busy: false, error: "", until: 0 };
const results = new Map<string, ReadState>();
const pendingReads = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let generation = 0;
function publish(key: string, value: ReadState) {
  results.set(key, value);
  while (results.size > 64) results.delete(results.keys().next().value!);
  listeners.forEach((listener) => listener());
}
export function clearRankingMemory() {
  generation++;
  pendingReads.forEach((controller) => controller.abort());
  pendingReads.clear();
  results.clear();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function usePlayerRead<T extends { uid: string; snapshotId: string }>(
  profile: PlayerProfile | null,
  path: string,
  active: boolean,
  seconds = 7200,
) {
  const uid = profile?.uid,
    snapshotId = profile?.snapshotId,
    localOnly = profile?.localOnly === true;
  const key = (snapshotId || "none") + ":" + path;
  const state = useSyncExternalStore(
    subscribe,
    useCallback(() => results.get(key) || empty, [key]),
  );
  const load = useCallback(
    (force = false) => {
      if (!uid || !snapshotId || localOnly) return;
      const previous = results.get(key);
      if (pendingReads.has(key) || (!force && previous && previous.until > Date.now())) return;
      const controller = new AbortController(),
        revision = generation;
      pendingReads.set(key, controller);
      publish(key, { data: previous?.data || null, busy: true, error: "", until: 0 });
      void statsRequest<T>(
        `players/${encodeURIComponent(snapshotId)}/${path}`,
        undefined,
        controller.signal,
      )
        .then((value) => {
          if (controller.signal.aborted || revision !== generation) return;
          if (value.uid !== uid || value.snapshotId !== snapshotId)
            throw new Error("玩家资料身份不一致，请重新查询。");
          const expiry =
            "expiresAt" in value && typeof value.expiresAt === "string"
              ? Date.parse(value.expiresAt)
              : Infinity;
          publish(key, {
            data: value,
            busy: false,
            error: "",
            until: Math.min(Date.now() + seconds * 1000, expiry),
          });
        })
        .catch((failure) => {
          if (!controller.signal.aborted && revision === generation)
            publish(key, {
              data: previous?.data || null,
              busy: false,
              error: failure instanceof Error ? failure.message : "暂时无法读取，请稍后重试。",
              until: 0,
            });
        })
        .finally(() => {
          if (pendingReads.get(key) === controller) pendingReads.delete(key);
        });
    },
    [key, uid, snapshotId, localOnly, path, seconds],
  );
  useEffect(() => {
    if (active) load();
  }, [active, load]);
  return {
    data: state.data as T | null,
    busy: active && !localOnly && (state === empty || state.busy),
    error: localOnly ? "当前为本机保存的资料，请重新查询此玩家后查看扩展数据。" : state.error,
    retry: useCallback(() => load(true), [load]),
  };
}

export const rankingIndicators = {
  averageScore: { label: "平均得分", percent: false },
  victories_battles: { label: "胜率", percent: true },
  averageRelativePosition: { label: "平均队内相对位置", percent: true },
  average_active_kills_by_spawn: { label: "玩家／机器人击毁 · 每次出击", percent: false },
} as const;
export const battleScopes = {
  ground: "陆战对局",
  air: "空战对局",
  naval: "海战对局",
  combined: "综合 PVP",
};
export function rankingValue(value: number | null | undefined, metric: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  const percent = metric === "victories_battles" || metric === "averageRelativePosition";
  return (
    (percent ? value * 100 : value).toLocaleString(getLocale(), { maximumFractionDigits: 2 }) +
    (percent ? "%" : "")
  );
}
