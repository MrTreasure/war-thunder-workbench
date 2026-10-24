import { GameAccountBinding } from "./GameAccountBinding";
import { readPublicResource } from "./public-resource-api";
import { queryTask, pendingQuery, resumeQuery, forgetQuery } from "./player-query-task";
import { vehicleDisplayName } from "./vehicle-display-name";
import { statsCountryMatches, statsCountryLabel } from "./stats-country";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  comparePlayerVehicles,
  type VehicleSort,
  type VehicleSortKey,
} from "./player-vehicle-sort";
import { PlayerTypeUsage } from "./PlayerTypeUsage";
import { PlayerCareerOverview } from "./PlayerCareerOverview";
import { PlayerRankings } from "./PlayerRankings";
import { PlayerVehicleDetails } from "./PlayerGarage";
import { PlayerVehicleShare, startVehicleShare } from "./PlayerVehicleShare";
import type { VehicleShareJob } from "./PlayerVehicleShare";
import { PlayerVehicleCards, PlayerVehiclePagination } from "./PlayerVehicleCards";
import { compactSilver, savedVehiclePresentation, saveVehiclePresentation, savedVehiclePageSize, saveVehiclePageSize } from "./player-number-format";
import type { VehiclePresentation } from "./player-number-format";
import { clearRankingMemory, usePlayerRead } from "./player-rankings-api";
import type { PlayerDetails } from "./player-rankings-api";
import { AccountValuation } from "./AccountValuation";
import { PlayerReport } from "./PlayerReport";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { reportStyle, reportStyles, type ReportStyle } from "./player-report-style";
import { StatsDataNotes } from "./StatsDataNotes";
import {
  defaultReportTheme,
  imageReportTheme,
  uploadReportBackground,
  localReportImage,
} from "./player-report-design";
import type { ReportTheme } from "./player-report-design";
import { useNavigate, useSearch } from "@tanstack/react-router";
import catalogSettings from "../data/catalog-settings.json";
import valuationRules from "../data/account-valuation-rules.json";
import { cachedLeaderboards, cacheLeaderboards, validLeaderboards, type LeaderboardData, type LeaderboardPlayer } from "./player-leaderboards-cache";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import {
  statsRequest,
  StatsError,
  statsNumber as num,
  statsSilver,
  statsSilverIcon,
  statsRatio as ratio,
  statsDate,
  statsModeNames,
  statsReportScopeLabel,
  lastStatsNickname,
  rememberStatsNickname,
  statsQueryHistory,
  rememberStatsProfile,
  clearStatsQueryHistory,
  reportImage,
  statsCategoryNames,
} from "./player-stats-api";
function quotaLabel(session: StatsSession | null, kind: "query" | "report") {
  if (!session) return "—";
  const limit = session.limits[kind === "query" ? "queryLimit" : "reportLimit"];
  return limit == null
    ? "不限次"
    : `${Math.max(0, limit - session[kind].used - session[kind].reserved)} 次`;
}
import type {
  PlayerCandidate,
  PlayerProfile,
  StatsConfig,
  StatsSession,
  StatsReport,
  Background,
  PlayerVehicle,
} from "./player-stats-api";
function Avatar({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="wt-player-avatar">
      <span aria-hidden="true">{Array.from(name)[0]}</span>
      {url && (
        <img
          src={url}
          alt={`${name}的游戏头像`}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}
function VehicleRow({
  vehicle: v,
  countryName,
  showNaval,
  select,
}: {
  vehicle: PlayerVehicle;
  countryName: string;
  showNaval: boolean;
  select: () => void;
}) {
  return (
    <tr>
      <td aria-label={vehicleDisplayName(v.name)}>
        <a
          className="wt-record-vehicle"
          href={"https://wiki.warthunder.com/unit/" + encodeURIComponent(v.id)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${vehicleDisplayName(v.name)} 官方 Wiki（新标签页打开）`}
          title="在新标签页打开官方 Wiki"
        >
          <img src={v.thumbnail} alt="" loading="lazy" />
          <span>
            <b>{vehicleDisplayName(v.name)}</b>
            <small>
              {v.rank && `${v.rank} 级 · `}
              {countryName}
            </small>
          </span>
        </a>
        <button className="wt-record-link wt-vehicle-detail-button" onClick={select}>战绩详情</button>
      </td>
      <td>{num(v.battles)}</td>
      <td>{v.winRate == null ? "—" : v.winRate.toFixed(2) + "%"}</td>
      <td>{ratio(v.airKd)}</td>
      <td>{ratio(v.groundKd)}</td>
      {showNaval && <td>{v.category === "ground" ? "—" : ratio(v.navalKd)}</td>}
      <td>{ratio(v.kd)}</td>
      <td>
        <b className="wt-gold">{num(v.efficiency)}</b>
        {v.smallSample && <small className="wt-record-small">场次不足</small>}
      </td>
      <td className="wt-silver">
        <span className="wt-silver-amount">
          <img src={statsSilverIcon} alt="银狮" />
          <span title={`累计银狮：${statsSilver(v.silverLions)}`}>{compactSilver(v.silverLions)}</span>
        </span>
      </td>
    </tr>
  );
}
export function PlayerStats() {
  const route = useSearch({ from: "/_workbench/stats" });
  const navigate = useNavigate({ from: "/stats" });
  const [queryProgress, setQueryProgress] = useState("");
  const resumedQuery = useRef(false);
  const [recentPlayers, setRecentPlayers] = useState(statsQueryHistory);
  const [leaderboards, setLeaderboards] = useState(cachedLeaderboards);
  const [leaderMode, setLeaderMode] = useState("rb"),
    [leaderBranch, setLeaderBranch] = useState("ground");
  const board = leaderboards.boards.find((b) => b.mode === leaderMode && b.branch === leaderBranch);
  const [config, setConfig] = useState<StatsConfig | null>(null);
  const { session, refreshSession: refreshAccountSession, identityVersion } = useWorkbenchAccount();
  const [nickname, setNickname] = useState(route.player || lastStatsNickname()),
    [candidates, setCandidates] = useState<PlayerCandidate[]>([]),
    [queryId, setQueryId] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(null),
    [mode, setMode] = useState("rb"),
    [tab, setTab] = useState(route.view || "overview");
  const publicDetails = usePlayerRead<PlayerDetails>(profile, "details", false);
  const freshVehicleDetails = profile && publicDetails.data && Date.parse(publicDetails.data.fetchedAt) >= Date.parse(profile.fetchedAt) ? publicDetails.data : null;
  const detailVehicles = new Map(freshVehicleDetails?.vehicles.map(v => [`${v.mode}:${v.id}`, v]) || []);
  const effectiveVehicles = (profile?.vehicles || []).map(v => ({ ...v, ...detailVehicles.get(`${v.mode}:${v.id}`) }));
  const displayProfile = profile ? { ...profile, vehicles: effectiveVehicles } : null;
  const [selectedVehicle, setSelectedVehicle] = useState<PlayerVehicle | null>(null);
  const [vehicleShare, setVehicleShare] = useState<{
    profile: PlayerProfile; vehicle: PlayerVehicle; job: VehicleShareJob;
  } | null>(null);
  function changeTab(next: string) {
    setTab(next);
    void navigate({ search: (previous: { player?: string; view?: string }) => ({ ...previous, view: next === "overview" ? undefined : next }), replace: false });
  }
  useEffect(() => { setTab(route.view || "overview"); }, [route.view]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [vehicleCountry, setVehicleCountry] = useState("all"),
    [vehicleRank, setVehicleRank] = useState("all"),
    [vehiclePage, setVehiclePage] = useState(1);
  const [vehicleView, setVehicleView] = useState(savedVehiclePresentation);
  const [vehiclePageSize, setVehiclePageSize] = useState(savedVehiclePageSize);
  const [vehicleSort, setVehicleSort] = useState<VehicleSort | null>({
    key: "battles",
    direction: "desc",
  });
  const [report, setReport] = useState<StatsReport | null>(null),
    [background, setBackground] = useState("auto"),
    [bgFilter, setBgFilter] = useState("all");
  const [reportCountry, setReportCountry] = useState("all"),
    [reportCategory, setReportCategory] = useState("all"),
    [viewingHistory, setViewingHistory] = useState(false);
  const [analysisStyle, setAnalysisStyle] = useState<ReportStyle>("commander"),
    [customStyle, setCustomStyle] = useState("");
  function changeStyle(value: ReportStyle, preference = customStyle) {
    setAnalysisStyle(value);
    setCustomStyle(preference);
    setViewingHistory(false);
    setReport(null);
  }
  function changeReportFilter(value: string, field: "country" | "category") {
    if (field === "country") setReportCountry(value);
    else setReportCategory(value);
    setViewingHistory(false);
    setReport(null);
    setBackground("auto");
  }
  const [customBackground, setCustomBackground] = useState<Background | null>(null),
    [reportTheme, setReportTheme] = useState<ReportTheme>(defaultReportTheme),
    [colorBusy, setColorBusy] = useState(false),
    [uploadBusy, setUploadBusy] = useState(false),
    [backgroundError, setBackgroundError] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null),
    uploadState = useRef({ url: "", version: 0 });
  useEffect(() => {
    const resource = uploadState.current;
    return () => {
      resource.version++;
      if (resource.url) URL.revokeObjectURL(resource.url);
    };
  }, []);
  async function uploadBackground(file: File) {
    const version = ++uploadState.current.version;
    setUploadBusy(true);
    setBackgroundError("");
    try {
      const result = await uploadReportBackground(file);
      if (version !== uploadState.current.version) {
        URL.revokeObjectURL(result.background.source);
        return;
      }
      if (uploadState.current.url) URL.revokeObjectURL(uploadState.current.url);
      uploadState.current.url = result.background.source;
      setCustomBackground(result.background);
      setReportTheme(result.theme);
      setBackground("custom");
    } catch (failure) {
      if (version === uploadState.current.version)
        setBackgroundError(
          failure instanceof Error ? failure.message : "图片读取失败，请重新选择。",
        );
    } finally {
      if (version === uploadState.current.version) setUploadBusy(false);
    }
  }
  const [showRules, setShowRules] = useState(false),
    [history, setHistory] = useState<StatsReport[] | null>(null),
    [exportBusy, setExportBusy] = useState(false);
  const requests = useRef(new Set<AbortController>()),
    generation = useRef(0),
    exportController = useRef<AbortController | null>(null);
  const refreshSession = useCallback(async () => {
    try {
      await refreshAccountSession();
    } catch {
      /* Explicit requests present connection failures; quota refresh is best effort. */
    }
  }, [refreshAccountSession]);
  function controller() {
    const c = new AbortController();
    requests.current.add(c);
    return c;
  }
  const loadProfile = useCallback((p: PlayerProfile, local = false) => {
    setProfile(p);
    if (p.nicknameHidden && route.player) void navigate({ search: { view: route.view }, replace: true });
    setSelectedVehicle(null);
    setVehicleShare(null);
    if (!local) setRecentPlayers(rememberStatsProfile(p));
    setNickname(p.nickname);
    rememberStatsNickname(p.nickname);
    setMode([...p.modes].sort((a, b) => (b.battles || 0) - (a.battles || 0))[0]?.id || "rb");
    setSearch("");
    setCategory("all");
    setVehicleCountry("all");
    setVehicleRank("all");
    setVehicleSort({ key: "battles", direction: "desc" });
    setVehiclePage(1);
    setReport(null);
    setReportCountry("all");
    setReportCategory("all");
    setViewingHistory(false);
    setBackground("auto");
    setCandidates([]);
    setNotice(p.stale ? p.staleReason || "官方查询繁忙，正在展示此前采集的资料。" : "");
  }, [navigate, route.player, route.view]);
  const hasSession = !!session;
  useEffect(() => {
    if (!hasSession || route.player || resumedQuery.current || !pendingQuery()) return;
    resumedQuery.current = true;
    const c = controller(), id = ++generation.current;
    setBusy(true);
    void resumeQuery<PlayerProfile | { items: PlayerCandidate[]; queryId: string; stale?: boolean; staleReason?: string }>(c.signal, setQueryProgress)
      .then(value => {
        if (!value || c.signal.aborted || id !== generation.current) return;
        if ("items" in value.result) {
          setQueryId(value.result.queryId); setCandidates(value.result.items);
          if (value.result.stale) setNotice(value.result.staleReason || "正在展示已保存的搜索结果。");
        } else loadProfile(value.result);
        void refreshSession();
      })
      .catch(error => { if (!c.signal.aborted) setError(error instanceof Error ? error.message : "暂时无法恢复查询。"); })
      .finally(() => { requests.current.delete(c); if (!c.signal.aborted && id === generation.current) setBusy(false); });
    return () => { c.abort(); resumedQuery.current = false; };
  }, [hasSession, route.player, loadProfile, refreshSession]);
  async function openSavedProfile(p: PlayerProfile) {
    setQueryProgress("");
    const id = ++generation.current, c = controller();
    setBusy(true);
    setError("");
    try {
      const restored = await statsRequest<PlayerProfile>("players/restore", { snapshotId: p.snapshotId, uid: p.uid }, c.signal);
      if (c.signal.aborted || id !== generation.current) return;
      if (restored.uid !== p.uid) throw new Error("保存的玩家身份不一致，请重新查询。");
      loadProfile(restored);
      setNotice("已打开保存的查询记录，本次不扣查询次数；采集时间见下方。");
    } catch (failure) {
      if (c.signal.aborted || id !== generation.current) return;
      setError(failure instanceof Error ? failure.message : "暂时无法完成安全审核，请稍后重新打开记录。");
    } finally {
      requests.current.delete(c);
      if (id === generation.current) setBusy(false);
    }
  }
  function returnToSearch() {
    generation.current++;
    requests.current.forEach((c) => c.abort());
    exportController.current?.abort();
    setBusy(false);
    setProfile(null);
    setCandidates([]);
    setReport(null);
    setHistory(null);
    setError("");
    setNotice("");
    setTab("overview");
    void navigate({ search: {}, replace: true });
  }
  async function performSearch(nick: string) {
    const value = nick.trim();
    if (value.length < 2) return;
    rememberStatsNickname(value);
    const id = ++generation.current,
      c = controller();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await queryTask<{
        items: PlayerCandidate[];
        queryId: string;
        cached: boolean;
        stale?: boolean;
        staleReason?: string;
      }>(
        "search",
        { nickname: value, requestId: "query_" + crypto.randomUUID() },
        c.signal,
        setQueryProgress,
      );
      if (c.signal.aborted || id !== generation.current) return;
      setQueryId(result.queryId);
      setCandidates(result.items);
      if (!result.items.length) setNotice("没有找到玩家，请检查昵称与平台后缀。");
      else if (result.stale) setNotice(result.staleReason || "正在展示已保存的搜索结果，请核对玩家 UID。");
      setProfile(null);
    } catch (failure) {
      if (!c.signal.aborted && id === generation.current)
        setError(failure instanceof Error ? failure.message : "查询失败，请稍后重试。");
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted && id === generation.current) {
        setBusy(false);
        void refreshSession();
      }
    }
  }
  async function chooseLeader(player: LeaderboardPlayer) {
    if (busy || !session) return;
    const id = ++generation.current, c = controller();
    setBusy(true);
    setError("");
    setNotice("");
    setNickname(player.nickname);
    setCandidates([]);
    setQueryId("");
    setProfile(null);
    try {
      const result = await queryTask<PlayerProfile>("leaderboard", {
        mode: leaderMode, branch: leaderBranch, rank: player.rank, nickname: player.nickname,
        uid: player.uid || undefined, requestId: "query_" + crypto.randomUUID(),
      }, c.signal, setQueryProgress);
      if (!c.signal.aborted && id === generation.current) {
        loadProfile(result);
        const next = { ...leaderboards, boards: leaderboards.boards.map(b => ({ ...b, players: b.players.map(p =>
          p.nickname === player.nickname ? { ...p, uid: result.uid } : p,
        ) })) };
        setLeaderboards(next);
        cacheLeaderboards(next);
      }
    } catch (failure) {
      if (!c.signal.aborted && id === generation.current) {
        setError(failure instanceof Error ? failure.message : "榜单玩家查询失败。");
        if (failure instanceof StatsError && failure.code === "BOARD_CHANGED") {
          const current = await statsRequest<LeaderboardData>("leaderboards?revision=" + Date.now(), undefined, c.signal).catch(() => null);
          if (!c.signal.aborted && id === generation.current && validLeaderboards(current)) { setLeaderboards(current); cacheLeaderboards(current); }
        }
      }
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted && id === generation.current) { setBusy(false); void refreshSession(); }
    }
  }
  async function choose(p: PlayerCandidate) {
    const id = ++generation.current,
      c = controller();
    setBusy(true);
    setError("");
    try {
      const value = await queryTask<PlayerProfile>(
        "select",
        { queryId, uid: p.uid },
        c.signal,
        setQueryProgress,
      );
      if (!c.signal.aborted && id === generation.current) loadProfile(value);
    } catch (failure) {
      if (!c.signal.aborted) setError(failure instanceof Error ? failure.message : "查询失败。");
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted) {
        setBusy(false);
        void refreshSession();
      }
    }
  }
  async function forceRefresh() {
    if (!profile || busy) return;
    const id = ++generation.current,
      c = controller();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await queryTask<PlayerProfile>(
        "refresh",
        {
          snapshotId: profile.snapshotId,
          requestId: "refresh_" + crypto.randomUUID(),
        },
        c.signal,
        setQueryProgress,
      );
      if (c.signal.aborted || id !== generation.current) return;
      setProfile(value);
      setRecentPlayers(rememberStatsProfile(value));
      setNickname(value.nickname);
      rememberStatsNickname(value.nickname);
      if (!value.modes.some((m) => m.id === mode)) setMode(value.modes[0]?.id || "rb");
      setReport(null);
      setViewingHistory(false);
      setNotice("已重新获取官方资料。");
    } catch (failure) {
      if (!c.signal.aborted && id === generation.current)
        setError(failure instanceof Error ? failure.message : "刷新失败，原资料仍可查看。");
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted && id === generation.current) {
        setBusy(false);
        void refreshSession();
      }
    }
  }
  useEffect(() => {
    const c = new AbortController();
    void statsRequest<LeaderboardData>("leaderboards", undefined, c.signal).then(value => {
      if (!c.signal.aborted && validLeaderboards(value)) { setLeaderboards(value); cacheLeaderboards(value); }
    }).catch(() => { /* Keep the saved official snapshot when unavailable. */ });
    return () => c.abort();
  }, []);
  useEffect(() => {
    const c = new AbortController(),
      active = requests.current;
    active.add(c);
    void Promise.all([readPublicResource<StatsConfig>("config", c.signal), refreshSession()])
      .then(async ([cfg]) => {
        if (c.signal.aborted) return;
        setConfig(cfg);
        if (route.snapshot && route.uid) {
          const saved = await statsRequest<PlayerProfile>("players/restore", { snapshotId: route.snapshot, uid: route.uid }, c.signal);
          if (!c.signal.aborted) loadProfile(saved);
        } else if (route.player) {
          const result = await statsRequest<{ items: PlayerCandidate[]; queryId: string }>(
            "players/search",
            { nickname: route.player, requestId: "query_" + crypto.randomUUID() },
            c.signal,
          );
          if (c.signal.aborted) return;
          setQueryId(result.queryId);
          const exact = result.items.filter((p) => p.nickname === route.player);
          if (exact.length === 1) {
            const p = await statsRequest<PlayerProfile>(
              "players/select",
              { queryId: result.queryId, uid: exact[0].uid },
              c.signal,
            );
            if (!c.signal.aborted) {
              loadProfile(p);
              await refreshSession();
            }
          } else setCandidates(result.items);
        }
      })
      .catch((failure) => {
        if (!c.signal.aborted)
          setError(failure instanceof Error ? failure.message : "服务暂时不可用。");
      });
    return () => {
      c.abort();
      active.forEach((item) => item.abort());
    };
    // The route's initial player is a one-time explicit deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!report || !["queued", "running"].includes(report.status)) return;
    const c = new AbortController();
    const timeout = setTimeout(() => {
      void statsRequest<StatsReport>("reports/" + report.id, undefined, c.signal)
        .then((value) => {
          if (!c.signal.aborted) {
            setReport(value);
            if (value.status === "ready" || value.status === "failed") void refreshSession();
          }
        })
        .catch((failure) => {
          if (!c.signal.aborted)
            setError(failure instanceof Error ? failure.message : "暂时无法读取战报状态。");
        });
    }, 1800);
    return () => {
      clearTimeout(timeout);
      c.abort();
    };
  }, [report, refreshSession]);
  const previousIdentity = useRef(identityVersion);
  useEffect(() => {
    if (previousIdentity.current === identityVersion) return;
    previousIdentity.current = identityVersion;
    clearRankingMemory();
    forgetQuery();
    setQueryProgress("");
    setSelectedVehicle(null);
    setVehicleShare(null);
    generation.current++;
    requests.current.forEach((request) => request.abort());
    exportController.current?.abort();
    setBusy(false);
    setProfile(null);
    setCandidates([]);
    setReport(null);
    setHistory(null);
    setQueryId("");
    setNotice("账号状态已更新，请重新选择玩家。");
  }, [identityVersion]);
  async function generate() {
    setQueryProgress("");
    if (!profile || viewingHistory || !eligible.length) return;
    const c = controller();
    setBusy(true);
    setError("");
    try {
      const value = await statsRequest<StatsReport>(
        "reports",
        {
          snapshotId: profile.snapshotId,
          mode,
          country: reportCountry,
          category: reportCategory,
          style: analysisStyle,
          customStyle: analysisStyle === "custom" ? customStyle : "",
          requestId: "report_" + crypto.randomUUID(),
        },
        c.signal,
      );
      if (!c.signal.aborted) setReport(value);
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : "战报暂时无法生成。");
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted) {
        setBusy(false);
        void refreshSession();
      }
    }
  }
  async function save() {
    if (!report || report.status !== "ready" || !config) return;
    const selected = bg;
    if (!selected) return;
    const c = new AbortController();
    exportController.current = c;
    setExportBusy(true);
    setError("");
    try {
      const { downloadStatsReport } = await import("./player-report-export");
      await downloadStatsReport(report, selected, reportTheme, c.signal);
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : "保存失败，请重试。");
    } finally {
      setExportBusy(false);
      exportController.current = null;
    }
  }
  const active = profile?.modes.find((m) => m.id === mode);
  const vehicleColumns: [VehicleSortKey, string][] = [
    ["battles", "场次"],
    ["winRate", "胜率"],
    ["airKd", "对空 K/D"],
    ["groundKd", "对地 K/D"],
    ...(category === "ground" ? [] : [["navalKd", "对海 K/D"]] as [VehicleSortKey, string][]),
    ["kd", "综合 K/D"],
    ["efficiency", "效率评分"],
    ["silverLions", "累计获得银狮"],
  ];
  function sortVehicles(key: VehicleSortKey | "none", toggle = false) {
    setVehicleSort(current => key === "none" ? null : ({
      key,
      direction: current?.key === key
        ? toggle ? current.direction === "desc" ? "asc" : "desc" : current.direction
        : "desc",
    }));
    setVehiclePage(1);
  }
  const filtered = effectiveVehicles
    .filter(
      (v) =>
        v.mode === mode &&
        (category === "all" || v.category === category) &&
        statsCountryMatches(v.country, vehicleCountry) &&
        (vehicleRank === "all" || (v.rank || "unknown") === vehicleRank) &&
        (!search || (vehicleDisplayName(v.name) + " " + v.id).toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => vehicleSort ? comparePlayerVehicles(a, b, vehicleSort) : 0);
  const vehiclePages = Math.max(1, Math.ceil(filtered.length / vehiclePageSize));
  const currentVehiclePage = Math.min(vehiclePage, vehiclePages);
  const pagedVehicles = filtered.slice((currentVehiclePage - 1) * vehiclePageSize, currentVehiclePage * vehiclePageSize);
  const eligible = effectiveVehicles.filter(
    (v) =>
      v.mode === mode &&
      (reportCountry === "all" || v.country === reportCountry) &&
      (reportCategory === "all" || v.category === reportCategory),
  );
  const bg =
    background === "custom"
      ? customBackground || undefined
      : config?.assets.backgrounds.find(
          (b) =>
            b.id ===
            (background === "auto"
              ? report?.payload.suggestedBackground ||
                config.assets.backgrounds.find(
                  (item) =>
                    reportCategory === "all" ||
                    item.category ===
                      (reportCategory === "boats"
                        ? "ships"
                        : reportCategory === "helicopters"
                          ? "aviation"
                          : reportCategory),
                )?.id
              : background),
        );
  const canReadBackground = !!session;
  useEffect(() => {
    if (!bg || !canReadBackground || tab !== "report") return;
    const c = new AbortController();
    setBackgroundError("");
    setColorBusy(true);
    void (
      bg.local ? localReportImage(bg.source, c.signal) : reportImage("background", bg.id, c.signal)
    )
      .then((image) => {
        if (!c.signal.aborted) setReportTheme(imageReportTheme(image));
      })
      .catch(() => {
        if (!c.signal.aborted) {
          setReportTheme(defaultReportTheme);
          setBackgroundError("暂时无法提取这张背景的颜色，可重选背景后再试。");
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setColorBusy(false);
      });
    return () => c.abort();
  }, [bg, tab, canReadBackground]);
  return (
    <div className="wt-record-page">
      <header className="wt-record-page-title">
        <div>
          <h1>个人战绩档案</h1>
          <p>查看生涯表现和官方排位，生成你的个人战报。</p>
        </div>
        <div className="wt-record-account">
          <span>
            {session?.role === "superadmin" ? "超管" : session?.user ? "普通用户" : "游客"}
            {" · 新查询 "}
            {quotaLabel(session, "query")}
            {" / 战报 "}
            {quotaLabel(session, "report")}
            <small>每日零点重置 · 缓存命中不扣次</small>
          </span>
        </div>
      </header>
      <form
        className="wt-record-query"
        onSubmit={(event) => {
          event.preventDefault();
          void performSearch(nickname);
        }}
      >
        <label className="sr-only" htmlFor="player-nickname">
          游戏昵称
        </label>
        <input
          id="player-nickname"
          type="search"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={64}
          placeholder="输入游戏昵称，保留 @psn 等后缀"
          autoComplete="off"
        />
        <button
          className="wt-record-primary"
          disabled={busy || !session || nickname.trim().length < 2}
        >
          {busy ? "正在查询…" : "搜索玩家"}
        </button>
        {(profile || candidates.length > 0 || busy || route.player) && (
          <button type="button" className="wt-record-back" onClick={returnToSearch}>
            ← 返回战绩首页
          </button>
        )}
      </form>
      {busy && queryProgress && <output className="wt-record-notice" aria-live="polite">{queryProgress}</output>}
      {error && (
        <p className="wt-record-error" role="alert">
          {error}
        </p>
      )}
      {notice && <output className="wt-record-notice">{notice}</output>}
      {!!candidates.length && (
        <section className="wt-record-candidates">
          <h2>确认玩家</h2>
          {candidates.map((p) => (
            <button key={p.uid} disabled={busy} onClick={() => void choose(p)}>
              <Avatar url={p.avatar} name={p.nickname} />
              <span>
                <b>{p.nickname}</b>
                <small>UID {p.uid}</small>
              </span>
              <span>查看 ↗</span>
            </button>
          ))}
        </section>
      )}
      {!profile && !candidates.length && (
        <div className="wt-record-home">
          <section className="wt-record-panel">
            <div className="wt-record-heading">
              <h2>
                最近查询 <span>{recentPlayers.length}</span>
              </h2>
              {!!recentPlayers.length && (
                <button onClick={() => setRecentPlayers(clearStatsQueryHistory())}>清空记录</button>
              )}
            </div>
            <p className="wt-record-fine">
              本机保留最近 16
              位玩家的已查资料，点击直接查看，不发起新查询；需要最新资料时使用强制刷新。
            </p>
            {recentPlayers.length ? (
              <div className="wt-record-recent">
                {recentPlayers.map((p) => (
                  <button
                    key={p.uid}
                    disabled={busy}
                    onClick={() => { void openSavedProfile(p); }}
                  >
                    <Avatar url={p.avatar} name={p.nickname} />
                    <span>
                      <b>{p.nickname}</b>
                      <small>{statsDate(p.fetchedAt)}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="wt-record-empty">还没有查询记录，输入昵称或从下方排行榜选择玩家。</p>
            )}
          </section>
          <section className="wt-record-panel">
            <div className="wt-record-heading">
              <h2>
                官方排行榜 <span>TOP 25</span>
              </h2>
              {board && (
                <a href={board.sources[0]} target="_blank" rel="noopener noreferrer">
                  查看官方榜单 ↗
                </a>
              )}
            </div>
            <div className="wt-record-leader-filters">
              <fieldset aria-label="排行榜战斗模式">
                {Object.entries(statsModeNames).map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={leaderMode === id}
                    onClick={() => setLeaderMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
              <fieldset aria-label="排行榜军种">
                {[
                  ["ground", "陆战"],
                  ["air", "空战"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={leaderBranch === id}
                    onClick={() => setLeaderBranch(id)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
            </div>
            <p className="wt-record-fine">
              按官方累计击毁数整理，点击后按已核验 UID 查询；缓存命中免费，新查询遵守上方额度。
            </p>
            {board ? (
              <>
                <ol className="wt-record-leaders">
                  {board.players.map((p) => (
                    <li key={p.rank}>
                      <button
                        disabled={!session || busy}
                        onClick={() => void chooseLeader(p)}
                      >
                        <span className="wt-record-rank">{String(p.rank).padStart(2, "0")}</span>
                        <b>{p.nickname}</b>
                        <span aria-hidden="true">→</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="wt-record-fine">
                  榜单快照采集于 {statsDate(board.fetchedAt)} · 官方累计榜，非实时更新。
                </p>
              </>
            ) : (
              <p className="wt-record-empty">该榜单暂未获取，请稍后再试或直接输入昵称。</p>
            )}
          </section>
        </div>
      )}
      {profile && (
        <>
          <section className="wt-record-player">
            <Avatar url={profile.avatar} name={profile.nickname} />
            <div>
              <h2>
                {profile.clanTag && <small>{profile.clanTag} </small>}
                {profile.nickname}
              </h2>
              <p>
                等级 {num(profile.level)} · UID {profile.uid}
              </p>
            </div>
            <GameAccountBinding key={`${profile.snapshotId}:${session?.user?.id || "guest"}`} profile={profile} />
            <AccountValuation
              key={`${profile.snapshotId}:${session?.user?.id || "guest"}`}
              profile={profile}
              session={session}
              onSessionChange={refreshSession}
            />
            <div className="wt-record-source">
              <span>
                采集于 {statsDate(profile.fetchedAt)} ·{" "}
                {profile.cached ? "已命中缓存，本次不扣查询次数" : "官方助手资料"}
              </span>
              <button
                className="wt-record-link wt-record-refresh"
                title={profile.localOnly ? "请先重新查询此玩家" : "重新获取官方资料，按一次新查询计入额度；同一玩家每分钟可刷新一次"}
                disabled={
                  profile.localOnly || busy || exportBusy || (!!report && ["queued", "running"].includes(report.status))
                }
                onClick={() => void forceRefresh()}
              >
                {busy ? "正在获取…" : "强制刷新"}
              </button>
              <small>强制刷新计入新查询次数</small>
            </div>
          </section>
          <div className="wt-record-tabs" aria-label="战绩视图">
            <button aria-pressed={tab === "overview"} onClick={() => changeTab("overview")}>
              生涯总览
            </button>
            <button aria-pressed={tab === "rankings"} onClick={() => changeTab("rankings")}>
              排位数据
            </button>
            <button aria-pressed={tab === "report"} onClick={() => changeTab("report")}>
              个人战报 <small>TOP 5</small>
            </button>
            <div className="wt-record-modes">
              {profile.modes.map((m) => (
                <button
                  key={m.id}
                  disabled={
                    tab === "report" &&
                    (busy ||
                      exportBusy ||
                      (!!report && ["queued", "running"].includes(report.status)))
                  }
                  aria-pressed={mode === m.id}
                  onClick={() => {
                    setMode(m.id);
                    setViewingHistory(false);
                    setVehiclePage(1);
                    setReport(null);
                  }}
                >
                  {statsModeNames[m.id]}
                </button>
              ))}
            </div>
          </div>
          <div className="wt-record-results">
          <PlayerCareerOverview key={`career:${profile.snapshotId}`} profile={profile} mode={mode} base={active} active={tab === "overview"} armyBase={config?.assets.armyBase || ""} />
          <PlayerRankings key={`rankings:${profile.snapshotId}`} profile={displayProfile!} mode={mode} active={tab === "rankings"} />
          {tab === "rankings" ? null : !active ? (
            <p className="wt-record-empty">这位玩家还没有可展示的出击记录。</p>
          ) : tab === "overview" ? (
            <>
              <section className="wt-record-panel wt-record-table-panel">
                <div className="wt-record-heading">
                  <h2>
                    载具战绩 <span>{filtered.length} 辆</span>
                  </h2>
                  <span>{statsModeNames[mode]} · 仅展示已出击载具{freshVehicleDetails ? ` · 采集于 ${statsDate(freshVehicleDetails.fetchedAt)}` : ""}</span>
                </div>
                <div className="wt-record-filters">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setVehiclePage(1);
                    }}
                    placeholder="搜索载具名称或型号"
                    aria-label="筛选载具"
                  />
                  <GameSelect
                    aria-label="载具国家筛选"
                    value={vehicleCountry}
                    onValueChange={(value) => {
                      setVehicleCountry(value);
                      setVehiclePage(1);
                    }}
                  >
                    <option value="all">全部国家</option>
                    {Object.keys(catalogSettings.countries).map((id) => (
                      <option key={id} value={id}>
                        {statsCountryLabel(id)}
                      </option>
                    ))}
                    {profile.vehicles.some((v) => !v.country) && (
                      <option value="unknown">国家待核验</option>
                    )}
                  </GameSelect>
                  <GameSelect
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value);
                      if (value === "ground")
                        setVehicleSort((current) =>
                          current?.key === "navalKd"
                            ? { key: "battles", direction: "desc" }
                            : current,
                        );
                      setVehiclePage(1);
                    }}
                    aria-label="军种筛选"
                  >
                    <option value="all">全部军种</option>
                    {Object.entries(statsCategoryNames).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </GameSelect>
                  <GameSelect
                    aria-label="载具等级筛选"
                    value={vehicleRank}
                    onValueChange={(value) => {
                      setVehicleRank(value);
                      setVehiclePage(1);
                    }}
                  >
                    <option value="all">全部等级</option>
                    {valuationRules.researchRanks.map((rank) => (
                      <option key={rank} value={rank}>
                        Rank {rank}
                      </option>
                    ))}
                    {profile.vehicles.some((v) => !v.rank) && (
                      <option value="unknown">等级待核验</option>
                    )}
                  </GameSelect>
                  <GameSelect
                    className="wt-record-sort-field"
                    aria-label="载具战绩排序字段"
                    value={vehicleSort?.key || "none"}
                    onValueChange={value => sortVehicles(value as VehicleSortKey | "none")}
                  >
                    <option value="none">不排序</option>
                    {vehicleColumns.map(([key, label]) => (
                      <option key={key} value={key}>按{label}排序</option>
                    ))}
                  </GameSelect>
                  <button
                    type="button"
                    className="wt-record-sort-direction"
                    disabled={!vehicleSort}
                    onClick={() => { if (vehicleSort) sortVehicles(vehicleSort.key, true); }}
                    aria-label={`切换为${vehicleSort?.direction === "desc" ? "升序" : "降序"}排列载具战绩`}
                  >
                    {!vehicleSort ? "升降序" : vehicleSort.direction === "desc" ? "降序 ↓" : "升序 ↑"}
                  </button>
                  <button type="button" disabled={!vehicleSort} onClick={() => sortVehicles("none")}>清除排序</button>
                </div>
                <div className="wt-vehicle-display-toolbar">
                  <div className="wt-vehicle-view-switch" aria-label="载具战绩展示形式">{(["table", "cards"] as VehiclePresentation[]).map(view => <button key={view} aria-pressed={vehicleView === view} onClick={() => { setVehicleView(view); saveVehiclePresentation(view); }}>{view === "table" ? "表格" : "卡片"}</button>)}</div>
                  <span>展示形式保存在本机</span>
                </div>
                {vehicleView === "cards" ? <PlayerVehicleCards vehicles={pagedVehicles} select={setSelectedVehicle} generate={vehicle => {
                  if (displayProfile) setVehicleShare({ profile: displayProfile, vehicle, job: startVehicleShare(displayProfile, vehicle) });
                }} showNaval={category !== "ground"} /> : <div className="wt-record-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">载具</th>
                        {vehicleColumns.map(([key, label]) => (
                          <th
                            key={key}
                            scope="col"
                            aria-sort={
                              vehicleSort?.key === key
                                ? vehicleSort?.direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button
                              type="button"
                              className="wt-record-sort"
                              onClick={() => sortVehicles(key, true)}
                              title={`按${label}排序，点击切换升序或降序`}
                            >
                              {label}
                              <span aria-hidden="true">
                                {vehicleSort?.key === key
                                  ? vehicleSort?.direction === "desc"
                                    ? "↓"
                                    : "↑"
                                  : "↕"}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedVehicles.map((v) => (
                        <VehicleRow
                          key={v.id}
                          vehicle={v}
                          select={() => setSelectedVehicle(v)}
                          showNaval={category !== "ground"}
                          countryName={
                            profile.countries.find((c) => c.id === v.country)?.name ||
                            statsCategoryNames[v.category || ""] ||
                            ""
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>}
                {!filtered.length && <p className="wt-record-empty">没有符合筛选条件的载具。</p>}
                <PlayerVehiclePagination page={currentVehiclePage} pages={vehiclePages} total={filtered.length} pageSize={vehiclePageSize} changePage={setVehiclePage} changeSize={size => { setVehiclePageSize(size); setVehiclePage(1); saveVehiclePageSize(size); }} />
                <p className="wt-record-fine">
                  单车对空、对地、对海 K/D
                  分别使用该车死亡次数。银狮为助手累计获得统计，不是当前余额或扣除维修补给后的净收入，数据取自助手统计，建议以游戏内记录为准。“—”代表未返回。
                </p>
              </section>
              <PlayerTypeUsage profile={profile} mode={mode} active={tab === "overview"} />
            </>
          ) : (
            <div className="wt-record-report-layout">
              <aside className="wt-record-panel wt-report-controls">
                <h2>定制你的战报</h2>
                <p>选好范围、点评风格与背景，再一起生成。</p>
                <div className="wt-report-filters" aria-label="战报载具筛选">
                  <label>
                    <span>国家</span>
                    <GameSelect
                      aria-label="战报国家"
                      value={reportCountry}
                      onValueChange={(value) => changeReportFilter(value, "country")}
                      disabled={
                        busy ||
                        exportBusy ||
                        (!!report && ["queued", "running"].includes(report.status))
                      }
                    >
                      <option value="all">全部国家</option>
                      {profile.countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.name}
                        </option>
                      ))}
                    </GameSelect>
                  </label>
                  <label>
                    <span>兵种</span>
                    <GameSelect
                      aria-label="战报兵种"
                      value={reportCategory}
                      onValueChange={(value) => changeReportFilter(value, "category")}
                      disabled={
                        busy ||
                        exportBusy ||
                        (!!report && ["queued", "running"].includes(report.status))
                      }
                    >
                      <option value="all">全部兵种</option>
                      {Object.entries(statsCategoryNames).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </GameSelect>
                  </label>
                </div>
                <div className="wt-report-voice">
                  <label htmlFor="report-style">AI 点评风格</label>
                  <GameSelect
                    id="report-style"
                    value={analysisStyle}
                    disabled={
                      busy ||
                      exportBusy ||
                      (!!report && ["queued", "running"].includes(report.status))
                    }
                    onValueChange={(value) => changeStyle(value as ReportStyle)}
                  >
                    {reportStyles.map((style) => (
                      <option value={style.id} key={style.id}>
                        {style.label}
                      </option>
                    ))}
                  </GameSelect>
                  <p>{reportStyle(analysisStyle).description}</p>
                  {analysisStyle === "custom" && (
                    <div className="wt-report-custom-style">
                      <label htmlFor="report-style-preference">想怎么说</label>
                      <textarea
                        id="report-style-preference"
                        maxLength={160}
                        rows={3}
                        value={customStyle}
                        disabled={
                          busy ||
                          exportBusy ||
                          (!!report && ["queued", "running"].includes(report.status))
                        }
                        aria-describedby="report-style-hint"
                        placeholder="例如：像战雷老玩家闲聊，先讲强项，再用一句冷幽默提醒短板。"
                        onChange={(event) => changeStyle("custom", event.target.value)}
                      />
                      <small id="report-style-hint">
                        只描述语气和分析角度，请勿填写隐私。<span>{customStyle.length}/160</span>
                      </small>
                    </div>
                  )}
                </div>
                <p className="wt-record-fine">
                  筛选和选图不扣次数。点击生成时使用一次战报额度，生成失败会退回。
                </p>
                {viewingHistory && (
                  <p className="wt-record-fine">
                    正在查看已存战报。调整筛选可为当前玩家配置新战报。
                  </p>
                )}
                <div className="wt-record-heading">
                  <h3>战雷官方背景</h3>
                  <span>{config?.assets.backgrounds.length || 0} 张</span>
                </div>
                <button
                  disabled={exportBusy}
                  aria-pressed={background === "auto"}
                  onClick={() => setBackground("auto")}
                >
                  自动匹配军种与年代
                </button>
                <GameSelect aria-label="背景类别" value={bgFilter} onValueChange={setBgFilter}>
                  <option value="all">全部背景</option>
                  <option value="ground">装甲战场</option>
                  <option value="aviation">航空战场</option>
                  <option value="ships">海上战场</option>
                  <option value="mixed">综合场景</option>
                </GameSelect>
                <div className="wt-report-backgrounds">
                  {config?.assets.backgrounds
                    .filter((b) => bgFilter === "all" || b.category === bgFilter)
                    .map((b) => (
                      <button
                        key={b.id}
                        disabled={exportBusy}
                        aria-pressed={bg?.id === b.id && background !== "auto"}
                        onClick={() => setBackground(b.id)}
                      >
                        <img src={b.thumbnail} alt="" loading="lazy" />
                        <span>{b.title}</span>
                      </button>
                    ))}
                </div>
                {bg && !bg.local && (
                  <a href={bg.sourcePage} target="_blank" rel="noreferrer">
                    查看此背景的官方来源 ↗
                  </a>
                )}
                <div className="wt-custom-background">
                  <input
                    ref={uploadInput}
                    disabled={exportBusy || uploadBusy}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="上传自己的战报背景"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void uploadBackground(file);
                    }}
                  />
                  <button
                    disabled={uploadBusy || exportBusy}
                    onClick={() => uploadInput.current?.click()}
                  >
                    {uploadBusy ? "正在读取图片…" : "上传自己的背景"}
                  </button>
                  {customBackground && (
                    <button
                      className="wt-custom-background-choice"
                      disabled={exportBusy}
                      aria-pressed={background === "custom"}
                      onClick={() => setBackground("custom")}
                    >
                      <img src={customBackground.source} alt="自选背景缩略图" />
                      <span>{customBackground.title}</span>
                    </button>
                  )}
                  <small>JPG / PNG / WebP，最大 12 MB。只在本次页面使用，不上传服务器。</small>
                  <div className="wt-report-palette" aria-label="从背景提取的战报配色">
                    {[
                      reportTheme.base,
                      reportTheme.accent,
                      reportTheme.secondary,
                      reportTheme.ink,
                    ].map((color, i) => (
                      <i key={i} style={{ backgroundColor: color }} />
                    ))}
                    <span>{colorBusy ? "正在读取背景颜色…" : "随背景自动配色"}</span>
                  </div>
                  {backgroundError && (
                    <p className="wt-record-fine" role="alert">
                      {backgroundError}
                    </p>
                  )}
                </div>
                <button
                  className="wt-record-primary"
                  disabled={
                    busy ||
                    viewingHistory ||
                    !eligible.length ||
                    (analysisStyle === "custom" && !customStyle.trim()) ||
                    (!!report && ["queued", "running"].includes(report.status))
                  }
                  onClick={() => void generate()}
                >
                  {report?.status === "queued" || report?.status === "running"
                    ? "正在生成战报与点评…"
                    : report?.status === "ready"
                      ? "取用相同配置战报"
                      : "生成我的战报"}
                </button>
                <button
                  disabled={!report || exportBusy || colorBusy || report.status !== "ready"}
                  onClick={() => void save()}
                >
                  {exportBusy ? "正在保存图片…" : "保存战报图片"}
                </button>
                {exportBusy && (
                  <button onClick={() => exportController.current?.abort()}>取消保存</button>
                )}
                <button
                  onClick={() => {
                    void statsRequest<{ items: StatsReport[] }>("reports")
                      .then((value) => setHistory(value.items))
                      .catch((failure) => setError(failure.message));
                  }}
                >
                  我的战报
                </button>
                <p className="wt-record-fine">
                  更换背景和重复保存不扣次；更换分析风格或自定义内容会生成新战报。
                </p>
              </aside>
              <div className="wt-report-stage">
                <div className="wt-report-caption">
                  <span>
                    {report?.status === "ready"
                      ? "已生成"
                      : report?.status === "running"
                        ? "正在生成"
                        : "待生成"}
                  </span>
                  <span>{bg?.title}</span>
                </div>
                {!report && (
                  <div className="wt-report-idle">
                    <span>你的战地档案</span>
                    <h2>选好，再签发。</h2>
                    <p>
                      {statsModeNames[mode]} ·{" "}
                      {reportCountry === "all"
                        ? "全部国家"
                        : profile.countries.find((c) => c.id === reportCountry)?.name}{" "}
                      · {reportCategory === "all" ? "全部兵种" : statsCategoryNames[reportCategory]}
                    </p>
                    <strong>{eligible.length} 辆有出击记录的载具</strong>
                    <p>
                      {eligible.length
                        ? "生成后展示生涯总览与该范围最常用的五辆载具。"
                        : "这个范围暂时没有出击记录，请调整筛选。"}
                    </p>
                    <small>
                      {reportStyle(analysisStyle).label} · 点击生成后，数据与点评一起完成。
                    </small>
                  </div>
                )}
                {report && ["queued", "running"].includes(report.status) && (
                  <div className="wt-report-idle" aria-live="polite">
                    <span>正在制作</span>
                    <h2>正在写你的{reportStyle(report.payload.analysis?.style).label}</h2>
                    <p>结合真实生涯与常用载具完成点评，请稍候。</p>
                    <progress aria-label="正在制作战报" />
                    <small>完成后，整份战报会一起出现。</small>
                  </div>
                )}
                {report?.status === "failed" && (
                  <div className="wt-report-idle">
                    <h2>这份战报还没完成</h2>
                    <p>本次生成额度已退回，请稍后重新生成。</p>
                  </div>
                )}
                {report?.status === "ready" && (
                  <PlayerReport
                    report={report}
                    background={bg}
                    armyBase={config?.assets.armyBase || ""}
                    theme={reportTheme}
                  />
                )}
              </div>
            </div>
          )}
          </div>
          <footer className="wt-record-footer">
            {profile.notice}{" "}
            <button className="wt-record-link" onClick={() => setShowRules(true)}>
              效率分与 K/D 说明
            </button>
          </footer>
        </>
      )}
      {displayProfile && selectedVehicle && <PlayerVehicleDetails profile={displayProfile} vehicle={effectiveVehicles.find(v => v.id === selectedVehicle.id && v.mode === selectedVehicle.mode) || selectedVehicle} close={() => setSelectedVehicle(null)} />}
      {vehicleShare && <PlayerVehicleShare profile={vehicleShare.profile} vehicle={vehicleShare.vehicle} job={vehicleShare.job}
        close={() => setVehicleShare(null)} back={() => { setSelectedVehicle(vehicleShare.vehicle); setVehicleShare(null); }} />}
      {showRules && (
        <Modal
          title="读懂你的战绩"
          subtitle="先看统计范围，再看数字。"
          close={() => setShowRules(false)}
          className="wt-record-rules wt-data-notes-dialog"
        >
          <StatsDataNotes />
        </Modal>
      )}
      {history && (
        <Modal title="我的战报" close={() => setHistory(null)} className="wt-record-rules">
          {history.length ? (
            history.map((item) => (
              <button
                key={item.id}
                className="wt-report-history"
                onClick={() => {
                  setViewingHistory(true);
                  setReportCountry(item.payload.scope?.country || "all");
                  setReportCategory(item.payload.scope?.category || "all");
                  setAnalysisStyle(item.payload.analysis?.style || "commander");
                  setCustomStyle(item.payload.analysis?.customStyle || "");
                  setReport(item);
                  changeTab("report");
                  setBackground("auto");
                  setHistory(null);
                }}
              >
                <b>{item.payload.player.nickname}</b>
                <span>
                  {statsModeNames[item.payload.mode]} · {statsReportScopeLabel(item.payload)} ·{" "}
                  {reportStyle(item.payload.analysis?.style).label} ·{" "}
                  {item.status === "ready"
                    ? "已生成"
                    : item.status === "failed"
                      ? "未生成"
                      : "处理中"}
                </span>
                <small>{item.createdAt && statsDate(item.createdAt)}</small>
              </button>
            ))
          ) : (
            <p>还没有生成过战报。</p>
          )}
        </Modal>
      )}
    </div>
  );
}
