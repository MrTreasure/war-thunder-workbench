import { useLocale } from "./i18n/react";
import { t, getLocale } from "./i18n/core";
import { useMemo } from "react";
import type { WikiLoadouts } from "./models";
import type { Mount } from "./loadouts";
import {
  estimateBombingTiers,
  bombingRules,
  loadoutBombs,
  bombingRewardCoefficient,
} from "./loadout-bombing";
import { matchesWeaponFilters } from "./loadout-weapon-filters";
import { loadoutWeaponName } from "./intl-loadout-presentation";
const kg = (grams: number) =>
  (grams / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 3 });
type Estimate = ReturnType<typeof estimateBombingTiers>[number];
const bracket = (tier: Estimate) =>
  tier.brMax === null
    ? `${tier.brMin.toFixed(1)}+`
    : `${tier.brMin.toFixed(1)}–${tier.brMax.toFixed(1)}`;
export function LoadoutBombing({
  data,
  mounts,
  preset,
  airRbRating,
  mode,
  category,
  premium,
  role,
}: {
  data: WikiLoadouts;
  mounts: Mount[];
  preset: string | null;
  airRbRating: string | undefined;
  mode: string;
  category?: string;
  premium?: boolean;
  role?: string | null;
}) {
  useLocale();
  const payload = useMemo(() => loadoutBombs(data, mounts, preset), [data, mounts, preset]);
  const rows = useMemo(() => estimateBombingTiers(payload, airRbRating), [payload, airRbRating]);
  const capable =
    data.compatibility.some((option) => matchesWeaponFilters(option.name, "bomb", "")) ||
    data.presets.some((item) =>
      item.items.some((weapon) => matchesWeaponFilters(weapon.name, "bomb", "")),
    );
  if (!capable || category === "helicopters") return null;
  const current = rows.filter((row) => row.relevant);
  const other = current.length ? rows.filter((row) => !row.relevant) : [];
  const br = airRbRating === undefined || airRbRating === "" ? NaN : Number(airRbRating);
  const selected = payload.items.length > 0 || payload.unknown.length > 0;
  const bombCount = payload.items.reduce((sum, item) => sum + item.count, 0);
  const reward = payload.completeDamage
    ? bombingRewardCoefficient(payload.damage, premium, role)
    : null;
  const number = (value: number) => value.toLocaleString(getLocale(), { maximumFractionDigits: 3 });
  const table = (entries: Estimate[], label: string) => (
    <div className="wt-mount-bombing-scroll">
      <table aria-label={label}>
        <thead>
          <tr>
            <th scope="col">{t("房间最高 BR")}</th>
            <th scope="col">{t("战区耐久")}</th>
            <th scope="col">{t("预计可炸战区")}</th>
            <th scope="col">{t("配弹方案")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((row) => (
            <tr key={row.rankMin} data-relevant={row.relevant || undefined}>
              <th scope="row">{bracket(row)}</th>
              <td className="wt-mount-bombing-hp">
                <span className="wt-mount-bombing-mobile-label">{t("耐久")}</span>
                {number(row.hitPoints)} HP
                <small className="wt-mount-bombing-threshold">
                  {t("自毁门槛")}
                  {number(row.burnoutHitPoints)}
                </small>
              </td>
              <td className="wt-mount-bombing-count">
                <strong>
                  {row.count !== null
                    ? t("{0} 个", [row.count])
                    : row.status === "empty"
                      ? t("先选择炸弹")
                      : row.status === "unknown"
                        ? t("资料不足")
                        : t("待核验")}
                </strong>
                {row.status === "partial" && <small>{t("仅含已知炸弹")}</small>}
                {row.count !== null && row.directAllocation.count < row.allocation.count && (
                  <small>{t("含燃烧后摧毁")}</small>
                )}
                {!row.allocation.optimal && <small>{t("已找到的分配")}</small>}
              </td>
              <td className="wt-mount-bombing-packs">
                {row.allocation.packs.length ? (
                  row.allocation.packs.map((pack, index) => (
                    <div key={index}>
                      <span>
                        {row.allocation.packs.length === 1
                          ? t("单区")
                          : t("第 {0} 区", [index + 1])}
                      </span>
                      <p>
                        {pack
                          .flatMap((count, group) =>
                            count > 0
                              ? [
                                  `${loadoutWeaponName(row.allocation.groups[group].name)} × ${count}`,
                                ]
                              : [],
                          )
                          .join(" + ")}
                      </p>
                    </div>
                  ))
                ) : (
                  <span className="wt-mount-note">
                    {row.status === "empty"
                      ? "—"
                      : row.status === "unconfirmed"
                        ? t("剩余挂载资料不足以确认完整战区数量")
                        : t("缺少可用的完整配弹数据")}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <section className="wt-mount-bombing" aria-label={t("战区轰炸")}>
      <div className="wt-mount-section-heading">
        <h4>{t("战区轰炸")}</h4>
        <span>{t("空历 \u00B7 四战区 \u00B7 可刷新")}</span>
      </div>
      <div className="wt-mount-bombing-metrics">
        <div>
          <span>{payload.unknown.length ? t("已知炸弹 TNT 当量") : t("炸弹总 TNT 当量")}</span>
          <strong>
            {payload.items.length
              ? t("{0} 千克", [kg(payload.grams)])
              : selected
                ? t("未知")
                : t("尚未选择炸弹")}
          </strong>
        </div>
        <div>
          <span>{t("已知炸弹数量")}</span>
          <strong>{selected ? t("{0} 枚", [bombCount]) : "—"}</strong>
        </div>
        <div>
          <span>{t("飞机空历权重")}</span>
          <strong>{Number.isFinite(br) && br >= 1 ? br.toFixed(1) : t("未知")}</strong>
        </div>
        <div>
          <span>{t("炸弹合计伤害")}</span>
          <strong>{payload.items.length ? number(payload.damage) : "—"}</strong>
          {!payload.completeDamage && <small>{t("已知部分")}</small>}
        </div>
        <div>
          <span>{t("战区收益系数")}</span>
          <strong>
            {reward === null
              ? "—"
              : `${reward.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ×`}
          </strong>
          <small>{t("按炸弹部分计算")}</small>
        </div>
      </div>
      {!!payload.items.length && (
        <div className="wt-mount-bombing-payload">
          {payload.items.map((item) => (
            <div key={item.key}>
              <span>
                {loadoutWeaponName(item.name)} × {item.count}
              </span>
              <small>
                {kg(item.grams)}
                {t("千克 TNT／枚")}
              </small>
              <small>
                {t("单枚伤害")}
                {item.damage === null ? t("未知") : number(item.damage)}
              </small>
            </div>
          ))}
        </div>
      )}
      {mode !== "rb" && (
        <p className="wt-mount-note">{t("按飞机空历权重计算，不套用当前街机或全真规则。")}</p>
      )}
      {!!payload.unknown.length && (
        <p className="wt-mount-warning">
          {t("以下挂载资料不完整，未计入：")}
          {payload.unknown.map((name) => loadoutWeaponName(name)).join("、")}。
        </p>
      )}
      <p className="wt-mount-bombing-caption">
        {current.length ? t("当前可能分房 \u00B7 随挂载自动更新") : t("空历权重未知，列出全部档位")}
      </p>
      {table(current.length ? current : rows, t("当前分房的战区估算"))}
      {!!other.length && (
        <details className="wt-mount-bombing-other">
          <summary>{t("查看其他 BR 档位")}</summary>
          {table(other, t("其他分房的战区估算"))}
        </details>
      )}
      <p className="wt-mount-bombing-caveat">
        {t("按炸弹全部有效命中估算，包含战区燃烧后摧毁；特殊地图不套用此规则。")}
      </p>
      <details className="wt-mount-bombing-sources">
        <summary>{t("计算口径与来源")}</summary>
        <p>
          {t(
            "按房间最高 BR 选择战区耐久；剩余 HP 达到 10% 的燃烧自毁门槛时即可停止配弹，逐枚分配，多余伤害不转移到下一战区。",
          )}
        </p>
        <p>
          {t(
            "普通高爆炸弹按游戏伤害曲线和战区装甲参数计算。收益系数复用游戏挂载算法与界面显示口径，结合金币机和战斗机属性；它不是实际银狮或研发点收益。",
          )}
        </p>
        <p>{t("燃烧弹及资料不完整的组合保留未知，不补零。")}</p>
        {bombingRules.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
            {t(source.label)}
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
