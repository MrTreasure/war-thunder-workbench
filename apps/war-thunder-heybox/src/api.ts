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
  code: string;
  status: number;
  constructor(code: string, message: string, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
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
        // A Host can reject an HTTP error before the SDK status predicate runs.
        // Preserve its documented response fields instead of turning an expired code into a connection failure.
        const http = error as { status?: unknown; data?: unknown };
        if (
          Number.isInteger(http?.status) &&
          Number(http.status) >= 400 &&
          Number(http.status) <= 599
        )
          return { status: Number(http.status), data: http.data };
        const code = (error as { code?: string })?.code || "NETWORK_UNAVAILABLE";
        const message = [
          "PERMISSION_NOT_IN_SNAPSHOT",
          "PERMISSION_DENIED",
          "METHOD_FORBIDDEN",
        ].includes(code)
          ? "网络功能暂未开放，可先使用研发功能。"
          : code === "REQUEST_TIMEOUT"
            ? "连接超时，请稍后核对结果，勿连续重复提交。"
            : code === "REQUEST_UNSUPPORTED"
              ? "当前客户端无法发送此请求，请更新小黑盒后重试（REQUEST_UNSUPPORTED）。"
              : `连接暂不可用，请稍后重试（${/^[A-Z_]{3,60}$/.test(code) ? code : "NETWORK_UNAVAILABLE"}）。`;
        throw new MiniappError(code, message);
      });
    // SDK timeout/abort does not cancel the Host request. Never consume its late
    // response after an account switch; mutations keep their own idempotency IDs.
    options.signal?.throwIfAborted();
    if (!Number.isInteger(response.status))
      throw new MiniappError("INVALID_NETWORK_RESPONSE", "服务器响应格式无效，请稍后重试。");
    // Native Hosts may return a JSON response as text. Decode it once here,
    // before callers inspect job/session fields or HTTP failure messages.
    let data: unknown = response.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        if (response.status >= 400) data = null;
        else
          throw new MiniappError(
            "INVALID_NETWORK_RESPONSE",
            `服务响应暂不可用（HTTP ${response.status}），请稍后重试。`,
            response.status,
          );
      }
    }
    if (response.status < 200 || response.status >= 300) {
      const failure = data as { code?: unknown; message?: unknown } | null;
      const expired = response.status === 410 && path.startsWith("auth/heybox/device/");
      const fallback = expired
        ? "关联号已过期，请在网页重新生成关联号后输入。"
        : response.status === 429
          ? "操作过于频繁，请稍后重试。"
          : `请求未完成（HTTP ${response.status}），请稍后重试。`;
      throw new MiniappError(
        typeof failure?.code === "string"
          ? failure.code
          : expired
            ? "HEYBOX_AUTH_EXPIRED"
            : `HTTP_${response.status}`,
        expired ? fallback : typeof failure?.message === "string" ? failure.message : fallback,
        response.status,
      );
    }
    if (!data || typeof data !== "object")
      throw new MiniappError("INVALID_NETWORK_RESPONSE", "服务器返回的数据无效，请稍后重试。");
    return data as T;
  };
}
export type APIRequest = ReturnType<typeof createAPI>;
