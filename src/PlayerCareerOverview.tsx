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
            对局统计
            <GameTip label="对局统计">
              {scope?.label || "综合 PVP"} ·{" "}
              {period === "career" ? "累计统计" : "官方近期口径，非逐场记录"} · 对空／对地 K/D
              均使用所选范围的死亡数。
              {selectedBranch === "ground" && " 陆战对局包含其中的飞机出击。"}
            </GameTip>
          </span>
          <GameSelect
            aria-label="生涯对局统计范围"
            value={selectedBranch}
            onValueChange={setBranch}
          >
            {Object.entries(battleScopes).map(([id, label]) => (
              <option key={id} value={id} disabled={mode === "sb" && id === "naval"}>
                {label}
              </option>
            ))}
          </GameSelect>
        </div>
        <GameTabs
          id="career-period"
          panelId="career-statistics"
          className="wt-career-period"
          label="生涯统计时期"
          value={period}
          onValueChange={setPeriod}
          items={[
            { value: "career", label: "累计" },
            { value: "recent", label: "官方近期" },
          ]}
        />
        <PlayerReadStatus read={read} label="扩展统计" localOnly={profile.localOnly} />
      </div>
      <div id="career-statistics" role="tabpanel" aria-labelledby={`career-period-${period}-tab`}>
        {!counters ? (
          <p className="wt-record-empty">
            {read.busy ? "正在读取所选范围…" : "此范围暂无有效统计，其他生涯资料仍可查看。"}
          </p>
        ) : (
          <>
            <div className="wt-record-metrics wt-career-metrics">
              {[
                ["战斗场次", num(counters.battles)],
                ["胜率", counters.winRate == null ? "—" : counters.winRate.toFixed(2) + "%"],
                ["工作台效率", num(counters.efficiency)],
                ["对地 K/D", ratio(counters.groundKd)],
                ["对空 K/D", ratio(counters.airKd)],
                ["平均得分", rankingValue(selected?.metrics.averageScore?.value, "averageScore")],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  {label === "工作台效率" && counters.smallSample && <small>有效场次不足 50</small>}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="wt-career-dashboard">
          <div className="wt-career-performance">
            {counters?.radar && <PlayerRadar axes={counters.radar} />}
            {base && base.branches.length > 0 && (
              <section className="wt-record-panel wt-record-branch-panel">
                <div className="wt-record-heading">
                  <h2>
                    载具分类 K/D
                    <GameTip label="载具分类 K/D">
                      仅以对应军种单车的击毁、死亡汇总；与上方按对局类型统计的范围不同。
                    </GameTip>
                  </h2>
                  <span>当前模式 · 累计单车记录</span>
                </div>
                <div className="wt-record-branch-grid">
                  {base.branches.map((b) => (
                    <div key={b.id}>
                      <div className="wt-record-branch-summary">
                        <h3>
                          <img
                            className="wt-branch-icon"
                            src={statsArmyIcon(armyBase, b.id)}
                            alt=""
                          />
                          {b.label}
                        </h3>
                        <strong>{ratio(statsBranchKd(b))}</strong>
                      </div>
                      <small>
                        {statsBranchTarget(b.id)} K/D · {b.vehicleCount} 辆已出击
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
          <div className="wt-career-collection">
            <CountryOwnership key={profile.snapshotId} profile={profile} />
            <section className="wt-record-panel wt-career-comparison">
              <div className="wt-record-heading">
                <h2>
                  近期与生涯
                  <GameTip label="近期与生涯">
                    差异仅与自身生涯均值比较，不代表连续涨跌或最近几局结果。
                    {career && recent && (
                      <p>
                        累计 {num(career.counters.battles)} 场 · 近期 {num(recent.counters.battles)}{" "}
                        场。
                      </p>
                    )}
                    {read.data?.registeredAt && (
                      <p>
                        注册于 {new Date(read.data.registeredAt * 1000).toLocaleDateString("zh-CN")}
                      </p>
                    )}
                  </GameTip>
                </h2>
                <span>{scope?.label || "同一统计范围"}</span>
              </div>
              {career && recent ? (
                <>
                  <table>
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>生涯累计</th>
                        <th>官方近期</th>
                        <th>差异</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
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
                          victories_battles: "胜率",
                          averageScore: "平均得分",
                          averageRelativePosition: "队内相对位置",
                          average_active_kills_by_spawn: "击毁／出击",
                        };
                        return (
                          <tr key={key}>
                            <th>{labels[key]}</th>
                            <td>{rankingValue(a, key)}</td>
                            <td>{rankingValue(b, key)}</td>
                            <td
                              className={
                                delta == null || delta === 0
                                  ? ""
                                  : delta > 0
                                    ? "wt-career-up"
                                    : "wt-career-down"
                              }
                            >
                              {delta == null
                                ? "—"
                                : `${delta > 0 ? "+" : ""}${(delta * (percent ? 100 : 1)).toFixed(2)}${percent ? " 个百分点" : ""}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="wt-record-fine">
                  {read.busy ? "正在补充近期统计…" : "当前范围缺少可比较的近期数据。"}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
