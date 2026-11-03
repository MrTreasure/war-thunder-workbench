import { rating as vehicleRating } from "./vehicle-labels";
import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
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
} from "./intl-loadout-presentation";
import { Modal } from "./Modal";
import { useStored } from "./storage";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { useAccountWorkspace } from "./workspace-context";
import { loadoutRequest } from "./loadout-api";
import { useLoadoutPlans } from "./loadout-storage";
import { LoadoutPresets } from "./LoadoutPresets";
import { loadoutLibrary } from "./loadout-library";
import { LoadoutBombing } from "./LoadoutBombing";
import { LoadoutPlanCard } from "./LoadoutPlanCard";
import { readRemoteLoadout, type LoadoutShare } from "./loadout-shares";
import { TagSelector, type TagChoice } from "./components/TagSelector";
import { useGameTagAccess } from "./game-tag-access";
import { GameIcon } from "./components/GameIcon";
import { LoadoutWeaponFilters } from "./LoadoutWeaponFilters";
import { matchesWeaponFilters } from "./loadout-weapon-filters";
import { gameTagOptions } from "./game-tag-options";
import { LoadoutHall } from "./LoadoutHall";
import { LoadoutStationBoard } from "./LoadoutStationBoard";
import { LoadoutWeaponBrief, LoadoutWeaponDetails } from "./LoadoutWeaponDetails";
import { LoadoutCompareDock, LoadoutWeaponComparison } from "./LoadoutWeaponComparison";
import {
  comparedMissile,
  isComparableMissile,
  selectComparedMissile,
  missileComparisonLimit,
  type ComparedMissile,
} from "./loadout-weapon-details";
import {
  checkLoadout,
  hasConfigurableLoadout,
  loadoutRevision,
  optionKey,
  weaponKey,
  presetKey,
  validLoadoutPlan,
  type LoadoutPlan,
  type Mount,
  type Requirement,
} from "./loadouts";
import type { Mode, WikiLoadouts, WikiLoadoutOption } from "./models";
import "./loadouts.css";
type Result = {
  vehicle: VehicleTileUnit & {
    country: string;
  };
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
  weapons: {
    key: string;
    name: string;
    imageUrl: string | null;
  }[];
  coverage: {
    available: number;
    notProvided: number;
    total: number;
  };
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
      <span>{t(countries[id])}</span>
    </span>
  ) : null;
const kg = (value: number | null) =>
  value === null
    ? t("未知")
    : t("{0} 千克", [value.toLocaleString(getLocale(), { maximumFractionDigits: 3 })]);
const planOrNull = (value: unknown): value is LoadoutPlan | null => {
  if (value === null || validLoadoutPlan(value)) return true;
  if (!value || typeof value !== "object") return false;
  const draft = value as LoadoutPlan;
  return (
    typeof draft.name === "string" &&
    draft.name.length <= 80 &&
    validLoadoutPlan({ ...draft, name: t("草稿") })
  );
};
function makePlan(unit: VehicleFacts, country: string, data: WikiLoadouts): LoadoutPlan {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: t("{0} \u00B7 自定义挂载", [unit.name]),
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
  useLocale();
  const account = useWorkbenchAccount();
  const { session } = account;
  const workspace = useAccountWorkspace();
  const owner = session?.user?.id || "guest";
  if (!session?.user)
    return (
      <main className="wt-mount-page wt-mount-login">
        <h2>{t("模拟挂载")}</h2>
        <p>{t("登录后创建、保存和分享挂载方案。")}</p>
        <button
          className="primary-button"
          disabled={account.initializing || account.busy}
          onClick={() => void account.login()}
        >
          {account.initializing
            ? t("正在恢复登录\u2026")
            : account.busy
              ? t("正在登录\u2026")
              : t("登录并继续")}
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
        <p>{t("正在恢复账号方案\u2026")}</p>
      </main>
    );
  return <LoadoutPage key={owner} owner={owner} />;
}
function LoadoutPage({ owner }: { owner: string }) {
  useLocale();
  const workspace = useAccountWorkspace();
  const tagAccess = useGameTagAccess("loadouts");
  const navigate = useNavigate();
  const search = useRouterState({
    select: (s) =>
      s.location.search as {
        recommendation?: string;
        country?: string;
        vehicle?: string;
      },
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
  const [weaponType, setWeaponType] = useState("");
  const [weaponFamily, setWeaponFamily] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(false);
  const [compared, setCompared] = useState<ComparedMissile[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [share, setShare] = useState("");
  const [sharePlan, setSharePlan] = useState<LoadoutPlan | null>(null);
  const [shareTags, setShareTags] = useState<TagChoice[]>([]);
  const [selecting, setSelecting] = useState<"new" | "replace" | null>(null);
  const [myShares, setMyShares] = useState<LoadoutShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(true);
  const library = useMemo(() => loadoutLibrary(saved, myShares), [saved, myShares]);
  const [importText, setImportText] = useState("");
  const [pending, setPending] = useState<LoadoutPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [weaponLookup, setWeaponLookup] = useState("");
  const [lookupType, setLookupType] = useState("");
  const [lookupFamily, setLookupFamily] = useState("");
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
    void loadoutRequest<{
      items: LoadoutShare[];
    }>("shares/mine", undefined, controller.signal)
      .then(
        (value) => {
          if (!controller.signal.aborted) setMyShares(value.items);
        },
        (e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : t("推荐读取失败。"));
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setSharesLoading(false);
      });
    return () => controller.abort();
  }, [owner]);
  const unit =
    units.find((u) => u.id === vehicle) || (pinnedUnit?.id === vehicle ? pinnedUnit : undefined);
  const data = activeData;
  const check = useMemo(
    () => (data && plan ? checkLoadout(data, plan.mounts, plan.preset) : null),
    [data, plan],
  );
  const [loadState, setLoadState] = useState<{
    error: string;
    loading: boolean;
  }>({
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
          error: e instanceof Error ? e.message : t("国家资料读取失败。"),
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
            setError(t("当前资料未找到该机型挂载，原方案仍保留。"));
            return;
          }
          setActiveData(structuredClone(selected.wikiDetails.loadouts));
          setPinnedUnit(selected);
        },
        (cause: unknown) => {
          if (opening.current === sequence)
            setError(cause instanceof Error ? cause.message : t("机型资料读取失败。"));
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
          setPending({ ...p, name: t("导入挂载方案") });
          setImporting(true);
          setImportText(search.recommendation!);
        }
      },
      (e: unknown) => active && setError(e instanceof Error ? e.message : t("分享内容读取失败。")),
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
        else setError(t("当前国家资料未找到这个机型。"));
      },
      (cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("机型资料读取失败。"));
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
      setError(t("请先确认按当前资料重新核对，再保存方案。"));
      return;
    }
    if (check?.issues.length) {
      setError(t("请先处理已列出的挂载冲突；当前编辑已保留为草稿。"));
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
          ? t("方案已保存到此浏览器。")
          : t("方案已交给账号工作区同步，可在账号菜单查看同步状态。"),
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
      setError(e instanceof Error ? e.message : t("分享失败。"));
    } finally {
      setBusy(false);
    }
  };
  const refreshShares = async () => {
    setSharesLoading(true);
    try {
      const value = await loadoutRequest<{
        items: LoadoutShare[];
      }>("shares/mine");
      setMyShares(value.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("分享读取失败。"));
    } finally {
      setSharesLoading(false);
    }
  };
  const withdrawShares = async (items: LoadoutShare[]) => {
    if (!confirm(t("撤回后，挂载大厅和该机型推荐将移除此方案。确定撤回？"))) return;
    setBusy(true);
    try {
      for (const item of items) await loadoutRequest("shares/" + item.id + "/remove", {});
    } catch (e) {
      setError(e instanceof Error ? e.message : t("撤回失败。"));
    } finally {
      await refreshShares();
      setBusy(false);
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
      if (!importText.trim()) throw Error(t("请先选择挂载备份文件。"));
      const value: unknown = JSON.parse(importText);
      if (!validLoadoutPlan(value)) throw Error(t("挂载备份文件格式不正确。"));
      setPending({ ...value, name: t("导入挂载方案") });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("分享内容读取失败。"));
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
        setError(e instanceof Error ? e.message : t("武器目录读取失败。"));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const findAircraft = async (offset = 0) => {
    if (requirements.some((r) => !r.weapon || !Number.isSafeInteger(r.count) || r.count < 1)) {
      setError(t("请选择武器并填写至少数量。"));
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
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : t("挂载查找失败。"));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const openResult = (result: Result, now: string, id: string) => {
    openPlan({
      schemaVersion: 1,
      id,
      name: t("{0} \u00B7 需求方案", [result.vehicle.name]),
      vehicleId: result.vehicle.id,
      country: result.vehicle.country,
      sourceHash: result.sourceHash,
      sourceDate: result.sourceDate,
      mounts: result.mounts,
      preset: result.preset,
      updatedAt: now,
    });
  };
  const stationOptions =
    data?.compatibility.filter((option) =>
      option.stations.some((point) => point.hardpointId === station),
    ) || [];
  const candidates = stationOptions.filter(
    (option) =>
      matchesLoadoutText(option.name, weaponQuery) &&
      matchesWeaponFilters(option.name, weaponType, weaponFamily),
  );
  const weaponOption = (key: string) => {
    const weapon = weapons?.weapons.find((item) => item.key === key);
    if (!weapon) return null;
    return (
      <span className="wt-mount-weapon-option">
        {weapon.imageUrl ? (
          <img src={weapon.imageUrl} alt="" width={36} height={28} loading="lazy" />
        ) : (
          <GameIcon name="loadout" />
        )}
        <span>{loadoutWeaponName(weapon.name)}</span>
      </span>
    );
  };
  const retry = () => {
    setLoadState({ error: "", loading: true });
    void vehicleStore.ensure(country).catch((e: unknown) =>
      setLoadState({
        error: e instanceof Error ? e.message : t("资料读取失败。"),
        loading: false,
      }),
    );
  };
  return (
    <main className="wt-mount-page">
      <div className="wt-mount-heading">
        <div>
          <h2>{tab === "editor" ? t("配置挂载") : t("模拟挂载")}</h2>
          <p>{t("我的挂载 \u00B7 云端保存与应用内推荐")}</p>
        </div>
        <button
          className="quiet-button"
          onClick={() => {
            setImporting(true);
            setPending(null);
            setImportText("");
          }}
        >
          {t("导入方案")}
        </button>
        <button className="primary-button" onClick={() => setSelecting("new")}>
          {t("＋ 添加挂载")}
        </button>
      </div>
      <nav className="wt-lineup-sections wt-mount-tabs" aria-label={t("挂载工具")}>
        {(
          [
            ["saved", t("我的挂载（{0}）", [saved.length])],
            ["hall", t("挂载大厅")],
            ["search", t("按挂载找机型")],
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
          {loadState.error && <button onClick={retry}>{t("重试")}</button>}
        </p>
      )}
      {storageStatus.sending && <p aria-live="polite">{t("正在保存云端挂载方案\u2026")}</p>}
      {storageStatus.remote && storageError && (
        <button onClick={() => void storageStatus.reload()}>{t("重新读取云端方案")}</button>
      )}
      {message && (
        <p aria-live="polite" className="wt-mount-message">
          {message}
        </p>
      )}
      {tab === "editor" && (
        <>
          <div className="wt-mount-editor-toolbar">
            <button onClick={() => secondaryAction("back")}>{t("\u2190 返回挂载列表")}</button>
            <button onClick={() => setSelecting("replace")}>{t("重新选择机型")}</button>
            <GameSelect
              aria-label={t("权重模式")}
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
            >
              <option value="ab">{t("街机 AB")}</option>
              <option value="rb">{t("历史 RB")}</option>
              <option value="sb">{t("全真 SB")}</option>
            </GameSelect>
          </div>
          {!plan && draft && (
            <button className="quiet-button" onClick={() => openPlan(draft)}>
              {t("继续本地草稿 \u00B7")}
              {draft.name}
            </button>
          )}
          {loadState.loading && <p aria-live="polite">{t("正在加载该国完整资料\u2026")}</p>}
          {!unit && !loadState.loading && (
            <div className="wt-mount-empty">
              {t("选择机型后开始配置。可以先在\u201C按挂载找机型\u201D中提出武器需求。")}
            </div>
          )}
          {unit && data && data.status !== "available" && (
            <div className="wt-mount-empty">
              <VehicleTile unit={unit} mode={mode} />
              {data?.status === "none" ? (
                <p>{t("Wiki 明确列出该机没有可用外挂。")}</p>
              ) : (
                <p>
                  {t("该机挂载资料尚未完整提供，暂不能核对配置。已拥有状态与挂载能力分别处理。")}
                </p>
              )}
              {data && (
                <a href={data.source} target="_blank" rel="noopener noreferrer">
                  {t("查看官方 Wiki \u2197")}
                </a>
              )}
            </div>
          )}
          {plan && !data && !loadState.loading && (
            <p aria-live="polite">{t("正在准备挂载资料\u2026")}</p>
          )}
          {unit && data?.status === "available" && plan && (
            <>
              <section className="wt-mount-plan-title">
                <VehicleTile unit={unit} mode={mode} footerLabel={t("{0} 级", [unit.rank])} />
                <label>
                  {t("方案名称")}
                  <input
                    maxLength={80}
                    value={plan.name}
                    onChange={(e) => setWorkingPlan({ ...plan, name: e.target.value })}
                  />
                </label>
                <span className="wt-mount-state">
                  {check?.issues.length
                    ? t("{0} 项冲突", [check.issues.length])
                    : t("已知规则通过")}
                </span>
              </section>
              {loadoutRevision(data) !== plan.sourceHash && (
                <p className="wt-mount-warning">
                  {t("方案来源版本与当前资料不同，请查看挂载及冲突提示后确认。")}
                  <button
                    onClick={() =>
                      mutate({
                        ...plan,
                        sourceHash: loadoutRevision(data),
                        sourceDate: data.checkedAt,
                      })
                    }
                  >
                    {t("确认按当前资料核对")}
                  </button>
                </p>
              )}
              {unit.wikiDetails?.loadouts &&
                loadoutRevision(data) !== loadoutRevision(unit.wikiDetails.loadouts) && (
                  <p className="wt-mount-warning">
                    {t("已有新的挂载资料，当前编辑保持原版本。")}
                    <button
                      onClick={() => {
                        setActiveData(structuredClone(unit.wikiDetails!.loadouts!));
                        setHistory([]);
                        setFuture([]);
                      }}
                    >
                      {t("载入新资料并核对")}
                    </button>
                  </p>
                )}
              <div className="wt-mount-workspace">
                <section className="wt-mount-board" aria-label={t("挂点配置")}>
                  {data.hardpoints.length > 0 ? (
                    <>
                      <div className="wt-mount-board-top">
                        <h3>{t("自定义挂载")}</h3>
                        <span>{t("挂点示意 \u00B7 按来源编号与翼侧排列")}</span>
                      </div>
                      <LoadoutStationBoard
                        data={data}
                        mounts={plan.mounts}
                        selected={station}
                        conflicts={new Set(check?.issues.flatMap((issue) => issue.stations) || [])}
                        onChoose={(id) => {
                          setStation(id);
                          setWeaponQuery("");
                          setWeaponType("");
                          setWeaponFamily("");
                          setPicker(true);
                        }}
                      />
                    </>
                  ) : (
                    <LoadoutPresets
                      data={data}
                      onUse={(key) => mutate({ ...plan, mounts: [], preset: key })}
                    />
                  )}
                </section>
                <aside className="wt-mount-summary" aria-label={t("配置汇总")}>
                  <h3>{t("当前挂载")}</h3>
                  <dl>
                    <div>
                      <dt>{t("总挂载重量")}</dt>
                      <dd>{kg(check?.weightKg ?? null)}</dd>
                    </div>
                    {data.limits.map((l) => (
                      <div key={l.id}>
                        <dt>{t(l.label)}</dt>
                        <dd>
                          {l.value === null
                            ? t("未知")
                            : `${l.value.toLocaleString(getLocale())} ${loadoutParameterValue(l.unit)}`}
                        </dd>
                      </div>
                    ))}
                    {data.hardpoints.length > 0 && (
                      <>
                        <div>
                          <dt>{t("左翼 / 右翼")}</dt>
                          <dd>
                            {kg(check?.leftKg ?? null)} / {kg(check?.rightKg ?? null)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("两翼重量差")}</dt>
                          <dd>
                            {check?.leftKg !== null && check?.rightKg !== null && check
                              ? kg(Math.abs(check.leftKg - check.rightKg))
                              : t("未知")}
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
                        <li key={i.code + i.stations.join()}>{t(i.message)}</li>
                      ))}
                    </ul>
                  )}
                  <LoadoutBombing
                    data={data}
                    mounts={plan.mounts}
                    preset={plan.preset}
                    airRbRating={unit ? vehicleRating(unit, "rb") : undefined}
                    category={unit?.category ?? undefined}
                    premium={unit?.premium}
                    role={unit?.role}
                    mode={mode}
                  />
                  <section className="wt-mount-provenance">
                    <h4>{t("规则与来源")}</h4>
                    {check?.limitations.map((text) => (
                      <p key={text}>{t(text)}</p>
                    ))}
                    <a href={data.source} target="_blank" rel="noopener noreferrer">
                      {t("官方 Wiki \u00B7")}
                      {data.checkedAt.slice(0, 10)} ↗
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
                    {t("撤销")}
                  </button>
                  <button disabled={!future.length} onClick={() => secondaryAction("redo")}>
                    {t("重做")}
                  </button>
                  <button onClick={() => secondaryAction("clear")}>{t("清空")}</button>
                  <button onClick={() => secondaryAction("export")}>{t("导出文件")}</button>
                  <button onClick={() => secondaryAction("back")}>{t("返回方案")}</button>
                </div>
                <div className="wt-mount-mobile-actions">
                  <GameSelect
                    aria-label={t("更多挂载操作")}
                    value=""
                    onValueChange={secondaryAction}
                  >
                    <option value="">{t("更多操作")}</option>
                    <option value="undo" disabled={!history.length}>
                      {t("撤销")}
                    </option>
                    <option value="redo" disabled={!future.length}>
                      {t("重做")}
                    </option>
                    <option value="clear">{t("清空")}</option>
                    <option value="export">{t("导出文件")}</option>
                    <option value="back">{t("返回方案")}</option>
                  </GameSelect>
                </div>
                <span className="wt-mount-action-spacer" />
                <button
                  disabled={busy || !!check?.issues.length}
                  onClick={() => void exportPlan(plan)}
                >
                  {t("发布到大厅")}
                </button>
                <button
                  className="primary-button"
                  disabled={storageStatus.sending}
                  onClick={() => void commit()}
                >
                  {storageStatus.sending ? t("正在保存\u2026") : t("保存方案")}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {tab === "search" && (
        <section className="wt-mount-find">
          <h3>{t("这些武器能一起挂在哪个机型上？")}</h3>
          <p>{t("多个条件须同时满足。结果包含一组通过已知规则的方案，未公开的限制单独说明。")}</p>
          {!weapons && (
            <button disabled={busy} onClick={() => void fetchWeapons()}>
              {busy ? t("载入武器目录\u2026") : t("重试读取武器目录")}
            </button>
          )}
          {weapons && (
            <>
              <div className="wt-mount-requirements">
                {requirements.map((r, index) => (
                  <div key={index}>
                    {index === 0 && (
                      <>
                        <label>
                          {t("搜索武器目录")}
                          <input
                            value={weaponLookup}
                            placeholder={t("名称或型号，例如 AIM-9")}
                            onChange={(e) => setWeaponLookup(e.target.value)}
                          />
                        </label>
                        <LoadoutWeaponFilters
                          names={weapons.weapons.map((weapon) => weapon.name)}
                          type={lookupType}
                          family={lookupFamily}
                          onChange={(type, family) => {
                            setLookupType(type);
                            setLookupFamily(family);
                          }}
                        />
                      </>
                    )}
                    <label>
                      {t("武器")}
                      <GameSelect
                        value={r.weapon}
                        disabled={busy}
                        menuClassName="wt-mount-weapon-menu"
                        renderOption={(option) => weaponOption(option.value)}
                        renderValue={(key) => weaponOption(key)}
                        onValueChange={(value) => {
                          setResults(null);
                          setRequirements((old) =>
                            old.map((n, i) => (i === index ? { ...n, weapon: value } : n)),
                          );
                        }}
                      >
                        <option value="">{t("选择具体型号")}</option>
                        {[
                          ...weapons.weapons.filter((w) => w.key === r.weapon),
                          ...weapons.weapons.filter(
                            (w) =>
                              w.key !== r.weapon &&
                              matchesLoadoutText(w.name, weaponLookup) &&
                              matchesWeaponFilters(w.name, lookupType, lookupFamily),
                          ),
                        ].map((w) => (
                          <option key={w.key} value={w.key}>
                            {loadoutWeaponName(w.name)}
                          </option>
                        ))}
                      </GameSelect>
                    </label>
                    <label>
                      {t("至少数量")}
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
                      aria-label={t("移除第 {0} 个武器条件", [index + 1])}
                      disabled={busy || requirements.length === 1}
                      onClick={() => {
                        setResults(null);
                        setRequirements((old) => old.filter((_, i) => i !== index));
                      }}
                    >
                      {t("移除")}
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
                {t("＋ 添加同时携带条件")}
              </button>
              <div className="wt-mount-toolbar">
                <label>
                  {t("国家")}
                  <GameSelect
                    renderValue={countryLabel}
                    renderOption={(option) => countryLabel(option.value)}
                    value={searchCountry}
                    disabled={busy}
                    onValueChange={(v) => {
                      setSearchCountry(v);
                      setResults(null);
                    }}
                  >
                    <option value="">{t("全部国家")}</option>
                    {Object.entries(countries).map(([id, name]) => (
                      <option key={id} value={id}>
                        {t(name)}
                      </option>
                    ))}
                  </GameSelect>
                </label>
                <label>
                  {t("等级")}
                  <GameSelect
                    value={searchRank}
                    disabled={busy}
                    onValueChange={(value) => {
                      setSearchRank(value);
                      setResults(null);
                    }}
                  >
                    <option value="">{t("全部等级")}</option>
                    {loadoutRanks.map((value) => (
                      <option key={value} value={value}>
                        {value}
                        {t("级")}
                      </option>
                    ))}
                  </GameSelect>
                </label>
                <label>
                  {t("军种")}
                  <GameSelect
                    value={searchCategory}
                    disabled={busy}
                    onValueChange={(v) => {
                      setSearchCategory(v);
                      setResults(null);
                    }}
                  >
                    <option value="">{t("飞机与直升机")}</option>
                    <option value="aviation">{t("飞机")}</option>
                    <option value="helicopters">{t("直升机")}</option>
                  </GameSelect>
                </label>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void findAircraft()}
                >
                  {busy ? t("正在核对挂点组合\u2026") : t("查找可配机型")}
                </button>
              </div>
              <p className="wt-mount-coverage">
                {t("当前资料覆盖")}
                {weapons.coverage.available}
                {t("个机型；")}
                {weapons.coverage.notProvided} {t("个缺少完整资料。缺失资料不记作不支持。")}
              </p>
            </>
          )}
          {results && (
            <>
              <p aria-live="polite">
                {t("找到")}
                {results.total}
                {t("个匹配机型")}
                {results.unchecked
                  ? t("，另有 {0} 个机型尚未完成组合核对", [results.unchecked])
                  : ""}
                。
              </p>
              <div className="wt-mount-results">
                {results.items.map((result) => (
                  <article key={result.vehicle.id}>
                    <VehicleTile
                      unit={result.vehicle}
                      mode={mode}
                      footerLabel={t("{0} 级", [result.vehicle.rank])}
                      countryLabel={t(countries[result.vehicle.country])}
                    />
                    <span className="wt-mount-state">{t("已知规则通过")}</span>
                    <button
                      onClick={() =>
                        openResult(result, new Date().toISOString(), crypto.randomUUID())
                      }
                    >
                      {t("查看挂载")}
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
                    {t("上一页")}
                  </button>
                  <span>
                    {Math.floor(results.offset / 24) + 1} / {Math.ceil(results.total / 24)}
                  </span>
                  <button
                    disabled={busy || results.offset + 24 >= results.total}
                    onClick={() => void findAircraft(results.offset + 24)}
                  >
                    {t("下一页")}
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
            <h3>{t("我的挂载方案")}</h3>
            <button disabled={sharesLoading || busy} onClick={() => void refreshShares()}>
              {sharesLoading ? t("刷新中\u2026") : t("刷新推荐状态")}
            </button>
          </div>
          {!library.length && !storageStatus.loading && !sharesLoading && (
            <div className="wt-mount-empty">
              {t("还没有保存的挂载。点击\u201C添加挂载\u201D，选好机型后开始配置。")}
            </div>
          )}
          {storageStatus.previewError && (
            <p role="alert" className="wt-mount-error">
              {storageStatus.previewError}
              <button onClick={() => void storageStatus.reload()}>{t("刷新资料")}</button>
            </p>
          )}
          <div className="wt-mount-saved">
            {library.map(({ plan: p, saved: isSaved, recommendations }) => {
              const recommendation = recommendations[0];
              return (
                <LoadoutPlanCard
                  key={isSaved ? p.id : `recommended:${p.id}`}
                  title={p.name}
                  vehicle={
                    storageStatus.summaries[p.id]?.vehicle ||
                    recommendation?.vehicle || {
                      ...(facts.get(p.vehicleId) || { id: p.vehicleId, name: p.vehicleId }),
                      country: p.country,
                    }
                  }
                  preview={storageStatus.summaries[p.id]?.preview || recommendation?.preview}
                  recommended={!!recommendation}
                  tags={recommendation?.tags}
                  meta={
                    <>
                      {t(countries[p.country])} ·{" "}
                      {p.preset ? t("预设组合") : t("{0} 个挂点", [p.mounts.length])}{" "}
                      {t("\u00B7 来源")}
                      {p.sourceDate.slice(0, 10)}
                    </>
                  }
                >
                  <button onClick={() => openPlan(isSaved ? p : { ...p, id: crypto.randomUUID() })}>
                    {isSaved ? t("编辑") : t("打开配置")}
                  </button>
                  {isSaved && (
                    <button
                      onClick={() =>
                        openPlan({
                          ...p,
                          id: crypto.randomUUID(),
                          name: t("{0} \u00B7 副本", [p.name.slice(0, 74)]),
                        })
                      }
                    >
                      {t("复制")}
                    </button>
                  )}
                  {recommendation ? (
                    <button
                      disabled={busy || sharesLoading}
                      onClick={() => void withdrawShares(recommendations)}
                    >
                      {t("撤回推荐")}
                    </button>
                  ) : (
                    <button disabled={busy || sharesLoading} onClick={() => void exportPlan(p)}>
                      {t("发布到大厅")}
                    </button>
                  )}
                  {isSaved && (
                    <button
                      onClick={() => {
                        if (confirm(t("删除\u201C{0}\u201D？", [p.name])))
                          void savePlans(saved.filter((item) => item.id !== p.id));
                      }}
                    >
                      {t("删除")}
                    </button>
                  )}
                </LoadoutPlanCard>
              );
            })}
          </div>
          {storageStatus.loading && <p aria-live="polite">{t("正在读取云端挂载\u2026")}</p>}

          <div className="wt-mount-list-actions">
            {draft && !saved.some((p) => p.id === draft.id && p.updatedAt === draft.updatedAt) && (
              <button onClick={() => openPlan(draft)}>{t("继续未保存的草稿")}</button>
            )}
            {owner !== "guest" && (
              <button className="quiet-button" onClick={() => workspace?.open()}>
                {t("查看账号同步状态")}
              </button>
            )}
          </div>
        </section>
      )}
      {selecting && (
        <Modal
          title={selecting === "replace" ? t("重新选择机型") : t("添加挂载 \u00B7 选择机型")}
          close={() => setSelecting(null)}
          className="wt-mount-vehicle-picker"
        >
          {selecting === "replace" && (
            <p className="wt-mount-note">
              {t("选择其他机型后将清空当前挂载；已保存的方案在再次保存前保持原样。")}
            </p>
          )}
          <div className="wt-mount-toolbar">
            <label>
              {t("国家")}
              <GameSelect
                value={country}
                renderValue={countryLabel}
                renderOption={(option) => countryLabel(option.value)}
                onValueChange={setCountry}
              >
                <option value="">{t("选择国家")}</option>
                {Object.entries(countries).map(([id, name]) => (
                  <option key={id} value={id}>
                    {t(name)}
                  </option>
                ))}
              </GameSelect>
            </label>
            <label>
              {t("等级")}
              <GameSelect value={rank} onValueChange={setRank}>
                <option value="">{t("全部等级")}</option>
                {loadoutRanks.map((value) => (
                  <option key={value} value={value}>
                    {value}
                    {t("级")}
                  </option>
                ))}
              </GameSelect>
            </label>
            <label>
              {t("搜索机型")}
              <input
                value={vehicleQuery}
                placeholder={t("名称或型号")}
                onChange={(e) => setVehicleQuery(e.target.value)}
              />
            </label>
          </div>
          {loadState.loading && <p aria-live="polite">{t("正在读取该国资料\u2026")}</p>}
          {loadState.error && (
            <p role="alert">
              {loadState.error}
              <button onClick={retry}>{t("重试")}</button>
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
                    footerLabel={u.rank + t("级")}
                    showPackPrice={false}
                    onSelect={() => chooseVehicle(u.id)}
                  />
                </div>
              ))}
          </div>
          {!country && <p className="wt-mount-note">{t("先选择国家，再选择可挂载的机型。")}</p>}
        </Modal>
      )}
      {picker && data && plan && (
        <Modal
          title={t("挂点 {0} \u00B7 选择挂载", [
            data.hardpoints.find((p) => p.id === station)?.label || "",
          ])}
          close={() => setPicker(false)}
          className="wt-mount-picker"
        >
          <div className="wt-mount-picker-tools">
            <label>
              {t("搜索")}
              <input
                aria-label={t("搜索挂载武器")}
                placeholder={t("名称或型号，如 PL8")}
                value={weaponQuery}
                onChange={(e) => setWeaponQuery(e.target.value)}
              />
            </label>
            <LoadoutWeaponFilters
              names={stationOptions.map((option) => option.name)}
              type={weaponType}
              family={weaponFamily}
              onChange={(type, family) => {
                setWeaponType(type);
                setWeaponFamily(family);
              }}
            />
            <button onClick={() => applyOption(null)}>{t("卸下挂载")}</button>
            <button onClick={() => setPicker(false)}>{t("返回配置")}</button>
          </div>
          {!candidates.length && (
            <p className="wt-mount-note">{t("当前挂点没有符合筛选条件的挂载。")}</p>
          )}
          <div className="wt-mount-weapon-list">
            {candidates.map((option) => {
              const next = [
                ...plan.mounts.filter((m) => m.station !== station),
                { station, option: optionKey(option) },
              ];
              const issues = checkLoadout(data, next).issues;
              const blocked = issues.some((issue) => issue.code !== "wing-max-difference");
              const comparisonSelected = compared.some(
                (item) => item.key === weaponKey(option.name),
              );
              return (
                <article key={option.optionId} data-conflict={!!issues.length || undefined}>
                  <div className="wt-mount-weapon-row">
                    <button
                      className="wt-mount-weapon-select"
                      disabled={blocked}
                      onClick={() => applyOption(option)}
                    >
                      {option.imageUrl && (
                        <img src={option.imageUrl} alt="" width={48} height={36} loading="lazy" />
                      )}
                      <span className="wt-mount-weapon-title">
                        <strong>{loadoutWeaponName(option.name)}</strong>
                        <small>{kg(option.weightKg)}</small>
                      </span>
                    </button>
                    {(isComparableMissile(option) ||
                      option.parameters.some((p) => p.id === "guidance")) && (
                      <LoadoutWeaponBrief option={option} />
                    )}
                    {isComparableMissile(option) && (
                      <label className="wt-mount-compare-choice">
                        <input
                          type="checkbox"
                          checked={comparisonSelected}
                          disabled={
                            compared.length >= missileComparisonLimit && !comparisonSelected
                          }
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            const item = comparedMissile(option, data);
                            setCompared((old) => selectComparedMissile(old, item, enabled));
                          }}
                        />
                        {t("对比")}
                      </label>
                    )}
                  </div>
                  {issues.length > 0 && (
                    <p className="wt-mount-warning">
                      {issues.map((issue) => t(issue.message)).join(" ")}
                    </p>
                  )}
                  <details className="wt-mount-weapon-more">
                    <summary>{t("详细参数与来源")}</summary>
                    <LoadoutWeaponDetails option={option} />
                  </details>
                </article>
              );
            })}
            {!candidates.length && <p>{t("没有匹配的可装选项。")}</p>}
          </div>
        </Modal>
      )}
      {importing && (
        <Modal
          title={pending && search.recommendation ? t("查看推荐挂载") : t("导入挂载备份")}
          close={() => {
            setImporting(false);
            setPending(null);
          }}
          className="wt-mount-share"
        >
          {!pending && (
            <label>
              {t("选择挂载备份文件")}
              <input
                type="file"
                accept=".wtloadout.json,.json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 256 * 1024) {
                    setError(t("备份文件不能超过256 KiB。"));
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
              {busy ? t("读取中\u2026") : t("读取预览")}
            </button>
          )}
          {pending && (
            <section>
              <h3>{pending.name}</h3>
              <p>
                {t(countries[pending.country])} · {pending.vehicleId} · {pending.mounts.length}
                {t("个挂点")}
              </p>
              <p>{t("打开后按当前资料核对，保存时创建自己的副本。")}</p>
              <button
                className="primary-button"
                onClick={() => {
                  openPlan({ ...pending, id: crypto.randomUUID() });
                  setImporting(false);
                  void navigate({ to: "/loadouts", search: {}, replace: true });
                }}
              >
                {t("打开并核对")}
              </button>
            </section>
          )}
        </Modal>
      )}
      {sharePlan && (
        <Modal
          title={t("发布到挂载大厅")}
          subtitle={t("方案会关联到该机型详情中的挂载推荐，仅在应用内部展示。")}
          close={() => setSharePlan(null)}
          className="wt-mount-share"
        >
          <p>{t("为这套挂载选择用途标签，最多5个。私人方案名称不会作为公开标题。")}</p>
          {error && (
            <p role="alert" className="wt-mount-error">
              {error}
            </p>
          )}
          <TagSelector
            options={gameTagOptions}
            value={shareTags}
            allowedTones={tagAccess.allowedTones}
            loading={tagAccess.loading}
            error={tagAccess.error}
            onRetry={tagAccess.refresh}
            max={5}
            label={t("挂载标签")}
            disabled={busy}
            onChange={(value) => {
              setShareTags(value);
              setShare("");
            }}
          />
          {share ? (
            <output>{t("已发布到大厅，并关联该机型的挂载推荐。")}</output>
          ) : (
            <button
              className="primary-button"
              disabled={busy || tagAccess.loading || !!tagAccess.error || !shareTags.length}
              onClick={() => void publishShare()}
            >
              {busy ? t("正在发布\u2026") : t("确认发布")}
            </button>
          )}
        </Modal>
      )}
      {!!compared.length && !picker && !comparisonOpen && (
        <LoadoutCompareDock count={compared.length} onOpen={() => setComparisonOpen(true)} />
      )}
      {comparisonOpen && (
        <LoadoutWeaponComparison
          items={compared}
          onRemove={(key) => setCompared((old) => old.filter((item) => item.key !== key))}
          onClear={() => setCompared([])}
          close={() => setComparisonOpen(false)}
        />
      )}
    </main>
  );
}
