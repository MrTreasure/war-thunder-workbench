import { vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
import { vehicleDisplayName } from "./vehicle-display-name";
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
  const locale = useLocale();

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
      {locale !== "zh-CN" && (
        <p className="wt-source-language-note">
          {t("点评为生成时的原文，不会随界面语言自动翻译。")}
        </p>
      )}
      <div className="wt-report-screen-watermark" aria-hidden="true">
        {localize(Array.from({ length: 24 }, (_, i) => <span key={i}>mrtreasure.cc</span>))}
      </div>
      <div className="wt-poster-top">
        <img src="https://warthunder.com/assets/img/svg/logo-wt.svg" alt="War Thunder" />
        <span>
          {localize(statsModeNames[p.mode])} · {localize(voice.label)}
        </span>
      </div>
      <div className="wt-poster-eyebrow">{localize(voice.kicker)}</div>
      <h2 className="wt-poster-headline">{report.review?.title || t("你的战地记录")}</h2>
      <header className="wt-poster-identity">
        <span className="wt-player-avatar">
          <span aria-hidden="true">{Array.from(p.player.nickname)[0]}</span>
          {p.player.avatar && (
            <img
              src={p.player.avatar}
              alt={localize(p.player.nickname + "的游戏头像")}
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
        </span>
        <div>
          <h3>{p.player.nickname}</h3>
          <span>
            {t("等级")}
            {localize(n(p.player.level))}
            {localize(p.player.clanTag ? " · " + p.player.clanTag : "")}
          </span>
        </div>
      </header>
      <div className="wt-poster-section-title">
        <h3>{localize(p.career ? "生涯总览" : "所列载具汇总")}</h3>
        <span>{localize(p.career ? "该模式 · 全部国家与兵种" : "含同场多车，不代表总对局")}</span>
      </div>
      <div className="wt-poster-summary">
        {localize(
          reportSummary(p).map((item) => (
            <div key={item.label}>
              <strong>{localize(item.value)}</strong>
              <span>{localize(item.label)}</span>
            </div>
          )),
        )}
      </div>
      <div className="wt-poster-branch-strip">
        {localize(
          branches.map((b) => (
            <span key={b.id}>
              <img src={statsArmyIcon(armyBase, b.id)} alt="" />
              {localize(b.label)}
              {localize(statsBranchTarget(b.id))} K/D <b>{localize(r(statsBranchKd(b)))}</b>
            </span>
          )),
        )}
      </div>
      <section className="wt-poster-charts" aria-label={t("所列载具统计图")}>
        <figure className="wt-efficiency-chart">
          <figcaption>
            {t("载具效率评分")}
            <span>0–{localize(efficiencyMaximum)}</span>
          </figcaption>
          <ol className="wt-efficiency-bars">
            {localize(
              chart.values.map((v) => (
                <li key={v.id} title={localize(v.label)}>
                  <span className="wt-chart-vehicle-name">{localize(v.label)}</span>
                  <span className="wt-chart-bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${(100 * Math.max(0, Math.min(efficiencyMaximum, v.value || 0))) / efficiencyMaximum}%`,
                      }}
                    />
                  </span>
                  <b>{localize(n(v.value))}</b>
                </li>
              )),
            )}
          </ol>
        </figure>
        <figure className="wt-kills-chart">
          <figcaption>
            {t("载具击毁构成")}
            {localize(" ")}
            <span>
              <b>{localize(chart.hasKnown ? n(chart.total) : "—")}</b> {t("已知击毁")}
            </span>
          </figcaption>
          <div className="wt-kills-composition" aria-hidden="true">
            {localize(
              chart.total > 0 &&
                chart.segments.map((seg, i) => (
                  <i
                    key={seg.key}
                    style={{
                      width: `${((seg.value || 0) / chart.total) * 100}%`,
                      backgroundColor: colors[i],
                    }}
                  />
                )),
            )}
          </div>
          <ul className="wt-chart-legend">
            {localize(
              chart.segments.map((v, i) => (
                <li key={v.key}>
                  <i style={{ backgroundColor: colors[i] }} />
                  <span>{localize(v.label)}</span>
                  <b>{localize(n(v.value))}</b>
                </li>
              )),
            )}
          </ul>
        </figure>
        <table className="sr-only">
          <caption>{t("图表对应数值：所列载具效率评分与已返回的目标击毁构成")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("项目")}</th>
              <th scope="col">{t("数值")}</th>
            </tr>
          </thead>
          <tbody>
            {localize(
              chart.values.map((v) => (
                <tr key={v.id}>
                  <th scope="row">
                    {localize(v.label)}
                    {t("效率评分")}
                  </th>
                  <td>{localize(n(v.value))}</td>
                </tr>
              )),
            )}
            {localize(
              chart.segments.map((v) => (
                <tr key={v.key}>
                  <th scope="row">
                    {localize(v.label)}
                    {t("击毁")}
                  </th>
                  <td>{localize(n(v.value))}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </section>
      <div className="wt-poster-section-title">
        <h3>
          {t("常用载具 · TOP")}
          {localize(p.top5.length)}
        </h3>
        <span>{localize(statsReportScopeLabel(p))}</span>
      </div>
      {localize(
        p.top5.map((v, i) => (
          <section className="wt-poster-vehicle" key={v.id}>
            <span className="wt-poster-place">{localize(String(i + 1).padStart(2, "0"))}</span>
            <img src={v.image} alt={localize(vehicleDisplayName(vehicleName(v)))} loading="lazy" />
            <div className="wt-poster-vehicle-info">
              <div className="wt-poster-vehicle-title">
                <h3>{localize(vehicleDisplayName(vehicleName(v)))}</h3>
                <span>
                  <b>{localize(n(v.efficiency))}</b> {t("效率")}
                  {localize(v.smallSample ? " · 场次不足" : "")}
                </span>
              </div>
              <div className="wt-poster-vehicle-values">
                <span>
                  <b>{localize(n(v.battles))}</b> {t("场")}
                </span>
                <span>
                  <b>{localize(v.winRate == null ? "—" : v.winRate.toFixed(2) + "%")}</b>{" "}
                  {t("胜率")}
                </span>
                <span>
                  {t("对空")}
                  <b>{localize(r(v.airKd))}</b>
                </span>
                <span>
                  {t("对地")}
                  <b>{localize(r(v.groundKd))}</b>
                </span>
                {localize(
                  v.category !== "ground" &&
                    (v.navalKd != null || v.category === "ships" || v.category === "boats") && (
                      <span>
                        {t("对海")}
                        <b>{localize(r(v.navalKd))}</b>
                      </span>
                    ),
                )}
                <span className="wt-poster-silver" title={t("累计获得银狮，非净收入")}>
                  <span className="wt-silver-amount">
                    <img src={statsSilverIcon} alt={t("累计银狮")} />
                    <b>{localize(statsSilver(v.silverLions))}</b>
                  </span>
                </span>
              </div>
            </div>
          </section>
        )),
      )}
      <section className="wt-poster-speech">
        <span>{localize(voice.sectionTitle)}</span>
        <p>{report.review?.speech}</p>
        <small>{localize(voice.signoff)}</small>
      </section>
      <footer className="wt-poster-bottom">
        <span>
          {t("资料采集")}
          {localize(statsDate(p.fetchedAt))}
        </span>
        {localize(
          p.previousEfficiencyVersion && (
            <span>{t("历史点评保留原文，效率评分已按当前规则更新。")}</span>
          ),
        )}
        <span>
          {t("效率为工作台统计评分 · 构成图仅含所列载具的已知击毁 · 单车对空/地/海数字为 K/D")}
        </span>
        <span>{t("银狮为累计获得，非余额或净收入 · AI 点评仅供参考")}</span>
      </footer>
    </article>
  );
}
