/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Data matrices have a keyboard-scrollable viewport. */
import { useState } from "react";
import type { ReactNode } from "react";
import type { Catalog, WikiPerformanceMetric } from "./models";
import { Modal } from "./Modal";
import { VehicleTile } from "./VehicleTile";
import { GameSelect } from "./components/GameSelect";
import { GameTabs } from "./components/GameTabs";
import { GameIcon } from "./components/GameIcon";
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
  comparisonMetricRows,
  groundShells,
  shellPenetration,
  spadedValue,
} from "./vehicle-compare";
import type { ComparedVehicle } from "./vehicle-compare";
import display from "../data/ground-combat-display.json";
import { equipmentLabel, equipmentValue, equipmentParameter } from "./vehicle-equipment";
import { purposeMetric, vehiclePurposes, vehiclePurposeSummary } from "./comparison-purpose";
import "./comparison-purpose.css";
import { SupportedLoadoutWeapons } from "./SupportedLoadoutWeapons";

function ComparisonRow({
  label,
  unit,
  values,
  direction,
  notes,
  focused,
}: {
  focused?: boolean;
  label: string;
  unit?: string;
  values: (number | string | null)[];
  direction?: WikiPerformanceMetric["direction"];
  notes?: (string | null | undefined)[];
}) {
  const reference = values[0];
  return (
    <tr className={focused ? "wt-purpose-row" : undefined}>
      <th scope="row" className="wt-vehicle-compare-metric-label">
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
            <span className="wt-vehicle-compare-value">
              <strong>{typeof value === "number" ? combatNumber(value) : value || "—"}</strong>
              {delta !== null && delta !== 0 && (
                <small className="wt-vehicle-compare-delta">
                  {delta > 0 ? "+" : ""}
                  {combatNumber(delta)}
                  {unit ? ` ${unit}` : ""}
                </small>
              )}
            </span>
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
  onSetBaseline,
  close,
}: {
  entries: ComparedVehicle[];
  catalog: Catalog;
  initialMode: "ab" | "rb";
  onRemove: (keys: ReadonlySet<string>) => void;
  onSetBaseline: (key: string) => void;
  close: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [angle, setAngle] = useState("source");
  const category = entries[0]?.category;
  const [purposeId, setPurposeId] = useState("");
  const metricRows = comparisonMetricRows(entries);
  const purposes = vehiclePurposes.filter(
    (item) =>
      item.categories.includes(category || "") &&
      metricRows.some(
        (row) =>
          purposeMetric(row, item.metrics) &&
          row.metrics.some((metric) => spadedValue(metric, mode) !== null),
      ),
  );
  const purpose = purposes.find((item) => item.id === purposeId);
  const focusedRows = purpose
    ? metricRows.filter((row) => purposeMetric(row, purpose.metrics))
    : [];
  const orderedRows = purpose
    ? [...focusedRows, ...metricRows.filter((row) => !purposeMetric(row, purpose.metrics))]
    : metricRows;
  const keys = entries.map(comparedVehicleKey);
  const shells = entries.map((entry) => {
    const available = groundShells(entry.unit);
    return (
      available.find((item) => item.key === choices[comparedVehicleKey(entry)]) || available[0]
    );
  });
  function removeEntry(key: string) {
    onRemove(new Set([key]));
    setChoices((old) => Object.fromEntries(Object.entries(old).filter(([value]) => value !== key)));
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
      style={{
        width: `min(${entries.length ? 170 + entries.length * 300 : 640}px, calc(100vw - 24px))`,
      }}
      title="载具对比"
      subtitle="完全体数据 · 可切换基准 · 最多 5 辆"
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
        </div>
        {!!entries.length && !!purposes.length && (
          <section className="wt-purpose-panel" aria-label="按用途比较载具">
            <label>
              比较用途
              <GameSelect value={purpose?.id || ""} onValueChange={setPurposeId}>
                <option value="">全部指标</option>
                {purposes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </GameSelect>
            </label>
            {purpose && (
              <>
                <p>{purpose.note} 相关指标已移至性能表前列。</p>
                <div className="wt-purpose-summaries">
                  {entries.map((entry, index) => (
                    <article key={comparedVehicleKey(entry)}>
                      <strong>{entry.unit.name}</strong>
                      <p>{vehiclePurposeSummary(focusedRows, index, mode)}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {entries.length ? (
          <>
            <div
              className="wt-vehicle-compare-scroll"
              tabIndex={0}
              aria-label="载具数据对比，可横向滚动"
            >
              <table
                className="wt-vehicle-compare-table"
                style={{ minWidth: 148 + entries.length * 300, width: 148 + entries.length * 300 }}
              >
                <thead>
                  <tr>
                    <th scope="col">
                      对比载具<small>卡片旁可设基准</small>
                    </th>
                    {entries.map((entry, index) => (
                      <th scope="col" key={comparedVehicleKey(entry)}>
                        <div className="wt-vehicle-compare-card">
                          <VehicleTile
                            unit={entry.unit}
                            catalog={catalog}
                            mode={mode}
                            showRank
                            country={entry.country}
                            countryLabel={catalog.countries[entry.country]}
                            href={`https://wiki.warthunder.com/unit/${encodeURIComponent(entry.unit.id)}`}
                          />
                          <div className="wt-vehicle-compare-card-actions">
                            <button
                              type="button"
                              className="wt-vehicle-compare-set-baseline"
                              disabled={index === 0}
                              aria-pressed={index === 0}
                              aria-label={
                                index === 0
                                  ? `${entry.unit.name} 是当前基准`
                                  : `设 ${entry.unit.name} 为基准`
                              }
                              onClick={() => onSetBaseline(comparedVehicleKey(entry))}
                            >
                              {index === 0 ? "基准" : "设基准"}
                            </button>
                            <button
                              type="button"
                              className="wt-vehicle-compare-remove"
                              onClick={() => removeEntry(comparedVehicleKey(entry))}
                              aria-label={`移除 ${entry.unit.name}`}
                              title="移除载具"
                            >
                              <GameIcon name="close" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section("完全体性能")}
                  {orderedRows.map((metric) => {
                    const metrics = metric.metrics;
                    return (
                      <ComparisonRow
                        key={metric.key}
                        focused={!!purpose && purposeMetric(metric, purpose.metrics)}
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
                  <ComparisonRow
                    label="性能资料采集"
                    values={entries.map(
                      (entry) =>
                        entry.unit.wikiDetails?.performance?.checkedAt.slice(0, 10) || null,
                    )}
                  />
                  {(category === "aviation" || category === "helicopters") && (
                    <>
                      {section("挂载能力")}
                      <tr>
                        <th scope="row">支持挂载</th>
                        {entries.map((entry) => (
                          <td key={comparedVehicleKey(entry)}>
                            <SupportedLoadoutWeapons unit={entry.unit} compact />
                          </td>
                        ))}
                      </tr>
                    </>
                  )}
                  {entries.some((entry) =>
                    entry.unit.wikiDetails?.performance?.equipment?.features.some(
                      (feature) => feature.kind === "radar" || feature.kind === "radar_warning",
                    ),
                  ) && (
                    <>
                      {section("雷达与探测设备")}
                      {(
                        [
                          ["radar", "model", "雷达／光电型号"],
                          ["radar", "radar-band", "雷达频段"],
                          ["radar", "radar-tws", "边扫边跟踪（TWS）"],
                          ["radar", "radar-iff", "敌我识别"],
                          ["radar_warning", "model", "雷达告警接收机"],
                          ["radar_warning", "range", "告警探测距离"],
                        ] as const
                      ).map(([kind, parameter, label]) => (
                        <ComparisonRow
                          key={`${kind}:${parameter}`}
                          label={label}
                          values={entries.map((entry) => {
                            const value = equipmentParameter(entry.unit, kind, parameter);
                            return value ? equipmentValue(value) : null;
                          })}
                        />
                      ))}
                    </>
                  )}
                  {category === "ground" && (
                    <>
                      {section("装甲与防护")}
                      <ComparisonRow
                        label="装甲类型"
                        values={entries.map(
                          (entry) =>
                            entry.unit.wikiDetails?.performance?.groundCombat?.armorTypes
                              ?.map(equipmentLabel)
                              .join("、") || "来源未标明",
                        )}
                      />
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
