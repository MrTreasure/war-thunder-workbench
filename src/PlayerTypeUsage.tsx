import { useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { statsDate, statsNumber as num } from "./player-stats-api";
import type { PlayerProfile } from "./player-stats-api";
import { usePlayerRead } from "./player-rankings-api";
import type { PlayerDetails } from "./player-rankings-api";

export function PlayerTypeUsage({ profile, mode, active }: { profile: PlayerProfile; mode: string; active: boolean }) {
  const read = usePlayerRead<PlayerDetails>(profile, "details", active);
  const [group, setGroup] = useState("pvp_played"), [expanded, setExpanded] = useState(false);
  const groups = read.data?.usage.filter(value => value.mode === mode) || [];
  const selected = groups.find(value => value.id === group) || groups[0];
  const roles = [...(selected?.roles || [])].sort((a, b) => b.seconds - a.seconds);
  const total = roles.reduce((sum, role) => sum + role.seconds, 0);
  const maximum = Math.max(1, ...roles.map(role => role.seconds));
  const hours = (seconds: number) => (seconds / 3600).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
  const longest = roles[0];
  const hasSorties = roles.some(role => role.sorties != null), hasAir = roles.some(role => role.airKills != null);
  const hasGround = roles.some(role => role.groundKills != null), hasNaval = roles.some(role => (role.navalKills || 0) > 0);
  return <section className="wt-record-panel wt-type-usage">
    <header className="wt-type-heading"><div><h2>载具类型与游玩时长</h2><p>按当前战斗模式，查看各类载具的使用记录。</p></div>
      {groups.length > 0 && <GameSelect aria-label="分类统计玩法" value={selected?.id || "pvp_played"} onValueChange={value => { setGroup(value); setExpanded(false); }}>{groups.map(value => <option value={value.id} key={value.id}>{value.label}</option>)}</GameSelect>}
    </header>
    {read.busy && !read.data && <output className="wt-rank-loading">正在补充分类统计…</output>}
    {read.error && <div className="wt-rank-error" role="alert"><span>{read.error}</span>{!profile.localOnly && <button onClick={read.retry}>重试</button>}</div>}
    {roles.length > 0 ? <>
      <div className="wt-type-summary"><span>已记录时长 <b>{hours(total)} <small>小时</small></b></span><span>常用类型 <b>{longest.label}</b></span><span>玩法场次 <b>{num(selected?.battles)}</b></span><span>胜场 <b>{num(selected?.wins)}</b></span></div>
      <div className="wt-type-table-scroll"><table className="wt-type-table"><thead><tr><th scope="col">载具类型</th><th scope="col">游玩时长</th><th scope="col">时长占比</th>{hasSorties && <th scope="col">出击</th>}{hasAir && <th scope="col">对空击毁</th>}{hasGround && <th scope="col">对地击毁</th>}{hasNaval && <th scope="col">对海击毁</th>}</tr></thead><tbody>{(expanded ? roles : roles.slice(0, 8)).map(role => <tr key={role.id}>
        <th scope="row">{role.label}</th><td aria-label={`${role.label} ${hours(role.seconds)} 小时`}><div className="wt-type-duration"><span>{hours(role.seconds)} <small>小时</small></span><div aria-hidden="true"><i style={{ width: `${role.seconds / maximum * 100}%` }} /></div></div></td>
        <td>{(role.seconds / total * 100).toFixed(1)}%</td>{hasSorties && <td>{num(role.sorties)}</td>}{hasAir && <td>{num(role.airKills)}</td>}{hasGround && <td>{num(role.groundKills)}</td>}{hasNaval && <td>{num(role.navalKills)}</td>}
      </tr>)}</tbody></table></div>
      {roles.length > 8 && <button className="wt-record-link wt-type-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "收起分类" : `展开全部 ${roles.length} 类`}</button>}
    </> : !read.busy && !read.error && <p className="wt-record-fine">此模式暂无已核实的分类游玩记录。</p>}
    <footer className="wt-type-note">分类使用时长不含排队时间；占比以已返回分类的时长合计为基数，玩法场次不可按载具类型相加。未返回的数据记为“—”。{read.data && <span>采集于 {statsDate(read.data.fetchedAt)}</span>}</footer>
  </section>;
}
