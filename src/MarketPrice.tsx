import type { MarketPrice, Vehicle } from "./models";

export function gjnPrice(cents: number) {
  const value = BigInt(cents);
  const fraction = value % 100n;
  return `${(value / 100n).toLocaleString("zh-CN")}${fraction ? `.${String(fraction).padStart(2, "0")}` : ""} GJN`;
}
export function marketPriceLabel(price: MarketPrice | undefined) {
  return price?.amountGjnCents != null ? gjnPrice(price.amountGjnCents) : "暂无挂售价";
}
export function MarketPriceDetails({ unit }: { unit: Vehicle }) {
  if (!unit.market) return null;
  const price = unit.marketPrice;
  const reference = price?.quoteKind === "user-reference-limit";
  return (
    <section className="pack-price-details" aria-label="交易所价格">
      <div className="pack-price-heading">
        <span>{reference ? "交易所参考上限" : "交易所最低挂售价"}</span>
        <strong>{marketPriceLabel(price)}</strong>
      </div>
      <p>
        {reference
          ? "按已设定上限作估值参考，不是当前实际挂售订单。"
          : "可交易载具券的挂售报价；已激活载具不等同于可出售的载具券。"}
      </p>
      {price?.referenceLimitGjnCents != null && (
        <p>估值参考上限 {gjnPrice(price.referenceLimitGjnCents)}</p>
      )}
      {price && <small>报价核对于 {price.checkedAt.slice(0, 10)}</small>}
    </section>
  );
}
