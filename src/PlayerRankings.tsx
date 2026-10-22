import { useEffect, useRef, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { statsDate, statsNumber as num } from "./player-stats-api";
import type { PlayerProfile } from "./player-stats-api";
import {
  battleScopes, rankingIndicators, rankingValue, usePlayerRead,
} from "./player-rankings-api";
import type { PlayerRank } from "./player-rankings-api";

export function RankDistribution({ data, metric }: { data: PlayerRank; metric: string }) {
  const points = [...(data.references?.points || data.points || [])].sort((a, b) => a.percentile - b.percentile);
  const position = data.position ? Math.max(0, Math.min(100, 100 - data.position.topPercent)) : null;
  const maximum = Math.max(1, ...points.map(point => point.value), data.value || 0) * 1.06;
  const median = points.find(point => point.percentile === 50);
  const difference = median && data.value != null ? data.value - median.value : null;
  const differencePercent = difference != null && median && median.value > 0 ? difference / median.value * 100 : null;
  const percentMetric = metric === "victories_battles" || metric === "averageRelativePosition";
  const medianChange = difference == null ? "—" : percentMetric
    ? `${difference > 0 ? "+" : ""}${(difference * 100).toFixed(1)} 个百分点`
    : differencePercent != null ? `${differencePercent > 0 ? "+" : ""}${differencePercent.toFixed(1)}%` : rankingValue(difference, metric);
  return <section className="wt-record-panel wt-rank-distribution">
    <header className="wt-rank-chart-heading"><h2>分位对照</h2><span>{data.sampleCount != null ? "本站有效样本" : "官方榜表抽样"}</span></header>
    {position != null ? <div className="wt-rank-position-block">
      <div className="wt-rank-position-label"><span>名次位置</span><strong>榜内前 {data.position!.topPercent.toFixed(2)}%</strong></div>
      <div className="wt-rank-position" aria-hidden="true"><div className="wt-rank-position-track" />{[0, 25, 50, 75, 100].map(value => <i key={value} style={{ left: `${value}%` }} />)}<b style={{ left: `${position}%` }} /></div>
      <div className="wt-rank-scale"><span>较低</span><span>中位</span><span>较高</span></div>
    </div> : <p className="wt-record-fine">{data.period === "recent" ? "近期仅展示官方名次，不换算活跃玩家百分位。" : `有效样本达到 ${data.minimumPlayers || 100} 位后展示分位。`}</p>}
    {points.length >= 2 ? <>
      <div className="wt-rank-benchmark-layout"><dl className="wt-rank-benchmarks">
        {points.map(point => <div className={point.percentile === 50 ? "wt-rank-benchmark-median" : ""} key={point.percentile}><dt>{point.percentile}% 分位{point.percentile === 50 && <small>中位数</small>}</dt><dd><span aria-hidden="true" className="wt-rank-benchmark-track"><i style={{ width: `${point.value / maximum * 100}%` }} /></span><b>{rankingValue(point.value, metric)}</b></dd></div>)}
        {data.value != null && <div className="wt-rank-benchmark-own"><dt>本人</dt><dd><span aria-hidden="true" className="wt-rank-benchmark-track"><i style={{ width: `${data.value / maximum * 100}%` }} /></span><b>{rankingValue(data.value, metric)}</b></dd></div>}
      </dl><aside className="wt-rank-median-note"><span>相较中位数</span><strong>{medianChange}</strong><p>中位数 {rankingValue(median?.value, metric)}<br />本人 {rankingValue(data.value, metric)}</p></aside></div>
      <p className="wt-record-fine wt-rank-chart-note">分位值按从低到高排列，50% 分位为中位数。参考条取自有限名次抽样，不代表完整人数分布；同分名次可能并列。</p>
    </> : <p className="wt-rank-reference-state">{["pending", "running"].includes(data.referenceState || "") ? "正在整理分位参考，个人名次已可查看。" : data.period === "recent" ? "近期参照人数尚未核实。" : data.sampleCount != null ? "样本正在积累，达到有效人数后开放对照。" : "分位参考暂未就绪，个人名次仍可查看。"}</p>}
  </section>;
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
      <div className="wt-rank-intro"><div><h2>排位数据</h2><p>选择指标，查看名次与同范围玩家的分位对照。</p></div><span>{official ? "官方榜内位置" : "本站已收录玩家"}</span></div>
      <div className="wt-rank-toolbar">
        <label>数据来源<GameSelect value={source} onValueChange={v => { setSource(v); if (v === "official" && branch === "vehicle") setBranch("ground"); }}><option value="official">官方排位</option><option value="workbench">本站排位</option></GameSelect></label>
        <label>统计范围<GameSelect value={scope} onValueChange={v => { setBranch(v); if (v === "combined" && indicator === "average_active_kills_by_spawn") setIndicator("averageScore"); }}>{Object.entries(battleScopes).map(([id, name]) => <option key={id} value={id} disabled={id === "naval" && mode === "sb"}>{name}</option>)}{!official && <option value="vehicle">同一载具</option>}</GameSelect></label>
        <label>对比指标<GameSelect value={metric} onValueChange={official ? setIndicator : setSampleMetric}>{official ? Object.entries(rankingIndicators).map(([id, m]) => <option key={id} value={id} disabled={scope === "combined" && id === "average_active_kills_by_spawn"}>{m.label}</option>) : <><option value="efficiency">工作台效率</option><option value="kd">综合 K/D</option></>}</GameSelect></label>
        {official && <label>统计时期<GameSelect value={period} onValueChange={setPeriod}><option value="career">累计</option><option value="recent">官方近期</option></GameSelect></label>}
      </div>
      {!official && scope === "vehicle" && <div className="wt-rank-unit-picker"><input type="search" placeholder="搜索已出击载具" aria-label="搜索同车排位载具" value={search} onChange={e => setSearch(e.target.value)} /><GameSelect aria-label="同车排位载具" value={selectedUnit} onValueChange={setUnit}><option value={selectedUnit}>{vehicles.find(v => v.id === selectedUnit)?.name || "暂无此模式载具"}</option>{vehicles.filter(v => v.id !== selectedUnit && v.name.toLowerCase().includes(search.toLowerCase())).slice(0, 80).map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</GameSelect></div>}
      {read.busy && !data && <output className="wt-rank-loading">正在读取排位数据，生涯战绩仍可切换查看…</output>}
      {read.error && <div className="wt-rank-error" role="alert"><span>{read.error}</span>{!profile.localOnly && <button onClick={read.retry}>重试</button>}</div>}
      {data && <>
        <div className="wt-rank-scoreboard">
          <div className="wt-rank-primary"><span>{label}</span><strong>{rankingValue(data.value, metric)}</strong><small>{official ? period === "career" ? "累计表现" : "官方近期表现" : scope === "vehicle" ? vehicles.find(v => v.id === selectedUnit)?.name : "同模式 · 同统计范围"}</small></div>
          <div><span>{official ? "官方名次" : "本站样本名次"}</span><strong>{data.rank == null ? "—" : `#${num(data.rank)}`}</strong><small>{data.rank == null ? "有效样本积累中" : "当前指标"}</small></div>
          <div><span>{official ? "榜表记录数" : "有效样本人数"}</span><strong>{num(official ? data.total : data.sampleCount)}</strong><small>{official ? "不等于全部注册人数" : `每位玩家一份最新成绩 · 至少 ${data.minimumBattles || 50} 场`}</small></div>
        </div>
        <div className="wt-rank-analysis-layout"><RankDistribution data={data} metric={metric} /><aside className="wt-record-panel wt-rank-scope-note"><h3>统计范围</h3><dl><div><dt>对局</dt><dd>{scope === "vehicle" ? "同一载具" : battleScopes[scope as keyof typeof battleScopes]}</dd></div><div><dt>模式</dt><dd>{mode.toUpperCase()}</dd></div><div><dt>时期</dt><dd>{official && period === "recent" ? "官方近期" : "累计"}</dd></div><div><dt>来源</dt><dd>{official ? "官方榜表" : "本站有效样本"}</dd></div></dl><p>{official ? "榜表人数仅代表该指标的统计记录，不等于全部注册玩家。" : `每位玩家保留一份最新记录；至少 ${data.minimumBattles || 50} 场进入有效样本。`}</p><p>{metric === "averageRelativePosition" ? "队内相对位置衡量单局队内表现，数值越高通常越靠前。" : metric === "average_active_kills_by_spawn" ? "该项击毁统计包含玩家与机器人，不等于仅对玩家的击毁。" : "所选对局范围与载具分类不同，陆战对局也包含其中的航空出击。"}</p></aside></div>
        <div className="wt-rank-source"><span>{data.stale ? "正在展示已保存排位 · " : ""}{data.fetchedAt ? `排位采集于 ${statsDate(data.fetchedAt)}` : "尚无有效采样记录"}</span><span>{data.notice}</span></div>
      </>}
    </div>
  );
}
