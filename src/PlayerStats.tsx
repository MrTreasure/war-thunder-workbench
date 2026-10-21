import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerReport } from "./PlayerReport";
import {
  defaultReportTheme,
  imageReportTheme,
  uploadReportBackground,
  localReportImage,
} from "./player-report-design";
import type { ReportTheme } from "./player-report-design";
import { useSearch } from "@tanstack/react-router";
import { GameSelect } from "./components/GameSelect";
import { Modal } from "./Modal";
import { PlayerRadar } from "./PlayerRadar";
import {
  statsRequest,
  prepareStatsDevice,
  setStatsToken,
  loginChallenge,
  statsNumber as num,
  statsRatio as ratio,
  statsDate,
  statsModeNames,
  statsBranchKd,
  statsBranchTarget,
  statsArmyIcon,
  statsReportScopeLabel,
  lastStatsNickname,
  rememberStatsNickname,
  reportImage,
  statsCategoryNames,
} from "./player-stats-api";
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
function VehicleRow({ vehicle: v, countryName }: { vehicle: PlayerVehicle; countryName: string }) {
  return (
    <tr>
      <td aria-label={v.name}>
        <span className="wt-record-vehicle">
          <img src={v.thumbnail} alt="" loading="lazy" />
          <span>
            <b>{v.name}</b>
            <small>
              {v.rank && `${v.rank} 级 · `}
              {countryName}
            </small>
          </span>
        </span>
      </td>
      <td>{num(v.battles)}</td>
      <td>{v.winRate == null ? "—" : v.winRate.toFixed(2) + "%"}</td>
      <td>{ratio(v.airKd)}</td>
      <td>{ratio(v.groundKd)}</td>
      <td>{ratio(v.navalKd)}</td>
      <td>{ratio(v.kd)}</td>
      <td>
        <b className="wt-gold">{num(v.efficiency)}</b>
        {v.smallSample && <small className="wt-record-small">小样本</small>}
      </td>
      <td className="wt-silver">{num(v.silverLions)}</td>
    </tr>
  );
}
export function PlayerStats() {
  const route = useSearch({ from: "/_workbench/stats" });
  const [config, setConfig] = useState<StatsConfig | null>(null),
    [session, setSession] = useState<StatsSession | null>(null);
  const [nickname, setNickname] = useState(route.player || lastStatsNickname()),
    [candidates, setCandidates] = useState<PlayerCandidate[]>([]),
    [queryId, setQueryId] = useState("");
  const [profile, setProfile] = useState<PlayerProfile | null>(null),
    [mode, setMode] = useState("rb"),
    [tab, setTab] = useState(route.view === "report" ? "report" : "overview");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [limit, setLimit] = useState(40);
  const [report, setReport] = useState<StatsReport | null>(null),
    [background, setBackground] = useState("auto"),
    [bgFilter, setBgFilter] = useState("all");
  const [reportCountry, setReportCountry] = useState("all"),
    [reportCategory, setReportCategory] = useState("all"),
    [viewingHistory, setViewingHistory] = useState(false);
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
    [backgroundError, setBackgroundError] = useState(""),
    [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null),
    uploadState = useRef({ url: "", version: 0 });
  useEffect(() => {
    setHeaderHost(document.getElementById("wt-header-account"));
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
  const authPending = useRef<{ verifier: string; state: string; popup: Window } | null>(null);
  function controller() {
    const c = new AbortController();
    requests.current.add(c);
    return c;
  }
  async function refreshSession() {
    try {
      setSession(await statsRequest<StatsSession>("session"));
    } catch {
      /* An expired login is presented by the next explicit request. */
    }
  }
  function loadProfile(p: PlayerProfile) {
    setProfile(p);
    setNickname(p.nickname);
    rememberStatsNickname(p.nickname);
    setMode([...p.modes].sort((a, b) => (b.battles || 0) - (a.battles || 0))[0]?.id || "rb");
    setSearch("");
    setCategory("all");
    setLimit(40);
    setReport(null);
    setReportCountry("all");
    setReportCategory("all");
    setViewingHistory(false);
    setBackground("auto");
    setCandidates([]);
    setNotice("");
  }
  async function performSearch(nick: string, exact: boolean) {
    const value = nick.trim();
    if (value.length < 2) return;
    rememberStatsNickname(value);
    const id = ++generation.current,
      c = controller();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await statsRequest<{
        items: PlayerCandidate[];
        queryId: string;
        cached: boolean;
      }>(
        "players/search",
        { nickname: value, requestId: "query_" + crypto.randomUUID() },
        c.signal,
      );
      if (c.signal.aborted || id !== generation.current) return;
      setQueryId(result.queryId);
      setCandidates(result.items);
      if (!result.items.length) setNotice("没有找到玩家，请检查昵称与平台后缀。");
      const matches = result.items.filter((p) => p.nickname === value);
      if (exact && matches.length === 1) {
        const p = await statsRequest<PlayerProfile>(
          "players/select",
          { queryId: result.queryId, uid: matches[0].uid },
          c.signal,
        );
        if (!c.signal.aborted && id === generation.current) loadProfile(p);
      } else setProfile(null);
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
  async function choose(p: PlayerCandidate) {
    const id = ++generation.current,
      c = controller();
    setBusy(true);
    setError("");
    try {
      const value = await statsRequest<PlayerProfile>(
        "players/select",
        { queryId, uid: p.uid },
        c.signal,
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
  useEffect(() => {
    const c = new AbortController(),
      active = requests.current;
    active.add(c);
    void Promise.all([
      statsRequest<StatsConfig>("config", undefined, c.signal),
      prepareStatsDevice(c.signal),
    ])
      .then(async ([cfg, actor]) => {
        if (c.signal.aborted) return;
        setConfig(cfg);
        setSession(actor);
        if (route.player) {
          const result = await statsRequest<{ items: PlayerCandidate[]; queryId: string }>(
            "players/search",
            { nickname: route.player, requestId: "query_" + crypto.randomUUID() },
            c.signal,
          );
          if (c.signal.aborted) return;
          setCandidates(result.items);
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
              setSession(await statsRequest<StatsSession>("session", undefined, c.signal));
            }
          }
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
  }, [report]);
  useEffect(() => {
    const listener = async (event: MessageEvent) => {
      const pending = authPending.current;
      if (
        !pending ||
        event.origin !== "https://api.mrtreasure.cc" ||
        event.source !== pending.popup ||
        event.data?.type !== "wt-login-code" ||
        event.data.state !== pending.state
      )
        return;
      authPending.current = null;
      try {
        const result = await statsRequest<{ token: string }>("auth/exchange", {
          code: event.data.code,
          verifier: pending.verifier,
        });
        setStatsToken(result.token);
        setSession(await statsRequest<StatsSession>("session"));
        setProfile(null);
        setCandidates([]);
        setNotice("登录成功，已取消每日次数限制。请重新选择玩家，缓存不扣次。");
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "登录未完成。");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  async function login() {
    const popup = window.open("about:blank", "wt-account-login", "width=500,height=680");
    if (!popup) {
      setError("请允许打开登录窗口后重试。");
      return;
    }
    try {
      const challenge = await loginChallenge();
      authPending.current = { verifier: challenge.verifier, state: challenge.state, popup };
      const start = await statsRequest<{ authorizeUrl: string }>("auth/start", {
        challenge: challenge.challenge,
        state: challenge.state,
      });
      popup.location.replace(start.authorizeUrl);
    } catch (failure) {
      popup.close();
      setError(failure instanceof Error ? failure.message : "无法打开登录。");
    }
  }
  async function logout() {
    try {
      await statsRequest("auth/logout", {});
      setStatsToken("");
      setProfile(null);
      setReport(null);
      setSession(await statsRequest<StatsSession>("session"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "退出失败。");
    }
  }
  async function generate() {
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
      await downloadStatsReport(report, selected, config.assets.armyBase, reportTheme, c.signal);
    } catch (failure) {
      if (!c.signal.aborted)
        setError(failure instanceof Error ? failure.message : "保存失败，请重试。");
    } finally {
      setExportBusy(false);
      exportController.current = null;
    }
  }
  const active = profile?.modes.find((m) => m.id === mode);
  const filtered = (profile?.vehicles || [])
    .filter(
      (v) =>
        v.mode === mode &&
        (category === "all" || v.category === category) &&
        (!search || (v.name + " " + v.id).toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => (b.battles || 0) - (a.battles || 0));
  const eligible = (profile?.vehicles || []).filter(
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
  const hours = Math.max(2, Math.round((config?.settings.cacheTtlSeconds || 7200) / 3600));
  return (
    <div className="wt-record-page">
      {headerHost &&
        createPortal(
          <div className="wt-header-account">
            {session?.user && (
              <span
                className="wt-header-account-name"
                title={session.user.displayName || session.user.email}
              >
                {session.user.displayName || session.user.email}
              </span>
            )}
            <button
              className="wt-header-login"
              disabled={!session}
              onClick={() => void (session?.user ? logout() : login())}
            >
              {session?.user ? "退出" : "登录"}
            </button>
          </div>,
          headerHost,
        )}
      <header className="wt-record-page-title">
        <div>
          <h1>生涯战绩与个人战报</h1>
          <p>查阅出击记录，领取属于你的授勋致辞。</p>
        </div>
        <div className="wt-record-account">
          {session?.user ? (
            <>
              <span>
                {session.user.displayName || session.user.email || "已登录"}
                <small>每日查询与战报不限次</small>
              </span>
            </>
          ) : (
            <>
              <span>
                游客 · 新查询{" "}
                {session
                  ? Math.max(
                      0,
                      session.limits.queryLimit - session.query.used - session.query.reserved,
                    )
                  : "—"}{" "}
                次 / 战报{" "}
                {session
                  ? Math.max(
                      0,
                      session.limits.reportLimit - session.report.used - session.report.reserved,
                    )
                  : "—"}{" "}
                次<small>每日零点重置 · 缓存命中不扣次</small>
              </span>
            </>
          )}
        </div>
      </header>
      <form
        className="wt-record-query"
        onSubmit={(event) => {
          event.preventDefault();
          void performSearch(nickname, false);
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
        <span>缓存至少 {hours} 小时，命中免费</span>
      </form>
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
        <section className="wt-record-welcome">
          <h2>查找你的战斗记录</h2>
          <p>输入昵称，查看生涯、单车收入与分军种 K/D，再生成 Top 5 战报。</p>
          <div>
            <button
              disabled={!session || busy}
              onClick={() => {
                setNickname("ArthurDaynee");
                void performSearch("ArthurDaynee", true);
              }}
            >
              查看 ArthurDaynee
            </button>
            <button
              disabled={!session || busy}
              onClick={() => {
                setNickname("starfall21740");
                void performSearch("starfall21740", true);
              }}
            >
              查看 starfall21740
            </button>
          </div>
          <small>只展示有出击记录的数据。查询其他玩家不需要对方的游戏密码。</small>
        </section>
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
            <div className="wt-record-source">
              <span>
                采集于 {statsDate(profile.fetchedAt)} ·{" "}
                {profile.cached ? "已命中缓存，本次不扣查询次数" : "官方助手资料"}
              </span>
            </div>
          </section>
          <div className="wt-record-tabs" aria-label="战绩视图">
            <button aria-pressed={tab === "overview"} onClick={() => setTab("overview")}>
              生涯总览
            </button>
            <button aria-pressed={tab === "report"} onClick={() => setTab("report")}>
              授勋战报 <small>TOP 5</small>
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
                    setLimit(40);
                    setReport(null);
                  }}
                >
                  {statsModeNames[m.id]}
                </button>
              ))}
            </div>
          </div>
          {!active ? (
            <p className="wt-record-empty">这位玩家还没有可展示的出击记录。</p>
          ) : tab === "overview" ? (
            <>
              <div className="wt-record-metrics">
                {[
                  ["战斗场次", num(active.battles)],
                  ["胜率", active.winRate == null ? "—" : active.winRate.toFixed(2) + "%"],
                  ["参考效率", num(active.efficiency)],
                  ["综合 K/D", ratio(active.kd)],
                  ["空中目标击毁", num(active.airKills)],
                  ["地面目标击毁", num(active.groundKills)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    {label === "参考效率" && (
                      <button className="wt-record-link" onClick={() => setShowRules(true)}>
                        查看计算规则
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="wt-record-overview">
                <div className="wt-record-career">
                  <section className="wt-record-panel">
                    <div className="wt-record-heading">
                      <h2>分军种 K/D</h2>
                      <span>陆军对地 · 航空对空 · 海军对海</span>
                    </div>
                    <div className="wt-record-branch-grid">
                      {active.branches.map((b) => (
                        <div key={b.id}>
                          <h3>
                            <img
                              className="wt-branch-icon"
                              src={statsArmyIcon(config?.assets.armyBase || "", b.id)}
                              alt=""
                            />
                            {b.label}
                          </h3>
                          <strong>{ratio(statsBranchKd(b))}</strong>
                          <p>{statsBranchTarget(b.id)}目标击毁 / 对应载具死亡</p>
                          <small>{b.vehicleCount} 辆有出击记录的载具</small>
                        </div>
                      ))}
                    </div>
                    <p className="wt-record-fine">
                      按对应军种的单车记录分别汇总，不混用其他军种的死亡数；击毁只合计已返回的类别。
                    </p>
                  </section>
                  <section className="wt-record-panel">
                    <div className="wt-record-heading">
                      <h2>各国拥有载具</h2>
                      <span>官方公开数量</span>
                    </div>
                    <div className="wt-record-countries">
                      {profile.countries
                        .filter((c) => c.owned != null && c.owned > 0)
                        .map((c) => (
                          <div key={c.id}>
                            <img src={c.flag} alt="" />
                            <span>{c.name}</span>
                            <b>{num(c.owned)}</b>
                            <small>精英 {num(c.elite)}</small>
                          </div>
                        ))}
                    </div>
                  </section>
                </div>
                <PlayerRadar axes={active.radar} />
              </div>
              <section className="wt-record-panel wt-record-table-panel">
                <div className="wt-record-heading">
                  <h2>
                    载具战绩 <span>{filtered.length} 辆</span>
                  </h2>
                  <span>{statsModeNames[mode]} · 仅展示已出击载具</span>
                </div>
                <div className="wt-record-filters">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setLimit(40);
                    }}
                    placeholder="搜索载具名称或型号"
                    aria-label="筛选载具"
                  />
                  <GameSelect
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value);
                      setLimit(40);
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
                </div>
                <div className="wt-record-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "载具",
                          "场次",
                          "胜率",
                          "对空 K/D",
                          "对地 K/D",
                          "对海 K/D",
                          "综合 K/D",
                          "参考效率",
                          "累计获得银狮",
                        ].map((label) => (
                          <th key={label} scope="col">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, limit).map((v) => (
                        <VehicleRow
                          key={v.id}
                          vehicle={v}
                          countryName={
                            profile.countries.find((c) => c.id === v.country)?.name ||
                            statsCategoryNames[v.category || ""] ||
                            ""
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {limit < filtered.length && (
                  <button className="wt-record-more" onClick={() => setLimit(limit + 40)}>
                    显示更多载具
                  </button>
                )}
                <p className="wt-record-fine">
                  单车对空、对地、对海 K/D
                  分别使用该车死亡次数。银狮为助手累计获得统计，不是当前余额或扣除维修补给后的净收入，数据取自助手统计，建议以游戏内记录为准。“—”代表未返回。
                </p>
              </section>
            </>
          ) : (
            <div className="wt-record-report-layout">
              <aside className="wt-record-panel wt-report-controls">
                <h2>你的授勋战报</h2>
                <p>先配置范围与背景，点击生成后一起制作战报和司令致辞。</p>
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
                <div className="wt-report-voice">
                  <b>司令授勋致辞</b>
                  <p>结合生涯与常用载具，写给你本人。少报数字，多说一句真正值得记住的话。</p>
                </div>
                <button
                  className="wt-record-primary"
                  disabled={
                    busy ||
                    viewingHistory ||
                    !eligible.length ||
                    (!!report && ["queued", "running"].includes(report.status))
                  }
                  onClick={() => void generate()}
                >
                  {report?.status === "queued" || report?.status === "running"
                    ? "正在制作战报与致辞…"
                    : report?.status === "ready"
                      ? "生成同范围战报"
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
                  更换背景和重复保存不扣次数。已生成的同一份战报可以直接取用。
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
                    <small>点击“生成我的战报”，等待数据与致辞一起完成。</small>
                  </div>
                )}
                {report && ["queued", "running"].includes(report.status) && (
                  <div className="wt-report-idle" aria-live="polite">
                    <span>正在制作</span>
                    <h2>档案已送达，嘉奖正在签发。</h2>
                    <p>已选定统计范围，正在结合你的生涯与常用载具撰写致辞。</p>
                    <progress aria-label="正在制作战报" />
                    <small>完成后，整份战报会一起出现。</small>
                  </div>
                )}
                {report?.status === "failed" && (
                  <div className="wt-report-idle">
                    <h2>这份嘉奖还没完成</h2>
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
          <footer className="wt-record-footer">
            {profile.notice}{" "}
            <button className="wt-record-link" onClick={() => setShowRules(true)}>
              效率分与 K/D 说明
            </button>
          </footer>
        </>
      )}
      {showRules && (
        <Modal title="指标与数据说明" close={() => setShowRules(false)} className="wt-record-rules">
          <h3>参考效率</h3>
          <p>{config?.rules.efficiency.description}</p>
          <p>{config?.rules.efficiency.notice}</p>
          <h3>K/D 分开计算</h3>
          <p>
            陆军使用地面目标击毁与陆军载具死亡，航空使用空中目标击毁与航空载具死亡，海军使用海上目标击毁与海军载具死亡；只配对同一军种已返回的记录。单车对空
            K/D = 空中目标击毁 /
            该车死亡；对地、对海同理。综合只合计已返回的击毁类别；无死亡记录时不推测分母。
          </p>
          <h3>六维雷达</h3>
          <p>{config?.rules.radar.notice}</p>
          <h3>银狮收入</h3>
          <p>
            助手单车累计获得量，不等于当前余额或净收入。部分记录未返回该栏，保持空值。出击记录不是完整车库。
          </p>
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
                  setReport(item);
                  setTab("report");
                  setBackground("auto");
                  setHistory(null);
                }}
              >
                <b>{item.payload.player.nickname}</b>
                <span>
                  {statsModeNames[item.payload.mode]} · {statsReportScopeLabel(item.payload)} ·{" "}
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
