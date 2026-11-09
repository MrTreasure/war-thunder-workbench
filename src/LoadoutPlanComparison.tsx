/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Named table viewport allows keyboard scrolling. */
import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { GameSelect } from "./components/GameSelect";
import type { LoadoutPlan } from "./loadouts";
import { loadoutConfigurationKey } from "./loadout-library";
import type { VehicleFacts } from "./vehicle-store";
import { vehicleStore } from "./vehicle-store";
import { rating } from "./vehicle-labels";
import { loadoutWeaponName } from "./loadout-presentation";
import { compareLoadoutPlans, planComparisonProblem } from "./loadout-plan-comparison";
import "./comparison-purpose.css";
const selectionKey = (plan: LoadoutPlan) => `${plan.id}:${loadoutConfigurationKey(plan)}`;
const number = (value: number | null) =>
  value === null ? "未知" : value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
export function LoadoutPlanComparison({
  plans,
  close,
}: {
  plans: LoadoutPlan[];
  close: () => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("payload");
  const [state, setState] = useState<{ key: string; unit?: VehicleFacts; error?: string }>({
    key: "",
  });
  const selected = useMemo(
    () => plans.filter((plan) => ids.includes(selectionKey(plan))),
    [plans, ids],
  );
  const selectionProblem = planComparisonProblem(selected);
  const first = selected[0];
  const requestKey =
    !selectionProblem && first ? `${first.country}:${first.vehicleId}:${first.sourceHash}` : "";
  useEffect(() => {
    if (!requestKey || !first) return;
    let active = true;
    void vehicleStore.ensure(first.country).then(
      () => {
        if (active)
          setState({ key: requestKey, unit: vehicleStore.getFacts().get(first.vehicleId) });
      },
      (error: unknown) => {
        if (active)
          setState({
            key: requestKey,
            error: error instanceof Error ? error.message : "资料读取失败。",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [requestKey, first]);
  const current = state.key === requestKey ? state : undefined;
  const data = current?.unit?.wikiDetails?.loadouts;
  const comparison = useMemo(
    () => (data ? compareLoadoutPlans(selected, data, rating(current?.unit || {}, "rb")) : null),
    [data, selected, current?.unit],
  );
  const entries = comparison?.entries || [];
  const problem =
    selectionProblem ||
    current?.error ||
    comparison?.problem ||
    (!current ? "正在读取所选机型资料…" : !data ? "缺少可还原的挂载资料。" : "");
  const bombing =
    current?.unit?.category === "aviation" &&
    entries.some((entry) => entry.payload.items.length || entry.payload.unknown.length);
  const weaponRows = [
    ...new Map(
      entries.flatMap((entry) => entry.weapons).map((weapon) => [weapon.key, weapon]),
    ).values(),
  ];
  const row = (label: string, values: string[]) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      {values.map((value, index) => (
        <td key={selectionKey(entries[index].plan)}>{value}</td>
      ))}
    </tr>
  );
  return (
    <Modal
      title="挂载方案对比"
      subtitle="选择 2–4 套同机型、同资料版本方案；只读比较。"
      close={close}
      className="wt-mount-compare"
    >
      <div className="wt-plan-compare-selection">
        {plans.map((plan) => (
          <label key={selectionKey(plan)}>
            <input
              type="checkbox"
              checked={ids.includes(selectionKey(plan))}
              disabled={!ids.includes(selectionKey(plan)) && ids.length >= 4}
              onChange={(event) =>
                setIds((old) =>
                  event.target.checked
                    ? [...old, selectionKey(plan)]
                    : old.filter((id) => id !== selectionKey(plan)),
                )
              }
            />
            <span>
              {plan.name} · {plan.sourceDate.slice(0, 10)}
            </span>
          </label>
        ))}
      </div>
      {problem ? (
        <output className="wt-mount-note">{problem}</output>
      ) : (
        <>
          <section className="wt-purpose-panel">
            <strong>
              {current?.unit?.name} · {entries.length} 套方案
            </strong>
            <label>
              比较用途
              <GameSelect value={bombing ? purpose : "payload"} onValueChange={setPurpose}>
                <option value="payload">武器配置与挂重</option>
                {bombing && <option value="bombing">空历炸区</option>}
              </GameSelect>
            </label>
            <p>
              按数量、武器类型与已知整组挂载重量判断取舍。重量不等于阻力；未公开限制与个人解锁状态未知，不生成最佳挂载。
            </p>
            <div className="wt-purpose-summaries">
              {entries.map((entry, index) => (
                <article key={selectionKey(entry.plan)}>
                  <strong>{entry.plan.name}</strong>
                  <p>
                    {entry.check.issues.length
                      ? `存在 ${entry.check.issues.length} 项已知规则问题，暂不用于炸区估算。`
                      : `整组挂重 ${number(entry.check.weightKg)} 千克；${entry.weapons.length} 种来源挂载项。`}
                    {entry.check.weightKg === null || entries[0].check.weightKg === null
                      ? "重量资料不足，不能比较轻重。"
                      : index > 0
                        ? `相对首列挂重${entry.check.weightKg === entries[0].check.weightKg ? "相同" : `${entry.check.weightKg > entries[0].check.weightKg ? "增加" : "减少"} ${number(Math.abs(entry.check.weightKg - entries[0].check.weightKg))} 千克`}；更轻不代表实战表现更好。`
                        : "首列为挂重参照；更轻不代表实战表现更好。"}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <div className="wt-mount-compare-scroll" tabIndex={0} aria-label="挂载方案对比表">
            <table className="wt-plan-compare-table">
              <thead>
                <tr>
                  <th scope="col">指标</th>
                  {entries.map((entry) => (
                    <th scope="col" key={selectionKey(entry.plan)}>
                      {entry.plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row(
                  "整组挂载重量（千克）",
                  entries.map((entry) => number(entry.check.weightKg)),
                )}
                {row(
                  "左翼／右翼挂重（千克）",
                  entries.map(
                    (entry) => `${number(entry.check.leftKg)} / ${number(entry.check.rightKg)}`,
                  ),
                )}
                {row(
                  "已知规则",
                  entries.map((entry) =>
                    entry.check.issues.length
                      ? entry.check.issues.map((issue) => issue.message).join("；")
                      : "已知规则通过，未公开限制未知",
                  ),
                )}
                {purpose === "bombing" && bombing && (
                  <>
                    {row(
                      "已知炸弹 TNT 当量（千克）",
                      entries.map((entry) =>
                        entry.check.issues.length
                          ? "配置有冲突"
                          : `${entry.payload.items.length ? number(entry.payload.grams / 1000) : "未知"}${entry.payload.unknown.length ? "（仅已知部分）" : ""}`,
                      ),
                    )}
                    {entries[0].tiers.map((tier, index) =>
                      row(
                        `房间最高 BR ${tier.brMax === null ? `${tier.brMin}+` : `${tier.brMin}–${tier.brMax}`} · 战区数`,
                        entries.map((entry) => {
                          const result = entry.tiers[index];
                          return entry.check.issues.length
                            ? "配置有冲突"
                            : result.count === null
                              ? "资料不足／未选择可计算炸弹"
                              : `${result.count}（直接摧毁 ${result.directAllocation.count}）${result.status === "partial" ? " · 仅已知炸弹" : ""}${!result.allocation.optimal ? " · 已找到的分配" : ""}`;
                        }),
                      ),
                    )}
                  </>
                )}
                {weaponRows.map((weapon) =>
                  row(
                    `${loadoutWeaponName(weapon.name)} · ${weapon.types.join("／") || "类型未知"}`,
                    entries.map((entry) => {
                      const value = entry.weapons.find((item) => item.key === weapon.key);
                      return value
                        ? `${number(value.count)} 件（按来源组合数量）`
                        : entry.check.issues.length
                          ? "未知"
                          : "未装配";
                    }),
                  ),
                )}
                {row(
                  "资料日期",
                  entries.map((entry) => entry.plan.sourceDate.slice(0, 10)),
                )}
                {row(
                  "校验边界",
                  entries.map((entry) => entry.check.limitations.join("；")),
                )}
              </tbody>
            </table>
          </div>
          {purpose === "bombing" && bombing && (
            <p className="wt-mount-note">
              仅空历四战区可刷新模板，普通高爆炸弹全部有效命中；含燃烧后自毁，括号为直接清空
              HP。逐枚分配，溢出不转移；未知炸弹不补零，特殊地图不套用。各 BR
              档并列，不能把不同档的数量直接比较。
            </p>
          )}
          {data && (
            <p className="wt-mount-note">
              <a href={data.source} target="_blank" rel="noopener noreferrer">
                官方 Wiki 挂载来源 ↗
              </a>{" "}
              · 当前可还原资料日期 {data.checkedAt.slice(0, 10)}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
