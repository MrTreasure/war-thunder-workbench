import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
import { PlayerAvatar as Avatar } from "./PlayerAvatar";
import { GameTip } from "./components/GameTip";
import { buildReportRequest } from "./player-report-request";
import { ExtraQueryCredits } from "./ExtraQueryCredits";
import { PlayerMedals } from "./PlayerMedals";
import { PlayerAccountFacts } from "./PlayerAccountFacts";
import { RelativeTime } from "./RelativeTime";
import { PlayerRefreshAction } from "./PlayerRefreshAction";
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
import {
  compactSilver,
  savedVehiclePresentation,
  saveVehiclePresentation,
  savedVehiclePageSize,
  saveVehiclePageSize,
} from "./player-number-format";
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
import {
  cachedLeaderboards,
  cacheLeaderboards,
  validLeaderboards,
  type LeaderboardData,
  type LeaderboardPlayer,
} from "./player-leaderboards-cache";
import { GameTabs } from "./components/GameTabs";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import {
  statsRequest,
  StatsError,
  statsNumber as num,
  statsSilver,
  statsSilverIcon,
  statsRatio as ratio,
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

import type {
  PlayerCandidate,
  PlayerProfile,
  StatsConfig,
  StatsReport,
  Background,
  PlayerVehicle,
} from "./player-stats-api";
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
  useLocale();
  return (
    <tr>
      <td aria-label={vehicleDisplayName(v.name)}>
        <a
          className="wt-record-vehicle"
          href={"https://wiki.warthunder.com/unit/" + encodeURIComponent(v.id)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("{0} 官方 Wiki（新标签页打开）", [localize(vehicleDisplayName(v.name))])}
          title={t("在新标签页打开官方 Wiki")}
        >
          <img src={v.thumbnail} alt="" loading="lazy" />
          <span>
            <b>{localize(vehicleDisplayName(v.name))}</b>
            <small>
              {localize(v.rank && t("{0} 级 · ", [localize(v.rank)]))}
              {localize(countryName)}
            </small>
          </span>
        </a>
        <button className="wt-record-link wt-vehicle-detail-button" onClick={select}>
          {t("战绩详情")}
        </button>
      </td>
      <td>{localize(num(v.battles))}</td>
      <td>{localize(v.winRate == null ? "—" : v.winRate.toFixed(2) + "%")}</td>
      <td>{localize(ratio(v.airKd))}</td>
      <td>{localize(ratio(v.groundKd))}</td>
      {localize(showNaval && <td>{localize(v.category === "ground" ? "—" : ratio(v.navalKd))}</td>)}
      <td>{localize(ratio(v.kd))}</td>
      <td>
        <b className="wt-gold">{localize(num(v.efficiency))}</b>
        {localize(v.smallSample && <small className="wt-record-small">{t("场次不足")}</small>)}
      </td>
      <td className="wt-silver">
        <span className="wt-silver-amount">
          <img src={statsSilverIcon} alt={t("银狮")} />
          <span title={t("累计银狮：{0}", [localize(statsSilver(v.silverLions))])}>
            {localize(compactSilver(v.silverLions))}
          </span>
        </span>
      </td>
    </tr>
  );
}
export function PlayerStats() {
  useLocale();
  const route = useSearch({ from: "/_workbench/stats" });
  const navigate = useNavigate({ from: "/stats" });
  const resumedQuery = useRef(false);
  const [recentPlayers, setRecentPlayers] = useState(statsQueryHistory);
  const [leaderboards, setLeaderboards] = useState(cachedLeaderboards);
  const [leaderMode, setLeaderMode] = useState("rb"),
    [leaderBranch, setLeaderBranch] = useState("ground");
  const board = leaderboards.boards.find((b) => b.mode === leaderMode && b.branch === leaderBranch);
  const [config, setConfig] = useState<StatsConfig | null>(null);
  const {
    session,
    initializing: accountInitializing,
    refreshSession: refreshAccountSession,
    identityVersion,
  } = useWorkbenchAccount();
  const [nickname, setNickname] = useState(route.player || lastStatsNickname()),
    [candidates, setCandidates] = useState<PlayerCandidate[]>([]),
    [queryId, setQueryId] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(null),
    [mode, setMode] = useState("rb"),
    [tab, setTab] = useState(route.view || "overview");
  const publicDetails = usePlayerRead<PlayerDetails>(profile, "details", !!profile);
  const freshVehicleDetails =
    profile &&
    publicDetails.data &&
    Date.parse(publicDetails.data.fetchedAt) >= Date.parse(profile.fetchedAt)
      ? publicDetails.data
      : null;
  const detailVehicles = new Map(
    freshVehicleDetails?.vehicles.map((v) => [`${v.mode}:${v.id}`, v]) || [],
  );
  const effectiveVehicles = (profile?.vehicles || []).map((v) => ({
    ...v,
    ...detailVehicles.get(`${v.mode}:${v.id}`),
  }));
  const displayProfile = profile ? { ...profile, vehicles: effectiveVehicles } : null;
  const [selectedVehicle, setSelectedVehicle] = useState<PlayerVehicle | null>(null);
  const [vehicleShare, setVehicleShare] = useState<{
    profile: PlayerProfile;
    vehicle: PlayerVehicle;
    job: VehicleShareJob;
  } | null>(null);
  function changeTab(next: string) {
    setTab(next);
    void navigate({
      search: (previous: { player?: string; view?: string }) => ({
        ...previous,
        view: next === "overview" ? undefined : next,
      }),
      replace: false,
    });
  }
  useEffect(() => {
    setTab(route.view || "overview");
  }, [route.view]);
  const [busyAction, setBusyAction] = useState<"query" | "refresh" | "report" | null>(null);
  const busy = busyAction !== null;
  const [error, setError] = useState(""),
    [queryFeedback, setQueryFeedback] = useState("");
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
          failure instanceof Error ? failure.message : t("图片读取失败，请重新选择。"),
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
  const loadProfile = useCallback(
    (p: PlayerProfile, local = false) => {
      setProfile(p);
      if (p.nicknameHidden && route.player)
        void navigate({ search: { view: route.view }, replace: true });
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
      setQueryFeedback("");
    },
    [navigate, route.player, route.view],
  );
  const hasSession = !!session && !accountInitializing;
  useEffect(() => {
    if (!hasSession || route.player || resumedQuery.current || !pendingQuery()) return;
    resumedQuery.current = true;
    const c = controller(),
      id = ++generation.current;
    setBusyAction(pendingQuery()?.kind === "refresh" ? "refresh" : "query");
    void resumeQuery<
      | PlayerProfile
      | { items: PlayerCandidate[]; queryId: string; stale?: boolean; staleReason?: string }
    >(c.signal)
      .then((value) => {
        if (!value || c.signal.aborted || id !== generation.current) return;
        if ("items" in value.result) {
          setQueryId(value.result.queryId);
          setCandidates(value.result.items);
          if (value.result.stale)
            setQueryFeedback(value.result.staleReason || t("正在展示已保存的搜索结果。"));
        } else loadProfile(value.result);
        void refreshSession();
      })
      .catch((error) => {
        if (!c.signal.aborted)
          setError(error instanceof Error ? error.message : t("暂时无法恢复查询。"));
      })
      .finally(() => {
        requests.current.delete(c);
        if (!c.signal.aborted && id === generation.current) setBusyAction(null);
      });
    return () => {
      c.abort();
      resumedQuery.current = false;
    };
  }, [hasSession, route.player, loadProfile, refreshSession]);
  async function openSavedProfile(p: PlayerProfile) {
    const id = ++generation.current,
      c = controller();
    setBusyAction("query");
    setError("");
    try {
      const restored = await statsRequest<PlayerProfile>(
        "players/restore",
        { snapshotId: p.snapshotId, uid: p.uid },
        c.signal,
      );
      if (c.signal.aborted || id !== generation.current) return;
      if (restored.uid !== p.uid) throw new Error(t("保存的玩家身份不一致，请重新查询。"));
      loadProfile(restored);
    } catch (failure) {
      if (c.signal.aborted || id !== generation.current) return;
      setError(
        failure instanceof Error
          ? failure.message
          : t("暂时无法完成安全审核，请稍后重新打开记录。"),
      );
    } finally {
      requests.current.delete(c);
      if (id === generation.current) setBusyAction(null);
    }
  }
  function returnToSearch() {
    generation.current++;
    requests.current.forEach((c) => c.abort());
    exportController.current?.abort();
    setBusyAction(null);
    setProfile(null);
    setCandidates([]);
    setReport(null);
    setHistory(null);
    setError("");
    setQueryFeedback("");
    setTab("overview");
    void navigate({ search: {}, replace: true });
  }
  async function performSearch(nick: string) {
    if (accountInitializing || busy || !session) return;
    const value = nick.trim();
    if (value.length < 2) return;
    rememberStatsNickname(value);
    const id = ++generation.current,
      c = controller();
    setBusyAction("query");
    setError("");
    setQueryFeedback("");
    try {
      const result = await queryTask<{
        items: PlayerCandidate[];
        queryId: string;
        cached: boolean;
        stale?: boolean;
        staleReason?: string;
      }>("search", { nickname: value, requestId: "query_" + crypto.randomUUID() }, c.signal);
      if (c.signal.aborted || id !== generation.current) return;
      setQueryId(result.queryId);
      setCandidates(result.items);
      if (!result.items.length) setQueryFeedback(t("没有找到玩家，请检查昵称与平台后缀。"));
      else if (result.stale)
        setQueryFeedback(result.staleReason || t("正在展示已保存的搜索结果，请核对玩家 UID。"));
      setProfile(null);
    } catch (failure) {
      if (!c.signal.aborted && id === generation.current)
        setError(failure instanceof Error ? failure.message : t("查询失败，请稍后重试。"));
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted && id === generation.current) {
        setBusyAction(null);
        void refreshSession();
      }
    }
  }
  async function chooseLeader(player: LeaderboardPlayer) {
    if (accountInitializing || busy || !session) return;
    const id = ++generation.current,
      c = controller();
    setBusyAction("query");
    setError("");
    setQueryFeedback("");
    setNickname(player.nickname);
    setCandidates([]);
    setQueryId("");
    setProfile(null);
    try {
      const result = await queryTask<PlayerProfile>(
        "leaderboard",
        {
          mode: leaderMode,
          branch: leaderBranch,
          rank: player.rank,
          nickname: player.nickname,
          uid: player.uid || undefined,
          requestId: "query_" + crypto.randomUUID(),
        },
        c.signal,
      );
      if (!c.signal.aborted && id === generation.current) {
        loadProfile(result);
        const next = {
          ...leaderboards,
          boards: leaderboards.boards.map((b) => ({
            ...b,
            players: b.players.map((p) =>
              p.nickname === player.nickname ? { ...p, uid: result.uid } : p,
            ),
          })),
        };
        setLeaderboards(next);
        cacheLeaderboards(next);
      }
    } catch (failure) {
      if (!c.signal.aborted && id === generation.current) {
        setError(failure instanceof Error ? failure.message : t("榜单玩家查询失败。"));
        if (failure instanceof StatsError && failure.code === "BOARD_CHANGED") {
          const current = await statsRequest<LeaderboardData>(
            "leaderboards?revision=" + Date.now(),
            undefined,
            c.signal,
          ).catch(() => null);
          if (!c.signal.aborted && id === generation.current && validLeaderboards(current)) {
            setLeaderboards(current);
            cacheLeaderboards(current);
          }
        }
      }
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted && id === generation.current) {
        setBusyAction(null);
        void refreshSession();
      }
    }
  }
  async function choose(p: PlayerCandidate) {
    const id = ++generation.current,
      c = controller();
    setBusyAction("query");
    setError("");
    try {
      const value = await queryTask<PlayerProfile>("select", { queryId, uid: p.uid }, c.signal);
      if (!c.signal.aborted && id === generation.current) loadProfile(value);
    } catch (failure) {
      if (!c.signal.aborted) setError(failure instanceof Error ? failure.message : t("查询失败。"));
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted) {
        setBusyAction(null);
        void refreshSession();
      }
    }
  }
  async function forceRefresh() {
    if (!profile || busy) return;
    const id = ++generation.current,
      c = controller();
    setBusyAction("refresh");
    setError("");
    setQueryFeedback("");
    try {
      const value = await queryTask<PlayerProfile>(
        "refresh",
        {
          snapshotId: profile.snapshotId,
          requestId: "refresh_" + crypto.randomUUID(),
        },
        c.signal,
      );
      if (c.signal.aborted || id !== generation.current) return;
      setProfile(value);
      setRecentPlayers(rememberStatsProfile(value));
      setNickname(value.nickname);
      rememberStatsNickname(value.nickname);
      if (!value.modes.some((m) => m.id === mode)) setMode(value.modes[0]?.id || "rb");
      setReport(null);
      setViewingHistory(false);
    } catch (failure) {
      if (!c.signal.aborted && id === generation.current)
        setError(failure instanceof Error ? failure.message : t("刷新失败，原资料仍可查看。"));
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted && id === generation.current) {
        setBusyAction(null);
        void refreshSession();
      }
    }
  }
  useEffect(() => {
    const c = new AbortController();
    void statsRequest<LeaderboardData>("leaderboards", undefined, c.signal)
      .then((value) => {
        if (!c.signal.aborted && validLeaderboards(value)) {
          setLeaderboards(value);
          cacheLeaderboards(value);
        }
      })
      .catch(() => {
        /* Keep the saved official snapshot when unavailable. */
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (accountInitializing) return;
    const c = new AbortController(),
      active = requests.current;
    active.add(c);
    const openingPlayer =
      !!(route.player || (route.snapshot && route.uid)) && !resumedQuery.current;
    if (openingPlayer) setBusyAction("query");
    void Promise.all([readPublicResource<StatsConfig>("config", c.signal), refreshSession()])
      .then(async ([cfg]) => {
        if (c.signal.aborted) return;
        setConfig(cfg);
        if (route.snapshot && route.uid) {
          const saved = await statsRequest<PlayerProfile>(
            "players/restore",
            { snapshotId: route.snapshot, uid: route.uid },
            c.signal,
          );
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
          setError(failure instanceof Error ? failure.message : t("服务暂时不可用。"));
      })
      .finally(() => {
        if (openingPlayer && !c.signal.aborted) setBusyAction(null);
      });
    return () => {
      c.abort();
      active.forEach((item) => item.abort());
    };
    // Start the initial deep link only after account restoration settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountInitializing]);
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
            setError(failure instanceof Error ? failure.message : t("暂时无法读取战报状态。"));
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
    setSelectedVehicle(null);
    setVehicleShare(null);
    generation.current++;
    requests.current.forEach((request) => request.abort());
    exportController.current?.abort();
    setBusyAction(null);
    setProfile(null);
    setCandidates([]);
    setReport(null);
    setHistory(null);
    setQueryId("");
    setQueryFeedback(t("账号状态已更新，请重新选择玩家。"));
  }, [identityVersion]);
  async function generate() {
    if (!profile || viewingHistory || !eligible.length) return;
    const c = controller();
    setBusyAction("report");
    setError("");
    try {
      const value = await statsRequest<StatsReport>(
        "reports",
        buildReportRequest({
          snapshotId: profile.snapshotId,
          mode,
          country: reportCountry,
          category: reportCategory,
          style: analysisStyle,
          customStyle,
        }),
        c.signal,
      );
      if (!c.signal.aborted) setReport(value);
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : t("战报暂时无法生成。"));
    } finally {
      requests.current.delete(c);
      if (!c.signal.aborted) {
        setBusyAction(null);
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
        setError(failure instanceof Error ? failure.message : t("保存失败，请重试。"));
    } finally {
      setExportBusy(false);
      exportController.current = null;
    }
  }
  const active = profile?.modes.find((m) => m.id === mode);
  const vehicleColumns: [VehicleSortKey, string][] = [
    ["battles", t("场次")],
    ["winRate", t("胜率")],
    ["airKd", t("对空 K/D")],
    ["groundKd", t("对地 K/D")],
    ...(category === "ground" ? [] : ([["navalKd", t("对海 K/D")]] as [VehicleSortKey, string][])),
    ["kd", t("综合 K/D")],
    ["efficiency", t("效率评分")],
    ["silverLions", t("累计获得银狮")],
  ];
  function sortVehicles(key: VehicleSortKey | "none", toggle = false) {
    setVehicleSort((current) =>
      key === "none"
        ? null
        : {
            key,
            direction:
              current?.key === key
                ? toggle
                  ? current.direction === "desc"
                    ? "asc"
                    : "desc"
                  : current.direction
                : "desc",
          },
    );
    setVehiclePage(1);
  }
  const filtered = effectiveVehicles
    .filter(
      (v) =>
        v.mode === mode &&
        (category === "all" || v.category === category) &&
        statsCountryMatches(v.country, vehicleCountry) &&
        (vehicleRank === "all" || (v.rank || "unknown") === vehicleRank) &&
        (!search ||
          (vehicleDisplayName(v.name) + " " + v.id).toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => (vehicleSort ? comparePlayerVehicles(a, b, vehicleSort) : 0));
  const vehiclePages = Math.max(1, Math.ceil(filtered.length / vehiclePageSize));
  const currentVehiclePage = Math.min(vehiclePage, vehiclePages);
  const pagedVehicles = filtered.slice(
    (currentVehiclePage - 1) * vehiclePageSize,
    currentVehiclePage * vehiclePageSize,
  );
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
          setBackgroundError(t("暂时无法提取这张背景的颜色，可重选背景后再试。"));
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setColorBusy(false);
      });
    return () => c.abort();
  }, [bg, tab, canReadBackground]);
  const queryLoading =
    accountInitializing || busyAction === "query" || (busyAction === "refresh" && !profile);
  const reportLoading =
    busyAction === "report" || !!(report && ["queued", "running"].includes(report.status));
  return (
    <div className="wt-record-page">
      <header className="wt-record-page-title">
        <div>
          <h1>
            {t("个人战绩档案")}
            <button
              type="button"
              className="wt-game-tip-trigger"
              aria-label={t("战绩统计说明")}
              title={t("战绩统计说明")}
              onClick={() => setShowRules(true)}
            >
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7" />
                <path d="M10 9v5M10 6v1" />
              </svg>
            </button>
          </h1>
          <p>{t("查看生涯表现和官方排位，生成你的个人战报。")}</p>
        </div>
        <div className="wt-record-account">
          {localize(
            session ? (
              <ExtraQueryCredits
                session={session}
                refresh={refreshAccountSession}
                config={config}
              />
            ) : (
              <span>{t("额度加载中…")}</span>
            ),
          )}
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
          {t("游戏昵称")}
        </label>
        <input
          id="player-nickname"
          type="search"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={64}
          placeholder={t("输入游戏昵称，保留 @psn 等后缀")}
          autoComplete="off"
        />
        <button
          className="wt-record-primary wt-record-query-submit"
          aria-busy={queryLoading}
          disabled={accountInitializing || busy || !session || nickname.trim().length < 2}
        >
          {localize(queryLoading && <span className="wt-control-spinner" aria-hidden="true" />)}
          <span aria-live="polite">
            {localize(
              accountInitializing
                ? t("账号加载中…")
                : queryLoading
                  ? t("正在查询…")
                  : t("搜索玩家"),
            )}
          </span>
        </button>
        {localize(
          (profile || candidates.length > 0 || busy || route.player) && (
            <button type="button" className="wt-record-back" onClick={returnToSearch}>
              {t("← 返回战绩首页")}
            </button>
          ),
        )}
      </form>
      {localize(
        error && (
          <p className="wt-record-error" role="alert">
            {localize(error)}
          </p>
        ),
      )}
      {localize(
        queryFeedback && (
          <output className="wt-record-query-feedback">{localize(queryFeedback)}</output>
        ),
      )}
      {localize(
        !!candidates.length && (
          <section className="wt-record-candidates">
            <h2>{t("确认玩家")}</h2>
            {localize(
              candidates.map((p) => (
                <button key={p.uid} disabled={busy} onClick={() => void choose(p)}>
                  <Avatar url={p.avatar} name={p.nickname} />
                  <span>
                    <b>{localize(p.nickname)}</b>
                    <small>UID {localize(p.uid)}</small>
                  </span>
                  <span>{t("查看 ↗")}</span>
                </button>
              )),
            )}
          </section>
        ),
      )}
      {localize(
        !profile && !candidates.length && (
          <div className="wt-record-home">
            <section className="wt-record-panel">
              <div className="wt-record-heading">
                <h2>
                  {t("最近查询")}
                  <GameTip label={t("最近查询")}>
                    {t(
                      "本机保留最近 16 位玩家的已查资料，点击直接查看，不发起新查询；需要最新资料时使用强制刷新。",
                    )}
                  </GameTip>
                  <span>{localize(recentPlayers.length)}</span>
                </h2>
                {localize(
                  !!recentPlayers.length && (
                    <button onClick={() => setRecentPlayers(clearStatsQueryHistory())}>
                      {t("清空记录")}
                    </button>
                  ),
                )}
              </div>

              {localize(
                recentPlayers.length ? (
                  <div className="wt-record-recent">
                    {localize(
                      recentPlayers.map((p) => (
                        <div key={p.uid} className="wt-record-recent-entry">
                          <button
                            disabled={busy}
                            onClick={() => {
                              void openSavedProfile(p);
                            }}
                          >
                            <Avatar url={p.avatar} name={p.nickname} frameKey={p.avatarFrameKey} />
                            <span>
                              <b>{localize(p.nickname)}</b>
                              <span className="wt-record-recent-time-space" aria-hidden="true" />
                            </span>
                          </button>
                          <small>
                            <RelativeTime value={p.fetchedAt} />
                          </small>
                        </div>
                      )),
                    )}
                  </div>
                ) : (
                  <p className="wt-record-empty">
                    {t("还没有查询记录，输入昵称或从下方排行榜选择玩家。")}
                  </p>
                ),
              )}
            </section>
            <section className="wt-record-panel">
              <div className="wt-record-heading">
                <h2>
                  {t("官方排行榜")}
                  <GameTip label={t("官方排行榜")}>
                    {t(
                      "按官方累计击毁数整理，点击后按已核验 UID 查询；缓存命中免费，新查询遵守上方额度。",
                    )}
                    {localize(
                      board && (
                        <p>
                          {t("榜单快照采集于")}
                          {localize(" ")}
                          <RelativeTime value={board.fetchedAt} />
                          {t("· 官方累计榜，非实时更新。")}
                        </p>
                      ),
                    )}
                  </GameTip>
                  <span>TOP 30</span>
                </h2>
                {localize(
                  board && (
                    <a href={board.sources[0]} target="_blank" rel="noopener noreferrer">
                      {t("查看官方榜单 ↗")}
                    </a>
                  ),
                )}
              </div>
              <div className="wt-record-leader-filters">
                <fieldset aria-label={t("排行榜战斗模式")}>
                  {localize(
                    Object.entries(statsModeNames).map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={leaderMode === id}
                        onClick={() => setLeaderMode(id)}
                      >
                        {localize(label)}
                      </button>
                    )),
                  )}
                </fieldset>
                <fieldset aria-label={t("排行榜军种")}>
                  {localize(
                    [
                      ["ground", t("陆战")],
                      ["air", t("空战")],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={leaderBranch === id}
                        onClick={() => setLeaderBranch(id)}
                      >
                        {localize(label)}
                      </button>
                    )),
                  )}
                </fieldset>
              </div>

              {localize(
                board ? (
                  <>
                    <ol className="wt-record-leaders">
                      {localize(
                        board.players.map((p) => (
                          <li key={p.rank}>
                            <button
                              disabled={accountInitializing || !session || busy}
                              onClick={() => void chooseLeader(p)}
                            >
                              <span className="wt-record-rank">
                                {localize(String(p.rank).padStart(2, "0"))}
                              </span>
                              <b>{localize(p.nickname)}</b>
                              <span aria-hidden="true">→</span>
                            </button>
                          </li>
                        )),
                      )}
                    </ol>
                  </>
                ) : (
                  <p className="wt-record-empty">
                    {t("该榜单暂未获取，请稍后再试或直接输入昵称。")}
                  </p>
                ),
              )}
            </section>
          </div>
        ),
      )}
      {localize(
        profile && (
          <>
            <section className="wt-record-player">
              <div className="wt-record-player-avatar">
                <Avatar
                  url={profile.avatar}
                  name={profile.nickname}
                  frameKey={profile.avatarFrameKey}
                />
                <GameAccountBinding
                  key={`binding:${profile.snapshotId}:${session?.user?.id || "guest"}`}
                  profile={profile}
                />
              </div>
              <div className="wt-record-player-identity">
                <h2>
                  {localize(profile.clanTag && <small>{localize(profile.clanTag)} </small>)}
                  {localize(profile.nickname)}
                </h2>
                <p>
                  {t("等级")}
                  {localize(" ")}
                  {localize(num(profile.level))} · UID {localize(profile.uid)}
                </p>
                <PlayerAccountFacts
                  key={profile.uid}
                  details={publicDetails.data}
                  loading={publicDetails.busy}
                />
              </div>
              <PlayerMedals
                key={`medals:${profile.snapshotId}`}
                medals={publicDetails.data?.medals}
                busy={publicDetails.busy}
                error={publicDetails.error}
                retry={publicDetails.retry}
              />
              <div className="wt-record-player-actions" aria-label={t("玩家资料操作")}>
                <AccountValuation
                  key={`valuation:${profile.snapshotId}:${session?.user?.id || "guest"}`}
                  profile={profile}
                  session={session}
                  onSessionChange={refreshSession}
                />
              </div>
              <div className="wt-record-source">
                <span>
                  {t("采集于")}
                  {localize(" ")}
                  <RelativeTime value={profile.fetchedAt} /> ·{localize(" ")}
                  {localize(
                    profile.stale
                      ? t("正在展示此前资料")
                      : profile.cached
                        ? t("已命中缓存，本次不扣查询次数")
                        : t("官方助手资料"),
                  )}
                </span>
                <PlayerRefreshAction
                  key={`refresh:${profile.snapshotId}`}
                  profile={profile}
                  busy={busyAction === "refresh"}
                  disabled={
                    !!profile.localOnly ||
                    busy ||
                    exportBusy ||
                    (!!report && ["queued", "running"].includes(report.status))
                  }
                  refresh={() => void forceRefresh()}
                />
              </div>
            </section>
            <div className="wt-record-tabs">
              <GameTabs
                id="stats-view"
                panelId="stats-results"
                className="wt-record-main-tabs"
                label={t("战绩视图")}
                value={tab}
                items={[
                  { value: "overview", label: t("生涯总览") },
                  { value: "rankings", label: t("排位数据") },
                  {
                    value: "report",
                    label: (
                      <>
                        {t("个人战报")}
                        {localize(" ")}
                        <small>TOP 5</small>
                      </>
                    ),
                  },
                ]}
                onValueChange={changeTab}
              />
              <GameTabs
                id="stats-mode"
                panelId="stats-results"
                className="wt-record-modes"
                label={t("战斗模式")}
                value={mode}
                items={profile.modes.map((m) => ({
                  value: m.id,
                  label: statsModeNames[m.id],
                  disabled:
                    tab === "report" &&
                    (busy ||
                      exportBusy ||
                      (!!report && ["queued", "running"].includes(report.status))),
                }))}
                onValueChange={(value) => {
                  setMode(value);
                  setViewingHistory(false);
                  setVehiclePage(1);
                  setReport(null);
                }}
              />
            </div>
            <div
              className="wt-record-results"
              id="stats-results"
              role="tabpanel"
              aria-labelledby={`stats-view-${tab}-tab`}
            >
              <PlayerCareerOverview
                key={`career:${profile.snapshotId}`}
                profile={profile}
                mode={mode}
                base={active}
                active={tab === "overview"}
                armyBase={config?.assets.armyBase || ""}
              />
              <PlayerRankings
                key={`rankings:${profile.snapshotId}`}
                profile={displayProfile!}
                mode={mode}
                active={tab === "rankings"}
              />
              {localize(
                tab === "rankings" ? null : !active ? (
                  <p className="wt-record-empty">{t("这位玩家还没有可展示的出击记录。")}</p>
                ) : tab === "overview" ? (
                  <>
                    <section className="wt-record-panel wt-record-table-panel">
                      <div className="wt-record-heading">
                        <h2>
                          {t("载具战绩")}
                          {localize(" ")}
                          <GameTip label={t("载具战绩")}>
                            {t(
                              "单车对空、对地、对海 K/D 分别使用该车死亡次数。银狮为助手累计获得统计，不是当前余额或扣除维修补给后的净收入，数据取自助手统计，建议以游戏内记录为准。“—”代表未返回。",
                            )}
                          </GameTip>
                          <span>
                            {localize(filtered.length)}
                            {t("辆")}
                          </span>
                        </h2>
                        <span>
                          {localize(statsModeNames[mode])}
                          {t("· 仅展示已出击载具")}
                          {localize(
                            freshVehicleDetails && (
                              <>
                                {localize(" ")}
                                {t("· 采集于")}
                                {localize(" ")}
                                <RelativeTime value={freshVehicleDetails.fetchedAt} />
                              </>
                            ),
                          )}
                        </span>
                      </div>
                      <div className="wt-record-filters">
                        <input
                          type="search"
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            setVehiclePage(1);
                          }}
                          placeholder={t("搜索载具名称或型号")}
                          aria-label={t("筛选载具")}
                        />
                        <GameSelect
                          aria-label={t("载具国家筛选")}
                          value={vehicleCountry}
                          onValueChange={(value) => {
                            setVehicleCountry(value);
                            setVehiclePage(1);
                          }}
                        >
                          <option value="all">{t("全部国家")}</option>
                          {localize(
                            Object.keys(catalogSettings.countries).map((id) => (
                              <option key={id} value={id}>
                                {localize(statsCountryLabel(id))}
                              </option>
                            )),
                          )}
                          {localize(
                            profile.vehicles.some((v) => !v.country) && (
                              <option value="unknown">{t("国家待核验")}</option>
                            ),
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
                          aria-label={t("军种筛选")}
                        >
                          <option value="all">{t("全部军种")}</option>
                          {localize(
                            Object.entries(statsCategoryNames).map(([id, name]) => (
                              <option key={id} value={id}>
                                {localize(name)}
                              </option>
                            )),
                          )}
                        </GameSelect>
                        <GameSelect
                          aria-label={t("载具等级筛选")}
                          value={vehicleRank}
                          onValueChange={(value) => {
                            setVehicleRank(value);
                            setVehiclePage(1);
                          }}
                        >
                          <option value="all">{t("全部等级")}</option>
                          {localize(
                            valuationRules.researchRanks.map((rank) => (
                              <option key={rank} value={rank}>
                                Rank {localize(rank)}
                              </option>
                            )),
                          )}
                          {localize(
                            profile.vehicles.some((v) => !v.rank) && (
                              <option value="unknown">{t("等级待核验")}</option>
                            ),
                          )}
                        </GameSelect>
                        <GameSelect
                          className="wt-record-sort-field"
                          aria-label={t("载具战绩排序字段")}
                          value={vehicleSort?.key || "none"}
                          onValueChange={(value) => sortVehicles(value as VehicleSortKey | "none")}
                        >
                          <option value="none">{t("不排序")}</option>
                          {localize(
                            vehicleColumns.map(([key, label]) => (
                              <option key={key} value={key}>
                                {t("按")}
                                {localize(label)}
                                {t("排序")}
                              </option>
                            )),
                          )}
                        </GameSelect>
                        <button
                          type="button"
                          className="wt-record-sort-direction"
                          disabled={!vehicleSort}
                          onClick={() => {
                            if (vehicleSort) sortVehicles(vehicleSort.key, true);
                          }}
                          aria-label={t("切换为{0}排列载具战绩", [
                            localize(vehicleSort?.direction === "desc" ? t("升序") : t("降序")),
                          ])}
                        >
                          {localize(
                            !vehicleSort
                              ? t("升降序")
                              : vehicleSort.direction === "desc"
                                ? t("降序 ↓")
                                : t("升序 ↑"),
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={!vehicleSort}
                          onClick={() => sortVehicles("none")}
                        >
                          {t("清除排序")}
                        </button>
                      </div>
                      <div className="wt-vehicle-display-toolbar">
                        <div className="wt-vehicle-view-switch" aria-label={t("载具战绩展示形式")}>
                          {localize(
                            (["table", "cards"] as VehiclePresentation[]).map((view) => (
                              <button
                                key={view}
                                aria-pressed={vehicleView === view}
                                onClick={() => {
                                  setVehicleView(view);
                                  saveVehiclePresentation(view);
                                }}
                              >
                                {localize(view === "table" ? t("表格") : t("卡片"))}
                              </button>
                            )),
                          )}
                        </div>
                        <span>{t("展示形式保存在本机")}</span>
                      </div>
                      {localize(
                        vehicleView === "cards" ? (
                          <PlayerVehicleCards
                            vehicles={pagedVehicles}
                            select={setSelectedVehicle}
                            generate={(vehicle) => {
                              if (displayProfile)
                                setVehicleShare({
                                  profile: displayProfile,
                                  vehicle,
                                  job: startVehicleShare(displayProfile, vehicle),
                                });
                            }}
                            showNaval={category !== "ground"}
                          />
                        ) : (
                          <div className="wt-record-table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th scope="col">{t("载具")}</th>
                                  {localize(
                                    vehicleColumns.map(([key, label]) => (
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
                                          title={t("按{0}排序，点击切换升序或降序", [
                                            localize(label),
                                          ])}
                                        >
                                          {localize(label)}
                                          <span aria-hidden="true">
                                            {localize(
                                              vehicleSort?.key === key
                                                ? vehicleSort?.direction === "desc"
                                                  ? "↓"
                                                  : "↑"
                                                : "↕",
                                            )}
                                          </span>
                                        </button>
                                      </th>
                                    )),
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {localize(
                                  pagedVehicles.map((v) => (
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
                                  )),
                                )}
                              </tbody>
                            </table>
                          </div>
                        ),
                      )}
                      {localize(
                        !filtered.length && (
                          <p className="wt-record-empty">{t("没有符合筛选条件的载具。")}</p>
                        ),
                      )}
                      <PlayerVehiclePagination
                        page={currentVehiclePage}
                        pages={vehiclePages}
                        total={filtered.length}
                        pageSize={vehiclePageSize}
                        changePage={setVehiclePage}
                        changeSize={(size) => {
                          setVehiclePageSize(size);
                          setVehiclePage(1);
                          saveVehiclePageSize(size);
                        }}
                      />
                    </section>
                    <PlayerTypeUsage profile={profile} mode={mode} active={tab === "overview"} />
                  </>
                ) : (
                  <div className="wt-record-report-layout">
                    <aside className="wt-record-panel wt-report-controls">
                      <h2>
                        {t("定制你的战报")}
                        <GameTip label={t("定制你的战报")}>
                          <p>
                            {t("筛选和选图不扣次数。点击生成时使用一次战报额度，生成失败会退回。")}
                          </p>
                          <p>
                            {t("更换背景和重复保存不扣次；更换分析风格或自定义内容会生成新战报。")}
                          </p>
                          {localize(
                            viewingHistory && (
                              <p>{t("正在查看已存战报。调整筛选可为当前玩家配置新战报。")}</p>
                            ),
                          )}
                        </GameTip>
                      </h2>
                      <p>{t("选好范围、点评风格与背景，再一起生成。")}</p>
                      <div className="wt-report-filters" aria-label={t("战报载具筛选")}>
                        <label>
                          <span>{t("国家")}</span>
                          <GameSelect
                            aria-label={t("战报国家")}
                            value={reportCountry}
                            onValueChange={(value) => changeReportFilter(value, "country")}
                            disabled={
                              busy ||
                              exportBusy ||
                              (!!report && ["queued", "running"].includes(report.status))
                            }
                          >
                            <option value="all">{t("全部国家")}</option>
                            {localize(
                              profile.countries.map((country) => (
                                <option key={country.id} value={country.id}>
                                  {localize(country.name)}
                                </option>
                              )),
                            )}
                          </GameSelect>
                        </label>
                        <label>
                          <span>{t("兵种")}</span>
                          <GameSelect
                            aria-label={t("战报兵种")}
                            value={reportCategory}
                            onValueChange={(value) => changeReportFilter(value, "category")}
                            disabled={
                              busy ||
                              exportBusy ||
                              (!!report && ["queued", "running"].includes(report.status))
                            }
                          >
                            <option value="all">{t("全部兵种")}</option>
                            {localize(
                              Object.entries(statsCategoryNames).map(([id, name]) => (
                                <option key={id} value={id}>
                                  {localize(name)}
                                </option>
                              )),
                            )}
                          </GameSelect>
                        </label>
                      </div>
                      <div className="wt-report-voice">
                        <label htmlFor="report-style">{t("AI 点评风格")}</label>
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
                          {localize(
                            reportStyles.map((style) => (
                              <option value={style.id} key={style.id}>
                                {localize(style.label)}
                              </option>
                            )),
                          )}
                        </GameSelect>
                        <p>{localize(reportStyle(analysisStyle).description)}</p>
                        {localize(
                          analysisStyle === "custom" && (
                            <div className="wt-report-custom-style">
                              <label htmlFor="report-style-preference">{t("想怎么说")}</label>
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
                                placeholder={t(
                                  "例如：像战雷老玩家闲聊，先讲强项，再用一句冷幽默提醒短板。",
                                )}
                                onChange={(event) => changeStyle("custom", event.target.value)}
                              />
                              <small id="report-style-hint">
                                {t("只描述语气和分析角度，请勿填写隐私。")}
                                <span>{localize(customStyle.length)}/160</span>
                              </small>
                            </div>
                          ),
                        )}
                      </div>
                      <div className="wt-record-heading">
                        <h3>{t("战雷官方背景")}</h3>
                        <span>
                          {localize(config?.assets.backgrounds.length || 0)}
                          {t("张")}
                        </span>
                      </div>
                      <button
                        disabled={exportBusy}
                        aria-pressed={background === "auto"}
                        onClick={() => setBackground("auto")}
                      >
                        {t("自动匹配军种与年代")}
                      </button>
                      <GameSelect
                        aria-label={t("背景类别")}
                        value={bgFilter}
                        onValueChange={setBgFilter}
                      >
                        <option value="all">{t("全部背景")}</option>
                        <option value="ground">{t("装甲战场")}</option>
                        <option value="aviation">{t("航空战场")}</option>
                        <option value="ships">{t("海上战场")}</option>
                        <option value="mixed">{t("综合场景")}</option>
                      </GameSelect>
                      <div className="wt-report-backgrounds">
                        {localize(
                          config?.assets.backgrounds
                            .filter((b) => bgFilter === "all" || b.category === bgFilter)
                            .map((b) => (
                              <button
                                key={b.id}
                                disabled={exportBusy}
                                aria-pressed={bg?.id === b.id && background !== "auto"}
                                onClick={() => setBackground(b.id)}
                              >
                                <img src={b.thumbnail} alt="" loading="lazy" />
                                <span>{localize(b.title)}</span>
                              </button>
                            )),
                        )}
                      </div>
                      {localize(
                        bg && !bg.local && (
                          <a href={bg.sourcePage} target="_blank" rel="noreferrer">
                            {t("查看此背景的官方来源 ↗")}
                          </a>
                        ),
                      )}
                      <div className="wt-custom-background">
                        <input
                          ref={uploadInput}
                          disabled={exportBusy || uploadBusy}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          aria-label={t("上传自己的战报背景")}
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
                          {localize(uploadBusy ? t("正在读取图片…") : t("上传自己的背景"))}
                        </button>
                        {localize(
                          customBackground && (
                            <button
                              className="wt-custom-background-choice"
                              disabled={exportBusy}
                              aria-pressed={background === "custom"}
                              onClick={() => setBackground("custom")}
                            >
                              <img src={customBackground.source} alt={t("自选背景缩略图")} />
                              <span>{localize(customBackground.title)}</span>
                            </button>
                          ),
                        )}
                        <small>
                          {t("JPG / PNG / WebP，最大 12 MB。只在本次页面使用，不上传服务器。")}
                        </small>
                        <div className="wt-report-palette" aria-label={t("从背景提取的战报配色")}>
                          {localize(
                            [
                              reportTheme.base,
                              reportTheme.accent,
                              reportTheme.secondary,
                              reportTheme.ink,
                            ].map((color, i) => <i key={i} style={{ backgroundColor: color }} />),
                          )}
                          <span>
                            {localize(colorBusy ? t("正在读取背景颜色…") : t("随背景自动配色"))}
                          </span>
                        </div>
                        {localize(
                          backgroundError && (
                            <p className="wt-record-fine" role="alert">
                              {localize(backgroundError)}
                            </p>
                          ),
                        )}
                      </div>
                      <button
                        className="wt-record-primary wt-record-button-loading"
                        aria-busy={reportLoading}
                        disabled={
                          busy ||
                          viewingHistory ||
                          !eligible.length ||
                          (analysisStyle === "custom" && !customStyle.trim()) ||
                          (!!report && ["queued", "running"].includes(report.status))
                        }
                        onClick={() => void generate()}
                      >
                        {localize(
                          reportLoading && (
                            <span className="wt-control-spinner" aria-hidden="true" />
                          ),
                        )}
                        {localize(
                          reportLoading
                            ? t("正在生成战报与点评…")
                            : report?.status === "ready"
                              ? t("取用相同配置战报")
                              : t("生成我的战报"),
                        )}
                      </button>
                      <button
                        disabled={!report || exportBusy || colorBusy || report.status !== "ready"}
                        onClick={() => void save()}
                      >
                        {localize(exportBusy ? t("正在保存图片…") : t("保存战报图片"))}
                      </button>
                      {localize(
                        exportBusy && (
                          <button onClick={() => exportController.current?.abort()}>
                            {t("取消保存")}
                          </button>
                        ),
                      )}
                      <button
                        onClick={() => {
                          void statsRequest<{ items: StatsReport[] }>("reports")
                            .then((value) => setHistory(value.items))
                            .catch((failure) => setError(failure.message));
                        }}
                      >
                        {t("我的战报")}
                      </button>
                    </aside>
                    <div className="wt-report-stage">
                      <div className="wt-report-caption">
                        <span>
                          {localize(
                            report?.status === "ready"
                              ? t("已生成")
                              : report?.status === "running"
                                ? t("正在生成")
                                : t("待生成"),
                          )}
                        </span>
                        <span>{localize(bg?.title)}</span>
                      </div>
                      {localize(
                        !report && (
                          <div className="wt-report-idle">
                            <span>{t("你的战地档案")}</span>
                            <h2>{t("选好，再签发。")}</h2>
                            <p>
                              {localize(statsModeNames[mode])} ·{localize(" ")}
                              {localize(
                                reportCountry === "all"
                                  ? t("全部国家")
                                  : profile.countries.find((c) => c.id === reportCountry)?.name,
                              )}
                              {localize(" ")}·{localize(" ")}
                              {localize(
                                reportCategory === "all"
                                  ? t("全部兵种")
                                  : statsCategoryNames[reportCategory],
                              )}
                            </p>
                            <strong>
                              {localize(eligible.length)}
                              {t("辆有出击记录的载具")}
                            </strong>
                            <p>
                              {localize(
                                eligible.length
                                  ? t("生成后展示生涯总览与该范围最常用的五辆载具。")
                                  : t("这个范围暂时没有出击记录，请调整筛选。"),
                              )}
                            </p>
                            <small>
                              {localize(reportStyle(analysisStyle).label)}
                              {t("· 点击生成后，数据与点评一起完成。")}
                            </small>
                          </div>
                        ),
                      )}
                      {localize(
                        report && ["queued", "running"].includes(report.status) && (
                          <div className="wt-report-idle" aria-live="polite">
                            <span>{t("正在制作")}</span>
                            <h2>
                              {t("正在写你的")}
                              {localize(reportStyle(report.payload.analysis?.style).label)}
                            </h2>
                            <p>{t("结合真实生涯与常用载具完成点评，请稍候。")}</p>
                            <progress aria-label={t("正在制作战报")} />
                            <small>{t("完成后，整份战报会一起出现。")}</small>
                          </div>
                        ),
                      )}
                      {localize(
                        report?.status === "failed" && (
                          <div className="wt-report-idle">
                            <h2>{t("这份战报还没完成")}</h2>
                            <p>{t("本次生成额度已退回，请稍后重新生成。")}</p>
                          </div>
                        ),
                      )}
                      {localize(
                        report?.status === "ready" && (
                          <PlayerReport
                            report={report}
                            background={bg}
                            armyBase={config?.assets.armyBase || ""}
                            theme={reportTheme}
                          />
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </>
        ),
      )}
      {localize(
        displayProfile && selectedVehicle && (
          <PlayerVehicleDetails
            profile={displayProfile}
            vehicle={
              effectiveVehicles.find(
                (v) => v.id === selectedVehicle.id && v.mode === selectedVehicle.mode,
              ) || selectedVehicle
            }
            close={() => setSelectedVehicle(null)}
          />
        ),
      )}
      {localize(
        vehicleShare && (
          <PlayerVehicleShare
            profile={vehicleShare.profile}
            vehicle={vehicleShare.vehicle}
            job={vehicleShare.job}
            close={() => setVehicleShare(null)}
            back={() => {
              setSelectedVehicle(vehicleShare.vehicle);
              setVehicleShare(null);
            }}
          />
        ),
      )}
      {localize(
        showRules && (
          <Modal
            title={t("读懂你的战绩")}
            subtitle={t("先看统计范围，再看数字。")}
            close={() => setShowRules(false)}
            className="wt-record-rules wt-data-notes-dialog"
          >
            {localize(profile?.notice && <p>{localize(profile.notice)}</p>)}
            <StatsDataNotes />
          </Modal>
        ),
      )}
      {localize(
        history && (
          <Modal title={t("我的战报")} close={() => setHistory(null)} className="wt-record-rules">
            {localize(
              history.length ? (
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
                    <b>{localize(item.payload.player.nickname)}</b>
                    <span>
                      {localize(statsModeNames[item.payload.mode])} ·{" "}
                      {localize(statsReportScopeLabel(item.payload))} ·{localize(" ")}
                      {localize(reportStyle(item.payload.analysis?.style).label)} ·{localize(" ")}
                      {localize(
                        item.status === "ready"
                          ? t("已生成")
                          : item.status === "failed"
                            ? t("未生成")
                            : t("处理中"),
                      )}
                    </span>
                    <small>
                      {localize(
                        item.createdAt && (
                          <RelativeTime value={item.createdAt} interactive={false} />
                        ),
                      )}
                    </small>
                  </button>
                ))
              ) : (
                <p>{t("还没有生成过战报。")}</p>
              ),
            )}
          </Modal>
        ),
      )}
    </div>
  );
}
