import { MiniappError, type APIRequest, type SDK } from "./api.ts";
import type { AccountView, createAccount } from "./account.ts";
export type QueryKind = "search" | "select" | "refresh";
export function createRuntime(
  sdk: SDK,
  api: APIRequest,
  account: ReturnType<typeof createAccount>,
) {
  let view: AccountView = { status: "checking", user: null, storageError: false, generation: 0 };
  let version = 0;
  let actor = "";
  const stopAccount = account.subscribe((next) => {
    const nextActor = next.status === "checking" ? actor : next.user?.id || "guest";
    if (next.generation !== view.generation || nextActor !== actor) version++;
    actor = nextActor;
    view = next;
  });
  let device: Promise<string> | undefined;
  async function guestDevice() {
    if (!device)
      device = (async () => {
        let fingerprint = "";
        try {
          const { data } = await sdk.storage.getStorage<unknown>({ key: "wt_guest_id_v1" });
          if (typeof data === "string" && /^[a-f0-9]{64}$/.test(data)) fingerprint = data;
        } catch {
          /* Ephemeral guest identity still works. */
        }
        if (!fingerprint) {
          fingerprint = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
            n.toString(16).padStart(2, "0"),
          ).join("");
          try {
            await sdk.storage.setStorage({ key: "wt_guest_id_v1", data: fingerprint });
          } catch {
            /* No fingerprinting fallback. */
          }
        }
        const result = await api<{ ticket: string }>("device", { body: { fingerprint } });
        if (typeof result.ticket !== "string")
          throw new MiniappError("INVALID_TICKET", "访客会话无法建立");
        return result.ticket;
      })().catch((e) => {
        device = undefined;
        throw e;
      });
    return device;
  }
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    await account.whenReady(signal);
    const turn = version;
    const value =
      view.status === "authenticated"
        ? await account.request<T>(path, body, signal)
        : await api<T>(path, {
            ...(body === undefined ? {} : { body }),
            device: await guestDevice(),
            signal,
          });
    await account.whenReady(signal);
    if (turn !== version) throw new MiniappError("ACCOUNT_CHANGED", "账号状态已更新，请重新操作");
    return value;
  }
  type Job<T> = {
    id: string;
    status: "queued" | "running" | "ready" | "failed";
    stage: string;
    result?: T;
    contentSafetyVersion?: string;
    error?: { code: string; message: string };
  };
  let foreground = true;
  const wake = new Set<() => void>();
  const stopHide = sdk.on("hide", () => {
    foreground = false;
    for (const callback of wake) callback();
  });
  const stopShow = sdk.on("show", () => {
    foreground = true;
    for (const callback of wake) callback();
  });
  function pause(ms: number, signal: AbortSignal): Promise<number> {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let activeSince = foreground ? Date.now() : null,
        elapsed = 0;
      const clean = () => {
        clearTimeout(timer);
        wake.delete(visibility);
        signal.removeEventListener("abort", abort);
      };
      const finish = () => {
        clean();
        if (activeSince !== null) elapsed += Date.now() - activeSince;
        resolve(elapsed);
      };
      const abort = () => {
        clean();
        reject(signal.reason);
      };
      const visibility = () => {
        clearTimeout(timer);
        if (foreground) finish();
        else if (activeSince !== null) {
          elapsed += Date.now() - activeSince;
          activeSince = null;
        }
      };
      wake.add(visibility);
      signal.addEventListener("abort", abort, { once: true });
      if (foreground) timer = setTimeout(finish, ms);
    });
  }
  async function query<T>(
    kind: QueryKind,
    payload: unknown,
    signal: AbortSignal,
    progress: (s: string) => void,
  ): Promise<T> {
    progress("正在确认查询会话…");
    await account.whenReady(signal);
    const turn = version;
    progress("正在提交查询…");
    const submission = { kind, payload, requestId: "task_" + crypto.randomUUID() };
    let job: Job<T>;
    for (let attempt = 0; ; attempt++) {
      if (turn !== version) throw new MiniappError("ACCOUNT_CHANGED", "账号状态已变化，请重新操作");
      try {
        job = await request<Job<T>>("queries", submission, signal);
        break;
      } catch (error) {
        signal.throwIfAborted();
        if (turn !== version)
          throw new MiniappError("ACCOUNT_CHANGED", "账号状态已变化，请重新操作");
        const transient =
          error instanceof MiniappError &&
          (["REQUEST_TIMEOUT", "REQUEST_FAILED", "NETWORK_UNAVAILABLE"].includes(error.code) ||
            error.status >= 500);
        if (!transient || attempt >= 2) throw error;
        // This endpoint durably deduplicates actor + requestId and verifies the
        // payload hash before touching quotas. Never mint another ID on retry.
        // Other mutations, especially one-use authorization codes, are not retried.
        progress("连接暂时不稳定，正在确认刚才的查询…");
        await pause(1500 * (attempt + 1), signal);
      }
    }
    let budget = 0;
    while (budget < 7 * 60000) {
      signal.throwIfAborted();
      if (turn !== version) throw new MiniappError("ACCOUNT_CHANGED", "账号状态已变化");
      if (
        !job ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(job.id) ||
        !["queued", "running", "ready", "failed"].includes(job.status)
      )
        throw new MiniappError("INVALID_QUERY_RESPONSE", "查询响应不完整，请稍后重试。");
      if (job.status === "failed")
        throw new MiniappError(
          job.error?.code || "QUERY_FAILED",
          job.error?.message || "查询暂未完成",
        );
      if (job.status === "ready" && job.result)
        return { ...job.result, contentSafetyVersion: job.contentSafetyVersion };
      progress(
        job.stage === "waiting"
          ? "等待官方查询通道…"
          : job.status === "queued"
            ? "已排队，请勿重复提交…"
            : "正在读取玩家资料…",
      );
      const delay = Math.min(10000, 2000 + Math.floor(budget / 15000) * 1000);
      budget += await pause(job.status === "ready" ? 0 : delay, signal);
      // A completed submission must never be replayed after a network timeout.
      // Retry only the actor-bound GET for the existing job, with a bounded delay.
      for (let attempt = 0; ; attempt++) {
        if (turn !== version)
          throw new MiniappError("ACCOUNT_CHANGED", "账号状态已变化，请重新操作");
        try {
          job = await request<Job<T>>("queries/" + job.id, undefined, signal);
          break;
        } catch (error) {
          signal.throwIfAborted();
          const transient =
            error instanceof MiniappError &&
            (["REQUEST_TIMEOUT", "REQUEST_FAILED", "NETWORK_UNAVAILABLE"].includes(error.code) ||
              error.status >= 500);
          if (!transient || attempt >= 2) throw error;
          progress("连接暂时不稳定，正在继续读取已有查询结果…");
          budget += await pause(1500 * (attempt + 1), signal);
        }
      }
    }
    throw new MiniappError("QUERY_STILL_RUNNING", "查询仍在后台处理，请稍后查看");
  }

  return {
    request,
    query,
    pause,
    dispose: () => {
      stopAccount();
      stopHide();
      stopShow();
    },
  };
}
