import { buildReportRequest } from "../../../src/player-report-request";
import {
  reportStyles,
  reportStyle as reportStyleInfo,
  type ReportStyle,
} from "../../../src/player-report-style";
import { useEffect, useRef, useState } from "react";
import type {
  PlayerCandidate,
  PlayerProfile,
  StatsReport,
  PlayerVehicle,
} from "../../../src/player-stats-api";
import type { Valuation } from "../../../src/AccountValuation";
import { PlayerVehicleCards } from "../../../src/PlayerVehicleCards";
import {
  VehiclePresentation,
  useMiniappVehicleFacts,
  useMiniappOwnedVehicles,
} from "./VehiclePresentation";
import { GameSelect } from "../../../src/components/GameSelect";
import { request, query, pause, account, sdk } from "./runtime";
import { MainSiteLink } from "./MainSiteLink";
import { useRuntime } from "./context";
import { DetailPage, ErrorNote, num, ratio } from "./ui";
import { createQueryHistory, type QueryRecord } from "./query-history";
import { AchievementShare } from "./AchievementShare";
import { MiniappValuationDetails } from "./ValuationDetails";
import { visibleValuation } from "../../../src/valuation-visibility";
import catalog from "../../../src/generated/bootstrap.json";
const historyStore = createQueryHistory(sdk.storage);
const modeNames = { ab: "街机", rb: "历史", sb: "全真" };
export default function Stats({ boundRequest }: { boundRequest: number }) {
  const { view, cloud, reloadCloud } = useRuntime();
  const [recent, setRecent] = useState<QueryRecord[]>([]);
  const recentRef = useRef<QueryRecord[]>([]);
  const [historyError, setHistoryError] = useState("");
  const scroll = useRef<HTMLElement>(null),
    more = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    void historyStore
      .load()
      .then((rows) => {
        if (live && rows) {
          recentRef.current = rows;
          setRecent(rows);
        }
      })
      .catch(() => {
        if (live) setHistoryError("本地查询记录暂不可读，本次查询仍可继续。");
      });
    return () => {
      live = false;
    };
  }, []);
  function saveRecent(rows: QueryRecord[]) {
    recentRef.current = rows;
    setRecent(rows);
    setHistoryError("");
    void historyStore
      .save(rows)
      .catch(() => setHistoryError("本地记录保存失败，查询结果未受影响。"));
  }
  const [nickname, setNickname] = useState(""),
    [candidates, setCandidates] = useState<PlayerCandidate[]>([]),
    [queryId, setQueryId] = useState(""),
    [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [mode, setMode] = useState<"ab" | "rb" | "sb">("rb"),
    [country, setCountry] = useState("all"),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(0),
    [vehicle, setVehicle] = useState<PlayerVehicle | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [screen, setScreen] = useState<"profile" | "valuation" | "report">("profile"),
    [valuation, setValuation] = useState<Valuation | null>(null),
    [report, setReport] = useState<StatsReport | null>(null),
    [reportStyle, setReportStyle] = useState<ReportStyle>("commander");
  const [customStyle, setCustomStyle] = useState("");
  const [shareVehicle, setShareVehicle] = useState<PlayerVehicle | null>(null),
    [shareReport, setShareReport] = useState(false);
  const [binding, setBinding] = useState(false),
    [confirmedUid, setConfirmedUid] = useState("");
  const work = useRef<AbortController | null>(null);
  useEffect(() => () => work.current?.abort(), []);
  async function run(action: (c: AbortController) => Promise<void>) {
    work.current?.abort();
    const c = new AbortController();
    work.current = c;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action(c);
    } catch (e) {
      if (!c.signal.aborted) setError(e instanceof Error ? e.message : "请求暂未完成");
    } finally {
      if (!c.signal.aborted) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  function loaded(value: PlayerProfile) {
    setShareVehicle(null);
    setShareReport(false);
    setProfile(value);
    saveRecent(
      [
        {
          uid: value.uid,
          snapshotId: value.snapshotId,
          nickname: "玩家 #" + value.uid,
          fetchedAt: value.fetchedAt,
        },
        ...recentRef.current.filter((row) => row.uid !== value.uid),
      ].slice(0, 20),
    );
    setCandidates([]);
    setMode("rb");
    setPage(0);
    setValuation(null);
    setReport(null);
    setScreen("profile");
    setVehicle(null);
  }
  useEffect(() => {
    if (!boundRequest) return;
    const c = new AbortController();
    void request<PlayerProfile>("account/game-binding/profile", undefined, c.signal)
      .then((value) => {
        if (!c.signal.aborted) loaded(value);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : "关联资料暂不可用");
      });
    return () => c.abort();
  }, [boundRequest]);
  async function search() {
    if (nickname.trim().length < 2) return;
    await run(async (c) => {
      const value = await query<{ items: PlayerCandidate[]; queryId: string }>(
        "search",
        { nickname: nickname.trim(), requestId: "query_" + crypto.randomUUID() },
        c.signal,
        setProgress,
      );
      if (c.signal.aborted) return;
      setQueryId(value.queryId);
      setCandidates(value.items);
      setProfile(null);
      if (!value.items.length) setNotice("未找到玩家，请核对昵称和平台后缀。");
    });
  }
  async function choose(p: PlayerCandidate) {
    await run(async (c) => {
      const value = await query<PlayerProfile>(
        "select",
        { queryId, uid: p.uid },
        c.signal,
        setProgress,
      );
      if (!c.signal.aborted) loaded(value);
    });
  }
  async function restoreRecord(row: QueryRecord) {
    await run(async (c) => {
      const value = await request<PlayerProfile>(
        "players/restore",
        { uid: row.uid, snapshotId: row.snapshotId },
        c.signal,
      );
      if (c.signal.aborted) return;
      if (value.uid !== row.uid) throw Error("记录身份不一致，请重新查询。");
      loaded(value);
      setNotice("已打开保存记录，采集时间见下方。");
    });
  }
  async function refresh() {
    if (!profile) return;
    await run(async (c) => {
      const value = await query<PlayerProfile>(
        "refresh",
        { snapshotId: profile.snapshotId, requestId: "refresh_" + crypto.randomUUID() },
        c.signal,
        setProgress,
      );
      if (!c.signal.aborted) loaded(value);
    });
  }
  async function estimate() {
    if (!profile) return;
    setScreen("valuation");
    if (valuation) return;
    await run(async (c) => {
      const value = await request<Valuation>(
        "valuations",
        { snapshotId: profile.snapshotId, requestId: "value_" + crypto.randomUUID() },
        c.signal,
      );
      if (!c.signal.aborted) setValuation(visibleValuation(value));
    });
  }
  async function generate() {
    if (!profile) return;
    await run(async (c) => {
      setProgress("战报已提交…");
      let value = await request<StatsReport>(
        "reports",
        buildReportRequest({
          snapshotId: profile.snapshotId,
          mode,
          country,
          category,
          style: reportStyle,
          customStyle,
        }),
        c.signal,
      );
      setReport(value);
      let polls = 0;
      while (!["ready", "failed"].includes(value.status) && polls++ < 90) {
        setProgress("正在生成战报…");
        await pause(Math.min(8000, 2500 + polls * 250), c.signal);
        value = await request<StatsReport>("reports/" + value.id, undefined, c.signal);
        if (!c.signal.aborted) setReport(value);
      }
      if (value.status === "failed") throw Error(value.error || "战报生成失败");
      if (value.status !== "ready") throw Error("战报仍在生成，请稍后查看。");
    });
  }
  async function bindGame() {
    if (!profile || !cloud) return;
    await run(async (c) => {
      await account.request(
        "account/game-binding",
        {
          ownerKey: cloud.ownerKey,
          uid: profile.uid,
          confirmedUid,
          snapshotId: profile.snapshotId,
          requestId: "bind_" + crypto.randomUUID(),
        },
        c.signal,
      );
      await reloadCloud();
      await account.refreshProfile();
      setBinding(false);
      setConfirmedUid("");
    });
  }
  const active = profile?.modes.find((m) => m.id === mode);
  const vehicles = (profile?.vehicles || [])
    .filter(
      (v) =>
        v.mode === mode &&
        (country === "all" || v.country === country) &&
        (category === "all" || v.category === category),
    )
    .sort((a, b) => (b.battles || 0) - (a.battles || 0));
  const visibleVehicles = vehicles.slice(0, (page + 1) * 12);
  useEffect(() => {
    const target = more.current;
    if (
      !target ||
      screen !== "profile" ||
      vehicle ||
      !profile ||
      busy ||
      (page + 1) * 12 >= vehicles.length
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setPage((p) => p + 1);
      },
      { root: scroll.current, rootMargin: "160px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [page, vehicles.length, screen, vehicle, profile, busy]);
  const { error: vehicleFactsError, retry: retryVehicleFacts } = useMiniappVehicleFacts([
    ...visibleVehicles.map((unit) => unit.country || ""),
    vehicle?.country || "",
    ...(report?.payload.top5.map((unit) => unit.country || "") || []),
  ]);
  const ownedVehicleIds = useMiniappOwnedVehicles();
  const valuationPage = screen === "valuation" && (
    <DetailPage path="#/stats/valuation" title="账号参考估值" close={() => setScreen("profile")}>
      <h2>车库参考估值</h2>
      <p className="hb-muted">
        {profile?.nickname} · UID {profile?.uid}
      </p>
      <ErrorNote error={error} />
      {busy && !valuation && <output>正在计算车库价值…</output>}
      {valuation && (
        <>
          <div className="hb-value-scenarios">
            {(["normal", "discount", "secondHand"] as const).map((key) => (
              <article key={key}>
                <span>{valuation.scenarios[key].label}</span>
                <strong>{money(valuation.scenarios[key].totalCents)}</strong>
                {valuation.scenarios[key].totalCents === null && (
                  <small>已知部分 {money(valuation.scenarios[key].knownCents)}</small>
                )}
              </article>
            ))}
          </div>
          <dl className="hb-kv">
            <div>
              <dt>常规载具</dt>
              <dd>{num(valuation.researchCount)}</dd>
            </div>
            <div>
              <dt>金币载具</dt>
              <dd>{num(valuation.gold.length)}</dd>
            </div>
            <div>
              <dt>礼包</dt>
              <dd>{num(valuation.packs.length)}</dd>
            </div>
            <div>
              <dt>待核价</dt>
              <dd>{num(valuation.unpriced.length)}</dd>
            </div>
          </dl>
          <MiniappValuationDetails valuation={valuation} />
          <p className="hb-fine">{valuation.ownership?.notice}</p>
          <p className="hb-fine">{valuation.notice}</p>
          <p className="hb-fine">计算于 {date(valuation.calculatedAt)}。参考估值不代表交易价格。</p>
        </>
      )}
      {!busy && !valuation && <button onClick={() => void estimate()}>重新估算</button>}
    </DetailPage>
  );
  const reportPage = screen === "report" && (
    <DetailPage path="#/stats/report" title="个人战报" close={() => setScreen("profile")}>
      <h2>个人战报</h2>
      <p className="hb-muted">
        {profile?.nickname} · {modeNames[mode]}战斗
      </p>
      <label>
        战报风格
        <GameSelect value={reportStyle} onValueChange={(v) => setReportStyle(v as ReportStyle)}>
          {reportStyles.map((style) => (
            <option key={style.id} value={style.id}>
              {style.label}
            </option>
          ))}
        </GameSelect>
      </label>
      <p className="hb-fine">{reportStyleInfo(reportStyle).description}</p>
      {reportStyle === "custom" && (
        <label>
          自定义风格
          <textarea
            maxLength={160}
            value={customStyle}
            onChange={(e) => setCustomStyle(e.target.value)}
            placeholder="只描述语气和分析角度，请勿填写隐私。"
          />
          <small>{customStyle.length}/160</small>
        </label>
      )}
      <p className="hb-fine">使用当前军种、国家与战斗模式筛选。生成会消耗一次战报额度。</p>
      <button
        className="hb-primary"
        onClick={() => void generate()}
        disabled={busy || (reportStyle === "custom" && !customStyle.trim())}
      >
        {" "}
        {busy ? "正在生成…" : report ? "重新生成战报" : "生成战报"}
      </button>
      <ErrorNote error={error} />
      {progress && <output>{progress}</output>}
      {report?.status === "ready" && (
        <button className="hb-primary" onClick={() => setShareReport(true)}>
          保存 / 分享战报
        </button>
      )}
      {report?.status === "ready" && (
        <article className="hb-report">
          <header>
            <span>WAR THUNDER · 战雷工作台</span>
            <h2>{report.review?.title || "作战报告"}</h2>
            <p>
              {report.payload.player.nickname} · UID {report.payload.player.uid}
            </p>
          </header>
          <dl className="hb-kv">
            <div>
              <dt>场次</dt>
              <dd>{num(report.payload.totals.battles)}</dd>
            </div>
            <div>
              <dt>作战效率</dt>
              <dd>{num(report.payload.totals.efficiency)}</dd>
            </div>
            <div>
              <dt>综合 K/D</dt>
              <dd>{ratio(report.payload.totals.kd)}</dd>
            </div>
          </dl>
          <p className="hb-report-speech">{report.review?.speech}</p>
          <h3>主力载具</h3>
          <PlayerVehicleCards
            vehicles={report.payload.top5}
            select={(unit) => {
              setVehicle(unit);
            }}
            showNaval
          />
          <small>数据采集于 {date(report.payload.fetchedAt)}</small>
          <footer className="hb-watermark-reserve" aria-hidden="true" />
        </article>
      )}
    </DetailPage>
  );
  return (
    <section ref={scroll} className="hb-scroll hb-page hb-stats wt-record-page">
      <form
        className="hb-query-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label htmlFor="player-nickname">查找玩家</label>
        <div>
          <input
            id="player-nickname"
            placeholder="完整游戏昵称，含平台后缀"
            minLength={2}
            maxLength={64}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!busy) void search();
              }
            }}
          />
          <button
            type="button"
            className="hb-primary"
            disabled={busy || nickname.trim().length < 2}
            onClick={() => void search()}
          >
            {busy ? "查询中" : "查询"}
          </button>
        </div>
      </form>
      {recent.length > 0 && !profile && (
        <section className="hb-query-history" aria-label="本地查询记录">
          <header>
            <h2>本地查询记录</h2>
            <button disabled={busy} onClick={() => saveRecent([])}>
              清除记录
            </button>
          </header>
          {recent.map((row) => (
            <button key={row.uid} disabled={busy} onClick={() => void restoreRecord(row)}>
              <span>
                {row.nickname}
                <small>{date(row.fetchedAt)}</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </section>
      )}
      <ErrorNote error={historyError} />
      {profile && recent.length > 0 && (
        <button
          onClick={() => {
            setProfile(null);
            setCandidates([]);
          }}
        >
          返回查询记录
        </button>
      )}
      <ErrorNote error={error} />
      {notice && <output>{notice}</output>}
      {busy && (
        <div className="hb-job" aria-live="polite">
          <span>{progress || "正在处理…"}</span>
          <button
            onClick={() => {
              work.current?.abort();
              setBusy(false);
              setProgress("");
            }}
          >
            停止等待
          </button>
        </div>
      )}
      {candidates.length > 0 && (
        <div className="hb-candidates">
          <p className="hb-muted">选择玩家并核对 UID</p>
          {candidates.map((p) => (
            <button key={p.uid} onClick={() => void choose(p)} disabled={busy}>
              {p.avatar && <img src={p.avatar} width="40" height="40" alt="" />}
              <span>
                <b>{p.nickname}</b>
                <small>UID {p.uid}</small>
              </span>
              <span>→</span>
            </button>
          ))}
        </div>
      )}
      {!profile && !candidates.length && !busy && (
        <div className="hb-empty hb-stats-empty">
          <h2>从一次出击开始</h2>
          <p>查询公开战绩，查看作战表现、车库参考估值和个人战报。</p>
          <small>支持游客查询，登录后使用账号权益。</small>
        </div>
      )}
      {profile && (
        <>
          <div className="hb-player-heading">
            {profile.avatar && <img src={profile.avatar} alt="" width="56" height="56" />}
            <div>
              <h2>{profile.nickname}</h2>
              <p>
                UID {profile.uid} · 等级 {num(profile.level)}
              </p>
            </div>
          </div>
          <p className="hb-fine">
            {profile.stale ? "历史资料 · " : profile.cached ? "缓存资料 · " : ""}
            {date(profile.fetchedAt)}
          </p>
          {profile.staleReason && <p className="hb-fine">{profile.staleReason}</p>}
          <div className="hb-profile-actions">
            <button disabled={busy} onClick={() => void refresh()}>
              强制刷新
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setScreen("report");
                setError("");
              }}
            >
              生成战报
            </button>
            <button disabled={busy} onClick={() => void estimate()}>
              账号估值
            </button>
          </div>
          {view.status === "authenticated" && cloud && !cloud.binding && (
            <button className="hb-link-game" onClick={() => setBinding(true)}>
              关联为我的游戏账号 →
            </button>
          )}
          <div className="hb-segment hb-mode-tabs">
            {Object.entries(modeNames).map(([id, name]) => (
              <button
                key={id}
                aria-pressed={mode === id}
                onClick={() => {
                  setMode(id as typeof mode);
                  setPage(0);
                }}
              >
                {name}战斗
              </button>
            ))}
          </div>
          {active && (
            <dl className="hb-stat-grid">
              {[
                ["作战效率", num(active.efficiency)],
                ["场次", num(active.battles)],
                ["胜率", active.winRate == null ? "—" : active.winRate.toFixed(2) + "%"],
                ["综合 K/D", ratio(active.kd)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="hb-stats-filters">
            <GameSelect
              aria-label="载具国家"
              value={country}
              onValueChange={(v) => {
                setCountry(v);
                setPage(0);
              }}
            >
              <option value="all">全部国家</option>
              {Object.entries(catalog.countries).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </GameSelect>
            <GameSelect
              aria-label="载具军种"
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(0);
              }}
            >
              <option value="all">全部军种</option>
              {Object.entries(catalog.categories).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </GameSelect>
          </div>
          <ErrorNote error={vehicleFactsError} />
          {vehicleFactsError && <button onClick={retryVehicleFacts}>重新载入载具资料</button>}
          <PlayerVehicleCards
            generate={setShareVehicle}
            vehicles={visibleVehicles}
            select={setVehicle}
            showNaval
            noRecords={
              new Set(visibleVehicles.filter((unit) => unit.battles === 0).map((unit) => unit.id))
            }
          />
          {!vehicles.length && <p className="hb-muted">暂无符合筛选的出击记录。</p>}
          <div ref={more} className="hb-load-more" aria-live="polite">
            <small>
              已显示 {visibleVehicles.length} / {vehicles.length} 辆
            </small>
            {visibleVehicles.length < vehicles.length && (
              <button onClick={() => setPage((p) => p + 1)}>加载更多载具</button>
            )}
          </div>
        </>
      )}
      <MainSiteLink />
      {valuationPage}
      {reportPage}
      {vehicle && (
        <DetailPage
          path={"#/stats/vehicle/" + encodeURIComponent(vehicle.id)}
          title={vehicle.name}
          close={() => setVehicle(null)}
        >
          <button className="hb-primary" onClick={() => setShareVehicle(vehicle)}>
            生成载具成就 / 分享战报
          </button>
          <VehiclePresentation
            unit={vehicle}
            country={vehicle.country}
            category={vehicle.category}
            mode={mode}
            owned={cloud?.binding?.uid === profile?.uid && ownedVehicleIds.has(vehicle.id)}
          />
          <dl className="hb-kv">
            {[
              ["场次", num(vehicle.battles)],
              ["作战效率", num(vehicle.efficiency)],
              ["胜率", vehicle.winRate == null ? "—" : vehicle.winRate.toFixed(2) + "%"],
              ["综合 K/D", ratio(vehicle.kd)],
              ["对空 K/D", ratio(vehicle.airKd)],
              ["对地 K/D", ratio(vehicle.groundKd)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </DetailPage>
      )}
      {shareVehicle && profile && (
        <AchievementShare
          profile={profile}
          vehicle={shareVehicle}
          close={() => setShareVehicle(null)}
        />
      )}
      {shareReport && profile && report?.status === "ready" && (
        <AchievementShare profile={profile} report={report} close={() => setShareReport(false)} />
      )}
      {binding && profile && (
        <DetailPage path="#/stats/link-game" title="关联游戏账号" close={() => setBinding(false)}>
          <h3>{profile.nickname}</h3>
          <p>
            请勿关联他人的游戏账号，否则会影响当前账号的研发计算。本操作仅用于防止误绑，不代表官方身份认证。
          </p>
          <label>
            重新输入此玩家 UID
            <input
              inputMode="numeric"
              placeholder={profile.uid}
              value={confirmedUid}
              onChange={(e) => setConfirmedUid(e.target.value)}
            />
          </label>
          <ErrorNote error={error} />
          <button
            className="hb-primary"
            disabled={confirmedUid !== profile.uid || busy}
            onClick={() => void bindGame()}
          >
            确认关联
          </button>
        </DetailPage>
      )}
    </section>
  );
}
function date(s: string) {
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}
function money(cents: number | null | undefined) {
  if (cents == null || !Number.isSafeInteger(cents)) return "待核价";
  const v = BigInt(cents);
  return `¥ ${(v / 100n).toLocaleString("zh-CN")}.${(v % 100n).toString().padStart(2, "0")}`;
}
