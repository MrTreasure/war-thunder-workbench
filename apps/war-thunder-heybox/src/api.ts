import type hbSDK from "@heybox/hb-sdk";

export type SDK = typeof hbSDK;
export const MINI_PROGRAM_ID = "01a16e09-097b-7867-a702-7537cd3919fd";
const API = "https://api.mrtreasure.cc/wt-stats/v1/";
const fixed = new Set([
  "config",
  "session",
  "device",
  "account/terms",
  "account/consent",
  "account/workspace",
  "account/workspace/clear",
  "account/game-binding",
  "account/game-binding/profile",
  "account/game-binding/refresh",
  "account/game-binding/unlink",
  "auth/logout",
  "auth/profile",
  "auth/heybox/config",
  "auth/heybox/session",
  "auth/heybox/complete",
  "auth/heybox/device/inspect",
  "auth/heybox/device/approve",
  "queries",
  "players/restore",
  "valuations",
  "owned-imports",
  "reports",
  "reports/preview",
]);

export class MiniappError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

/** Fixed own-domain routes, no cookie recovery or automatic write retries. */
export function createAPI(sdk: SDK) {
  return async function request<T>(
    path: string,
    options: {
      body?: unknown;
      token?: string;
      device?: string;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    if (
      !fixed.has(path) &&
      !/^(queries|reports|valuations)\/[A-Za-z0-9_-]{1,128}$/.test(path) &&
      !/^players\/[A-Za-z0-9_-]{1,128}\/(details|ownership|rankings|garage)$/.test(path)
    ) {
      throw new MiniappError("INVALID_API_PATH", "不支持的请求");
    }
    options.signal?.throwIfAborted();
    const response = await sdk.network
      .request<T>({
        url: API + path,
        method: options.body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-WT-Client": "heybox-mini",
          ...(options.token ? { Authorization: "Bearer " + options.token } : {}),
          ...(options.device ? { "X-WT-Device": options.device } : {}),
        },
        ...(options.body === undefined ? {} : { data: options.body }),
        timeout: 9000,
        validateStatus: () => true,
      })
      .catch((error: unknown) => {
        const code = (error as { code?: string })?.code || "NETWORK_UNAVAILABLE";
        const message = [
          "PERMISSION_NOT_IN_SNAPSHOT",
          "PERMISSION_DENIED",
          "METHOD_FORBIDDEN",
        ].includes(code)
          ? "网络功能暂未开放，可先使用研发功能。"
          : code === "REQUEST_TIMEOUT"
            ? "连接超时，请稍后核对结果，勿连续重复提交。"
            : "连接暂不可用，请稍后重试。";
        throw new MiniappError(code, message);
      });
    // SDK timeout/abort does not cancel the Host request. Never consume its late
    // response after an account switch; mutations keep their own idempotency IDs.
    options.signal?.throwIfAborted();
    if (response.status < 200 || response.status >= 300) {
      const failure = response.data as { code?: unknown; message?: unknown } | null;
      throw new MiniappError(
        typeof failure?.code === "string" ? failure.code : "API_UNAVAILABLE",
        typeof failure?.message === "string" ? failure.message : "服务暂不可用，请稍后重试",
        response.status,
      );
    }
    return response.data;
  };
}
export type APIRequest = ReturnType<typeof createAPI>;
