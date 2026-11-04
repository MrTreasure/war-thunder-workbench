/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Data matrices have a keyboard-scrollable viewport. */
import { useState } from "react";
import type { ReactNode } from "react";
import type { Catalog, WikiPerformanceMetric } from "./models";
import { Modal } from "./Modal";
import { VehicleTile } from "./VehicleTile";
import { GameSelect } from "./components/GameSelect";
import { GameTabs } from "./components/GameTabs";
import { GameButton } from "./components/GameButton";
import { loadoutWeaponName } from "./loadout-presentation";
import {
  combatNumber,
  GroundShellLabel,
  shellTypeName,
  groundWeaponName,
  groundShellName,
} from "./VehicleGroundCombat";
import {
  comparedVehicleKey,
  comparisonMetricKey,
  comparisonMetrics,
  groundShells,
  shellPenetration,
  spadedValue,
} from "./vehicle-compare";
import type { ComparedVehicle } from "./vehicle-compare";
import flags from "../data/flags.json";
import display from "../data/ground-combat-display.json";

function ComparisonRow({
  label,
  unit,
  values,
  direction,
  notes,
}: {
  label: string;
  unit?: string;
  values: (number | string | null)[];
  direction?: WikiPerformanceMetric["direction"];
  notes?: (string | null | undefined)[];
}) {
  const reference = values[0];
  return (
    <tr>
      <th scope="row">
        {label}
        {unit && <small>{unit}</small>}
      </th>
      {values.map((value, index) => {
        const delta =
          index > 0 && typeof value === "number" && typeof reference === "number"
            ? value - reference
            : null;
        const trend =
          delta && direction
            ? (direction === "higher" ? delta : -delta) > 0
              ? "better"
              : "worse"
            : undefined;
        return (
          <td key={index} data-baseline={index === 0 || undefined} data-trend={trend}>
            <strong>{typeof value === "number" ? combatNumber(value) : value || "—"}</strong>
            {delta !== null && delta !== 0 && (
              <small className="wt-vehicle-compare-delta">
                {delta > 0 ? "+" : ""}
                {combatNumber(delta)}
                {unit ? ` ${unit}` : ""}
              </small>
            )}
            {notes?.[index] && <small>{notes[index]}</small>}
          </td>
        );
      })}
    </tr>
  );
}
export function VehicleComparison({
  entries,
  catalog,
  initialMode,
  onRemove,
  close,
}: {
  entries: ComparedVehicle[];
  catalog: Catalog;
  initialMode: "ab" | "rb";
  onRemove: (keys: ReadonlySet<string>) => void;
  close: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [angle, setAngle] = useState("source");
  const category = entries[0]?.category;
  const keys = entries.map(comparedVehicleKey);
  const selectedCount = keys.filter((key) => selected.has(key)).length;
  const shells = entries.map((entry) => {
    const available = groundShells(entry.unit);
    return (
      available.find((item) => item.key === choices[comparedVehicleKey(entry)]) || available[0]
    );
  });
  const select = (key: string, checked: boolean) =>
    setSelected((old) => {
      const next = new Set(old);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  function removeSelected() {
    onRemove(selected);
    setChoices((old) =>
      Object.fromEntries(Object.entries(old).filter(([key]) => !selected.has(key))),
    );
    setSelected(new Set());
  }
  const section = (title: string, control?: ReactNode) => (
    <tr className="wt-vehicle-compare-section">
      <th colSpan={entries.length + 1}>
        <span>{title}</span>
        {control}
      </th>
    </tr>
  );
  return (
    <Modal
      className="wt-vehicle-compare-modal"
      title="载具对比"
      subtitle="完全体数据 · 首辆为基准 · 最多 5 辆"
      close={close}
    >
      <div className="wt-vehicle-compare-body">
        <div className="wt-vehicle-compare-toolbar">
          <div>
            <strong>{category ? catalog.categories[category] : "尚未选择载具"}</strong>
            <span>{entries.length} / 5 辆</span>
          </div>
          <GameTabs
            id="vehicle-compare-mode"
            label="载具对比数据模式"
            value={mode}
            onValueChange={setMode}
            items={[
              { value: "ab", label: "街机 AB" },
              { value: "rb", label: "历史 RB" },
            ]}
          />
          <GameButton tone="ghost" disabled={!selectedCount} onClick={removeSelected}>
            删除勾选（{selectedCount}）
          </GameButton>
        </div>
        <p className="wt-vehicle-compare-note">
          仅使用完全改装后的参数，不叠加专家或王牌乘员加成。未知值显示“—”；数值差额相对首辆载具。
          {category
            ? ` 当前只接受${catalog.categories[category]}载具。`
            : " 首辆加入后锁定军种，清空后可重新选择。"}
        </p>
        {entries.length ? (
          <>
            <div
              className="wt-vehicle-compare-scroll"
              tabIndex={0}
              aria-label="载具数据对比，可横向滚动"
            >
              <table
                className="wt-vehicle-compare-table"
                style={{ minWidth: 180 + entries.length * 225 }}
              >
                <thead>
                  <tr>
                    <th scope="col">
                      <label className="wt-vehicle-compare-check">
                        <input
                          type="checkbox"
                          checked={selectedCount === entries.length}
                          onChange={(event) =>
                            setSelected(event.target.checked ? new Set(keys) : new Set())
                          }
                        />
                        全选
                      </label>
                      <small>勾选后可批量删除</small>
                    </th>
                    {entries.map((entry, index) => (
                      <th scope="col" key={comparedVehicleKey(entry)}>
                        <div className="wt-vehicle-compare-column-tools">
                          <label className="wt-vehicle-compare-check">
                            <input
                              type="checkbox"
                              checked={selected.has(comparedVehicleKey(entry))}
                              onChange={(event) =>
                                select(comparedVehicleKey(entry), event.target.checked)
                              }
                              aria-label={`勾选 ${entry.unit.name}`}
                            />
                            选择
                          </label>
                          {index === 0 && <span className="wt-vehicle-compare-baseline">基准</span>}
                        </div>
                        <VehicleTile
                          unit={entry.unit}
                          catalog={catalog}
                          mode={mode}
                          showRank
                          showPackPrice={false}
                          href={`https://wiki.warthunder.com/unit/${encodeURIComponent(entry.unit.id)}`}
                        />
                        <div className="wt-vehicle-compare-country">
                          <img
                            src={(flags as Record<string, string>)[entry.country]}
                            width={24}
                            height={16}
                            alt=""
                          />
                          {catalog.countries[entry.country]}
                        </div>
                        <small>
                          性能资料{" "}
                          {entry.unit.wikiDetails?.performance?.checkedAt.slice(0, 10) || "未采集"}
                        </small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section("完全体性能")}
                  {comparisonMetrics(entries).map((metric) => {
                    const metrics = entries.map((entry) => {
                      const data = entry.unit.wikiDetails?.performance;
                      return data?.status === "available"
                        ? data.metrics.find(
                            (item) => comparisonMetricKey(item) === comparisonMetricKey(metric),
                          )
                        : undefined;
                    });
                    return (
                      <ComparisonRow
                        key={comparisonMetricKey(metric)}
                        label={metric.label}
                        unit={metric.unit}
                        values={metrics.map((item) => spadedValue(item, mode))}
                        direction={metric.direction}
                        notes={metrics.map((item) =>
                          [
                            item?.weaponName
                              ? category === "ground"
                                ? groundWeaponName(item.weaponName)
                                : loadoutWeaponName(item.weaponName)
                              : null,
                            item?.altitudeM !== null && item?.altitudeM !== undefined
                              ? `海拔 ${combatNumber(item.altitudeM)} m`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        )}
                      />
                    );
                  })}
                  {category === "ground" && (
                    <>
                      {section("标称装甲厚度")}
                      {(
                        [
                          ["hull", "车体"],
                          ["turret", "炮塔"],
                        ] as const
                      ).flatMap(([part, label]) =>
                        (
                          [
                            ["front", "正面"],
                            ["side", "侧面"],
                            ["rear", "后部"],
                          ] as const
                        ).map(([side, sideLabel]) => (
                          <ComparisonRow
                            key={`${part}:${side}`}
                            label={`${label} · ${sideLabel}`}
                            unit="mm"
                            values={entries.map((entry) => {
                              const data = entry.unit.wikiDetails?.performance?.groundCombat;
                              const value =
                                data?.armorStatus === "available"
                                  ? data.armor.find((row) => row.id === part)?.[side]
                                  : undefined;
                              return value === undefined
                                ? null
                                : value.trim() && Number.isFinite(Number(value))
                                  ? Number(value)
                                  : value;
                            })}
                          />
                        )),
                      )}
                      {section(
                        "武器与弹药",
                        <label className="wt-vehicle-compare-angle">
                          穿深口径
                          <GameSelect value={angle} onValueChange={setAngle}>
                            <option value="source">来源表格</option>
                            <option value="0">0°</option>
                            <option value="30">30°</option>
                            <option value="60">60°</option>
                          </GameSelect>
                        </label>,
                      )}
                      <tr>
                        <th scope="row">
                          选择对比弹药<small>包含全部公开弹种</small>
                        </th>
                        {entries.map((entry, index) => {
                          const available = groundShells(entry.unit);
                          return (
                            <td key={keys[index]}>
                              {shells[index] ? (
                                <GameSelect
                                  value={shells[index].key}
                                  onValueChange={(value) =>
                                    setChoices((old) => ({ ...old, [keys[index]]: value }))
                                  }
                                  renderOption={(value) => {
                                    const item = available.find((ammo) => ammo.key === value);
                                    return item ? <GroundShellLabel shell={item.shell} /> : value;
                                  }}
                                  renderValue={(value) => {
                                    const item = available.find((ammo) => ammo.key === value);
                                    return item ? <GroundShellLabel shell={item.shell} /> : value;
                                  }}
                                >
                                  {(
                                    entry.unit.wikiDetails?.performance?.groundCombat?.weapons || []
                                  )
                                    .filter((weapon) => weapon.shells.length)
                                    .map((weapon) => (
                                      <optgroup
                                        key={weapon.id}
                                        label={groundWeaponName(weapon.name)}
                                      >
                                        {weapon.shells.map((shell) => (
                                          <option key={shell.id} value={`${weapon.id}:${shell.id}`}>
                                            {groundShellName(shell.name)}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                </GameSelect>
                              ) : (
                                "来源未提供弹药表"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <ComparisonRow
                        label="武器"
                        values={shells.map((item) =>
                          item ? groundWeaponName(item.weapon.name) : null,
                        )}
                      />
                      <ComparisonRow
                        label="弹药类型"
                        values={shells.map((item) =>
                          item
                            ? `${shellTypeName(item.shell.type)}${item.shell.type !== "belt" ? ` · ${item.shell.type}` : ""}`
                            : null,
                        )}
                      />
                      <ComparisonRow
                        label="口径"
                        unit="mm"
                        values={shells.map((item) => item?.shell.caliberMm ?? null)}
                      />
                      <ComparisonRow
                        label="初速"
                        unit="米/秒"
                        values={shells.map((item) => item?.shell.velocityMps ?? null)}
                      />
                      <ComparisonRow
                        label="弹体质量"
                        unit="千克"
                        values={shells.map((item) => item?.shell.massKg ?? null)}
                      />
                      <ComparisonRow
                        label="TNT 当量"
                        unit="千克"
                        values={shells.map((item) => item?.shell.tntKg ?? null)}
                      />
                      <ComparisonRow
                        label="装药类型"
                        values={shells.map(
                          (item) =>
                            item?.shell.parameters.find(
                              (parameter) => parameter.id === "explosive-type",
                            )?.value ?? null,
                        )}
                      />
                      <ComparisonRow
                        label="装药量"
                        values={shells.map(
                          (item) =>
                            item?.shell.parameters.find(
                              (parameter) => parameter.id === "explosive-mass",
                            )?.value ?? null,
                        )}
                      />
                      {display.distancesM.map((distance) => (
                        <ComparisonRow
                          key={distance}
                          label={`${distance} 米穿深`}
                          unit="mm"
                          values={shells.map((item) =>
                            shellPenetration(item?.shell, distance, angle),
                          )}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {category === "ground" && (
              <p className="calc-note">
                装甲为标称厚度，不等同于复合装甲或反应装甲等效防护。“来源表格”沿用 Wiki
                默认穿深列；指定射角时仅展示来源明确提供的数据。
              </p>
            )}
          </>
        ) : (
          <div className="wt-vehicle-compare-empty">
            <h3>从载具详情加入对比</h3>
            <p>
              打开一辆载具，点击“加入对比”。首辆载具锁定军种，最多可加入 5
              辆；删除全部后可切换军种。
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
