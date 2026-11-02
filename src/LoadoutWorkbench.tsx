import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { VehicleTile, type VehicleTileUnit } from "./VehicleTile";
import { useVehicleCatalog, type VehicleFacts } from "./vehicle-catalog";
import { vehicleStore } from "./vehicle-store";
import bootstrap from "./generated/bootstrap.json";
import { GameSelect } from "./components/GameSelect";
import {
  loadoutRanks,
  loadoutWeaponName,
  loadoutParameterValue,
  matchesLoadoutText,
} from "./loadout-presentation";
import { Modal } from "./Modal";
import { useStored } from "./storage";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { useAccountWorkspace } from "./workspace-context";
import { loadoutRequest } from "./loadout-api";
import { useLoadoutPlans } from "./loadout-storage";
import { LoadoutPresets } from "./LoadoutPresets";
import { readRemoteLoadout, type LoadoutShare, type LoadoutVehicle } from "./loadout-shares";
import { TagSelector, freeTagTones, type TagChoice } from "./components/TagSelector";
import { gameTagOptions } from "./game-tag-options";
import { GameTag } from "./components/GameTag";
import { LoadoutHall } from "./LoadoutHall";
import {
  checkLoadout,
  hasConfigurableLoadout,
  stationLoadoutOptions,
  loadoutRevision,
  optionKey,
  presetKey,
  validLoadoutPlan,
  type LoadoutPlan,
  type Mount,
  type Requirement,
} from "./loadouts";
import type { Mode, WikiLoadouts, WikiLoadoutOption } from "./models";
import "./loadouts.css";

type Result = {
  vehicle: VehicleTileUnit & { country: string };
  mounts: Mount[];
  preset: string | null;
  sourceHash: string;
  sourceDate: string;
};
type SearchResults = {
  items: Result[];
  total: number;
  offset: number;
  limit: number;
  unchecked: number;
  version: string;
};
type WeaponIndex = {
  weapons: { key: string; name: string }[];
  coverage: { available: number; notProvided: number; total: number };
  version: string;
};
const countries = bootstrap.countries as Record<string, string>;
const countryLabel = (id: string) =>
  id && countries[id] ? (
    <span className="wt-mount-country">
      <img
        src={bootstrap.flags[id as keyof typeof bootstrap.flags]}
        alt=""
        width={24}
        height={18}
      />
      <span>{countries[id]}</span>
    </span>
  ) : null;
const kg = (value: number | null) =>
  value === null ? "未知" : `${value.toLocaleString("zh-CN", { maximumFractionDigits: 3 })} 千克`;
const planOrNull = (value: unknown): value is LoadoutPlan | null => {
  if (value === null || validLoadoutPlan(value)) return true;
  if (!value || typeof value !== "object") return false;
  const draft = value as LoadoutPlan;
  return (
    typeof draft.name === "string" &&
    draft.name.length <= 80 &&
    validLoadoutPlan({ ...draft, name: "草稿" })
  );
};
function makePlan(unit: VehicleFacts, country: string, data: WikiLoadouts): LoadoutPlan {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: `${unit.name} · 自定义挂载`,
    country,
    vehicleId: unit.id,
    sourceHash: loadoutRevision(data),
    sourceDate: data.checkedAt,
    mounts: [],
    preset: data.hardpoints.length ? null : data.presets[0] ? presetKey(data.presets[0]) : null,
    updatedAt: new Date().toISOString(),
  };
}

export function LoadoutWorkbench() {
  const account = useWorkbenchAccount();
  const { session } = account;
  const workspace = useAccountWorkspace();
  const owner = session?.user?.id || "guest";
  if (!session?.user)
    return (
      <main className="wt-mount-page wt-mount-login">
        <h2>模拟挂载</h2>
        <p>登录后创建、保存和分享挂载方案。</p>
        <button
          className="primary-button"
          disabled={account.initializing || account.busy}
          onClick={() => void account.login()}
        >
          {account.initializing ? "正在恢复登录…" : account.busy ? "正在登录…" : "登录并继续"}
        </button>
        {account.error && <p role="alert">{account.error}</p>}
      </main>
    );
  if (
    (owner !== "guest" && workspace?.userId !== owner) ||
    (owner === "guest" && !!workspace?.userId)
  )
    return (
      <main className="wt-mount-page">
        <p>正在恢复账号方案…</p>
      </main>
    );
  return <LoadoutPage key={owner} owner={owner} />;
}

function LoadoutPage({ owner }: { owner: string }) {
  const workspace = useAccountWorkspace();
  const navigate = useNavigate();
  const search = useRouterState({
    select: (s) =>
      s.location.search as { recommendation?: string; country?: string; vehicle?: string },
  });
  const [tab, setTab] = useState<"editor" | "search" | "saved" | "hall">("saved");
  const [country, setCountry] = useState(() =>
    search.country && Object.hasOwn(countries, search.country) ? search.country : "",
  );
  const facts = useVehicleCatalog(country ? [country] : []);
  const [vehicle, setVehicle] = useState("");
  const [activeData, setActiveData] = useState<WikiLoadouts | null>(null);
  const [pinnedUnit, setPinnedUnit] = useState<VehicleFacts | null>(null);
  const opening = useRef(0);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [rank, setRank] = useState("");
  const [mode, setMode] = useState<Mode>("rb");
  const [plan, setPlan] = useState<LoadoutPlan | null>(null);
  const [draft, saveDraft, draftError] = useStored(
    `wt-loadout-draft-v1:${owner}`,
    null as LoadoutPlan | null,
    planOrNull,
    undefined,
    true,
  );
  const [saved, savePlans, storageError, storageStatus] = useLoadoutPlans(owner);
  const [history, setHistory] = useState<LoadoutPlan[]>([]);
  const [future, setFuture] = useState<LoadoutPlan[]>([]);
  const [station, setStation] = useState("");
  const [weaponQuery, setWeaponQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const [share, setShare] = useState("");
  const [sharePlan, setSharePlan] = useState<LoadoutPlan | null>(null);
  const [shareTags, setShareTags] = useState<TagChoice[]>([]);
  const [selecting, setSelecting] = useState<"new" | "replace" | null>(null);
  const [summaries, setSummaries] = useState<Record<string, LoadoutVehicle>>({});
  const [myShares, setMyShares] = useState<LoadoutShare[]>([]);
  const [importText, setImportText] = useState("");
  const [pending, setPending] = useState<LoadoutPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [weaponLookup, setWeaponLookup] = useState("");
  const [weapons, setWeapons] = useState<WeaponIndex | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([{ weapon: "", count: 1 }]);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchRank, setSearchRank] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const request = useRef<AbortController | null>(null);
  const importedSearch = useRef("");
  const units = useMemo(
    () =>
      [...facts.values()].filter(
        (u) =>
          u.country === country &&
          ["aviation", "helicopters"].includes(u.category || "") &&
          hasConfigurableLoadout(u.wikiDetails?.loadouts),
      ),
    [facts, country],
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadoutRequest<{ items: LoadoutShare[] }>(
      "shares/mine",
      undefined,
      controller.signal,
    ).then(
      (value) => {
        if (!controller.signal.aborted) setMyShares(value.items);
      },
      (e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "推荐读取失败。");
      },
    );
    return () => controller.abort();
  }, [owner]);
  const savedVehicleIDs = useMemo(
    () => [...new Set(saved.map((p) => p.vehicleId))].sort().join(","),
    [saved],
  );
  useEffect(() => {
    if (!savedVehicleIDs) return;
    const controller = new AbortController();
    void loadoutRequest<{ items: LoadoutVehicle[] }>(
      "vehicles",
      { ids: savedVehicleIDs.split(",") },
      controller.signal,
    ).then(
      (value) => {
        if (!controller.signal.aborted)
          setSummaries(Object.fromEntries(value.items.map((item) => [item.id, item])));
      },
      (e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "机型资料读取失败。");
      },
    );
    return () => controller.abort();
  }, [savedVehicleIDs]);
  const unit =
    units.find((u) => u.id === vehicle) || (pinnedUnit?.id === vehicle ? pinnedUnit : undefined);
  const data = activeData;
  const check = useMemo(
    () => (data && plan ? checkLoadout(data, plan.mounts, plan.preset) : null),
    [data, plan],
  );
  const [loadState, setLoadState] = useState<{ error: string; loading: boolean }>({
    error: "",
    loading: false,
  });
  useEffect(() => {
    if (!country) return;
    let active = true;
    const update = () => {
      if (active)
        setLoadState({
          error: vehicleStore.getCountry(country)?.error || "",
          loading: !vehicleStore.getCountry(country),
        });
    };
    update();
    const off = vehicleStore.subscribe(update);
    void vehicleStore.ensure(country).then(
      update,
      (e: unknown) =>
        active &&
        setLoadState({
          error: e instanceof Error ? e.message : "国家资料读取失败。",
          loading: false,
        }),
    );
    return () => {
      active = false;
      off();
    };
  }, [country]);
  useEffect(
    () => () => {
      request.current?.abort();
      opening.current++;
    },
    [],
  );
  const draftSaveRef = useRef(saveDraft);
  useEffect(() => {
    draftSaveRef.current = saveDraft;
  }, [saveDraft]);
  const setWorkingPlan = useCallback((next: LoadoutPlan | null) => {
    setPlan(next);
    if (next) draftSaveRef.current(next);
  }, []);
  const openPlan = useCallback(
    (next: LoadoutPlan) => {
      const sequence = ++opening.current;
      setActiveData(null);
      setPinnedUnit(null);
      void vehicleStore.ensure(next.country).then(
        () => {
          if (opening.current !== sequence) return;
          const selected = vehicleStore.getFacts().get(next.vehicleId);
          if (selected?.country !== next.country || !selected.wikiDetails?.loadouts) {
            setError("当前资料未找到该机型挂载，原方案仍保留。");
            return;
          }
          setActiveData(structuredClone(selected.wikiDetails.loadouts));
          setPinnedUnit(selected);
        },
        (cause: unknown) => {
          if (opening.current === sequence)
            setError(cause instanceof Error ? cause.message : "机型资料读取失败。");
        },
      );
      setCountry(next.country);
      setVehicle(next.vehicleId);
      setWorkingPlan(structuredClone(next));
      setHistory([]);
      setFuture([]);
      setTab("editor");
      setStation("");
      setPending(null);
      setError("");
      setMessage("");
    },
    [setWorkingPlan],
  );
  useEffect(() => {
    if (!search.recommendation || importedSearch.current === search.recommendation) return;
    importedSearch.current = search.recommendation;
    let active = true;
    void readRemoteLoadout(search.recommendation).then(
      (p) => {
        if (active) {
          setPending({ ...p, name: "导入挂载方案" });
          setImporting(true);
          setImportText(search.recommendation!);
        }
      },
      (e: unknown) => active && setError(e instanceof Error ? e.message : "分享内容读取失败。"),
    );
    return () => {
      active = false;
    };
  }, [search.recommendation]);
  useEffect(() => {
    if (!search.country || !search.vehicle || !Object.hasOwn(countries, search.country)) return;
    let active = true;
    const targetCountry = search.country,
      targetId = search.vehicle;
    void vehicleStore.ensure(targetCountry).then(
      () => {
        if (!active) return;
        const target = vehicleStore.getFacts().get(targetId);
        if (target?.country === targetCountry && target.wikiDetails?.loadouts)
          // oxlint-disable-next-line react/purity -- Runs after the asynchronous country read, never during render.
          openPlan(makePlan(target, targetCountry, target.wikiDetails.loadouts));
        else setError("当前国家资料未找到这个机型。");
      },
      (cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "机型资料读取失败。");
      },
    );
    return () => {
      active = false;
    };
  }, [search.country, search.vehicle, openPlan]);
  const mutate = (next: LoadoutPlan) => {
    if (plan) setHistory((old) => [...old.slice(-39), structuredClone(plan)]);
    setFuture([]);
    // oxlint-disable-next-line react/purity -- This action is called only by input handlers, after render.
    setWorkingPlan({ ...next, updatedAt: new Date().toISOString() });
    setMessage("");
  };
  const applyOption = (option: WikiLoadoutOption | null) => {
    if (!plan || !data || !station) return;
    const mounts = plan.mounts.filter((m) => m.station !== station);
    if (option) mounts.push({ station, option: optionKey(option) });
    mutate({ ...plan, mounts, preset: null });
    setPicker(false);
  };
  const chooseVehicle = (id: string) => {
    const selected = units.find((u) => u.id === id);
    if (!selected?.wikiDetails?.loadouts) return;
    if (plan) saveDraft(plan);
    const next = makePlan(selected, country, selected.wikiDetails.loadouts);
    if (selecting === "replace" && plan) next.id = plan.id;
    openPlan(next);
    setSelecting(null);
  };
  const commit = async () => {
    if (!plan || !data || !plan.name.trim()) return;
    if (loadoutRevision(data) !== plan.sourceHash) {
      setError("请先确认按当前资料重新核对，再保存方案。");
      return;
    }
    if (check?.issues.length) {
      setError("请先处理已列出的挂载冲突；当前编辑已保留为草稿。");
      return;
    }
    const next = {
      ...plan,
      name: plan.name.trim(),
      sourceHash: loadoutRevision(data),
      sourceDate: data.checkedAt,
      updatedAt: new Date().toISOString(),
    };
    const list = saved.some((p) => p.id === next.id)
      ? saved.map((p) => (p.id === next.id ? next : p))
      : [...saved, next];
    if (await savePlans(list)) {
      setWorkingPlan(next);
      setError("");
      setMessage(
        owner === "guest"
          ? "方案已保存到此浏览器。"
          : "方案已交给账号工作区同步，可在账号菜单查看同步状态。",
      );
    }
  };
  const exportPlan = (source: LoadoutPlan) => {
    setSharePlan(source);
    setShare("");
    setShareTags([]);
    setError("");
  };
  const publishShare = async () => {
    if (!sharePlan) return;
    setBusy(true);
    setError("");
    try {
      const remote = await loadoutRequest<LoadoutShare>("shares", {
        plan: sharePlan,
        listed: true,
        tags: shareTags,
      });
      setShare(remote.id);
      void refreshShares();
    } catch (e) {
      setError(e instanceof Error ? e.message : "分享失败。");
    } finally {
      setBusy(false);
    }
  };
  const refreshShares = async () => {
    try {
      const value = await loadoutRequest<{ items: LoadoutShare[] }>("shares/mine");
      setMyShares(value.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分享读取失败。");
    }
  };
  const downloadPlan = (source: LoadoutPlan) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(source, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "wt-loadout-" + source.vehicleId + ".wtloadout.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const secondaryAction = (value: string) => {
    if (!plan) return;
    if (value === "undo" && history.length) {
      setFuture((old) => [plan, ...old]);
      setHistory((old) => old.slice(0, -1));
      setWorkingPlan(history.at(-1)!);
    }
    if (value === "redo" && future.length) {
      setHistory((old) => [...old, plan]);
      setWorkingPlan(future[0]);
      setFuture((old) => old.slice(1));
    }
    if (value === "clear" && data)
      mutate({ ...plan, mounts: [], preset: data.hardpoints.length ? null : plan.preset });
    if (value === "export") downloadPlan(plan);
    if (value === "back") {
      setWorkingPlan(null);
      setVehicle("");
      setTab("saved");
      void navigate({ to: "/loadouts", search: {}, replace: true });
    }
  };
  const readImport = async () => {
    setBusy(true);
    setError("");
    try {
      if (!importText.trim()) throw Error("请先选择挂载备份文件。");
      const value: unknown = JSON.parse(importText);
      if (!validLoadoutPlan(value)) throw Error("挂载备份文件格式不正确。");
      setPending({ ...value, name: "导入挂载方案" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "分享内容读取失败。");
    } finally {
      setBusy(false);
    }
  };
  const fetchWeapons = async () => {
    if (weapons) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const value = await loadoutRequest<WeaponIndex>("weapons", undefined, controller.signal);
      setWeapons(value);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "武器目录读取失败。");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const findAircraft = async (offset = 0) => {
    if (requirements.some((r) => !r.weapon || !Number.isSafeInteger(r.count) || r.count < 1)) {
      setError("请选择武器并填写至少数量。");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      setResults(
        await loadoutRequest<SearchResults>(
          "search",
          {
            requirements,
            country: searchCountry,
            category: searchCategory,
            rank: searchRank,
            offset,
          },
          controller.signal,
        ),
      );
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "挂载查找失败。");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const openResult = (result: Result, now: string, id: string) => {
    openPlan({
      schemaVersion: 1,
      id,
      name: `${result.vehicle.name} · 需求方案`,
      vehicleId: result.vehicle.id,
      country: result.vehicle.country,
      sourceHash: result.sourceHash,
      sourceDate: result.sourceDate,
      mounts: result.mounts,
      preset: result.preset,
      updatedAt: now,
    });
  };
  const candidates =
    data?.compatibility.filter(
      (o) =>
        o.stations.some((s) => s.hardpointId === station) &&
        matchesLoadoutText(o.name, weaponQuery),
    ) || [];
  const retry = () => {
    setLoadState({ error: "", loading: true });
    void vehicleStore
      .ensure(country)
      .catch((e: unknown) =>
        setLoadState({ error: e instanceof Error ? e.message : "资料读取失败。", loading: false }),
      );
  };
  return (
    <main className="wt-mount-page">
      <div className="wt-mount-heading">
        <div>
          <h2>{tab === "editor" ? "配置挂载" : "模拟挂载"}</h2>
          <p>我的挂载 · 云端保存与应用内推荐</p>
        </div>
        <button
          className="quiet-button"
          onClick={() => {
            setImporting(true);
            setPending(null);
            setImportText("");
          }}
        >
          导入方案
        </button>
        <button className="primary-button" onClick={() => setSelecting("new")}>
          ＋ 添加挂载
        </button>
      </div>
      <nav className="wt-lineup-sections wt-mount-tabs" aria-label="挂载工具">
        {(
          [
            ["saved", `我的挂载（${saved.length}）`],
            ["hall", "挂载大厅"],
            ["search", "按挂载找机型"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className="wt-lineup-section-link"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              if (key === "search") void fetchWeapons();
              if (key === "saved") void refreshShares();
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {(error || storageError || draftError || loadState.error) && (
        <p role="alert" className="wt-mount-error">
          {error || storageError || draftError || loadState.error}
          {loadState.error && <button onClick={retry}>重试</button>}
        </p>
      )}
      {storageStatus.sending && <p aria-live="polite">正在保存云端挂载方案…</p>}
      {storageStatus.remote && storageError && (
        <button onClick={() => void storageStatus.reload()}>重新读取云端方案</button>
      )}
      {message && (
        <p aria-live="polite" className="wt-mount-message">
          {message}
        </p>
      )}
      {tab === "editor" && (
        <>
          <div className="wt-mount-editor-toolbar">
            <button onClick={() => secondaryAction("back")}>← 返回挂载列表</button>
            <button onClick={() => setSelecting("replace")}>重新选择机型</button>
            <GameSelect
              aria-label="权重模式"
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
            >
              <option value="ab">街机 AB</option>
              <option value="rb">历史 RB</option>
              <option value="sb">全真 SB</option>
            </GameSelect>
          </div>
          {!plan && draft && (
            <button className="quiet-button" onClick={() => openPlan(draft)}>
              继续本地草稿 · {draft.name}
            </button>
          )}
          {loadState.loading && <p aria-live="polite">正在加载该国完整资料…</p>}
          {!unit && !loadState.loading && (
            <div className="wt-mount-empty">
              选择机型后开始配置。可以先在“按挂载找机型”中提出武器需求。
            </div>
          )}
          {unit && data && data.status !== "available" && (
            <div className="wt-mount-empty">
              <VehicleTile unit={unit} mode={mode} />
              {data?.status === "none" ? (
                <p>Wiki 明确列出该机没有可用外挂。</p>
              ) : (
                <p>该机挂载资料尚未完整提供，暂不能核对配置。已拥有状态与挂载能力分别处理。</p>
              )}
              {data && (
                <a href={data.source} target="_blank" rel="noopener noreferrer">
                  查看官方 Wiki ↗
                </a>
              )}
            </div>
          )}
          {plan && !data && !loadState.loading && <p aria-live="polite">正在准备挂载资料…</p>}
          {unit && data?.status === "available" && plan && (
            <>
              <section className="wt-mount-plan-title">
                <VehicleTile unit={unit} mode={mode} footerLabel={`${unit.rank} 级`} />
                <label>
                  方案名称
                  <input
                    maxLength={80}
                    value={plan.name}
                    onChange={(e) => setWorkingPlan({ ...plan, name: e.target.value })}
                  />
                </label>
                <span className="wt-mount-state">
                  {check?.issues.length ? `${check.issues.length} 项冲突` : "已知规则通过"}
                </span>
              </section>
              {loadoutRevision(data) !== plan.sourceHash && (
                <p className="wt-mount-warning">
                  方案来源版本与当前资料不同，请查看挂载及冲突提示后确认。
                  <button
                    onClick={() =>
                      mutate({
                        ...plan,
                        sourceHash: loadoutRevision(data),
                        sourceDate: data.checkedAt,
                      })
                    }
                  >
                    确认按当前资料核对
                  </button>
                </p>
              )}
              {unit.wikiDetails?.loadouts &&
                loadoutRevision(data) !== loadoutRevision(unit.wikiDetails.loadouts) && (
                  <p className="wt-mount-warning">
                    已有新的挂载资料，当前编辑保持原版本。
                    <button
                      onClick={() => {
                        setActiveData(structuredClone(unit.wikiDetails!.loadouts!));
                        setHistory([]);
                        setFuture([]);
                      }}
                    >
                      载入新资料并核对
                    </button>
                  </p>
                )}
              <div className="wt-mount-workspace">
                <section className="wt-mount-board" aria-label="挂点配置">
                  {data.hardpoints.length > 0 ? (
                    <>
                      <div className="wt-mount-board-top">
                        <h3>自定义挂载</h3>
                        <span>挂点示意 · 按来源编号与翼侧排列</span>
                      </div>
                      <div className="wt-mount-stations">
                        {data.hardpoints.map((point) => {
                          const mount = plan.mounts.find((m) => m.station === point.id);
                          const chosen = data.compatibility.find(
                            (o) =>
                              mount &&
                              optionKey(o) === mount.option &&
                              o.stations.some((s) => s.hardpointId === point.id),
                          );
                          const conflict = check?.issues.some((i) => i.stations.includes(point.id));
                          const available = stationLoadoutOptions(data, point.id).length > 0;
                          return (
                            <button
                              key={point.id}
                              className="wt-mount-station"
                              data-side={point.side}
                              data-conflict={conflict || undefined}
                              disabled={!available}
                              aria-label={`挂点 ${point.label}，${available ? "选择挂载" : "不可挂载，当前资料无可用选项"}`}
                              aria-pressed={point.id === station}
                              onClick={() => {
                                setStation(point.id);
                                setWeaponQuery("");
                                setPicker(true);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                if (!available) return;
                                setStation(point.id);
                                setPicker(true);
                              }}
                            >
                              <span className="wt-mount-station-number">
                                挂点 {point.label}
                                <small>
                                  {point.side === "left"
                                    ? "左翼"
                                    : point.side === "right"
                                      ? "右翼"
                                      : point.side === "center"
                                        ? "机身"
                                        : "位置待核对"}
                                </small>
                              </span>
                              {chosen?.imageUrl && (
                                <img
                                  src={chosen.imageUrl}
                                  alt=""
                                  width={64}
                                  height={44}
                                  loading="lazy"
                                />
                              )}
                              <strong>
                                {chosen
                                  ? loadoutWeaponName(chosen.name)
                                  : !available
                                    ? "不可挂载"
                                    : mount
                                      ? "原挂载已失效"
                                      : "＋ 选择挂载"}
                              </strong>
                              <small>
                                {chosen
                                  ? kg(chosen.weightKg)
                                  : !available
                                    ? "当前资料无可用选项"
                                    : mount
                                      ? "请重新选择"
                                      : "空挂点"}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <LoadoutPresets
                      data={data}
                      onUse={(key) => mutate({ ...plan, mounts: [], preset: key })}
                    />
                  )}
                </section>
                <aside className="wt-mount-summary" aria-label="配置汇总">
                  <h3>当前挂载</h3>
                  <dl>
                    <div>
                      <dt>总挂载重量</dt>
                      <dd>{kg(check?.weightKg ?? null)}</dd>
                    </div>
                    {data.limits.map((l) => (
                      <div key={l.id}>
                        <dt>{l.label}</dt>
                        <dd>
                          {l.value === null
                            ? "未知"
                            : `${l.value.toLocaleString()} ${loadoutParameterValue(l.unit)}`}
                        </dd>
                      </div>
                    ))}
                    {data.hardpoints.length > 0 && (
                      <>
                        <div>
                          <dt>左翼 / 右翼</dt>
                          <dd>
                            {kg(check?.leftKg ?? null)} / {kg(check?.rightKg ?? null)}
                          </dd>
                        </div>
                        <div>
                          <dt>两翼重量差</dt>
                          <dd>
                            {check?.leftKg !== null && check?.rightKg !== null && check
                              ? kg(Math.abs(check.leftKg - check.rightKg))
                              : "未知"}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <ul>
                    {check?.weapons.map((w) => (
                      <li key={w.key}>
                        <span>{loadoutWeaponName(w.name)}</span>
                        <strong>× {w.count}</strong>
                      </li>
                    ))}
                  </ul>
                  {!!check?.issues.length && (
                    <ul className="wt-mount-error">
                      {check.issues.map((i) => (
                        <li key={i.code + i.stations.join()}>{i.message}</li>
                      ))}
                    </ul>
                  )}
                  <section className="wt-mount-provenance">
                    <h4>规则与来源</h4>
                    {check?.limitations.map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                    <a href={data.source} target="_blank" rel="noopener noreferrer">
                      官方 Wiki · {data.checkedAt.slice(0, 10)} ↗
                    </a>
                  </section>
                </aside>
              </div>
              {data.hardpoints.length > 0 && (
                <LoadoutPresets
                  data={data}
                  onUse={(key) => mutate({ ...plan, mounts: [], preset: key })}
                />
              )}
              <div className="wt-mount-actions">
                <div className="wt-mount-desktop-actions">
                  <button disabled={!history.length} onClick={() => secondaryAction("undo")}>
                    撤销
                  </button>
                  <button disabled={!future.length} onClick={() => secondaryAction("redo")}>
                    重做
                  </button>
                  <button onClick={() => secondaryAction("clear")}>清空</button>
                  <button onClick={() => secondaryAction("export")}>导出文件</button>
                  <button onClick={() => secondaryAction("back")}>返回方案</button>
                </div>
                <div className="wt-mount-mobile-actions">
                  <GameSelect aria-label="更多挂载操作" value="" onValueChange={secondaryAction}>
                    <option value="">更多操作</option>
                    <option value="undo" disabled={!history.length}>
                      撤销
                    </option>
                    <option value="redo" disabled={!future.length}>
                      重做
                    </option>
                    <option value="clear">清空</option>
                    <option value="export">导出文件</option>
                    <option value="back">返回方案</option>
                  </GameSelect>
                </div>
                <span className="wt-mount-action-spacer" />
                <button
                  disabled={busy || !!check?.issues.length}
                  onClick={() => void exportPlan(plan)}
                >
                  发布到大厅
                </button>
                <button
                  className="primary-button"
                  disabled={storageStatus.sending}
                  onClick={() => void commit()}
                >
                  {storageStatus.sending ? "正在保存…" : "保存方案"}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {tab === "search" && (
        <section className="wt-mount-find">
          <h3>这些武器能一起挂在哪个机型上？</h3>
          <p>多个条件须同时满足。结果包含一组通过已知规则的方案，未公开的限制单独说明。</p>
          {!weapons && (
            <button disabled={busy} onClick={() => void fetchWeapons()}>
              {busy ? "载入武器目录…" : "重试读取武器目录"}
            </button>
          )}
          {weapons && (
            <>
              <label>
                搜索武器目录
                <input
                  value={weaponLookup}
                  placeholder="名称或型号，例如 AIM-9"
                  onChange={(e) => setWeaponLookup(e.target.value)}
                />
              </label>
              <div className="wt-mount-requirements">
                {requirements.map((r, index) => (
                  <div key={index}>
                    <label>
                      武器
                      <GameSelect
                        value={r.weapon}
                        disabled={busy}
                        onValueChange={(value) => {
                          setResults(null);
                          setRequirements((old) =>
                            old.map((n, i) => (i === index ? { ...n, weapon: value } : n)),
                          );
                        }}
                      >
                        <option value="">选择具体型号</option>
                        {[
                          ...weapons.weapons.filter((w) => w.key === r.weapon),
                          ...weapons.weapons
                            .filter(
                              (w) => w.key !== r.weapon && matchesLoadoutText(w.name, weaponLookup),
                            )
                            .slice(0, 120),
                        ].map((w) => (
                          <option key={w.key} value={w.key}>
                            {loadoutWeaponName(w.name)}
                          </option>
                        ))}
                      </GameSelect>
                    </label>
                    <label>
                      至少数量
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={r.count}
                        disabled={busy}
                        onChange={(e) => {
                          setResults(null);
                          setRequirements((old) =>
                            old.map((n, i) =>
                              i === index ? { ...n, count: Number(e.target.value) } : n,
                            ),
                          );
                        }}
                      />
                    </label>
                    <button
                      aria-label={`移除第 ${index + 1} 个武器条件`}
                      disabled={busy || requirements.length === 1}
                      onClick={() => {
                        setResults(null);
                        setRequirements((old) => old.filter((_, i) => i !== index));
                      }}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
              <button
                disabled={busy || requirements.length >= 12}
                onClick={() => {
                  setResults(null);
                  setRequirements((old) => [...old, { weapon: "", count: 1 }]);
                }}
              >
                ＋ 添加同时携带条件
              </button>
              <div className="wt-mount-toolbar">
                <label>
                  国家
                  <GameSelect
                    renderValue={countryLabel}
                    renderOption={countryLabel}
                    value={searchCountry}
                    disabled={busy}
                    onValueChange={(v) => {
                      setSearchCountry(v);
                      setResults(null);
                    }}
                  >
                    <option value="">全部国家</option>
                    {Object.entries(countries).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </GameSelect>
                </label>
                <label>
                  等级
                  <GameSelect
                    value={searchRank}
                    disabled={busy}
                    onValueChange={(value) => {
                      setSearchRank(value);
                      setResults(null);
                    }}
                  >
                    <option value="">全部等级</option>
                    {loadoutRanks.map((value) => (
                      <option key={value} value={value}>
                        {value} 级
                      </option>
                    ))}
                  </GameSelect>
                </label>
                <label>
                  军种
                  <GameSelect
                    value={searchCategory}
                    disabled={busy}
                    onValueChange={(v) => {
                      setSearchCategory(v);
                      setResults(null);
                    }}
                  >
                    <option value="">飞机与直升机</option>
                    <option value="aviation">飞机</option>
                    <option value="helicopters">直升机</option>
                  </GameSelect>
                </label>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void findAircraft()}
                >
                  {busy ? "正在核对挂点组合…" : "查找可配机型"}
                </button>
              </div>
              <p className="wt-mount-coverage">
                当前资料覆盖 {weapons.coverage.available} 个机型；{weapons.coverage.notProvided}{" "}
                个缺少完整资料。缺失资料不记作不支持。
              </p>
            </>
          )}
          {results && (
            <>
              <p aria-live="polite">
                找到 {results.total} 个匹配机型
                {results.unchecked ? `，另有 ${results.unchecked} 个机型尚未完成组合核对` : ""}。
              </p>
              <div className="wt-mount-results">
                {results.items.map((result) => (
                  <article key={result.vehicle.id}>
                    <VehicleTile
                      unit={result.vehicle}
                      mode={mode}
                      footerLabel={`${result.vehicle.rank} 级`}
                      countryLabel={countries[result.vehicle.country]}
                    />
                    <span className="wt-mount-state">已知规则通过</span>
                    <button
                      onClick={() =>
                        openResult(result, new Date().toISOString(), crypto.randomUUID())
                      }
                    >
                      查看挂载
                    </button>
                  </article>
                ))}
              </div>
              {results.total > 24 && (
                <div className="wt-mount-pagination">
                  <button
                    disabled={busy || results.offset === 0}
                    onClick={() => void findAircraft(Math.max(0, results.offset - 24))}
                  >
                    上一页
                  </button>
                  <span>
                    {Math.floor(results.offset / 24) + 1} / {Math.ceil(results.total / 24)}
                  </span>
                  <button
                    disabled={busy || results.offset + 24 >= results.total}
                    onClick={() => void findAircraft(results.offset + 24)}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {tab === "hall" && (
        <LoadoutHall onUse={(value) => openPlan({ ...value, id: crypto.randomUUID() })} />
      )}
      {tab === "saved" && (
        <section>
          <div className="wt-mount-heading">
            <h3>我的挂载方案</h3>
            <button onClick={() => void refreshShares()}>刷新我的推荐</button>
          </div>
          {!saved.length && !storageStatus.loading && (
            <div className="wt-mount-empty">
              还没有保存的挂载。点击“添加挂载”，选好机型后开始配置。
            </div>
          )}
          <div className="wt-mount-saved">
            {saved.map((p) => (
              <article key={p.id}>
                <h4>{p.name}</h4>
                <VehicleTile
                  unit={
                    facts.get(p.vehicleId) ||
                    summaries[p.vehicleId] || { id: p.vehicleId, name: p.vehicleId }
                  }
                  showAcquisition={facts.has(p.vehicleId) || !!summaries[p.vehicleId]}
                  countryLabel={countries[p.country]}
                />
                <p>
                  来源资料 {p.sourceDate.slice(0, 10)} ·{" "}
                  {p.preset ? "预设组合" : `${p.mounts.length} 个挂点`}
                </p>
                <div>
                  <button onClick={() => openPlan(p)}>编辑</button>
                  <button
                    onClick={() =>
                      openPlan({
                        ...p,
                        id: crypto.randomUUID(),
                        name: `${p.name.slice(0, 74)} · 副本`,
                      })
                    }
                  >
                    复制
                  </button>
                  <button disabled={busy} onClick={() => void exportPlan(p)}>
                    发布到大厅
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`删除“${p.name}”？`))
                        void savePlans(saved.filter((n) => n.id !== p.id));
                    }}
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
          {storageStatus.loading && <p aria-live="polite">正在读取云端挂载…</p>}

          {!!myShares.length && (
            <section className="wt-mount-shared-list">
              <h3>我的大厅推荐</h3>
              {myShares.map((item) => (
                <article key={item.id}>
                  <span>{item.plan.name}</span>
                  <div className="wt-mount-tag-list">
                    {item.tags?.map((tag) => (
                      <GameTag key={tag.id} tagId={tag.id} tone={tag.tone}>
                        {gameTagOptions.find((t) => t.id === tag.id)?.label || tag.id}
                      </GameTag>
                    ))}
                  </div>
                  <button onClick={() => openPlan({ ...item.plan, id: crypto.randomUUID() })}>
                    打开配置
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("撤回后，挂载大厅和该机型推荐将移除此方案。确定撤回？")) return;
                      try {
                        await loadoutRequest("shares/" + item.id + "/remove", {});
                        await refreshShares();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "撤回失败。");
                      }
                    }}
                  >
                    撤回推荐
                  </button>
                </article>
              ))}
            </section>
          )}
          <div className="wt-mount-list-actions">
            {draft && !saved.some((p) => p.id === draft.id && p.updatedAt === draft.updatedAt) && (
              <button onClick={() => openPlan(draft)}>继续未保存的草稿</button>
            )}
            {owner !== "guest" && (
              <button className="quiet-button" onClick={() => workspace?.open()}>
                查看账号同步状态
              </button>
            )}
          </div>
        </section>
      )}
      {selecting && (
        <Modal
          title={selecting === "replace" ? "重新选择机型" : "添加挂载 · 选择机型"}
          close={() => setSelecting(null)}
          className="wt-mount-vehicle-picker"
        >
          {selecting === "replace" && (
            <p className="wt-mount-note">
              选择其他机型后将清空当前挂载；已保存的方案在再次保存前保持原样。
            </p>
          )}
          <div className="wt-mount-toolbar">
            <label>
              国家
              <GameSelect
                value={country}
                renderValue={countryLabel}
                renderOption={countryLabel}
                onValueChange={setCountry}
              >
                <option value="">选择国家</option>
                {Object.entries(countries).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </GameSelect>
            </label>
            <label>
              等级
              <GameSelect value={rank} onValueChange={setRank}>
                <option value="">全部等级</option>
                {loadoutRanks.map((value) => (
                  <option key={value} value={value}>
                    {value} 级
                  </option>
                ))}
              </GameSelect>
            </label>
            <label>
              搜索机型
              <input
                value={vehicleQuery}
                placeholder="名称或型号"
                onChange={(e) => setVehicleQuery(e.target.value)}
              />
            </label>
          </div>
          {loadState.loading && <p aria-live="polite">正在读取该国资料…</p>}
          {loadState.error && (
            <p role="alert">
              {loadState.error}
              <button onClick={retry}>重试</button>
            </p>
          )}
          <div className="wt-mount-model-grid">
            {units
              .filter(
                (u) =>
                  (!rank || u.rank === rank) &&
                  (u.name + " " + u.nameEn + " " + u.id)
                    .toLowerCase()
                    .includes(vehicleQuery.toLowerCase()),
              )
              .map((u) => (
                <div key={u.id} className="wt-mount-model-choice">
                  <VehicleTile
                    unit={u}
                    mode={mode}
                    footerLabel={u.rank + " 级"}
                    showPackPrice={false}
                    onSelect={() => chooseVehicle(u.id)}
                  />
                </div>
              ))}
          </div>
          {!country && <p className="wt-mount-note">先选择国家，再选择可挂载的机型。</p>}
        </Modal>
      )}
      {picker && data && plan && (
        <Modal
          title={`挂点 ${data.hardpoints.find((p) => p.id === station)?.label || ""} · 选择挂载`}
          close={() => setPicker(false)}
          className="wt-mount-picker"
        >
          <div className="wt-mount-picker-tools">
            <input
              aria-label="搜索挂载武器"
              placeholder="搜索名称或型号"
              value={weaponQuery}
              onChange={(e) => setWeaponQuery(e.target.value)}
            />
            <button onClick={() => applyOption(null)}>卸下挂载</button>
          </div>
          <div className="wt-mount-weapon-list">
            {candidates.map((option) => {
              const next = [
                ...plan.mounts.filter((m) => m.station !== station),
                { station, option: optionKey(option) },
              ];
              const issues = checkLoadout(data, next).issues;
              const blocked = issues.some((issue) => issue.code !== "wing-max-difference");
              return (
                <article key={option.optionId} data-conflict={!!issues.length || undefined}>
                  <button disabled={blocked} onClick={() => applyOption(option)}>
                    {option.imageUrl && (
                      <img src={option.imageUrl} alt="" width={48} height={36} loading="lazy" />
                    )}
                    <span>
                      <strong>{loadoutWeaponName(option.name)}</strong>
                      <small>{kg(option.weightKg)}</small>
                    </span>
                  </button>
                  {loadoutWeaponName(option.name) !== option.name && (
                    <p className="wt-mount-source-name">来源名称：{option.name}</p>
                  )}
                  {issues.length > 0 && (
                    <p className="wt-mount-warning">{issues.map((i) => i.message).join(" ")}</p>
                  )}
                  {option.parameters.length > 0 && (
                    <dl className="wt-mount-weapon-parameters" aria-label="详细参数">
                      {option.parameters.map((parameter) => (
                        <div key={parameter.id}>
                          <dt>{parameter.label}</dt>
                          <dd>{loadoutParameterValue(parameter.value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </article>
              );
            })}
            {!candidates.length && <p>没有匹配的可装选项。</p>}
          </div>
        </Modal>
      )}
      {importing && (
        <Modal
          title={pending && search.recommendation ? "查看推荐挂载" : "导入挂载备份"}
          close={() => {
            setImporting(false);
            setPending(null);
          }}
          className="wt-mount-share"
        >
          {!pending && (
            <label>
              选择挂载备份文件
              <input
                type="file"
                accept=".wtloadout.json,.json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 256 * 1024) {
                    setError("备份文件不能超过256 KiB。");
                    return;
                  }
                  setImportText(await file.text());
                  setPending(null);
                }}
              />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          {!pending && (
            <button disabled={busy} onClick={() => void readImport()}>
              {busy ? "读取中…" : "读取预览"}
            </button>
          )}
          {pending && (
            <section>
              <h3>{pending.name}</h3>
              <p>
                {countries[pending.country]} · {pending.vehicleId} · {pending.mounts.length} 个挂点
              </p>
              <p>打开后按当前资料核对，保存时创建自己的副本。</p>
              <button
                className="primary-button"
                onClick={() => {
                  openPlan({ ...pending, id: crypto.randomUUID() });
                  setImporting(false);
                  void navigate({ to: "/loadouts", search: {}, replace: true });
                }}
              >
                打开并核对
              </button>
            </section>
          )}
        </Modal>
      )}
      {sharePlan && (
        <Modal
          title="发布到挂载大厅"
          subtitle="方案会关联到该机型详情中的挂载推荐，仅在应用内部展示。"
          close={() => setSharePlan(null)}
          className="wt-mount-share"
        >
          <p>为这套挂载选择用途标签，最多5个。私人方案名称不会作为公开标题。</p>
          {error && (
            <p role="alert" className="wt-mount-error">
              {error}
            </p>
          )}
          <TagSelector
            options={gameTagOptions}
            value={shareTags}
            allowedTones={freeTagTones}
            max={5}
            label="挂载标签"
            disabled={busy}
            onChange={(value) => {
              setShareTags(value);
              setShare("");
            }}
          />
          {share ? (
            <output>已发布到大厅，并关联该机型的挂载推荐。</output>
          ) : (
            <button
              className="primary-button"
              disabled={busy || !shareTags.length}
              onClick={() => void publishShare()}
            >
              {busy ? "正在发布…" : "确认发布"}
            </button>
          )}
        </Modal>
      )}
    </main>
  );
}
