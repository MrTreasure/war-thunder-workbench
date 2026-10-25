import settings from "./config/player-stats.json";
import { statsHeaders, StatsError } from "./player-stats-api";

export type HeyboxConfig = {
  configured: boolean;
  miniProgramId: string | null;
  websiteFlow: "device_code";
  expiresInSeconds: number;
};
export type HeyboxPair = {
  requestId: string;
  pollSecret: string;
  pairingCode: string;
  expiresInSeconds: number;
};
export type HeyboxPoll =
  | { status: "pending" }
  | { status: "authenticated"; token: string; purpose: "login" | "bind"; user: { id: string } };

/** Memory-only device proof; persist neither the proof nor an identity token. */
export async function heyboxRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${settings.apiBaseUrl}/auth/heybox/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: statsHeaders(),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw new StatsError(
      value?.message || "小黑盒授权暂不可用",
      value?.code || "HEYBOX_AUTH_UNAVAILABLE",
    );
  return value as T;
}
