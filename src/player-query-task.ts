import { statsRequest, StatsError } from "./player-stats-api";

export type QueryKind = "search" | "select" | "leaderboard" | "refresh";
type PendingQuery = { id: string; kind: QueryKind; savedAt: number };
type QueryJob<T> = PendingQuery & {
  status: "queued" | "running" | "ready" | "failed";
  stage: string;
  result?: T;
  error?: { code: string; message: string };
  contentSafetyVersion?: string;
};
const KEY = "wt-stats-pending-query-v1";
const stages: Record<string, string> = {
  queued: "查询已排队，无需重复提交…",
  cache: "正在检查已有资料…",
  waiting: "正在等待官方查询通道…",
  fetching: "正在读取官方资料…",
  moderating: "正在整理资料并审核显示内容…",
};
export function pendingQuery(): PendingQuery | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (value && /^qjob_[A-Za-z0-9_-]{10,60}$/.test(value.id) &&
      ["search", "select", "leaderboard", "refresh"].includes(value.kind) &&
      Number.isFinite(value.savedAt) && Date.now() - value.savedAt >= 0 && Date.now() - value.savedAt < 15 * 60_000) return value;
  } catch { /* Task recovery is optional when browser storage is unavailable. */ }
  return null;
}
export function forgetQuery(id?: string) {
  try { if (!id || pendingQuery()?.id === id) sessionStorage.removeItem(KEY); } catch { /* No credentials are stored here. */ }
}
function remember(job: PendingQuery) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ id: job.id, kind: job.kind, savedAt: Date.now() })); } catch { /* Polling still works. */ }
}
// Stop timers while hidden. Returning to the page wakes polling immediately;
// suspended time does not consume the foreground wait budget.
function pause(milliseconds: number, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hiddenAt = document.hidden ? Date.now() : null;
    let suspended = 0;
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      signal.removeEventListener("abort", abort);
    };
    const finish = () => { cleanup(); resolve(suspended); };
    const abort = () => { cleanup(); reject(signal.reason); };
    const visibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        hiddenAt ??= Date.now();
      } else {
        if (hiddenAt !== null) suspended += Math.max(0, Date.now() - hiddenAt);
        finish();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    signal.addEventListener("abort", abort, { once: true });
    if (!document.hidden) timer = setTimeout(finish, milliseconds);
  });
}
function pollDelay(unchanged: number, queued: boolean) {
  const steps = queued ? [2000, 3000, 5000, 8000, 12000, 15000] : [2000, 3000, 5000, 8000];
  // Small positive jitter prevents clients from repeatedly hitting the same instant.
  return steps[Math.min(unchanged, steps.length - 1)] * (1 + Math.random() * 0.1);
}
async function follow<T>(task: PendingQuery, signal: AbortSignal, progress: (text: string) => void): Promise<T> {
  let until = Date.now() + 7 * 60_000;
  let previousStage = "";
  let unchanged = 0;
  let transientFailures = 0;
  while (true) {
    signal.throwIfAborted();
    until += await pause(0, signal);
    if (Date.now() >= until) break;
    let job: QueryJob<T>;
    try {
      job = await statsRequest<QueryJob<T>>(`queries/${encodeURIComponent(task.id)}`, undefined, signal);
      transientFailures = 0;
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof StatsError && ["QUERY_JOB_NOT_FOUND", "LOGIN_EXPIRED", "INVALID_TICKET"].includes(error.code)) {
        forgetQuery(task.id); throw error;
      }
      if (++transientFailures >= 3) throw new Error("连接暂时中断，任务仍在后台处理；刷新页面可继续查看，无需重复提交。");
      progress("连接暂时不稳定，正在恢复任务状态…");
      until += await pause(Math.min(15000, 3000 * 2 ** (transientFailures - 1)), signal); continue;
    }
    if (job.status === "failed") {
      forgetQuery(task.id);
      throw new StatsError(job.error?.message || "查询未完成，请稍后重试", job.error?.code || "QUERY_FAILED");
    }
    if (job.status === "ready" && job.result) {
      forgetQuery(task.id);
      return { ...job.result, contentSafetyVersion: job.contentSafetyVersion };
    }
    progress(stages[job.stage] || "查询正在处理中…");
    const stage = job.status + ":" + job.stage;
    unchanged = stage === previousStage ? unchanged + 1 : 0;
    previousStage = stage;
    until += await pause(pollDelay(unchanged, job.status === "queued" || job.stage === "waiting"), signal);
  }
  throw new Error("查询仍在后台处理中，刷新页面可继续查看任务状态。");
}
export async function queryTask<T>(kind: QueryKind, payload: unknown, signal: AbortSignal, progress: (text: string) => void = () => {}): Promise<T> {
  progress("正在提交查询任务…");
  const job = await statsRequest<QueryJob<T>>("queries", { kind, payload, requestId: "task_" + crypto.randomUUID() }, signal);
  remember(job);
  return follow<T>(job, signal, progress);
}
export async function resumeQuery<T>(signal: AbortSignal, progress: (text: string) => void = () => {}) {
  const task = pendingQuery();
  if (!task) return null;
  progress("正在恢复上次查询任务…");
  return { kind: task.kind, result: await follow<T>(task, signal, progress) };
}
