import { t, getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { Catalog, Vehicle, WikiVehicleDetails } from "./models";
import { PackPriceDetails } from "./PackPrice";
import { rpText } from "./TreeCanvas";
import "./vehicle-wiki-facts.css";

const modeLabels = { ab: "街机 AB", rb: "历史 RB", sb: "全真 SB" };
const percent = (value: number | undefined) =>
  value === undefined ? "—" : `${value.toLocaleString(getLocale(), { maximumFractionDigits: 2 })}%`;
type RewardPercent = NonNullable<WikiVehicleDetails["rewards"]>["rp"];
function Reward({ value, mode }: { value: RewardPercent | undefined; mode: "ab" | "rb" | "sb" }) {
  return (
    <span
      title={
        value && value.factor !== 1 && value.basePercent[mode] !== undefined
          ? t("Wiki 显示：{0} × {1}%", [value.factor, value.basePercent[mode]])
          : undefined
      }
    >
      {percent(value?.percent[mode])}
    </span>
  );
}
export function VehicleWikiFacts({
  unit,
  catalog,
  country,
  category,
}: {
  unit: Vehicle;
  catalog: Catalog;
  country: string;
  category: string;
}) {
  useLocale();
  const details = unit.wikiDetails,
    rewards = details?.rewards;
  const purchase = details?.purchase;
  return (
    <div className="wt-vehicle-wiki">
      <section aria-labelledby="wt-vehicle-basic-title">
        <h3 id="wt-vehicle-basic-title">{t("基础资料")}</h3>
        <dl className="wt-vehicle-facts">
          <div>
            <dt>{t("国家 / 军种")}</dt>
            <dd>
              {t(catalog.countries[country])} · {t(catalog.categories[category])}
            </dd>
          </div>
          <div>
            <dt>{t("阶级")}</dt>
            <dd>Rank {unit.rank}</dd>
          </div>
          <div>
            <dt>{t("载具类型")}</dt>
            <dd>{t(unit.role ? catalog.roles[unit.role] || unit.role : "暂无资料")}</dd>
          </div>
          <div>
            <dt>{t("获取类别")}</dt>
            <dd>
              {t(unit.side === "research" ? "常规研发" : catalog.kinds[unit.kind] || "特殊载具")}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="wt-vehicle-purchase-title">
        <h3 id="wt-vehicle-purchase-title">{t("获取与价格")}</h3>
        {(unit.side === "research" || unit.kind === "squadron") && (
          <div className="wt-vehicle-price-line">
            <span>{t(unit.kind === "squadron" ? "联队研发点" : "载具研发点")}</span>
            <strong>{t(rpText(unit))}</strong>
          </div>
        )}
        {unit.kind === "gold" && (
          <div className="wt-vehicle-price-line">
            <span>{t("金鹰原价")}</span>
            <strong>
              {unit.price === null ? t("暂无报价") : `${unit.price.toLocaleString(getLocale())} GE`}
            </strong>
          </div>
        )}
        {purchase?.currency === "SL" && (
          <div className="wt-vehicle-price-line">
            <span>{t("银狮购车价")}</span>
            <strong>
              {purchase.amount === 0
                ? t("免费")
                : `${purchase.amount.toLocaleString(getLocale())} SL`}
            </strong>
          </div>
        )}
        <PackPriceDetails unit={unit} />
        {purchase && (
          <small className="wt-vehicle-facts-source">
            {t("购车价核对：{0}", [purchase.checkedAt.slice(0, 10)])}
          </small>
        )}
        {unit.rpCheckedAt && (unit.side === "research" || unit.kind === "squadron") && (
          <small className="wt-vehicle-facts-source">
            {t("研发点核对：{0}", [unit.rpCheckedAt.slice(0, 10)])}
          </small>
        )}
        {unit.side !== "research" && !["gold", "pack", "squadron"].includes(unit.kind) && (
          <p className="wt-vehicle-facts-note">
            {t("通过对应活动、市场或其他获取渠道获得，具体可用状态以游戏和官方页面为准。")}
          </p>
        )}
      </section>
      <section aria-labelledby="wt-vehicle-rewards-title">
        <h3 id="wt-vehicle-rewards-title">{t("收益倍率")}</h3>
        {rewards ? (
          <>
            <table className="wt-vehicle-reward-table">
              <thead>
                <tr>
                  <th scope="col">{t("模式")}</th>
                  <th scope="col">{t("研发点")}</th>
                  <th scope="col">{t("银狮")}</th>
                </tr>
              </thead>
              <tbody>
                {(["ab", "rb", "sb"] as const).map((mode) => (
                  <tr key={mode}>
                    <th scope="row">{t(modeLabels[mode])}</th>
                    <td>
                      <Reward value={rewards.rp} mode={mode} />
                    </td>
                    <td>
                      <Reward value={rewards.sl} mode={mode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="wt-vehicle-facts-source">
              {t("Wiki 载具资料 · {0}", [rewards.checkedAt.slice(0, 10)])}
            </small>
          </>
        ) : (
          <p className="wt-vehicle-facts-note">{t("暂无已采集的收益倍率。")}</p>
        )}
        <p className="wt-vehicle-facts-note">
          {t("展示载具资料中的获取百分比，非单局最终收益；账号和活动加成以实际结算为准。")}
        </p>
      </section>
    </div>
  );
}
