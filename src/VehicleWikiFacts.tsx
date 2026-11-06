import { t, getLocale, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { Vehicle, WikiVehicleDetails } from "./models";
import { PackPriceDetails } from "./PackPrice";
import { MarketPriceDetails } from "./MarketPrice";
import { rpText } from "./TreeCanvas";
import { ResearchPoints } from "./ResearchPoints";
import { compactResearchPoints } from "./research-number-format";
import "./vehicle-wiki-facts.css";

const modeLabels = { ab: "街机 AB", rb: "历史 RB", sb: "全真 SB" };
const percent = (value: number | undefined) =>
  value === undefined ? "—" : `${value.toLocaleString(getLocale(), { maximumFractionDigits: 2 })}%`;
type RewardPercent = NonNullable<WikiVehicleDetails["rewards"]>["rp"];
function Reward({ value, mode }: { value: RewardPercent | undefined; mode: "ab" | "rb" | "sb" }) {
  return (
    <span
      title={localize(
        value && value.factor !== 1 && value.basePercent[mode] !== undefined
          ? `Wiki 显示：${value.factor} × ${value.basePercent[mode]}%`
          : undefined,
      )}
    >
      {localize(percent(value?.percent[mode]))}
    </span>
  );
}
export function VehicleWikiFacts({ unit }: { unit: Vehicle }) {
  useLocale();
  const details = unit.wikiDetails,
    rewards = details?.rewards;
  const purchase = details?.purchase;
  return (
    <div className="wt-vehicle-wiki">
      <section aria-labelledby="wt-vehicle-purchase-title">
        <h3 id="wt-vehicle-purchase-title">{t("获取与价格")}</h3>
        {localize(
          (unit.side === "research" || unit.kind === "squadron") && (
            <div className="wt-vehicle-price-line">
              <span>{localize(unit.kind === "squadron" ? "联队研发点" : "载具研发点")}</span>
              <strong>
                {localize(
                  unit.rp ? (
                    <ResearchPoints>{localize(compactResearchPoints(unit.rp))}</ResearchPoints>
                  ) : (
                    rpText(unit)
                  ),
                )}
              </strong>
            </div>
          ),
        )}
        {localize(
          unit.kind === "gold" && (
            <div className="wt-vehicle-price-line">
              <span>
                {localize(
                  unit.gePrice?.priceBasis === "derived_from_explicit_discount"
                    ? "金鹰常规参考价"
                    : "金鹰原价",
                )}
              </span>
              <strong>
                {localize(
                  unit.price === null ? "暂无报价" : `${unit.price.toLocaleString(getLocale())} GE`,
                )}
              </strong>
            </div>
          ),
        )}
        {localize(
          unit.gePrice && (
            <p className="wt-vehicle-facts-source">
              <a href={unit.gePrice.source} target="_blank" rel="noreferrer">
                {t("历史活动价")}
                {localize(unit.gePrice.historicalSaleGe.toLocaleString(getLocale()))}
                {t("GE · 优惠")}
                {localize(" ")}
                {localize(unit.gePrice.promotionPercent)}%
              </a>
              {localize(
                unit.gePrice.priceBasis === "derived_from_explicit_discount" &&
                  "；常规参考价依据同一官方公告的活动价与明确折扣推算，不是官方直接标价。",
              )}
            </p>
          ),
        )}
        {localize(
          unit.acquisition?.availabilityLabel && (
            <p
              className="wt-vehicle-facts-source"
              title={localize(unit.acquisition.availabilityReason)}
            >
              {localize(unit.acquisition.availabilityLabel)}
              {localize(
                unit.acquisition.availabilityReason
                  ? ` · ${t(unit.acquisition.availabilityReason)}`
                  : "",
              )}
            </p>
          ),
        )}
        {localize(
          purchase?.currency === "SL" && (
            <div className="wt-vehicle-price-line">
              <span>{t("银狮购车价")}</span>
              <strong>
                {localize(
                  purchase.amount === 0
                    ? "免费"
                    : `${purchase.amount.toLocaleString(getLocale())} SL`,
                )}
              </strong>
            </div>
          ),
        )}
        <PackPriceDetails unit={unit} />
        <MarketPriceDetails unit={unit} />
        {localize(
          purchase && (
            <small className="wt-vehicle-facts-source">
              {t("购车价核对：")}
              {localize(purchase.checkedAt.slice(0, 10))}
            </small>
          ),
        )}
        {localize(
          unit.rpCheckedAt && (unit.side === "research" || unit.kind === "squadron") && (
            <small className="wt-vehicle-facts-source">
              {t("研发点核对：")}
              {localize(unit.rpCheckedAt.slice(0, 10))}
            </small>
          ),
        )}
        {localize(
          unit.side !== "research" && !["gold", "pack", "squadron"].includes(unit.kind) && (
            <p className="wt-vehicle-facts-note">
              {t("通过对应活动、市场或其他获取渠道获得，具体可用状态以游戏和官方页面为准。")}
            </p>
          ),
        )}
      </section>
      <section aria-labelledby="wt-vehicle-rewards-title">
        <h3 id="wt-vehicle-rewards-title">{t("收益倍率")}</h3>
        {localize(
          rewards ? (
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
                  {localize(
                    (["ab", "rb", "sb"] as const).map((mode) => (
                      <tr key={mode}>
                        <th scope="row">{localize(modeLabels[mode])}</th>
                        <td>
                          <Reward value={rewards.rp} mode={mode} />
                        </td>
                        <td>
                          <Reward value={rewards.sl} mode={mode} />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
              <small className="wt-vehicle-facts-source">
                {t("Wiki 载具资料 ·")}
                {localize(rewards.checkedAt.slice(0, 10))}
              </small>
            </>
          ) : (
            <p className="wt-vehicle-facts-note">
              {localize(
                details?.rewardStatus?.state === "not_listed"
                  ? "官方页面暂未列出该载具的收益倍率。"
                  : "尚未采集到该载具的收益倍率。",
              )}
            </p>
          ),
        )}
        <p className="wt-vehicle-facts-note">
          {t("展示载具资料中的获取百分比，非单局最终收益；账号和活动加成以实际结算为准。")}
        </p>
      </section>
    </div>
  );
}
