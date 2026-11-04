/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Wide source tables support keyboard scrolling. */
import { useState } from "react";
import type { Vehicle, WikiGroundShell, WikiGroundWeapon } from "./models";
import { GameSelect } from "./components/GameSelect";
import { loadoutWeaponName, loadoutParameterValue } from "./loadout-presentation";
import display from "../data/ground-combat-display.json";
import { equipmentLabel } from "./vehicle-equipment";
import { VehicleArmorEstimate } from "./VehicleArmorEstimate";

const weaponTerms = Object.entries(display.weaponTerms).sort(([a], [b]) => b.length - a.length);
const weaponPattern = new RegExp(`\\b(?:${weaponTerms.map(([term]) => term).join("|")})\\b`, "gi");
const weaponTranslations = new Map(weaponTerms);
export const groundWeaponName = (name: string) =>
  name.replace(weaponPattern, (term) => weaponTranslations.get(term.toLowerCase()) || term);
export const groundShellName = (name: string) =>
  (display.shellNames as Record<string, string>)[name] || loadoutWeaponName(name);

export const combatNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN", { maximumFractionDigits: 6 })
    : "—";
export const shellTypeName = (type: string) =>
  (display.shellTypes as Record<string, string>)[type] || type;
export function GroundShellLabel({ shell }: { shell: WikiGroundShell }) {
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
          {weapon.ammunition === null ? "弹药基数未提供" : `弹药基数 ${weapon.ammunition} 发`}
        </span>
      </div>
      {weapon.shells.length ? (
        <>
          <div
            className="wt-ground-table-scroll"
            tabIndex={0}
            aria-label={`${groundWeaponName(weapon.name)} 弹药表，可横向滚动`}
          >
            <table className="wt-ground-table wt-ground-ammunition-table">
              <thead>
                <tr>
                  <th scope="col">弹药</th>
                  <th scope="col">类型</th>
                  <th scope="col">
                    初速
                    <br />
                    米/秒
                  </th>
                  <th scope="col">
                    弹体质量
                    <br />
                    千克
                  </th>
                  <th scope="col">
                    TNT 当量
                    <br />
                    千克
                  </th>
                  {display.distancesM.map((distance) => (
                    <th key={distance} scope="col">
                      {distance} 米<br />
                      穿深 mm
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
            <section className="wt-ground-shell-detail" aria-label="选中弹药详细参数">
              <label className="wt-ground-shell-select">
                弹药详情
                <GameSelect
                  value={shell.id}
                  onValueChange={setSelected}
                  renderOption={(value) => {
                    const item = weapon.shells.find((entry) => entry.id === value);
                    return item ? <GroundShellLabel shell={item} /> : value;
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
                    <dt>{labels[parameter.label] || parameter.label}</dt>
                    <dd>{loadoutParameterValue(parameter.value)}</dd>
                  </div>
                ))}
                {!shell.parameters.length && (
                  <div>
                    <dt>弹链构成</dt>
                    <dd>{shell.beltFilling || "来源未提供独立弹道参数"}</dd>
                  </div>
                )}
              </dl>
              {angles.length > 0 && (
                <div
                  className="wt-ground-table-scroll"
                  tabIndex={0}
                  aria-label="不同距离与射角的穿深"
                >
                  <table className="wt-ground-table wt-ground-angle-table">
                    <caption>按来源射角的穿深（mm）</caption>
                    <thead>
                      <tr>
                        <th scope="col">距离</th>
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
                          <th scope="row">{distance} 米</th>
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
        <p className="wt-dossier-empty">Wiki 未提供此武器的弹药参数表。</p>
      )}
    </article>
  );
}
export function VehicleGroundCombat({ unit }: { unit: Vehicle }) {
  const data = unit.wikiDetails?.performance?.groundCombat;
  return (
    <section className="wt-ground-combat" aria-label="装甲与弹药资料">
      <div className="wt-ground-section-heading">
        <h3>装甲防护</h3>
        <span>标称厚度 · mm</span>
      </div>
      <div className="wt-ground-armor-types">
        <span>装甲类型</span>
        {data?.armorTypes?.length ? (
          data.armorTypes.map((type) => (
            <span className="wt-ground-armor-type" key={type}>
              {equipmentLabel(type)}
            </span>
          ))
        ) : (
          <span>Wiki 未明确标注材质类型</span>
        )}
      </div>
      {data?.armorStatus === "available" && data.armor.length ? (
        <>
          <div className="wt-ground-table-scroll" tabIndex={0} aria-label="装甲厚度">
            <table className="wt-ground-table wt-ground-armor-table">
              <thead>
                <tr>
                  <th scope="col">部位</th>
                  <th scope="col">正面</th>
                  <th scope="col">侧面</th>
                  <th scope="col">后部</th>
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
          <VehicleArmorEstimate unit={unit} />
        </>
      ) : (
        <p className="wt-dossier-empty">
          {data?.armorStatus === "parse_failed"
            ? "装甲资料解析需要核对，暂不展示未验证数值。"
            : "此载具暂无已核验的装甲厚度资料。"}
        </p>
      )}
      <div className="wt-ground-section-heading">
        <h3>武器与弹药</h3>
        <span>点击弹药查看详细参数</span>
      </div>
      {data?.weaponsStatus === "available" && data.weapons.length ? (
        data.weapons.map((weapon) => (
          <GroundWeapon key={`${unit.id}:${weapon.id}`} weapon={weapon} />
        ))
      ) : (
        <p className="wt-dossier-empty">Wiki 未提供此载具的武器与弹药表。</p>
      )}
      {data && (
        <p className="calc-note wt-ground-source">
          穿深总表沿用 Wiki 表格口径；详细参数保留来源提供的距离与射角，未知值以“—”显示。
          <a href={data.source} target="_blank" rel="noreferrer">
            官方 Wiki 来源 ↗
          </a>{" "}
          · 采集于 {data.checkedAt.slice(0, 10)}
        </p>
      )}
    </section>
  );
}
