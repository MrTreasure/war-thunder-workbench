/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal tables remain keyboard-scrollable. */
import { useState } from "react";
import type { Mode, Vehicle, VehiclePerformanceStage, WikiPerformanceMetric } from "./models";
import { GameTabs } from "./components/GameTabs";
import { ComparisonBars } from "./components/ComparisonBars";
import display from "../data/vehicle-performance-display.json";
import { GameIcon } from "./components/GameIcon";
const stages: { value: VehiclePerformanceStage; label: string; basis: string }[] = [
  { value: "stock", label: "初始", basis: "初始配件 · 基础乘员" },
  { value: "spaded", label: "完全体", basis: "全配件 · 基础乘员" },
  { value: "expert", label: "专家成员组", basis: "全配件 · 满技能专家" },
  { value: "ace", label: "精英成员组", basis: "全配件 · 满技能王牌" },
];
const number = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
function MetricChart({ metric, mode }: { metric: WikiPerformanceMetric; mode: "ab" | "rb" }) {
  const values = metric.modes[mode]!;
  const labels: Record<string, string> = display.labels;
  const known = Object.values(values).filter((value): value is number => value !== null);
  const best =
    known.length && metric.direction
      ? metric.direction === "higher"
        ? Math.max(...known)
        : Math.min(...known)
      : null;
  const delta = best !== null && values.stock !== null ? best - values.stock : null;
  const percent = delta !== null && values.stock ? (delta / Math.abs(values.stock)) * 100 : null;
  const unchanged = known.length === stages.length && new Set(known).size === 1;
  const bestStage = stages.find((stage) => values[stage.value] === best);
  return (
    <figure className="wt-performance-chart">
      <figcaption>
        <div>
          <h4>{labels[metric.id] || metric.label}</h4>
          <span>
            {metric.unit}
            {metric.direction === "lower"
              ? " · 越低越好"
              : metric.direction === "higher"
                ? " · 越高越好"
                : ""}
          </span>
        </div>
        {delta !== null && delta !== 0 ? (
          <span
            className="wt-chart-change"
            title={`相对初始 ${delta > 0 ? "+" : ""}${number(delta)} ${metric.unit}`}
          >
            {percent !== null
              ? `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`
              : `${delta > 0 ? "+" : ""}${number(delta)}`}
            <small>
              {bestStage?.value === "ace"
                ? "精英"
                : bestStage?.value === "expert"
                  ? "专家"
                  : bestStage?.label}
              较初始
            </small>
          </span>
        ) : unchanged ? (
          <span className="wt-chart-same">无变化</span>
        ) : null}
      </figcaption>
      <ComparisonBars
        series={stages.map((stage) => ({
          id: stage.value,
          label: stage.value === "expert" ? "专家" : stage.value === "ace" ? "精英" : stage.label,
          value: values[stage.value],
          basis: metric.sourceBasis[stage.value],
        }))}
        formatValue={number}
      />
      {metric.altitudeM !== null && (
        <p className="wt-chart-context">测定海拔 {number(metric.altitudeM)} m</p>
      )}
    </figure>
  );
}
export function VehiclePerformance({
  unit,
  mode,
  category,
}: {
  unit: Vehicle;
  mode: Mode;
  category: string;
}) {
  const [comparisonMode, setComparisonMode] = useState<"ab" | "rb">(mode === "ab" ? "ab" : "rb");
  const data = unit.wikiDetails?.performance;
  const metrics = (data?.metrics || []).filter((metric) => metric.modes[comparisonMode]);
  const priorities: Record<string, string[]> = display.priorities;
  const summary = (priorities[category] || priorities.ground)
    .flatMap((id) => {
      const metric = metrics.find((item) => item.id === id);
      return metric ? [metric] : [];
    })
    .slice(0, display.summaryLimit);
  const id = `performance-${unit.id}`;
  return (
    <section className="wt-performance" aria-label="载具性能对比">
      <div className="wt-performance-header">
        <div>
          <GameIcon name="performance" />
          <h3>性能对比</h3>
        </div>
        <GameTabs
          id={id}
          label="性能对比模式"
          value={comparisonMode}
          onValueChange={setComparisonMode}
          items={[
            { value: "ab", label: "街机 AB" },
            { value: "rb", label: "历史 RB" },
          ]}
        />
      </div>
      <p className="wt-performance-caption">初始 / 完全体 / 专家 / 精英 · 相同数值合并展示</p>
      {mode === "sb" && (
        <p className="wt-dossier-note">
          Wiki 性能数据按街机、历史分别列出，此处默认展示历史参考值。
        </p>
      )}
      {unit.premium && (
        <p className="wt-dossier-note">该载具默认已解锁配件；“初始”列用于比较 Wiki 的基础参数。</p>
      )}
      <div
        role="tabpanel"
        id={`${id}-${comparisonMode}-panel`}
        aria-labelledby={`${id}-${comparisonMode}-tab`}
      >
        {data?.status === "available" && metrics.length ? (
          <>
            <div className="wt-performance-charts" aria-label="关键性能图表">
              {summary.map((metric) => (
                <MetricChart key={metric.id} metric={metric} mode={comparisonMode} />
              ))}
            </div>
            <details className="wt-performance-details">
              <summary>查看全部 {metrics.length} 项数值</summary>
              <section className="wt-performance-scroll" aria-label="四种状态性能数值" tabIndex={0}>
                <table className="wt-performance-table">
                  <thead>
                    <tr>
                      <th scope="col">性能项目</th>
                      {stages.map((stage) => (
                        <th scope="col" key={stage.value}>
                          <span>{stage.label}</span>
                          <small>{stage.basis}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric) => {
                      const values = metric.modes[comparisonMode]!;
                      return (
                        <tr key={metric.id}>
                          <th scope="row">
                            <span>{metric.label}</span>
                            {metric.weaponName && <small>{metric.weaponName}</small>}
                            <small>
                              {metric.unit}
                              {metric.altitudeM !== null
                                ? ` · 海拔 ${number(metric.altitudeM)} m`
                                : ""}
                              {metric.crewDependent ? " · 受乘员影响" : ""}
                            </small>
                          </th>
                          {stages.map((stage) => {
                            const value = values[stage.value];
                            return (
                              <td
                                key={stage.value}

                                title={
                                  metric.sourceBasis[stage.value] ||
                                  "Wiki 未提供该乘员状态的可靠数值"
                                }
                              >
                                {value === null || value === undefined ? (
                                  <span className="wt-performance-unknown">待核对</span>
                                ) : (
                                  <>
                                    <strong>{number(value)}</strong>
                                  </>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </details>
          </>
        ) : (
          <p className="wt-dossier-empty">
            {data?.status === "parse_failed"
              ? "这辆载具的性能资料需要重新核对，暂不展示未验证数值。"
              : data?.status === "not_provided"
                ? "Wiki 暂未提供可对比的性能数据。"
                : "这辆载具的性能对照资料尚未采集。"}
          </p>
        )}
      </div>
      <div
        role="tabpanel"
        hidden
        id={`${id}-${comparisonMode === "ab" ? "rb" : "ab"}-panel`}
        aria-labelledby={`${id}-${comparisonMode === "ab" ? "rb" : "ab"}-tab`}
      />
      <details className="wt-reference-explanation">
        <summary>对比口径与数据来源</summary>
        <p>
          图表各项独立量程，条长表示实际数值，相同数值合并显示。初始与完全体采用 Wiki 的
          Basic／Reference。专家和精英列按全配件、满技能资质比较；受乘员影响的项目仅展示 Wiki
          明确给出的端点，缺失的专家数值显示待核对。精英成员组对应游戏中的王牌资质（Ace）；王牌数值引用原页的
          aces 端点，原页未单独拆分技能条件。
        </p>
        <p>
          极速、功重比等不受乘员资格影响的项目沿用完全体数值；实际战斗表现还取决于载荷、环境与操作。
        </p>
        <a
          href="https://wiki.warthunder.com/mechanics/182-crew-skills"
          target="_blank"
          rel="noreferrer"
        >
          官方乘员技能说明 ↗
        </a>
        {data && (
          <a href={data.source} target="_blank" rel="noreferrer">
            Wiki 载具资料 · {data.checkedAt.slice(0, 10)} ↗
          </a>
        )}
      </details>
    </section>
  );
}
