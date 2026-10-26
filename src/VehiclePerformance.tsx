/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Horizontal tables remain keyboard-scrollable. */
import { useState } from "react";
import type { Mode, Vehicle, VehiclePerformanceStage, WikiPerformanceMetric } from "./models";
import { GameTabs } from "./components/GameTabs";
import { GameSelect } from "./components/GameSelect";
import { GameIcon } from "./components/GameIcon";
const stages: { value: VehiclePerformanceStage; label: string; basis: string }[] = [
  { value: "stock", label: "初始", basis: "初始配件 · 基础乘员" },
  { value: "spaded", label: "完全体", basis: "全配件 · 基础乘员" },
  { value: "expert", label: "专家成员组", basis: "全配件 · 满技能专家" },
  { value: "ace", label: "精英成员组", basis: "全配件 · 满技能王牌" },
];
const number = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
function Difference({
  value,
  base,
  direction,
}: {
  value: number;
  base: number | null;
  direction: WikiPerformanceMetric["direction"];
}) {
  if (base === null || value === base) return null;
  const delta = value - base,
    percent = base !== 0 ? (delta / Math.abs(base)) * 100 : null;
  const improved = direction ? (direction === "higher" ? delta > 0 : delta < 0) : null;
  return (
    <small
      className="wt-performance-delta"
      data-improved={improved ?? undefined}
      title={
        percent === null
          ? "相对所选基准的差值"
          : `相对基准 ${percent > 0 ? "+" : ""}${number(percent)}%`
      }
    >
      {delta > 0 ? "+" : ""}
      {number(delta)}
      {percent !== null && (
        <span>
          {" "}
          ({percent > 0 ? "+" : ""}
          {percent.toFixed(1)}%)
        </span>
      )}
    </small>
  );
}
export function VehiclePerformance({ unit, mode }: { unit: Vehicle; mode: Mode }) {
  const [comparisonMode, setComparisonMode] = useState<"ab" | "rb">(mode === "ab" ? "ab" : "rb");
  const [baseStage, setBaseStage] = useState<VehiclePerformanceStage>("stock");
  const [onlyChanges, setOnlyChanges] = useState(false);
  const data = unit.wikiDetails?.performance;
  const metrics = data?.metrics || [];
  const visible = metrics.filter((metric) => {
    const values = metric.modes[comparisonMode];
    if (!values) return false;
    return (
      !onlyChanges || new Set(Object.values(values).filter((value) => value !== null)).size > 1
    );
  });
  const id = `performance-${unit.id}`;
  return (
    <section className="wt-performance" aria-label="载具性能对比">
      <div className="wt-dossier-section-heading">
        <div>
          <GameIcon name="performance" />
          <h3>性能对比</h3>
        </div>
        <span>四种参考状态</span>
      </div>
      <div className="wt-performance-toolbar">
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
        <div className="wt-performance-options">
          <GameSelect
            aria-label="差值比较基准"
            value={baseStage}
            onValueChange={(value) => setBaseStage(value as VehiclePerformanceStage)}
          >
            {stages.map((stage) => (
              <option key={stage.value} value={stage.value}>
                对比基准：{stage.label}
              </option>
            ))}
          </GameSelect>
          <label>
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(event) => setOnlyChanges(event.target.checked)}
            />
            仅看有变化
          </label>
        </div>
      </div>
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
            <p className="wt-table-scroll-hint">横向滑动查看四种状态</p>
            <section className="wt-performance-scroll" aria-label="四种状态性能数值" tabIndex={0}>
              <table className="wt-performance-table">
                <thead>
                  <tr>
                    <th scope="col">
                      性能项目 <small>数值 / 相对基准变化</small>
                    </th>
                    {stages.map((stage) => (
                      <th scope="col" key={stage.value} data-baseline={baseStage === stage.value}>
                        <span>{stage.label}</span>
                        <small>{stage.basis}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((metric) => {
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
                          const value = values[stage.value],
                            base = values[baseStage];
                          return (
                            <td
                              key={stage.value}
                              data-baseline={baseStage === stage.value}
                              title={
                                metric.sourceBasis[stage.value] || "Wiki 未提供该乘员状态的可靠数值"
                              }
                            >
                              {value === null || value === undefined ? (
                                <span className="wt-performance-unknown">待核对</span>
                              ) : (
                                <>
                                  <strong>{number(value)}</strong>
                                  {stage.value !== baseStage && (
                                    <Difference
                                      value={value}
                                      base={base ?? null}
                                      direction={metric.direction}
                                    />
                                  )}
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
              {!visible.length && (
                <p className="wt-dossier-empty">当前模式下没有符合筛选条件的项目。</p>
              )}
            </section>
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
          初始与完全体采用 Wiki 的
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
