import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
import type { Vehicle } from "./models";

export function cnyPrice(cents: number) {
  const value = BigInt(cents);
  const fraction = value % 100n;
  return `¥${(value / 100n).toLocaleString(getLocale())}${fraction ? `.${fraction.toString().padStart(2, "0")}` : ""}`;
}
export function packPriceLabel(unit: Vehicle) {
  const price = unit.packPrice;
  return price?.status === "priced" && price.amountCents !== null
    ? `礼包 ${cnyPrice(price.amountCents)}`
    : "礼包 · 暂无报价";
}
export function PackPriceDetails({ unit }: { unit: Vehicle }) {
  useLocale();

  if (unit.kind !== "pack") return null;
  const price = unit.packPrice;
  const priced = price?.status === "priced" && price.amountCents !== null;
  return (
    <section className="pack-price-details" aria-label={t("礼包人民币价格")}>
      <div className="pack-price-heading">
        <span>{t("官方礼包价格 · 人民币")}</span>
        <strong>{localize(priced ? cnyPrice(price.amountCents!) : "暂无报价")}</strong>
        {localize(
          priced &&
            price.regularAmountCents !== null &&
            price.regularAmountCents > price.amountCents! && (
              <del aria-label={localize(`原价 ${localize(cnyPrice(price.regularAmountCents))}`)}>
                {localize(cnyPrice(price.regularAmountCents))}
              </del>
            ),
        )}
      </div>
      {localize(price?.title && <p>{localize(price.title)}</p>)}
      <p>
        {localize(
          priced
            ? "整包售价，包含商店列出的载具及附赠内容；实际支付以商店结算为准。"
            : "当前未查到可核实的人民币价格，是否在售请查看官方商店。",
        )}
      </p>
      {localize(
        price && (
          <small>
            {t("价格核对于")}
            {localize(price.checkedAt.slice(0, 10))}
          </small>
        ),
      )}
    </section>
  );
}
