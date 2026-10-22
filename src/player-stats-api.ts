import settings from "./config/player-stats.json";
import reportAssets from "../data/player-report-assets.json";
import type { ReportStyle } from "./player-report-style";
export type Ratio = number | "∞" | null;
export type Metrics = {
  efficiencyVersion?: string;
  knownKills: number | null;
  kd: Ratio;
  airKd: Ratio;
  groundKd: Ratio;
  navalKd: Ratio;
  kr: Ratio;
  efficiency: number | null;
  smallSample: boolean;
  partialKills: boolean;
};
export type Counters = {
  battles: number | null;
  wins: number | null;
  sorties: number | null;
  deaths: number | null;
  airKills: number | null;
  groundKills: number | null;
  navalKills: number | null;
  silverLions?: number | null;
  winRate?: number | null;
};
export type Branch = Metrics &
  Counters & {
    id: string;
    label: string;
    vehicleCount: number;
    kdKills: number | null;
    kdDeaths: number | null;
    kdCoverage: number;
  };
export type RadarAxis = { label: string; value: Ratio; score: number | null; unit: string };
export type PlayerMode = Metrics &
  Counters & { id: "ab" | "rb" | "sb"; branches: Branch[]; radar: RadarAxis[] };
export type PlayerCandidate = { uid: string; nickname: string; avatar: string | null };
export type PlayerVehicle = Metrics &
  Counters & {
    id: string;
    name: string;
    country: string | null;
    category: string | null;
    rank: string | null;
    mode: string;
    image: string;
    thumbnail: string;
  };
export type PlayerProfile = {
  uid: string;
  nickname: string;
  level: number | null;
  clanTag: string | null;
  avatar: string | null;
  avatarKey: string;
  source: string;
  fetchedAt: string;
  expiresAt: string;
  snapshotId: string;
  cached: boolean;
  notice: string;
  countries: {
    id: string;
    name: string;
    owned: number | null;
    elite: number | null;
    flag: string;
  }[];
  modes: PlayerMode[];
  vehicles: PlayerVehicle[];
};
export type Background = {
  id: string;
  title: string;
  category: string;
  era: string;
  source: string;
  thumbnail: string;
  sourcePage: string;
  local?: boolean;
};
export type StatsConfig = {
  assets: { backgrounds: Background[]; avatarBase: string; armyBase: string };
  rules: { efficiency: { description: string; notice: string }; radar: { notice: string } };
  settings: { cacheTtlSeconds: number; queryLimit: number; reportLimit: number };
};
export type StatsSession = {
  user: {
    id: string;
    displayName?: string;
    email?: string;
    isSuperAdmin?: boolean;
    applicationRole?: "user" | "admin";
  } | null;
  role: "guest" | "user" | "superadmin";
  unlimited: boolean;
  query: { used: number; reserved: number };
  report: { used: number; reserved: number };
  limits: { queryLimit: number | null; reportLimit: number | null; cacheTtlSeconds: number };
};
export type ReportScope = {
  country: string;
  category: string;
  countryLabel: string;
  categoryLabel: string;
};
export type ReportPayload = {
  efficiencyVersion?: string;
  analysis?: { style: ReportStyle; label: string; customStyle?: string };
  career?: PlayerMode;
  recentMatches?: { available: boolean; notice: string; source?: string };
  scope?: ReportScope;
  player: Pick<PlayerProfile, "uid" | "nickname" | "level" | "avatar" | "avatarKey" | "clanTag">;
  fetchedAt: string;
  mode: string;
  top5: PlayerVehicle[];
  totals: Metrics & Counters;
  branches: Branch[];
  suggestedBackground: string;
  silverCoverage: number;
};
export type StatsReport = {
  id: string;
  status: "preview" | "queued" | "running" | "ready" | "failed";
  payload: ReportPayload;
  review: { title: string; speech: string; model?: string } | null;
  error: string | null;
  createdAt?: string;
};
const DEVICE = "wt-stats-device-v1",
  SESSION = "wt-stats-session-v1";
export class StatsError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
function stored(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
export function setStatsToken(token: string) {
  if (token) localStorage.setItem(SESSION, token);
  else localStorage.removeItem(SESSION);
}
export function statsHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-WT-Device": stored(DEVICE),
    ...(stored(SESSION) ? { Authorization: "Bearer " + stored(SESSION) } : {}),
  };
}
export async function statsRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(settings.apiBaseUrl + "/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: statsHeaders(),
    credentials: "omit",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(45000)])
      : AbortSignal.timeout(45000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new StatsError(data?.message || "战绩服务暂时无法访问", data?.code || "REQUEST_FAILED");
  return data as T;
}
export const statsModeNames: Record<string, string> = {
  ab: "街机战斗",
  rb: "历史战斗",
  sb: "全真战斗",
};
export const statsCategoryNames: Record<string, string> = {
  ground: "陆军",
  aviation: "空军",
  helicopters: "直升机",
  ships: "远洋海军",
  boats: "近岸海军",
};
export const statsNumber = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("zh-CN");
/** Group by 万, retaining the exact integer rather than rounding income. */
export const statsSilver = (value: number | null | undefined) =>
  value == null || !Number.isSafeInteger(value)
    ? "—"
    : BigInt(value)
        .toString()
        .replace(/\B(?=(\d{4})+(?!\d))/g, ",");
export const statsSilverIcon = reportAssets.silverLionsIcon;
export const statsGoldenEaglesIcon = reportAssets.goldenEaglesIcon;
export const statsRatio = (value: Ratio | undefined) =>
  typeof value === "number" ? value.toFixed(2) : value === "∞" ? "∞" : "—";
export const statsDate = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export async function loginChallenge() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    verifier,
    challenge: base64url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
    ),
    state: base64url(crypto.getRandomValues(new Uint8Array(24))),
  };
}
export async function prepareStatsDevice(signal?: AbortSignal) {
  async function create() {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 40;
    const context = canvas.getContext("2d");
    if (context) {
      context.font = "18px sans-serif";
      context.fillText("War Thunder 0123456789", 4, 25);
    }
    const material = [
      navigator.userAgent,
      navigator.language,
      navigator.hardwareConcurrency,
      Math.max(screen.width, screen.height),
      Math.min(screen.width, screen.height),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas.toDataURL(),
    ].join("|");
    const fingerprint = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material))),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const result = await statsRequest<{ ticket: string }>("device", { fingerprint }, signal);
    localStorage.setItem(DEVICE, result.ticket);
  }
  if (!stored(DEVICE)) await create();
  try {
    return await statsRequest<StatsSession>("session", undefined, signal);
  } catch (error) {
    if (error instanceof StatsError && error.code === "LOGIN_EXPIRED") {
      setStatsToken("");
      return statsRequest<StatsSession>("session", undefined, signal);
    }
    if (error instanceof StatsError && error.code === "INVALID_TICKET") {
      await create();
      return statsRequest<StatsSession>("session", undefined, signal);
    }
    throw error;
  }
}
export async function reportImage(kind: string, key: string, signal: AbortSignal) {
  const proxy = settings.apiBaseUrl + "/media/" + kind + "/" + encodeURIComponent(key);
  const sources =
    kind === "vehicle" && /^[a-zA-Z0-9_-]+$/.test(key)
      ? [
          "https://static.encyclopedia.warthunder.com/images/" + encodeURIComponent(key) + ".png",
          proxy,
        ]
      : [proxy];
  for (const source of sources) {
    try {
      const response = await fetch(source, {
        ...(source === proxy ? { headers: statsHeaders() } : {}),
        credentials: "omit",
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
      });
      if (!response.ok) throw new Error("图片读取失败");
      const url = URL.createObjectURL(await response.blob());
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  throw new Error("战报图片读取失败，请稍后再保存。");
}

// These target-specific ratios already pair the correct carrier deaths on the server.
export const statsBranchKd = (branch: Branch): Ratio =>
  branch.id === "ground" ? branch.groundKd : branch.id === "air" ? branch.airKd : branch.navalKd;
export const statsBranchTarget = (id: string) =>
  id === "ground" ? "对地" : id === "air" ? "对空" : "对海";

export const statsArmyIcon = (base: string, branch: string) =>
  base +
  (branch === "ground" ? "army_tank" : branch === "air" ? "army_fighter" : "army_destroyer") +
  ".svg";

export const statsReportScopeLabel = (payload: ReportPayload) =>
  (payload.scope?.countryLabel || "全部国家") +
  " · " +
  (payload.scope?.categoryLabel || "全部兵种");

const LAST_NICKNAME = "wt-stats-last-nickname-v1";
export const lastStatsNickname = () => stored(LAST_NICKNAME).slice(0, 64);
export function rememberStatsNickname(value: string) {
  try {
    localStorage.setItem(LAST_NICKNAME, value.trim().slice(0, 64));
  } catch {
    /* Query remains available when local storage is disabled. */
  }
}

const QUERY_HISTORY = "wt-stats-query-history-v1";
export function statsQueryHistory(): PlayerProfile[] {
  try {
    const value = JSON.parse(stored(QUERY_HISTORY) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (p): p is PlayerProfile =>
              p &&
              typeof p.uid === "string" &&
              typeof p.nickname === "string" &&
              typeof p.fetchedAt === "string" &&
              typeof p.snapshotId === "string" &&
              Array.isArray(p.modes) &&
              Array.isArray(p.countries) &&
              Array.isArray(p.vehicles),
          )
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
export function rememberStatsProfile(profile: PlayerProfile): PlayerProfile[] {
  const items = [profile, ...statsQueryHistory().filter((p) => p.uid !== profile.uid)].slice(0, 8);
  // Bound this independent cache; quota failures never evict other user state.
  while (items.length) {
    try {
      const body = JSON.stringify(items);
      if (body.length > 2_000_000) {
        items.pop();
        continue;
      }
      localStorage.setItem(QUERY_HISTORY, body);
      return items;
    } catch {
      items.pop();
    }
  }
  return statsQueryHistory();
}
export function clearStatsQueryHistory() {
  try {
    localStorage.removeItem(QUERY_HISTORY);
  } catch {
    /* Storage may be unavailable. */
  }
  return statsQueryHistory();
}
