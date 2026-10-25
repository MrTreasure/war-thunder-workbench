import { statsHeaders } from "./player-stats-api";
import settings from "./config/player-stats.json";
import registry from "../data/lineup-sharing-tags.json";
import type { BattleType } from "./lineups";
import type { Mode } from "./models";
export const communityTags = registry.tags;
export const communityRules = registry;
export type CommunityPost = {
  id: string;
  country: string;
  code: string;
  battle: BattleType;
  mode: Mode;
  activeAircraft: string;
  slots: (string | null)[];
  tags: string[];
  step: number | null;
  rating: string;
  author: string;
  authorId: string;
  createdAt: string;
  up: number;
  down: number;
  vote: number;
  mine: boolean;
};
export type CommunityPage = { items: CommunityPost[]; page: number; hasMore: boolean };
export type CommunityDraft = {
  code: string;
  battle: BattleType;
  mode: Mode;
  activeAircraft: string;
  tags: string[];
};
export async function communityRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const namespace =
    import.meta.env.VITE_WT_CATALOG_SOURCE === "preview"
      ? "lineup-community-preview"
      : "lineup-community";
  const response = await fetch(`${settings.apiBaseUrl}/${namespace}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: statsHeaders(),
    credentials: "omit",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.message || "队列大厅暂时无法连接，请稍后重试。");
  return value as T;
}
export const communityMode = (battle: BattleType, mode: Mode) =>
  ({ ground: "陆战", air: "空战", naval: "海战" })[battle] +
  { ab: "街机", rb: "历史", sb: "全真" }[mode];
export function communityLink(id: string) {
  const url = new URL(location.href);
  url.hash = `/lineups/lobby?post=${encodeURIComponent(id)}`;
  return url.href;
}
