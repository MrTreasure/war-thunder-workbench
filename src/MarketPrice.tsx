import { t, getLocale, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { MarketPrice, Vehicle } from "./models";
import { cnyPrice } from "./PackPrice";

export function gjnPrice(cents: number) {
  const value = BigInt(cents);
  const fraction = value % 100n;
  return `${(value / 100n).toLocaleString(getLocale())}${fraction ? `.${String(fraction).padStart(2, "0")}` : ""} GJN`;
}
export function marketPriceLabel(price: MarketPrice | undefined) {
  return price?.amountGjnCents != null ? gjnPrice(price.amountGjnCents) : "暂无挂售价";
}
export function MarketPriceDetails({ unit }: { unit: Vehicle }) {
  useLocale();
  if (!unit.market) return null;
  const price = unit.marketPrice;
  const reference = price?.quoteKind === "user-reference-limit";
  return (
    <section className="pack-price-details" aria-label={t("交易所价格")}>
      <div className="pack-price-heading">
        <span>{localize(reference ? "交易所参考上限" : "交易所最低挂售价")}</span>
        <strong>{localize(marketPriceLabel(price))}</strong>
      </div>
      {localize(
        price?.referenceCnyCents != null && (
          <p>
            {t("折合人民币参考")}
            {localize(cnyPrice(price.referenceCnyCents))}
            {t("· 汇率日期")}
            {localize(price.fxDate)}
          </p>
        ),
      )}
      <p>
        {localize(
          reference
            ? "按已设定上限作估值参考，不是当前实际挂售订单。"
            : "可交易载具券的挂售报价；已激活载具不等同于可出售的载具券。",
        )}
      </p>
      {localize(
        price?.referenceLimitGjnCents != null && (
          <p>
            {t("估值参考上限")}
            {localize(gjnPrice(price.referenceLimitGjnCents))}
          </p>
        ),
      )}
      {localize(
        price && (
          <small>
            {t("报价核对于")}
            {localize(price.checkedAt.slice(0, 10))}
          </small>
        ),
      )}
    </section>
  );
}
