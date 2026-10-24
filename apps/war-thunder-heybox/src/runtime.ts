import hbSDK from "@heybox/hb-sdk";
import { createAPI, MiniappError } from "./api";
import { createAccount, type AccountView } from "./account";
export const sdk = hbSDK;
export const api = createAPI(sdk);
export const account = createAccount(sdk, api);
let view: AccountView = { status: "checking", user: null, storageError: false };
let version = 0;
account.subscribe((next) => {
  if (next.status !== view.status || next.user?.id !== view.user?.id) version++;
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
export async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const turn = version;
  const value =
    view.status === "authenticated"
      ? await account.request<T>(path, body, signal)
      : await api<T>(path, {
          ...(body === undefined ? {} : { body }),
          device: await guestDevice(),
          signal,
        });
  if (turn !== version) throw new MiniappError("ACCOUNT_CHANGED", "账号状态已更新，请重新操作");
  return value;
}
export type QueryKind = "search" | "select" | "refresh";
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
sdk.on("hide", () => {
  foreground = false;
  for (const callback of wake) callback();
});
sdk.on("show", () => {
  foreground = true;
  for (const callback of wake) callback();
});
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clean = () => {
      clearTimeout(timer);
      wake.delete(visibility);
      signal.removeEventListener("abort", abort);
    };
    const finish = () => {
      clean();
      resolve();
    };
    const abort = () => {
      clean();
      reject(signal.reason);
    };
    const visibility = () => {
      clearTimeout(timer);
      if (foreground) finish();
    };
    wake.add(visibility);
    signal.addEventListener("abort", abort, { once: true });
    if (foreground) timer = setTimeout(finish, ms);
  });
}
export async function query<T>(
  kind: QueryKind,
  payload: unknown,
  signal: AbortSignal,
  progress: (s: string) => void,
): Promise<T> {
  const turn = version;
  progress("正在提交查询…");
  let job = await request<Job<T>>(
    "queries",
    { kind, payload, requestId: "task_" + crypto.randomUUID() },
    signal,
  );
  let budget = 0;
  while (budget < 7 * 60000) {
    signal.throwIfAborted();
    if (turn !== version) throw new MiniappError("ACCOUNT_CHANGED", "账号状态已变化");
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
    const started = Date.now();
    await pause(delay, signal);
    if (foreground) budget += Math.min(delay, Date.now() - started);
    job = await request<Job<T>>("queries/" + job.id, undefined, signal);
  }
  throw new MiniappError("QUERY_STILL_RUNNING", "查询仍在后台处理，请稍后查看");
}
