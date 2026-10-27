import { useLocale } from "./i18n/react";
import { t, localize, getLocale } from "./i18n/core";
import { GameTip } from "./components/GameTip";
import { useState } from "react";
import { GameTabs } from "./components/GameTabs";
import { PlayerReadStatus } from "./PlayerReadStatus";
import { GameSelect } from "./components/GameSelect";
import { CountryOwnership } from "./CountryOwnership";
import { PlayerRadar } from "./PlayerRadar";
import {
  statsNumber as num,
  statsRatio as ratio,
  statsBranchKd,
  statsArmyIcon,
  statsBranchTarget,
} from "./player-stats-api";
import type { PlayerMode, PlayerProfile } from "./player-stats-api";
import { battleScopes, rankingValue, usePlayerRead } from "./player-rankings-api";
import type { PlayerDetails } from "./player-rankings-api";

export function PlayerCareerOverview({
  profile,
  mode,
  base,
  active,
  armyBase = "",
}: {
  profile: PlayerProfile;
  mode: string;
  base?: PlayerMode;
  active: boolean;
  armyBase?: string;
}) {
  useLocale();

  const read = usePlayerRead<PlayerDetails>(profile, "details", active);
  const [branch, setBranch] = useState("combined"),
    [period, setPeriod] = useState<"career" | "recent">("career");
  const selectedBranch = mode === "sb" && branch === "naval" ? "combined" : branch;
  const scope = read.data?.scopes.find((s) => s.mode === mode && s.branch === selectedBranch);
  const selected = scope?.periods[period];
  const counters =
    selected?.counters || (period === "career" && selectedBranch === "combined" ? base : null);
  const career = scope?.periods.career,
    recent = scope?.periods.recent;
  if (!active) return null;
  return (
    <div className="wt-career-overview">
      <div className="wt-career-toolbar">
        <div className="wt-career-scope-field">
          <span>
            {t("对局统计")}
            <GameTip label={t("对局统计")}>
              {localize(scope?.label || t("综合 PVP"))} ·{localize(" ")}
              {localize(period === "career" ? t("累计统计") : t("官方近期口径，非逐场记录"))}
              {t("· 对空／对地 K/D 均使用所选范围的死亡数。")}
              {localize(selectedBranch === "ground" && t("陆战对局包含其中的飞机出击。"))}
            </GameTip>
          </span>
          <GameSelect
            aria-label={t("生涯对局统计范围")}
            value={selectedBranch}
            onValueChange={setBranch}
          >
            {localize(
              Object.entries(battleScopes).map(([id, label]) => (
                <option key={id} value={id} disabled={mode === "sb" && id === "naval"}>
                  {localize(label)}
                </option>
              )),
            )}
          </GameSelect>
        </div>
        <GameTabs
          id="career-period"
          panelId="career-statistics"
          className="wt-career-period"
          label={t("生涯统计时期")}
          value={period}
          onValueChange={setPeriod}
          items={[
            { value: "career", label: t("累计") },
            { value: "recent", label: t("官方近期") },
          ]}
        />
        <PlayerReadStatus read={read} label={t("扩展统计")} localOnly={profile.localOnly} />
      </div>
      <div id="career-statistics" role="tabpanel" aria-labelledby={`career-period-${period}-tab`}>
        {localize(
          !counters ? (
            <p className="wt-record-empty">
              {localize(
                read.busy
                  ? t("正在读取所选范围…")
                  : t("此范围暂无有效统计，其他生涯资料仍可查看。"),
              )}
            </p>
          ) : (
            <>
              <div className="wt-record-metrics wt-career-metrics">
                {localize(
                  [
                    [t("战斗场次"), num(counters.battles)],
                    [t("胜率"), counters.winRate == null ? "—" : counters.winRate.toFixed(2) + "%"],
                    [t("工作台效率"), num(counters.efficiency)],
                    [t("对地 K/D"), ratio(counters.groundKd)],
                    [t("对空 K/D"), ratio(counters.airKd)],
                    [
                      t("平均得分"),
                      rankingValue(selected?.metrics.averageScore?.value, "averageScore"),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{localize(label)}</span>
                      <strong>{localize(value)}</strong>
                      {localize(
                        label === t("工作台效率") && counters.smallSample && (
                          <small>{t("有效场次不足 50")}</small>
                        ),
                      )}
                    </div>
                  )),
                )}
              </div>
            </>
          ),
        )}
        <div className="wt-career-dashboard">
          <div className="wt-career-performance">
            {localize(counters?.radar && <PlayerRadar axes={counters.radar} />)}
            {localize(
              base && base.branches.length > 0 && (
                <section className="wt-record-panel wt-record-branch-panel">
                  <div className="wt-record-heading">
                    <h2>
                      {t("载具分类 K/D")}
                      <GameTip label={t("载具分类 K/D")}>
                        {t("仅以对应军种单车的击毁、死亡汇总；与上方按对局类型统计的范围不同。")}
                      </GameTip>
                    </h2>
                    <span>{t("当前模式 · 累计单车记录")}</span>
                  </div>
                  <div className="wt-record-branch-grid">
                    {localize(
                      base.branches.map((b) => (
                        <div key={b.id}>
                          <div className="wt-record-branch-summary">
                            <h3>
                              <img
                                className="wt-branch-icon"
                                src={statsArmyIcon(armyBase, b.id)}
                                alt=""
                              />
                              {localize(b.label)}
                            </h3>
                            <strong>{localize(ratio(statsBranchKd(b)))}</strong>
                          </div>
                          <small>
                            {localize(statsBranchTarget(b.id))} K/D · {localize(b.vehicleCount)}
                            {t("辆已出击")}
                          </small>
                        </div>
                      )),
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
          <div className="wt-career-collection">
            <CountryOwnership key={profile.snapshotId} profile={profile} />
            <section className="wt-record-panel wt-career-comparison">
              <div className="wt-record-heading">
                <h2>
                  {t("近期与生涯")}
                  <GameTip label={t("近期与生涯")}>
                    {t("差异仅与自身生涯均值比较，不代表连续涨跌或最近几局结果。")}
                    {localize(
                      career && recent && (
                        <p>
                          {t("累计")}
                          {localize(num(career.counters.battles))}
                          {t("场 · 近期")}
                          {localize(num(recent.counters.battles))}
                          {localize(" ")}
                          {t("场。")}
                        </p>
                      ),
                    )}
                    {localize(
                      read.data?.registeredAt && (
                        <p>
                          {t("注册于")}
                          {localize(
                            new Date(read.data.registeredAt * 1000).toLocaleDateString(getLocale()),
                          )}
                        </p>
                      ),
                    )}
                  </GameTip>
                </h2>
                <span>{localize(scope?.label || t("同一统计范围"))}</span>
              </div>
              {localize(
                career && recent ? (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th>{t("指标")}</th>
                          <th>{t("生涯累计")}</th>
                          <th>{t("官方近期")}</th>
                          <th>{t("差异")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {localize(
                          [
                            "victories_battles",
                            "averageScore",
                            "averageRelativePosition",
                            "average_active_kills_by_spawn",
                          ].map((key) => {
                            const a = career.metrics[key]?.value,
                              b = recent.metrics[key]?.value;
                            if (a == null && b == null) return null;
                            const delta = a != null && b != null ? b - a : null;
                            const percent =
                              key === "victories_battles" || key === "averageRelativePosition";
                            const labels: Record<string, string> = {
                              victories_battles: t("胜率"),
                              averageScore: t("平均得分"),
                              averageRelativePosition: t("队内相对位置"),
                              average_active_kills_by_spawn: t("击毁／出击"),
                            };
                            return (
                              <tr key={key}>
                                <th>{localize(labels[key])}</th>
                                <td>{localize(rankingValue(a, key))}</td>
                                <td>{localize(rankingValue(b, key))}</td>
                                <td
                                  className={
                                    delta == null || delta === 0
                                      ? ""
                                      : delta > 0
                                        ? "wt-career-up"
                                        : "wt-career-down"
                                  }
                                >
                                  {localize(
                                    delta == null
                                      ? "—"
                                      : `${delta > 0 ? "+" : ""}${(delta * (percent ? 100 : 1)).toFixed(2)}${percent ? t("个百分点") : ""}`,
                                  )}
                                </td>
                              </tr>
                            );
                          }),
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="wt-record-fine">
                    {localize(
                      read.busy ? t("正在补充近期统计…") : t("当前范围缺少可比较的近期数据。"),
                    )}
                  </p>
                ),
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
