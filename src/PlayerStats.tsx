import { useEffect, useRef, useState } from "react";
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
  const [nickname, setNickname] = useState(route.player || ""),
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
    [previewBusy, setPreviewBusy] = useState(false),
    [previewError, setPreviewError] = useState(""),
    [previewRetry, setPreviewRetry] = useState(0),
    [viewingHistory, setViewingHistory] = useState(false);
  function changeReportFilter(value: string, field: "country" | "category") {
    if (field === "country") setReportCountry(value);
    else setReportCategory(value);
    setViewingHistory(false);
    setReport(null);
    setBackground("auto");
    setPreviewError("");
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
    setNotice(p.cached ? "已命中缓存，本次不扣查询次数。" : "已取得官方公开资料，并保存查询记录。");
  }
  async function performSearch(nick: string, exact: boolean) {
    const value = nick.trim();
    if (value.length < 2) return;
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
    const c = new AbortController();
    if (!profile || tab !== "report" || viewingHistory || !profile.modes.some((m) => m.id === mode))
      return;
    const matches = (current: StatsReport) =>
      current.payload.mode === mode &&
      current.payload.player.uid === profile.uid &&
      (current.payload.scope?.country || "all") === reportCountry &&
      (current.payload.scope?.category || "all") === reportCategory;
    setPreviewBusy(true);
    setPreviewError("");
    setReport((current) =>
      current && matches(current) && current.status !== "preview" ? current : null,
    );
    void statsRequest<StatsReport>(
      "reports/preview",
      {
        snapshotId: profile.snapshotId,
        mode,
        country: reportCountry,
        category: reportCategory,
        requestId: "preview_" + crypto.randomUUID(),
      },
      c.signal,
    )
      .then((value) => {
        if (!c.signal.aborted)
          setReport((current) =>
            current && matches(current) && current.status !== "preview" ? current : value,
          );
      })
      .catch((failure) => {
        if (!c.signal.aborted)
          setPreviewError(
            failure instanceof Error ? failure.message : "暂时无法预览战报，请稍后重试。",
          );
      })
      .finally(() => {
        if (!c.signal.aborted) setPreviewBusy(false);
      });
    return () => c.abort();
  }, [profile, mode, tab, reportCountry, reportCategory, viewingHistory, previewRetry]);
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
    if (!profile || !report || viewingHistory || previewBusy) return;
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
    if (!report || !config) return;
    const selected = config.assets.backgrounds.find(
      (b) => b.id === (background === "auto" ? report.payload.suggestedBackground : background),
    );
    if (!selected) return;
    const c = new AbortController();
    exportController.current = c;
    setExportBusy(true);
    setError("");
    try {
      const { downloadStatsReport } = await import("./player-report-export");
      await downloadStatsReport(report, selected, config.assets.armyBase, c.signal);
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
  const bg =
    report && config
      ? config.assets.backgrounds.find(
          (b) => b.id === (background === "auto" ? report.payload.suggestedBackground : background),
        )
      : undefined;
  const hours = Math.max(2, Math.round((config?.settings.cacheTtlSeconds || 7200) / 3600));
  return (
    <div className="wt-record-page">
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
              <button onClick={() => void logout()}>退出登录</button>
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
              <button onClick={() => void login()} disabled={!session}>
                登录
              </button>
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
              <b>{profile.cached ? "缓存资料" : "官方助手"}</b>
              <span>采集于 {statsDate(profile.fetchedAt)}</span>
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
                <p>先选国家和兵种，再从该范围按战斗场次选择 Top 5。</p>
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
                  筛选预览不扣次数。重新生成其他范围的 AI 致辞，会使用一次战报额度。
                </p>
                {viewingHistory && (
                  <p className="wt-record-fine">正在查看已存战报。调整筛选可返回当前玩家的预览。</p>
                )}
                <div className="wt-record-heading">
                  <h3>战雷官方背景</h3>
                  <span>{config?.assets.backgrounds.length || 0} 张</span>
                </div>
                <button aria-pressed={background === "auto"} onClick={() => setBackground("auto")}>
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
                        aria-pressed={bg?.id === b.id && background !== "auto"}
                        onClick={() => setBackground(b.id)}
                      >
                        <img src={b.thumbnail} alt="" loading="lazy" />
                        <span>{b.title}</span>
                      </button>
                    ))}
                </div>
                {bg && (
                  <a href={bg.sourcePage} target="_blank" rel="noreferrer">
                    查看此背景的官方来源 ↗
                  </a>
                )}
                <div className="wt-report-voice">
                  <b>司令授勋致辞</b>
                  <p>庄严、克制地回顾你的出击成绩。使用虚构授勋场景，不代表获得游戏勋章。</p>
                </div>
                <button
                  className="wt-record-primary"
                  disabled={
                    busy ||
                    previewBusy ||
                    !!previewError ||
                    viewingHistory ||
                    !report ||
                    ["queued", "running"].includes(report.status)
                  }
                  onClick={() => void generate()}
                >
                  {report?.status === "queued" || report?.status === "running"
                    ? "正在撰写授勋致辞…"
                    : report?.status === "ready"
                      ? "查看已生成战报"
                      : "生成授勋战报"}
                </button>
                <button
                  disabled={
                    !report ||
                    previewBusy ||
                    exportBusy ||
                    report.status === "queued" ||
                    report.status === "running"
                  }
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
                        : "战报预览"}
                  </span>
                  <span>{bg?.title}</span>
                </div>
                {previewBusy && !viewingHistory && (
                  <output className="wt-report-empty">正在筛选载具并准备预览…</output>
                )}
                {!previewBusy && previewError && !viewingHistory && (
                  <div className="wt-report-empty">
                    <output>{previewError}</output>
                    <button onClick={() => setPreviewRetry((value) => value + 1)}>重新预览</button>
                  </div>
                )}
                {report && (
                  <ReportPoster
                    report={report}
                    background={bg}
                    armyBase={config?.assets.armyBase || ""}
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
                  setPreviewBusy(false);
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
function ReportPoster({
  report,
  background,
  armyBase,
}: {
  report: StatsReport;
  background: Background | undefined;
  armyBase: string;
}) {
  const p = report.payload;
  return (
    <article
      className="wt-report-poster"
      style={
        {
          "--wt-report-bg": background ? `url("${background.source}")` : undefined,
        } as React.CSSProperties
      }
    >
      <div className="wt-poster-top">
        <img src="https://warthunder.com/assets/img/svg/logo-wt.svg" alt="War Thunder" />
        <span>{statsModeNames[p.mode]} · TOP 5</span>
      </div>
      <header className="wt-poster-identity">
        <Avatar url={p.player.avatar} name={p.player.nickname} />
        <div>
          <p>战地嘉奖 · {statsReportScopeLabel(p)}</p>
          <h2>{p.player.nickname}</h2>
          <span>
            等级 {num(p.player.level)} · {p.player.clanTag || "勇敢出击，留下记录"}
          </span>
        </div>
      </header>
      <div className="wt-poster-metrics">
        <div className="wt-poster-efficiency">
          <strong>{num(p.totals.efficiency)}</strong>
          <span>Top 5 参考效率</span>
        </div>
        {p.branches.map((b) => (
          <div key={b.id}>
            <strong>{ratio(statsBranchKd(b))}</strong>
            <span>
              <img className="wt-branch-icon" src={statsArmyIcon(armyBase, b.id)} alt="" />
              {b.label}
              {statsBranchTarget(b.id)} K/D
            </span>
          </div>
        ))}
      </div>
      <div className="wt-poster-section-title">
        <h3>功勋载具 · 最常出击 TOP 5</h3>
        <span>按战斗场次</span>
      </div>
      {p.top5.map((v, i) => (
        <section className="wt-poster-vehicle" key={v.id}>
          <span className="wt-poster-place">{String(i + 1).padStart(2, "0")}</span>
          <img src={v.image} alt={v.name} loading="lazy" />
          <div>
            <h3>{v.name}</h3>
            <div className="wt-poster-vehicle-values">
              <span>
                <b>{num(v.battles)}</b> 场
              </span>
              <span>
                <b>{v.winRate == null ? "—" : v.winRate.toFixed(2) + "%"}</b> 胜率
              </span>
              <span>
                <b>{num(v.efficiency)}</b> 效率{v.smallSample ? " · 小样本" : ""}
              </span>
            </div>
            <div className="wt-poster-vehicle-values">
              <span>
                对空 K/D <b>{ratio(v.airKd)}</b>
              </span>
              <span>
                对地 K/D <b>{ratio(v.groundKd)}</b>
              </span>
              {(v.navalKd != null || v.category === "ships" || v.category === "boats") && (
                <span>
                  对海 K/D <b>{ratio(v.navalKd)}</b>
                </span>
              )}
            </div>
            <p className="wt-poster-silver">
              累计获得银狮 <b>{num(v.silverLions)}</b>
            </p>
          </div>
        </section>
      ))}
      <section className="wt-poster-speech">
        <span>司令授勋致辞</span>
        {report.status === "ready" && report.review ? (
          <>
            <h3>{report.review.title}</h3>
            <p>{report.review.speech}</p>
          </>
        ) : (
          <>
            <h3>
              {report.status === "failed"
                ? "致辞暂未完成"
                : report.status === "preview"
                  ? "你的嘉奖，等待签发。"
                  : "司令正在签发嘉奖。"}
            </h3>
            <p>
              {report.status === "failed"
                ? "生成未完成，本次生成次数已退回。稍后可重新生成。"
                : report.status === "preview"
                  ? "点击生成，AI 将根据以上五辆载具的真实战绩，写下一段属于你的授勋致辞。"
                  : "战报数据已就绪，正在根据 Top 5 战绩撰写致辞。"}
            </p>
          </>
        )}
      </section>
      <footer className="wt-poster-bottom">
        <span>资料采集 {statsDate(p.fetchedAt)}</span>
        <span>本工具参考指数 · 仅所列五车 · 未返回项目留空</span>
        <span>银狮为累计获得统计，非余额或净收入 · 虚构授勋情景</span>
      </footer>
    </article>
  );
}
