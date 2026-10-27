import { t } from "./i18n/core";
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
  tagTones?: Record<string, import("./components/GameTag").GameTagTone>;
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
  tagTones?: Record<string, import("./components/GameTag").GameTagTone>;
};
export async function communityRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  // The static catalog preview does not select a different community database.
  const namespace = "lineup-community";
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
  if (!response.ok) throw new Error(value?.message || t("队列大厅暂时无法连接，请稍后重试。"));
  return value as T;
}
export const communityMode = (battle: BattleType, mode: Mode) =>
  ({ ground: t("陆战"), air: t("空战"), naval: t("海战") })[battle] +
  " · " +
  { ab: t("街机"), rb: t("历史"), sb: t("全真") }[mode];
export function communityLink(id: string) {
  const url = new URL(location.href);
  url.hash = `/lineups/lobby?post=${encodeURIComponent(id)}`;
  return url.href;
}

/** Caption text and identity are recorded for private administrator review. */
export async function approveLineupCaption(
  text: string,
  signal?: AbortSignal,
  purpose: "preview" | "export" = "preview",
  sourceId = "",
) {
  const result = await communityRequest<{
    approved: boolean;
    textSha256: string;
    policyVersion: string;
  }>("caption/check", { text, purpose, ...(sourceId ? { sourceId } : {}) }, signal);
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lineup-caption-v1:" + text)),
  );
  const hash = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (result.approved !== true || result.textSha256 !== hash || !result.policyVersion)
    throw new Error(t("文字说明检查结果不匹配，请重新检查。"));
  return result;
}
