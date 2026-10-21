import type { CSSProperties } from "react";
import { reportStyle } from "./player-report-style";
import type { Background, StatsReport } from "./player-stats-api";
import {
  statsNumber as n,
  statsSilver,
  statsSilverIcon,
  statsRatio as r,
  statsModeNames,
  statsDate,
  statsArmyIcon,
  statsBranchKd,
  statsBranchTarget,
  statsReportScopeLabel,
} from "./player-stats-api";
import { reportChartData, reportSummary, reportEfficiencyMaximum } from "./player-report-design";
import type { ReportTheme } from "./player-report-design";
export function PlayerReport({
  report,
  background,
  armyBase,
  theme,
}: {
  report: StatsReport;
  background: Background | undefined;
  armyBase: string;
  theme: ReportTheme;
}) {
  const p = report.payload,
    chart = reportChartData(p),
    colors = [theme.accent, theme.secondary, theme.tertiary],
    efficiencyMaximum = reportEfficiencyMaximum(p);
  const branches = p.career?.branches || p.branches;
  const voice = reportStyle(p.analysis?.style);
  return (
    <article
      className="wt-report-poster"
      style={
        {
          ...Object.fromEntries(
            Object.entries(theme).map(([key, value]) => ["--wt-report-" + key, value]),
          ),
          "--wt-report-bg": background ? 'url("' + background.source + '")' : undefined,
        } as CSSProperties
      }
    >
      <div className="wt-report-screen-watermark" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i}>mrtreasure.cc</span>
        ))}
      </div>
      <div className="wt-poster-top">
        <img src="https://warthunder.com/assets/img/svg/logo-wt.svg" alt="War Thunder" />
        <span>
          {statsModeNames[p.mode]} · {voice.label}
        </span>
      </div>
      <div className="wt-poster-eyebrow">{voice.kicker}</div>
      <h2 className="wt-poster-headline">{report.review?.title || "你的战地记录"}</h2>
      <header className="wt-poster-identity">
        <span className="wt-player-avatar">
          <span aria-hidden="true">{Array.from(p.player.nickname)[0]}</span>
          {p.player.avatar && (
            <img
              src={p.player.avatar}
              alt={p.player.nickname + "的游戏头像"}
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
        </span>
        <div>
          <h3>{p.player.nickname}</h3>
          <span>
            等级 {n(p.player.level)}
            {p.player.clanTag ? " · " + p.player.clanTag : ""}
          </span>
        </div>
      </header>
      <div className="wt-poster-section-title">
        <h3>{p.career ? "生涯总览" : "所列载具汇总"}</h3>
        <span>{p.career ? "该模式 · 全部国家与兵种" : "含同场多车，不代表总对局"}</span>
      </div>
      <div className="wt-poster-summary">
        {reportSummary(p).map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="wt-poster-branch-strip">
        {branches.map((b) => (
          <span key={b.id}>
            <img src={statsArmyIcon(armyBase, b.id)} alt="" />
            {b.label}
            {statsBranchTarget(b.id)} K/D <b>{r(statsBranchKd(b))}</b>
          </span>
        ))}
      </div>
      <section className="wt-poster-charts" aria-label="所列载具统计图">
        <figure className="wt-efficiency-chart">
          <figcaption>
            载具效率评分 <span>0–{efficiencyMaximum}</span>
          </figcaption>
          <ol className="wt-efficiency-bars">
            {chart.values.map((v) => (
              <li key={v.id} title={v.label}>
                <span className="wt-chart-vehicle-name">{v.label}</span>
                <span className="wt-chart-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${(100 * Math.max(0, Math.min(efficiencyMaximum, v.value || 0))) / efficiencyMaximum}%`,
                    }}
                  />
                </span>
                <b>{n(v.value)}</b>
              </li>
            ))}
          </ol>
        </figure>
        <figure className="wt-kills-chart">
          <figcaption>
            载具击毁构成{" "}
            <span>
              <b>{chart.hasKnown ? n(chart.total) : "—"}</b> 已知击毁
            </span>
          </figcaption>
          <div className="wt-kills-composition" aria-hidden="true">
            {chart.total > 0 &&
              chart.segments.map((seg, i) => (
                <i
                  key={seg.key}
                  style={{
                    width: `${((seg.value || 0) / chart.total) * 100}%`,
                    backgroundColor: colors[i],
                  }}
                />
              ))}
          </div>
          <ul className="wt-chart-legend">
            {chart.segments.map((v, i) => (
              <li key={v.key}>
                <i style={{ backgroundColor: colors[i] }} />
                <span>{v.label}</span>
                <b>{n(v.value)}</b>
              </li>
            ))}
          </ul>
        </figure>
        <table className="sr-only">
          <caption>图表对应数值：所列载具效率评分与已返回的目标击毁构成</caption>
          <thead>
            <tr>
              <th scope="col">项目</th>
              <th scope="col">数值</th>
            </tr>
          </thead>
          <tbody>
            {chart.values.map((v) => (
              <tr key={v.id}>
                <th scope="row">{v.label}效率评分</th>
                <td>{n(v.value)}</td>
              </tr>
            ))}
            {chart.segments.map((v) => (
              <tr key={v.key}>
                <th scope="row">{v.label}击毁</th>
                <td>{n(v.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="wt-poster-section-title">
        <h3>常用载具 · TOP {p.top5.length}</h3>
        <span>{statsReportScopeLabel(p)}</span>
      </div>
      {p.top5.map((v, i) => (
        <section className="wt-poster-vehicle" key={v.id}>
          <span className="wt-poster-place">{String(i + 1).padStart(2, "0")}</span>
          <img src={v.image} alt={v.name} loading="lazy" />
          <div className="wt-poster-vehicle-info">
            <div className="wt-poster-vehicle-title">
              <h3>{v.name}</h3>
              <span>
                <b>{n(v.efficiency)}</b> 效率{v.smallSample ? " · 场次不足" : ""}
              </span>
            </div>
            <div className="wt-poster-vehicle-values">
              <span>
                <b>{n(v.battles)}</b> 场
              </span>
              <span>
                <b>{v.winRate == null ? "—" : v.winRate.toFixed(2) + "%"}</b> 胜率
              </span>
              <span>
                对空 <b>{r(v.airKd)}</b>
              </span>
              <span>
                对地 <b>{r(v.groundKd)}</b>
              </span>
              {v.category !== "ground" &&
                (v.navalKd != null || v.category === "ships" || v.category === "boats") && (
                  <span>
                    对海 <b>{r(v.navalKd)}</b>
                  </span>
                )}
              <span className="wt-poster-silver" title="累计获得银狮，非净收入">
                <span className="wt-silver-amount">
                  <img src={statsSilverIcon} alt="累计银狮" />
                  <b>{statsSilver(v.silverLions)}</b>
                </span>
              </span>
            </div>
          </div>
        </section>
      ))}
      <section className="wt-poster-speech">
        <span>{voice.sectionTitle}</span>
        <p>{report.review?.speech}</p>
        <small>{voice.signoff}</small>
      </section>
      <footer className="wt-poster-bottom">
        <span>资料采集 {statsDate(p.fetchedAt)}</span>
        <span>效率按公开公式计算 · 构成图仅含所列载具的已知击毁 · 单车对空/地/海数字为 K/D</span>
        <span>银狮为累计获得，非余额或净收入 · AI 点评仅供参考</span>
      </footer>
    </article>
  );
}
