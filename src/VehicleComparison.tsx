import { useLocale } from "./i18n/react";
import { t, localize } from "./i18n/core";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Data matrices have a keyboard-scrollable viewport. */
import { useState } from "react";
import type { ReactNode } from "react";
import type { Catalog, WikiPerformanceMetric } from "./models";
import { Modal } from "./Modal";
import { VehicleTile } from "./VehicleTile";
import { GameSelect } from "./components/GameSelect";
import { GameTabs } from "./components/GameTabs";
import { GameIcon } from "./components/GameIcon";
import { loadoutWeaponName } from "./intl-loadout-presentation";
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
import { equipmentLabel, equipmentValue, equipmentParameter } from "./intl-vehicle-equipment";
import { SupportedLoadoutWeapons } from "./SupportedLoadoutWeapons";
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
  useLocale();
  const reference = values[0];
  return (
    <tr>
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
  useLocale();
  const [mode, setMode] = useState(initialMode);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [angle, setAngle] = useState("source");
  const category = entries[0]?.category;
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
      title={t("\u8F7D\u5177\u5BF9\u6BD4")}
      subtitle={t(
        "\u5B8C\u5168\u4F53\u6570\u636E \u00B7 \u53EF\u5207\u6362\u57FA\u51C6 \u00B7 \u6700\u591A 5 \u8F86",
      )}
      close={close}
    >
      <div className="wt-vehicle-compare-body">
        <div className="wt-vehicle-compare-toolbar">
          <div>
            <strong>
              {category ? catalog.categories[category] : t("\u5C1A\u672A\u9009\u62E9\u8F7D\u5177")}
            </strong>
            <span>
              {entries.length}
              {t("/ 5 \u8F86")}
            </span>
          </div>
          <GameTabs
            id="vehicle-compare-mode"
            label={t("\u8F7D\u5177\u5BF9\u6BD4\u6570\u636E\u6A21\u5F0F")}
            value={mode}
            onValueChange={setMode}
            items={[
              { value: "ab", label: t("\u8857\u673A AB") },
              { value: "rb", label: t("\u5386\u53F2 RB") },
            ]}
          />
        </div>
        {entries.length ? (
          <>
            <div
              className="wt-vehicle-compare-scroll"
              tabIndex={0}
              aria-label={t(
                "\u8F7D\u5177\u6570\u636E\u5BF9\u6BD4\uFF0C\u53EF\u6A2A\u5411\u6EDA\u52A8",
              )}
            >
              <table
                className="wt-vehicle-compare-table"
                style={{ minWidth: 148 + entries.length * 300, width: 148 + entries.length * 300 }}
              >
                <thead>
                  <tr>
                    <th scope="col">
                      {t("\u5BF9\u6BD4\u8F7D\u5177")}
                      <small>{t("\u5361\u7247\u65C1\u53EF\u8BBE\u57FA\u51C6")}</small>
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
                                  ? t("{0} \u662F\u5F53\u524D\u57FA\u51C6", [entry.unit.name])
                                  : t("\u8BBE {0} \u4E3A\u57FA\u51C6", [entry.unit.name])
                              }
                              onClick={() => onSetBaseline(comparedVehicleKey(entry))}
                            >
                              {index === 0 ? t("\u57FA\u51C6") : t("\u8BBE\u57FA\u51C6")}
                            </button>
                            <button
                              type="button"
                              className="wt-vehicle-compare-remove"
                              onClick={() => removeEntry(comparedVehicleKey(entry))}
                              aria-label={t("\u79FB\u9664 {0}", [entry.unit.name])}
                              title={t("\u79FB\u9664\u8F7D\u5177")}
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
                  {section(t("\u5B8C\u5168\u4F53\u6027\u80FD"))}
                  {comparisonMetricRows(entries).map((metric) => {
                    const metrics = metric.metrics;
                    return (
                      <ComparisonRow
                        key={metric.key}
                        label={metric.label
                          .split(" · ")
                          .map((part) => localize(part))
                          .join(" · ")}
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
                              ? t("\u6D77\u62D4 {0} m", [combatNumber(item.altitudeM)])
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                        )}
                      />
                    );
                  })}
                  <ComparisonRow
                    label={t("\u6027\u80FD\u8D44\u6599\u91C7\u96C6")}
                    values={entries.map(
                      (entry) =>
                        entry.unit.wikiDetails?.performance?.checkedAt.slice(0, 10) || null,
                    )}
                  />
                  {(category === "aviation" || category === "helicopters") && (
                    <>
                      {section(t("\u6302\u8F7D\u80FD\u529B"))}
                      <tr>
                        <th scope="row">{t("\u652F\u6301\u6302\u8F7D")}</th>
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
                      {section(t("\u96F7\u8FBE\u4E0E\u63A2\u6D4B\u8BBE\u5907"))}
                      {(
                        [
                          ["radar", "model", t("\u96F7\u8FBE\uFF0F\u5149\u7535\u578B\u53F7")],
                          ["radar", "radar-band", t("\u96F7\u8FBE\u9891\u6BB5")],
                          [
                            "radar",
                            "radar-tws",
                            t("\u8FB9\u626B\u8FB9\u8DDF\u8E2A\uFF08TWS\uFF09"),
                          ],
                          ["radar", "radar-iff", t("\u654C\u6211\u8BC6\u522B")],
                          [
                            "radar_warning",
                            "model",
                            t("\u96F7\u8FBE\u544A\u8B66\u63A5\u6536\u673A"),
                          ],
                          ["radar_warning", "range", t("\u544A\u8B66\u63A2\u6D4B\u8DDD\u79BB")],
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
                      {section(t("\u88C5\u7532\u4E0E\u9632\u62A4"))}
                      <ComparisonRow
                        label={t("\u88C5\u7532\u7C7B\u578B")}
                        values={entries.map(
                          (entry) =>
                            entry.unit.wikiDetails?.performance?.groundCombat?.armorTypes
                              ?.map(equipmentLabel)
                              .join("、") || t("\u6765\u6E90\u672A\u6807\u660E"),
                        )}
                      />
                      {(
                        [
                          ["hull", t("\u8F66\u4F53")],
                          ["turret", t("\u70AE\u5854")],
                        ] as const
                      ).flatMap(([part, label]) =>
                        (
                          [
                            ["front", t("\u6B63\u9762")],
                            ["side", t("\u4FA7\u9762")],
                            ["rear", t("\u540E\u90E8")],
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
                        t("\u6B66\u5668\u4E0E\u5F39\u836F"),
                        <label className="wt-vehicle-compare-angle">
                          {t("\u7A7F\u6DF1\u53E3\u5F84")}
                          <GameSelect value={angle} onValueChange={setAngle}>
                            <option value="source">{t("\u6765\u6E90\u8868\u683C")}</option>
                            <option value="0">0°</option>
                            <option value="30">30°</option>
                            <option value="60">60°</option>
                          </GameSelect>
                        </label>,
                      )}
                      <tr>
                        <th scope="row">
                          {t("\u9009\u62E9\u5BF9\u6BD4\u5F39\u836F")}
                          <small>{t("\u5305\u542B\u5168\u90E8\u516C\u5F00\u5F39\u79CD")}</small>
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
                                  renderOption={(option) => {
                                    const item = available.find(
                                      (ammo) => ammo.key === option.value,
                                    );
                                    return item ? (
                                      <GroundShellLabel shell={item.shell} />
                                    ) : (
                                      option.label
                                    );
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
                                t("\u6765\u6E90\u672A\u63D0\u4F9B\u5F39\u836F\u8868")
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <ComparisonRow
                        label={t("\u6B66\u5668")}
                        values={shells.map((item) =>
                          item ? groundWeaponName(item.weapon.name) : null,
                        )}
                      />
                      <ComparisonRow
                        label={t("\u5F39\u836F\u7C7B\u578B")}
                        values={shells.map((item) =>
                          item
                            ? `${shellTypeName(item.shell.type)}${item.shell.type !== "belt" ? ` · ${item.shell.type}` : ""}`
                            : null,
                        )}
                      />
                      <ComparisonRow
                        label={t("\u53E3\u5F84")}
                        unit="mm"
                        values={shells.map((item) => item?.shell.caliberMm ?? null)}
                      />
                      <ComparisonRow
                        label={t("\u521D\u901F")}
                        unit={t("\u7C73/\u79D2")}
                        values={shells.map((item) => item?.shell.velocityMps ?? null)}
                      />
                      <ComparisonRow
                        label={t("\u5F39\u4F53\u8D28\u91CF")}
                        unit={t("\u5343\u514B")}
                        values={shells.map((item) => item?.shell.massKg ?? null)}
                      />
                      <ComparisonRow
                        label={t("TNT \u5F53\u91CF")}
                        unit={t("\u5343\u514B")}
                        values={shells.map((item) => item?.shell.tntKg ?? null)}
                      />
                      <ComparisonRow
                        label={t("\u88C5\u836F\u7C7B\u578B")}
                        values={shells.map(
                          (item) =>
                            item?.shell.parameters.find(
                              (parameter) => parameter.id === "explosive-type",
                            )?.value ?? null,
                        )}
                      />
                      <ComparisonRow
                        label={t("\u88C5\u836F\u91CF")}
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
                          label={t("{0} \u7C73\u7A7F\u6DF1", [distance])}
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
            <h3>{t("\u4ECE\u8F7D\u5177\u8BE6\u60C5\u52A0\u5165\u5BF9\u6BD4")}</h3>
            <p>
              {t(
                "\u6253\u5F00\u4E00\u8F86\u8F7D\u5177\uFF0C\u70B9\u51FB\u201C\u52A0\u5165\u5BF9\u6BD4\u201D\u3002\u9996\u8F86\u8F7D\u5177\u9501\u5B9A\u519B\u79CD\uFF0C\u6700\u591A\u53EF\u52A0\u5165 5 \u8F86\uFF1B\u5220\u9664\u5168\u90E8\u540E\u53EF\u5207\u6362\u519B\u79CD\u3002",
              )}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
