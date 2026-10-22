import { useEffect, useId, useRef, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { statsDate, statsNumber as num } from "./player-stats-api";
import type { PlayerProfile } from "./player-stats-api";
import {
  battleScopes, rankingIndicators, rankingValue, usePlayerRead,
} from "./player-rankings-api";
import type { PlayerRank, RankPoint } from "./player-rankings-api";

export function RankDistribution({ data, metric }: { data: PlayerRank; metric: string }) {
  const title = useId();
  const points = data.references?.points || data.points || [];
  const position = data.position ? Math.max(0, Math.min(100, 100 - data.position.topPercent)) : null;
  const values = points.map(p => p.value).concat(data.value == null ? [] : [data.value]);
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const spread = maximum - minimum || Math.max(1, maximum * .1);
  const y = (value: number) => 164 - ((value - minimum) / spread) * 120;
  const x = (percentile: number) => 46 + percentile * 4.78;
  const median = points.find(p => p.percentile === 50);
  return (
    <section className="wt-record-panel wt-rank-distribution">
      <div className="wt-record-heading"><h2>你在什么位置</h2><span>{data.sampleCount != null ? "本站样本" : "官方榜表"}</span></div>
      {position != null ? (
        <>
          <div className="wt-rank-position-label"><strong>前 {data.position!.topPercent.toFixed(2)}%</strong><span>按当前榜内名次折算</span></div>
          {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- This data position diagram has the same numeric value immediately above. */}
          <div className="wt-rank-position" role="img" aria-label={`当前榜内前 ${data.position!.topPercent.toFixed(2)}%`}>
            <div className="wt-rank-position-track" />
            {[0, 25, 50, 75, 100].map(v => <i key={v} style={{ left: `${v}%` }} />)}
            <b style={{ left: `${position}%` }} title="本人位置" />
          </div>
          <div className="wt-rank-scale"><span>较低</span><span>中间位置</span><span>较高</span></div>
        </>
      ) : <p className="wt-record-fine">{data.period === "recent" ? "近期榜仅展示官方名次，暂不换算活跃玩家百分位。" : `有效样本达到 ${data.minimumPlayers || 100} 位后展示本人分位。`}</p>}
      {points.length >= 2 ? (
        <>
          {/* An SVG data chart with an equivalent numeric table below. */}
          {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
          <svg viewBox="0 0 570 210" role="img" aria-labelledby={title}>
            <title id={title}>分位参考曲线，点之间仅作近似连接，具体数值见下方表格</title>
            {[0, .5, 1].map(v => <line key={v} x1="46" x2="524" y1={44 + v * 120} y2={44 + v * 120} className="wt-rank-grid" />)}
            <polyline points={points.map(p => `${x(p.percentile)},${y(p.value)}`).join(" ")} className="wt-rank-curve" />
            {points.map(p => <g key={p.percentile}><circle cx={x(p.percentile)} cy={y(p.value)} r="4" className="wt-rank-reference-dot" /><text x={x(p.percentile)} y="193" textAnchor="middle">P{p.percentile}</text></g>)}
            {position != null && data.value != null && <g><line x1={x(position)} x2={x(position)} y1="32" y2="169" className="wt-rank-marker-line" /><circle cx={x(position)} cy={y(data.value)} r="6" className="wt-rank-player-dot" /><text x={Math.min(488, Math.max(72, x(position)))} y="24" textAnchor="middle">本人 {rankingValue(data.value, metric)}</text></g>}
          </svg>
          <div className="wt-rank-reference-summary"><span>中位数 <b>{rankingValue(median?.value, metric)}</b></span><span>本人 <b>{rankingValue(data.value, metric)}</b></span></div>
          <details className="wt-rank-reference-table"><summary>查看分位参考数值</summary><table><thead><tr><th>参考分位</th><th>指标数值</th></tr></thead><tbody>{points.map((p: RankPoint) => <tr key={p.percentile}><td>P{p.percentile}</td><td>{rankingValue(p.value, metric)}</td></tr>)}</tbody></table></details>
          <p className="wt-record-fine">P50 为中位数。曲线由有限分位点连接，不是完整人数分布；同分名次可能并列。</p>
        </>
      ) : <p className="wt-rank-reference-state">{data.referenceState === "pending" || data.referenceState === "running" ? "正在整理共享分位参考，个人名次已可查看…" : data.period === "recent" ? "近期有效参照人数尚未核实。" : data.sampleCount != null ? "样本积累中；不会用模拟数据补齐曲线。" : "分位参考暂未就绪，当前名次不受影响。"}</p>}
    </section>
  );
}

export function PlayerRankings({ profile, mode, active }: { profile: PlayerProfile; mode: string; active: boolean }) {
  const [source, setSource] = useState("official"), [branch, setBranch] = useState("ground");
  const [period, setPeriod] = useState("career"), [indicator, setIndicator] = useState("averageScore");
  const [sampleMetric, setSampleMetric] = useState("efficiency"), [unit, setUnit] = useState("");
  const [search, setSearch] = useState("");
  const vehicles = profile.vehicles.filter(v => v.mode === mode).sort((a, b) => (b.battles || 0) - (a.battles || 0));
  const selectedUnit = vehicles.some(v => v.id === unit) ? unit : vehicles[0]?.id || "";
  const scope = mode === "sb" && branch === "naval" ? "ground" : branch;
  const metric = source === "official" ? indicator : sampleMetric;
  const official = source === "official";
  const path = official
    ? `rankings?${new URLSearchParams({ mode, branch: scope === "vehicle" ? "ground" : scope, period, metric: indicator })}`
    : `distribution?${new URLSearchParams({ mode, scope, unit: scope === "vehicle" ? selectedUnit : "", metric: sampleMetric })}`;
  const read = usePlayerRead<PlayerRank>(profile, path, active, official ? 7200 : 900);
  const polling = useRef({ path: "", count: 0 });
  const { data, retry } = read;
  useEffect(() => {
    if (polling.current.path !== path) polling.current = { path, count: 0 };
    if (!active || !data || !["pending", "running"].includes(data.referenceState || "") || polling.current.count >= 6) return;
    const timer = setTimeout(() => { polling.current.count++; retry(); }, 12000);
    return () => clearTimeout(timer);
  }, [active, data, path, retry]);
  if (!active) return null;
  const label = official ? rankingIndicators[indicator as keyof typeof rankingIndicators].label : sampleMetric === "efficiency" ? "工作台效率" : "综合 K/D";
  return (
    <div className="wt-rankings" aria-label="排位数据">
      <div className="wt-rank-intro"><div><h2>排位数据</h2><p>选择一项数据，查看你的名次和所处区间。</p></div><span>{official ? "官方榜内位置" : "本站已收录玩家"}</span></div>
      <div className="wt-rank-toolbar">
        <label>数据来源<GameSelect value={source} onValueChange={v => { setSource(v); if (v === "official" && branch === "vehicle") setBranch("ground"); }}><option value="official">官方排位</option><option value="workbench">本站排位</option></GameSelect></label>
        <label>统计范围<GameSelect value={scope} onValueChange={v => { setBranch(v); if (v === "combined" && indicator === "average_active_kills_by_spawn") setIndicator("averageScore"); }}>{Object.entries(battleScopes).map(([id, name]) => <option key={id} value={id} disabled={id === "naval" && mode === "sb"}>{name}</option>)}{!official && <option value="vehicle">同一载具</option>}</GameSelect></label>
        <label>对比指标<GameSelect value={metric} onValueChange={official ? setIndicator : setSampleMetric}>{official ? Object.entries(rankingIndicators).map(([id, m]) => <option key={id} value={id} disabled={scope === "combined" && id === "average_active_kills_by_spawn"}>{m.label}</option>) : <><option value="efficiency">工作台效率</option><option value="kd">综合 K/D</option></>}</GameSelect></label>
        {official && <label>统计时期<GameSelect value={period} onValueChange={setPeriod}><option value="career">累计</option><option value="recent">官方近期</option></GameSelect></label>}
      </div>
      {!official && scope === "vehicle" && <div className="wt-rank-unit-picker"><input type="search" placeholder="搜索已出击载具" aria-label="搜索同车排位载具" value={search} onChange={e => setSearch(e.target.value)} /><GameSelect aria-label="同车排位载具" value={selectedUnit} onValueChange={setUnit}><option value={selectedUnit}>{vehicles.find(v => v.id === selectedUnit)?.name || "暂无此模式载具"}</option>{vehicles.filter(v => v.id !== selectedUnit && v.name.toLowerCase().includes(search.toLowerCase())).slice(0, 80).map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</GameSelect></div>}
      {read.busy && !data && <output className="wt-rank-loading">正在读取排位数据，生涯战绩仍可切换查看…</output>}
      {read.error && <div className="wt-rank-error" role="alert"><span>{read.error}</span><button onClick={read.retry}>重试</button></div>}
      {data && <>
        <div className="wt-rank-scoreboard">
          <div className="wt-rank-primary"><span>{label}</span><strong>{rankingValue(data.value, metric)}</strong><small>{official ? period === "career" ? "累计表现" : "官方近期表现" : scope === "vehicle" ? vehicles.find(v => v.id === selectedUnit)?.name : "同模式 · 同统计范围"}</small></div>
          <div><span>{official ? "官方名次" : "本站样本名次"}</span><strong>{data.rank == null ? "—" : `#${num(data.rank)}`}</strong><small>{data.rank == null ? "有效样本积累中" : "当前指标"}</small></div>
          <div><span>{official ? "榜表记录数" : "有效样本人数"}</span><strong>{num(official ? data.total : data.sampleCount)}</strong><small>{official ? "不等于全部注册人数" : `每位玩家一份最新成绩 · 至少 ${data.minimumBattles || 50} 场`}</small></div>
        </div>
        <RankDistribution data={data} metric={metric} />
        <div className="wt-rank-source"><span>{data.stale ? "正在展示已保存排位 · " : ""}{data.fetchedAt ? `排位采集于 ${statsDate(data.fetchedAt)}` : "尚无有效采样记录"}</span><span>{data.notice}</span></div>
      </>}
      <p className="wt-record-fine">陆战对局包含其中的飞机出击。平均队内相对位置反映对局表现，不是全服百分位。本站效率使用工作台统一评分。</p>
    </div>
  );
}
