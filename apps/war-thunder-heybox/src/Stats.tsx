import { useEffect, useRef, useState } from "react";
import type {
  PlayerCandidate,
  PlayerProfile,
  StatsReport,
  PlayerVehicle,
} from "../../../src/player-stats-api";
import type { Valuation } from "../../../src/AccountValuation";
import { GameSelect } from "../../../src/components/GameSelect";
import { request, query, pause, account } from "./runtime";
import { useRuntime } from "./context";
import { Sheet, ErrorNote, num, ratio } from "./ui";
import catalog from "../../../src/generated/bootstrap.json";
const modeNames = { ab: "街机", rb: "历史", sb: "全真" };
export default function Stats({ boundRequest }: { boundRequest: number }) {
  const { view, cloud, reloadCloud } = useRuntime();
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
    [reportStyle, setReportStyle] = useState("commander");
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
    setProfile(value);
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
      if (!c.signal.aborted) setValuation(value);
    });
  }
  async function generate() {
    if (!profile) return;
    await run(async (c) => {
      setProgress("战报已提交…");
      let value = await request<StatsReport>(
        "reports",
        {
          snapshotId: profile.snapshotId,
          mode,
          country,
          category,
          style: reportStyle,
          customStyle: "",
          requestId: "report_" + crypto.randomUUID(),
        },
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
  if (screen === "valuation")
    return (
      <section className="hb-scroll hb-page">
        <button className="hb-back" onClick={() => setScreen("profile")}>
          ← 返回战绩
        </button>
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
            <p className="hb-fine">{valuation.ownership?.notice}</p>
            <p className="hb-fine">{valuation.notice}</p>
            <p className="hb-fine">
              计算于 {date(valuation.calculatedAt)}。参考估值不代表交易价格。
            </p>
          </>
        )}
        {!busy && !valuation && <button onClick={() => void estimate()}>重新估算</button>}
      </section>
    );
  if (screen === "report")
    return (
      <section className="hb-scroll hb-page">
        <button className="hb-back" onClick={() => setScreen("profile")}>
          ← 返回战绩
        </button>
        <h2>个人战报</h2>
        <p className="hb-muted">
          {profile?.nickname} · {modeNames[mode]}战斗
        </p>
        <label>
          战报风格
          <GameSelect value={reportStyle} onValueChange={setReportStyle}>
            <option value="commander">指挥官点评</option>
            <option value="analysis">战术分析</option>
            <option value="roast">友好吐槽</option>
          </GameSelect>
        </label>
        <p className="hb-fine">使用当前军种、国家与战斗模式筛选。生成会消耗一次战报额度。</p>
        <button className="hb-primary" onClick={() => void generate()} disabled={busy}>
          {" "}
          {busy ? "正在生成…" : report ? "重新生成战报" : "生成战报"}
        </button>
        <ErrorNote error={error} />
        {progress && <output>{progress}</output>}
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
            {report.payload.top5.map((v) => (
              <div className="hb-route-row" key={v.id}>
                <span>{v.name}</span>
                <b>{num(v.battles)} 场</b>
              </div>
            ))}
            <small>数据采集于 {date(report.payload.fetchedAt)}</small>
            <footer className="hb-watermark-reserve" aria-hidden="true" />
          </article>
        )}
      </section>
    );
  return (
    <section className="hb-scroll hb-page">
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
            maxLength={100}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button className="hb-primary" disabled={busy || nickname.trim().length < 2}>
            查询
          </button>
        </div>
      </form>
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
          <div className="hb-vehicle-stats">
            {vehicles.slice(page * 12, (page + 1) * 12).map((v) => (
              <button
                key={v.id}
                className="hb-stat-vehicle"
                aria-label={`查看${v.name}的出击记录`}
                onClick={() => setVehicle(v)}
              >
                <div>
                  <h3>{v.name}</h3>
                  <small>{v.rank ? `Rank ${v.rank}` : "等级待匹配"}</small>
                </div>
                <img src={v.thumbnail || v.image} alt="" loading="lazy" />
                <div className="hb-stat-vehicle-bottom">
                  <span>
                    作战效率 <b>{num(v.efficiency)}</b>
                  </span>
                  <small>
                    {num(v.battles)} 场 · K/D {ratio(v.kd)}
                  </small>
                </div>
              </button>
            ))}
          </div>
          {!vehicles.length && <p className="hb-muted">暂无符合筛选的出击记录。</p>}
          {vehicles.length > 12 && (
            <div className="hb-pagination">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                上一页
              </button>
              <span>
                {page + 1} / {Math.ceil(vehicles.length / 12)}
              </span>
              <button
                disabled={(page + 1) * 12 >= vehicles.length}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
      {vehicle && (
        <Sheet title={vehicle.name} close={() => setVehicle(null)}>
          <img className="hb-detail-art" src={vehicle.image} alt="" />
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
        </Sheet>
      )}
      {binding && profile && (
        <Sheet title="关联游戏账号" close={() => setBinding(false)}>
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
        </Sheet>
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
