import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Wide source tables support keyboard scrolling. */
import { useState } from "react";
import type { Vehicle, WikiGroundShell, WikiGroundWeapon } from "./models";
import { GameSelect } from "./components/GameSelect";
import { loadoutWeaponName, loadoutParameterValue } from "./intl-loadout-presentation";
import display from "../data/ground-combat-display.json";
import { equipmentLabel } from "./intl-vehicle-equipment";
const weaponTerms = Object.entries(display.weaponTerms).sort(([a], [b]) => b.length - a.length);
const weaponPattern = new RegExp(`\\b(?:${weaponTerms.map(([term]) => term).join("|")})\\b`, "gi");
const weaponTranslations = new Map(weaponTerms);
export const groundWeaponName = (name: string) =>
  name.replace(weaponPattern, (term) => t(weaponTranslations.get(term.toLowerCase()) || term));
export const groundShellName = (name: string) =>
  t((display.shellNames as Record<string, string>)[name] || loadoutWeaponName(name));
export const combatNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: 6 })
    : "—";
export const shellTypeName = (type: string) =>
  t((display.shellTypes as Record<string, string>)[type] || type);
export function GroundShellLabel({ shell }: { shell: WikiGroundShell }) {
  useLocale();
  return (
    <span className="wt-ground-shell-label">
      {shell.imageUrl && (
        <img
          className="wt-ground-shell-icon"
          src={shell.imageUrl}
          alt=""
          width={28}
          height={28}
          loading="lazy"
        />
      )}
      <span>{groundShellName(shell.name)}</span>
    </span>
  );
}
function GroundWeapon({ weapon }: { weapon: WikiGroundWeapon }) {
  useLocale();
  const [selected, setSelected] = useState(weapon.shells[0]?.id || "");
  const shell = weapon.shells.find((item) => item.id === selected) || weapon.shells[0];
  const labels = display.parameterLabels as Record<string, string>;
  const angles = [...new Set(shell?.penetrationAngles.map((point) => point.angleDeg) || [])];
  const distances = display.distancesM;
  return (
    <article className="wt-ground-weapon">
      <div className="wt-ground-section-heading">
        <h4>{groundWeaponName(weapon.name)}</h4>
        <span>
          {weapon.ammunition === null
            ? t("\u5F39\u836F\u57FA\u6570\u672A\u63D0\u4F9B")
            : t("\u5F39\u836F\u57FA\u6570 {0} \u53D1", [weapon.ammunition])}
        </span>
      </div>
      {weapon.shells.length ? (
        <>
          <div
            className="wt-ground-table-scroll"
            tabIndex={0}
            aria-label={t("{0} \u5F39\u836F\u8868\uFF0C\u53EF\u6A2A\u5411\u6EDA\u52A8", [
              groundWeaponName(weapon.name),
            ])}
          >
            <table className="wt-ground-table wt-ground-ammunition-table">
              <thead>
                <tr>
                  <th scope="col">{t("\u5F39\u836F")}</th>
                  <th scope="col">{t("\u7C7B\u578B")}</th>
                  <th scope="col">
                    {t("\u521D\u901F")}
                    <br />
                    {t("\u7C73/\u79D2")}
                  </th>
                  <th scope="col">
                    {t("\u5F39\u4F53\u8D28\u91CF")}
                    <br />
                    {t("\u5343\u514B")}
                  </th>
                  <th scope="col">
                    {t("TNT \u5F53\u91CF")}
                    <br />
                    {t("\u5343\u514B")}
                  </th>
                  {display.distancesM.map((distance) => (
                    <th key={distance} scope="col">
                      {distance}
                      {t("\u7C73")}
                      <br />
                      {t("\u7A7F\u6DF1 mm")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weapon.shells.map((item) => (
                  <tr key={item.id} data-selected={item.id === shell?.id || undefined}>
                    <th scope="row">
                      <button
                        type="button"
                        className="wt-ground-shell-button"
                        onClick={() => setSelected(item.id)}
                        aria-pressed={item.id === shell?.id}
                      >
                        <GroundShellLabel shell={item} />
                      </button>
                    </th>
                    <td>
                      <span>{shellTypeName(item.type)}</span>
                      <small>{item.type === "belt" ? item.beltFilling : item.type}</small>
                    </td>
                    <td>{combatNumber(item.velocityMps)}</td>
                    <td>{combatNumber(item.massKg)}</td>
                    <td>{combatNumber(item.tntKg)}</td>
                    {display.distancesM.map((distance) => (
                      <td key={distance}>
                        {combatNumber(
                          item.penetration.find((point) => point.distanceM === distance)?.mm,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shell && (
            <section
              className="wt-ground-shell-detail"
              aria-label={t("\u9009\u4E2D\u5F39\u836F\u8BE6\u7EC6\u53C2\u6570")}
            >
              <label className="wt-ground-shell-select">
                {t("\u5F39\u836F\u8BE6\u60C5")}
                <GameSelect
                  value={shell.id}
                  onValueChange={setSelected}
                  renderOption={(option) => {
                    const item = weapon.shells.find((entry) => entry.id === option.value);
                    return item ? <GroundShellLabel shell={item} /> : option.label;
                  }}
                  renderValue={(value) => {
                    const item = weapon.shells.find((entry) => entry.id === value);
                    return item ? <GroundShellLabel shell={item} /> : value;
                  }}
                >
                  {weapon.shells.map((item) => (
                    <option value={item.id} key={item.id}>
                      {groundShellName(item.name)}
                    </option>
                  ))}
                </GameSelect>
              </label>
              <dl className="wt-ground-shell-parameters">
                {shell.parameters.map((parameter) => (
                  <div key={parameter.id}>
                    <dt>{t(labels[parameter.label] || parameter.label)}</dt>
                    <dd>{loadoutParameterValue(parameter.value)}</dd>
                  </div>
                ))}
                {!shell.parameters.length && (
                  <div>
                    <dt>{t("\u5F39\u94FE\u6784\u6210")}</dt>
                    <dd>
                      {shell.beltFilling ||
                        t("\u6765\u6E90\u672A\u63D0\u4F9B\u72EC\u7ACB\u5F39\u9053\u53C2\u6570")}
                    </dd>
                  </div>
                )}
              </dl>
              {angles.length > 0 && (
                <div
                  className="wt-ground-table-scroll"
                  tabIndex={0}
                  aria-label={t("\u4E0D\u540C\u8DDD\u79BB\u4E0E\u5C04\u89D2\u7684\u7A7F\u6DF1")}
                >
                  <table className="wt-ground-table wt-ground-angle-table">
                    <caption>
                      {t("\u6309\u6765\u6E90\u5C04\u89D2\u7684\u7A7F\u6DF1\uFF08mm\uFF09")}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{t("\u8DDD\u79BB")}</th>
                        {angles.map((angle) => (
                          <th key={angle} scope="col">
                            {angle}°
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {distances.map((distance) => (
                        <tr key={distance}>
                          <th scope="row">
                            {distance}
                            {t("\u7C73")}
                          </th>
                          {angles.map((angle) => (
                            <td key={angle}>
                              {combatNumber(
                                shell.penetrationAngles.find(
                                  (point) =>
                                    point.distanceM === distance && point.angleDeg === angle,
                                )?.mm,
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <p className="wt-dossier-empty">
          {t("Wiki \u672A\u63D0\u4F9B\u6B64\u6B66\u5668\u7684\u5F39\u836F\u53C2\u6570\u8868\u3002")}
        </p>
      )}
    </article>
  );
}
export function VehicleGroundCombat({ unit }: { unit: Vehicle }) {
  useLocale();
  const data = unit.wikiDetails?.performance?.groundCombat;
  return (
    <section
      className="wt-ground-combat"
      aria-label={t("\u88C5\u7532\u4E0E\u5F39\u836F\u8D44\u6599")}
    >
      <div className="wt-ground-section-heading">
        <h3>{t("\u88C5\u7532\u9632\u62A4")}</h3>
        <span>{t("\u6807\u79F0\u539A\u5EA6 \u00B7 mm")}</span>
      </div>
      <div className="wt-ground-armor-types">
        <span>{t("\u88C5\u7532\u7C7B\u578B")}</span>
        {data?.armorTypes?.length ? (
          data.armorTypes.map((type) => (
            <span className="wt-ground-armor-type" key={type}>
              {equipmentLabel(type)}
            </span>
          ))
        ) : (
          <span>{t("Wiki \u672A\u660E\u786E\u6807\u6CE8\u6750\u8D28\u7C7B\u578B")}</span>
        )}
      </div>
      {data?.armorStatus === "available" && data.armor.length ? (
        <>
          <div
            className="wt-ground-table-scroll"
            tabIndex={0}
            aria-label={t("\u88C5\u7532\u539A\u5EA6")}
          >
            <table className="wt-ground-table wt-ground-armor-table">
              <thead>
                <tr>
                  <th scope="col">{t("\u90E8\u4F4D")}</th>
                  <th scope="col">{t("\u6B63\u9762")}</th>
                  <th scope="col">{t("\u4FA7\u9762")}</th>
                  <th scope="col">{t("\u540E\u90E8")}</th>
                </tr>
              </thead>
              <tbody>
                {data.armor.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td>{row.front}</td>
                    <td>{row.side}</td>
                    <td>{row.rear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="wt-dossier-empty">
          {data?.armorStatus === "parse_failed"
            ? t(
                "\u88C5\u7532\u8D44\u6599\u89E3\u6790\u9700\u8981\u6838\u5BF9\uFF0C\u6682\u4E0D\u5C55\u793A\u672A\u9A8C\u8BC1\u6570\u503C\u3002",
              )
            : t(
                "\u6B64\u8F7D\u5177\u6682\u65E0\u5DF2\u6838\u9A8C\u7684\u88C5\u7532\u539A\u5EA6\u8D44\u6599\u3002",
              )}
        </p>
      )}
      <div className="wt-ground-section-heading">
        <h3>{t("\u6B66\u5668\u4E0E\u5F39\u836F")}</h3>
        <span>{t("\u70B9\u51FB\u5F39\u836F\u67E5\u770B\u8BE6\u7EC6\u53C2\u6570")}</span>
      </div>
      {data?.weaponsStatus === "available" && data.weapons.length ? (
        data.weapons.map((weapon) => (
          <GroundWeapon key={`${unit.id}:${weapon.id}`} weapon={weapon} />
        ))
      ) : (
        <p className="wt-dossier-empty">
          {t(
            "Wiki \u672A\u63D0\u4F9B\u6B64\u8F7D\u5177\u7684\u6B66\u5668\u4E0E\u5F39\u836F\u8868\u3002",
          )}
        </p>
      )}
      {data && (
        <p className="calc-note wt-ground-source">
          {t(
            "\u7A7F\u6DF1\u603B\u8868\u6CBF\u7528 Wiki \u8868\u683C\u53E3\u5F84\uFF1B\u8BE6\u7EC6\u53C2\u6570\u4FDD\u7559\u6765\u6E90\u63D0\u4F9B\u7684\u8DDD\u79BB\u4E0E\u5C04\u89D2\uFF0C\u672A\u77E5\u503C\u4EE5\u201C\u2014\u201D\u663E\u793A\u3002",
          )}
          <a href={data.source} target="_blank" rel="noreferrer">
            {t("\u5B98\u65B9 Wiki \u6765\u6E90 \u2197")}
          </a>{" "}
          {t("\u00B7 \u91C7\u96C6\u4E8E")}
          {data.checkedAt.slice(0, 10)}
        </p>
      )}
    </section>
  );
}
