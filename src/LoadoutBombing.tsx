import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { useMemo, useState } from "react";
import type { WikiLoadouts } from "./models";
import type { Mount } from "./loadouts";
import { allocateBases, bombingRules, loadoutBombs } from "./loadout-bombing";
import { matchesWeaponFilters } from "./loadout-weapon-filters";
import { loadoutWeaponName } from "./intl-loadout-presentation";
const kg = (grams: number) =>
  (grams / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
export function LoadoutBombing({
  data,
  mounts,
  preset,
  rating,
  mode,
}: {
  data: WikiLoadouts;
  mounts: Mount[];
  preset: string | null;
  rating: string | number | undefined;
  mode: string;
}) {
  useLocale();
  const [reference, setReference] = useState(false);
  const payload = useMemo(() => loadoutBombs(data, mounts, preset), [data, mounts, preset]);
  const rows = useMemo(
    () =>
      bombingRules.tiers.map((tier) => ({
        ...tier,
        allocation: reference
          ? allocateBases(payload.items, tier.hitPoints)
          : { count: 0, packs: [] as number[][], optimal: true, groups: [] },
      })),
    [payload, reference],
  );
  const capable =
    data.compatibility.some((option) => matchesWeaponFilters(option.name, "bomb", "")) ||
    data.presets.some((item) =>
      item.items.some((weapon) => matchesWeaponFilters(weapon.name, "bomb", "")),
    );
  if (!capable) return null;
  const br = Number(rating);
  const selected = payload.items.length > 0 || payload.unknown.length > 0;
  return (
    <section className="wt-mount-bombing" aria-label={t("战区轰炸")}>
      <div className="wt-mount-section-heading">
        <h4>{t("战区轰炸")}</h4>
        <span>{t("空历 \u00B7 四战区 \u00B7 可刷新")}</span>
      </div>
      {mode !== "rb" && (
        <p className="wt-mount-note">{t("以下只适用于空历，不套用当前街机或全真规则。")}</p>
      )}
      <dl>
        <div>
          <dt>{payload.unknown.length ? t("已知炸弹 TNT 当量") : t("炸弹总 TNT 当量")}</dt>
          <dd>
            {payload.items.length
              ? t("{0} 千克", [kg(payload.grams)])
              : selected
                ? t("未知")
                : t("尚未选择炸弹")}
          </dd>
        </div>
        {payload.items.map((item) => (
          <div key={item.key}>
            <dt>
              {loadoutWeaponName(item.name)} × {item.count}
            </dt>
            <dd>
              {kg(item.grams)}
              {t("千克／枚")}
            </dd>
          </div>
        ))}
      </dl>
      {!!payload.unknown.length && (
        <p className="wt-mount-warning">
          {t("以下挂载缺少明确当量、数量或普通爆炸伤害资料，未计入：")}
          {payload.unknown.map(loadoutWeaponName).join("、")}。
        </p>
      )}
      <label className="wt-mount-bombing-reference">
        <input
          type="checkbox"
          checked={reference}
          onChange={(event) => setReference(event.target.checked)}
        />
        {t("显示爆炸曲线参考")}
      </label>
      <p className="wt-mount-note">
        {t(
          "耐久来自游戏任务模板。TNT 不能按固定比例换算战区数量；曲线参考不计燃烧、破片、落点和特殊地图修正，尚未通过实测表校验。",
        )}
      </p>
      <div className="wt-mount-bombing-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("房间最高 BR")}</th>
              <th>{t("战区耐久")}</th>
              <th>{t("整枚配弹参考")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tier) => {
              const relevant =
                Number.isFinite(br) &&
                tier.brMin <= br + 1.001 &&
                (tier.brMax === null || tier.brMax >= br - 0.001);
              const pack = tier.allocation.packs[0];
              return (
                <tr key={tier.rankMin} data-relevant={relevant || undefined}>
                  <th>
                    {tier.brMax === null
                      ? `${tier.brMin.toFixed(1)}+`
                      : `${tier.brMin.toFixed(1)}–${tier.brMax.toFixed(1)}`}
                    {relevant && <small>{t("当前可能分房")}</small>}
                  </th>
                  <td>{tier.hitPoints.toLocaleString(getLocale())} HP</td>
                  <td>
                    {!reference ? (
                      t("待实测校验")
                    ) : !selected ? (
                      t("先选择炸弹")
                    ) : !payload.items.some((item) => item.damage !== null) ? (
                      t("伤害资料不足")
                    ) : (
                      <>
                        <strong>
                          {tier.allocation.count}
                          {t("个")}
                          {!tier.allocation.optimal ? t("（已找到方案）") : ""}
                        </strong>
                        {(payload.unknown.length > 0 ||
                          payload.items.some((item) => item.damage === null)) && (
                          <small>{t("仅含已知炸弹")}</small>
                        )}
                        {pack && (
                          <details>
                            <summary>{t("单区配弹")}</summary>
                            <ul>
                              {pack.map(
                                (count, index) =>
                                  count > 0 && (
                                    <li key={index}>
                                      {loadoutWeaponName(tier.allocation.groups![index].name)} ×{" "}
                                      {count}
                                    </li>
                                  ),
                              )}
                            </ul>
                            <p>
                              {t("单区")}{" "}
                              {kg(
                                pack.reduce(
                                  (sum, count, index) =>
                                    sum + count * tier.allocation.groups![index].grams,
                                  0,
                                ),
                              )}{" "}
                              {t("千克 TNT")}
                            </p>
                          </details>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="wt-mount-weapon-more">
        <summary>{t("规则与计算来源")}</summary>
        <p>
          {t(
            "按任务分房级别划为六档；表中 BR 指房间最高 BR。整枚配弹逐枚计算爆炸曲线，再分配到不同战区，不把多余伤害或半枚炸弹挪给下一战区。",
          )}
        </p>
        <p>{t("燃烧弹及缺少明确当量的组合不按普通高爆炸弹补值。")}</p>
        {bombingRules.sources.map((source, index) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
            {index === 0 ? t("游戏战区耐久模板") : t("游戏爆炸曲线配置")}
            {t("（公开镜像）\u2197")}
          </a>
        ))}
        <a href={bombingRules.referenceUrl} target="_blank" rel="noopener noreferrer">
          {t("实测表维护者说明 \u2197")}
        </a>
      </details>
    </section>
  );
}
