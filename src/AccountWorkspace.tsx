import { readPricePreferences } from "./sale-price-api";
import { saleWatchKey } from "./sale-watch-storage";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  WorkspaceContext,
  createWorkspaceStore,
  workspaceKey,
  type GameBinding,
  type WorkspaceDocument,
  type Workspace,
} from "./workspace-context";
import {
  statsRequest,
  StatsError,
  statsCategoryNames,
  type PlayerProfile,
} from "./player-stats-api";
import { mergeOwnedGarage, preferOwnedBinding } from "./owned-garage";
import type { OwnedGarage } from "./player-rankings-api";
import type { OwnedGarageSnapshot } from "./owned-garage";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { Modal } from "./Modal";
import { statsCountryLabel } from "./stats-country";
import { collectGuestDefaults } from "./workspace-guest-defaults";
import "./account-workspace.css";

function documentLabel(key: string) {
  if (key === saleWatchKey) return "折扣载具关注列表";
  if (key === "wt-workbench-cart-v1") return "研发购物车";
  const [kind, part, country] = key.split(":");
  if (kind === "wt-lineups-v1") return `${statsCountryLabel(part)} · 出击队列`;
  return `${statsCountryLabel(country)} · ${statsCategoryNames[part] || "研发"}计划`;
}
type Pending = Record<string, { value: unknown; revision: number }>;
type Snapshot = {
  ownerKey: string;
  version: string;
  notice: string;
  consented: boolean;
  documents: WorkspaceDocument[];
  binding: GameBinding | null;
};
const message = (e: unknown) => (e instanceof Error ? e.message : "云端同步失败，请重试。");
export function AccountWorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useWorkbenchAccount();
  const userId = session?.user?.id || "";
  const store = useMemo(() => createWorkspaceStore(userId), [userId]);
  const workspace = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <WorkspaceContext.Provider value={workspace}>
      <AccountWorkspace key={userId || "guest"} userId={userId} publish={store.publish} />
      {children}
    </WorkspaceContext.Provider>
  );
}
// Only account-owned state is keyed. The application shell and route stay mounted.
const AccountWorkspace = memo(function AccountWorkspace({
  userId,
  publish,
}: {
  userId: string;
  publish: (workspace: Workspace) => void;
}) {
  const [tabId, setTabId] = useState(() => {
    try {
      const key = "wt-account-workspace-tab-v1";
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  });
  const pendingKey = `wt-account-workspace-v1:${userId}:pending:${tabId}`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pending, setPending] = useState<Pending>(() => {
    if (!userId) return {};
    try {
      const p = JSON.parse(localStorage.getItem(pendingKey) || "{}");
      return p && typeof p === "object" && !Array.isArray(p)
        ? (Object.fromEntries(
            Object.entries(p).filter(
              ([k, v]) =>
                workspaceKey(k) &&
                v &&
                typeof v === "object" &&
                Number.isSafeInteger((v as { revision: unknown }).revision),
            ),
          ) as Pending)
        : {};
    } catch {
      return {};
    }
  });
  const current = useRef({ snapshot, pending });
  const [error, setError] = useState("");
  const [cacheWarning, setCacheWarning] = useState("");
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [conflict, setConflict] = useState<{ key: string; remote: WorkspaceDocument } | null>(null);
  const [importKeys, setImportKeys] = useState<string[]>([]);
  const [selectedImports, setSelectedImports] = useState<string[]>([]);
  const controller = useRef(new AbortController());
  const flight = useRef(false);
  const outboxReady = useRef(false);
  const autoImported = useRef(false);
  const autoImports = useRef(new Map<string, Pending[string]>());
  const storePending = useCallback(
    (next: Pending) => {
      try {
        localStorage.setItem(pendingKey, JSON.stringify(next));
      } catch {
        setCacheWarning("浏览器无法暂存待同步内容。请保持页面打开并连接网络；离线时请先导出备份。");
      }
      current.current.pending = next;
      setPending(next);
    },
    [pendingKey],
  );
  const importGuestDefaults = useCallback(
    (data: Snapshot) => {
      if (autoImported.current || !userId || !data.consented) return;
      autoImported.current = true;
      try {
        const additions = collectGuestDefaults(
          localStorage,
          userId,
          data.documents,
          Object.keys(current.current.pending),
        );
        for (const [key, job] of Object.entries(additions)) autoImports.current.set(key, job);
        if (Object.keys(additions).length)
          storePending({ ...current.current.pending, ...additions });
      } catch {
        /* Guest data stays local when browser storage is unavailable. */
      }
    },
    [userId, storePending],
  );
  useEffect(() => {
    let active = true;
    let release: () => void = () => {};
    const claim = () => {
      if (active) {
        outboxReady.current = true;
        if (current.current.snapshot?.consented) importGuestDefaults(current.current.snapshot);
      }
    };
    if (!navigator.locks) {
      claim();
      return () => {
        active = false;
        outboxReady.current = false;
      };
    }
    void navigator.locks
      .request("wt-workspace-outbox:" + pendingKey, { ifAvailable: true }, async (lock) => {
        if (!active) return;
        if (!lock) {
          const id = crypto.randomUUID();
          try {
            sessionStorage.setItem("wt-account-workspace-tab-v1", id);
          } catch {
            /* Private memory fallback. */
          }
          current.current.pending = {};
          setPending({});
          setTabId(id);
          return;
        }
        claim();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {
        claim();
      });
    return () => {
      active = false;
      outboxReady.current = false;
      release();
    };
  }, [pendingKey, importGuestDefaults]);
  const prompted = useRef(new Set<string>());
  const garageFlight = useRef<Promise<void> | null>(null);
  const syncOwnedGarage = useCallback((garage: OwnedGarageSnapshot) => {
    const previous = current.current.snapshot;
    if (!previous || controller.current.signal.aborted) return;
    const binding = mergeOwnedGarage(previous.binding, garage);
    if (binding === previous.binding) return;
    const next = { ...previous, binding };
    current.current.snapshot = next;
    setSnapshot(next);
  }, []);
  const refreshOwnedGarage = useCallback(() => {
    if (garageFlight.current) return garageFlight.current;
    const uid = current.current.snapshot?.binding?.uid;
    if (!userId || !uid) return Promise.resolve();
    const signal = controller.current.signal;
    const job = statsRequest<PlayerProfile>("account/game-binding/profile", undefined, signal)
      .then(async (profile) => {
        if (signal.aborted || profile.uid !== uid || current.current.snapshot?.binding?.uid !== uid)
          return;
        const garage = await statsRequest<OwnedGarage>(
          `players/${encodeURIComponent(profile.snapshotId)}/garage`,
          undefined,
          signal,
        );
        if (garage.uid !== uid || garage.snapshotId !== profile.snapshotId)
          throw Error("车库身份不一致，已保留原拥有状态。");
        if (!signal.aborted) syncOwnedGarage(garage);
      })
      .finally(() => {
        if (garageFlight.current === job) garageFlight.current = null;
      });
    garageFlight.current = job;
    return job;
  }, [userId, syncOwnedGarage]);
  const load = useCallback(
    async (preserveDocuments = false) => {
      if (!userId) return;
      const data = await statsRequest<Snapshot>(
        "account/workspace",
        undefined,
        controller.current.signal,
      );
      if (data.ownerKey !== "user:" + userId) throw Error("登录账号已变化，已停止读取旧账号数据。");
      if (!controller.current.signal.aborted) {
        data.binding = preferOwnedBinding(data.binding, current.current.snapshot?.binding || null);
        if (preserveDocuments && current.current.snapshot)
          data.documents = [
            ...current.current.snapshot.documents.filter((d) => d.key !== saleWatchKey),
            ...data.documents.filter((d) => d.key === saleWatchKey),
          ];
        current.current.snapshot = data;
        setSnapshot(data);
        if (data.consented && outboxReady.current) importGuestDefaults(data);
        if (!data.consented && !prompted.current.has(data.version)) {
          prompted.current.add(data.version);
          setOpen(true);
        }
      }
    },
    [userId, importGuestDefaults],
  );
  useEffect(() => {
    controller.current = new AbortController();
    const c = controller.current;
    if (userId)
      void load().catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [userId, load]);
  const bindingUid = snapshot?.binding?.uid;
  useEffect(() => {
    if (bindingUid) void refreshOwnedGarage().catch(() => {});
  }, [bindingUid, refreshOwnedGarage]);
  // Refresh on return to this page. No background official queries or interval polling.
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (!document.hidden && !flight.current)
        void load(true)
          .then(refreshOwnedGarage)
          .catch((e) => setError(message(e)));
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId, load, refreshOwnedGarage]);
  function save(key: string, value: unknown) {
    const s = current.current.snapshot;
    if (!outboxReady.current) throw Error("正在准备本机同步队列，请稍后重试。");
    if (!userId || !s || !s.consented)
      throw Error("请先在用户名菜单的云端数据中同意协议并完成同步。");
    if (!workspaceKey(key)) throw Error("此数据不支持云端保存。");
    const prior = current.current.pending[key];
    const revision = prior?.revision ?? s.documents.find((d) => d.key === key)?.revision ?? 0;
    storePending({ ...current.current.pending, [key]: { value, revision } });
    setError("");
  }
  const drain = useCallback(async () => {
    if (
      !outboxReady.current ||
      flight.current ||
      !current.current.snapshot?.consented ||
      controller.current.signal.aborted
    )
      return;
    flight.current = true;
    setSending(true);
    try {
      for (const key of Object.keys(current.current.pending)) {
        if (controller.current.signal.aborted) break;
        const job = current.current.pending[key];
        if (!job) continue;
        try {
          const doc = await statsRequest<WorkspaceDocument>(
            "account/workspace",
            { key, ...job, ownerKey: "user:" + userId },
            controller.current.signal,
          );
          if (controller.current.signal.aborted) return;
          const s: Snapshot = current.current.snapshot!;
          const nextSnapshot: Snapshot = {
            ...s,
            documents: [...s.documents.filter((d) => d.key !== key), doc],
          };
          current.current.snapshot = nextSnapshot;
          setSnapshot(nextSnapshot);
          const latest = current.current.pending[key];
          const next = { ...current.current.pending };
          if (latest === job) delete next[key];
          else if (latest) next[key] = { ...latest, revision: doc.revision };
          try {
            localStorage.setItem(pendingKey, JSON.stringify(next));
          } catch {
            setCacheWarning("浏览器无法暂存待同步内容。请保持页面打开并连接网络，或先导出备份。");
          }
          current.current.pending = next;
          setPending(next);
          setError("");
        } catch (e) {
          if (controller.current.signal.aborted) return;
          if (e instanceof StatsError && e.code === "WORKSPACE_CONFLICT") {
            try {
              const remote = await statsRequest<Snapshot>(
                "account/workspace",
                undefined,
                controller.current.signal,
              );
              if (controller.current.signal.aborted) return;
              if (remote.ownerKey !== "user:" + userId)
                throw Error("登录账号已变化，已停止旧账号同步。");
              const row = remote.documents.find((d) => d.key === key);
              if (
                row &&
                autoImports.current.get(key) === job &&
                current.current.pending[key] === job
              ) {
                const next = { ...current.current.pending };
                delete next[key];
                autoImports.current.delete(key);
                storePending(next);
                const updated: Snapshot = {
                  ...current.current.snapshot!,
                  documents: [
                    ...current.current.snapshot!.documents.filter((d) => d.key !== key),
                    row,
                  ],
                };
                current.current.snapshot = updated;
                setSnapshot(updated);
                continue;
              }
              if (row) {
                setConflict({ key, remote: row });
                setOpen(true);
              }
            } catch (readError) {
              setError(message(readError));
              break;
            }
          }
          setError(message(e));
          break;
        }
      }
    } finally {
      flight.current = false;
      if (!controller.current.signal.aborted) setSending(false);
    }
  }, [pendingKey, userId, storePending]);
  useEffect(() => {
    if (!snapshot?.consented || conflict || !Object.keys(pending).length || error) return;
    const id = setTimeout(() => void drain(), Object.hasOwn(pending, saleWatchKey) ? 0 : 600);
    return () => clearTimeout(id);
  }, [pending, snapshot?.consented, conflict, error, drain]);
  useEffect(() => {
    const online = () => {
      setError("");
      void load(true)
        .then(() => drain())
        .catch((e) => setError(message(e)));
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [load, drain]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const boundVehicles = snapshot?.binding?.vehicles;
  const ownedVehicleIds = useMemo(
    () => new Set((boundVehicles || []).map((v) => v.id)),
    [boundVehicles],
  );
  const documents = Object.fromEntries((snapshot?.documents || []).map((d) => [d.key, d]));
  for (const [key, v] of Object.entries(pending)) documents[key] = { key, ...v };
  const status = !userId
    ? "仅本地保存"
    : error
      ? "同步需要处理"
      : !snapshot
        ? "正在读取云端"
        : !snapshot.consented
          ? "待确认协议"
          : sending
            ? "正在同步"
            : Object.keys(pending).length
              ? cacheWarning
                ? "待同步，请勿关闭"
                : "待同步"
              : "已同步";
  function inspectLocal() {
    const keys = Object.keys(localStorage).filter(workspaceKey);
    setImportKeys(keys);
    setSelectedImports(keys.filter((k) => !documents[k]?.value));
  }
  async function exportData() {
    const pricePreferences = await readPricePreferences();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            documents,
            pricePreferences,
            binding: snapshot?.binding,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "war-thunder-account-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useLayoutEffect(() => {
    publish({
      userId,
      ready: !!snapshot,
      consented: !!snapshot?.consented,
      documents,
      binding: snapshot?.binding || null,
      ownedVehicleIds,
      status,
      error,
      save,
      reload: load,
      refreshOwnedGarage,
      syncOwnedGarage,
      open: () => setOpen(true),
    });
  });
  return (
    <>
      {open && userId && (
        <Modal
          title="云端数据"
          subtitle={error ? "同步需要处理" : undefined}
          close={() => setOpen(false)}
          className="wt-account-dialog"
        >
          <div className="wt-account-form">
            {!snapshot ? (
              <button onClick={() => void run(load)}>重新读取云端</button>
            ) : !snapshot.consented ? (
              <>
                <h3>用户协议与数据说明</h3>
                <p>{snapshot.notice}</p>
                <a
                  href="https://api.mrtreasure.cc/wt-stats/v1/auth/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  阅读用户协议与数据说明 · {snapshot.version}
                </a>
                <label className="wt-agreement-check">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  我已阅读并同意，启用账号云端功能
                </label>
                <button
                  disabled={!agreed || busy}
                  onClick={() =>
                    void run(async () => {
                      await statsRequest("account/consent", {
                        version: snapshot.version,
                        accepted: true,
                        ownerKey: "user:" + userId,
                      });
                      await load();
                    })
                  }
                >
                  确认并启用
                </button>
              </>
            ) : (
              <>
                <p>
                  研发计划、购物车与出击队列随账号同步。本机游客数据保持独立。待同步内容在当前设备按账号暂存，恢复网络后继续。
                </p>
                {snapshot.binding && (
                  <p>
                    关联账号：{snapshot.binding.nickname} · UID {snapshot.binding.uid}
                    <br />
                    车库采集于 {new Date(snapshot.binding.fetchedAt).toLocaleString()}
                    。车库刷新请到该玩家战绩页操作。
                  </p>
                )}
                <div className="wt-account-actions">
                  <button
                    disabled={busy || sending}
                    onClick={() =>
                      void run(async () => {
                        await load();
                        setError("");
                      })
                    }
                  >
                    重试同步
                  </button>
                  <button disabled={busy} onClick={inspectLocal}>
                    导入本机游客数据
                  </button>
                  <button disabled={busy} onClick={() => void run(exportData)}>
                    导出云端数据
                  </button>
                </div>
                {importKeys.length > 0 && (
                  <section>
                    <h3>选择要导入的本机数据</h3>
                    <p>同名内容会替换当前账号云端版本，原游客数据不会删除。</p>
                    {importKeys.map((k) => (
                      <label className="wt-agreement-check" key={k}>
                        <input
                          type="checkbox"
                          checked={selectedImports.includes(k)}
                          onChange={(e) =>
                            setSelectedImports((old) =>
                              e.target.checked ? [...old, k] : old.filter((v) => v !== k),
                            )
                          }
                        />
                        {documentLabel(k)}
                        {documents[k]?.value ? "（已有云端内容）" : ""}
                      </label>
                    ))}
                    <button
                      disabled={busy || !selectedImports.length}
                      onClick={() =>
                        void run(async () => {
                          for (const key of selectedImports) {
                            const raw = localStorage.getItem(key);
                            if (raw) save(key, JSON.parse(raw));
                          }
                          setImportKeys([]);
                        })
                      }
                    >
                      确认导入所选内容
                    </button>
                  </section>
                )}
                {conflict && (
                  <section>
                    <h3>另一设备更新了此内容</h3>
                    <p>{documentLabel(conflict.key)}。本机待保存内容仍保留，请选择。</p>
                    <div className="wt-account-actions">
                      <button
                        disabled={busy || sending}
                        onClick={() =>
                          void run(async () => {
                            const next = { ...current.current.pending };
                            delete next[conflict.key];
                            storePending(next);
                            setConflict(null);
                            await load();
                          })
                        }
                      >
                        使用云端版本
                      </button>
                      <button
                        disabled={busy || sending}
                        onClick={() =>
                          void run(async () => {
                            const old = current.current.pending[conflict.key];
                            if (old)
                              storePending({
                                ...current.current.pending,
                                [conflict.key]: { ...old, revision: conflict.remote.revision },
                              });
                            setConflict(null);
                          })
                        }
                      >
                        用本机版本覆盖
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
            {cacheWarning && Object.keys(pending).length > 0 && <output>{cacheWarning}</output>}
            {error && <p role="alert">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
});
