export type SaleChannel = "sl" | "ge" | "pack" | "bundle" | "premium";
export type SaleEvent = {
  id: string;
  family: string;
  phase: string;
  title: string;
  year: number;
  status: "confirmed" | "predicted";
  startAt: string;
  endAt: string;
  startPrecision?: string;
  startWindow?: string[];
  endWindow?: string[];
  countries: string[];
  categories: string[];
  channels: SaleChannel[];
  coverage: string;
  vehicleIds: string[];
  excludedVehicleIds: string[];
  discounts: { channel: SaleChannel; percentOff: number }[];
  notes: string;
  sources: { url: string; title: string; checkedAt: string }[];
  basis?: { year: number; startAt: string; endAt: string; method: string };
};
export type SaleVehicle = {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  category: string;
  channel: SaleChannel | "market" | "excluded" | "unknown";
  image: string;
  rank: string;
  originalPrice?: {
    currency: "GE" | "CNY";
    amount: number | null;
    checkedAt: string | null;
    source: string | null;
  } | null;
  store: string | null;
  market: string | null;
};
export type SaleCalendarData = {
  serverNow: string;
  checkedAt: string;
  nextCheckAt: string | null;
  lastAttemptAt: string | null;
  updateStatus: string;
  events: SaleEvent[];
};
export const saleChannels: Record<string, string> = {
  sl: "银狮购车",
  ge: "金鹰购车",
  pack: "商城礼包",
  bundle: "组合礼包",
  premium: "高级账号",
  market: "交易所",
  excluded: "联队载具",
  unknown: "购买方式待核对",
};
export function matchesSale(vehicle: SaleVehicle, event: SaleEvent): boolean {
  if (["market", "excluded", "unknown"].includes(vehicle.channel)) return false;
  if (event.countries.length && !event.countries.includes(vehicle.country)) return false;
  if (event.categories.length && !event.categories.includes(vehicle.category)) return false;
  if (event.excludedVehicleIds.includes(vehicle.id)) return false;
  if (event.coverage === "explicit" && !event.vehicleIds.includes(vehicle.id)) return false;
  return (
    event.channels.includes(vehicle.channel as SaleChannel) ||
    (event.channels.includes("bundle") && ["pack", "ge"].includes(vehicle.channel))
  );
}
export function nextSale(vehicle: SaleVehicle, events: SaleEvent[], now: number): SaleEvent | null {
  return (
    events
      .filter(
        (event) =>
          matchesSale(vehicle, event) &&
          Date.parse(
            event.status === "predicted" ? event.endWindow?.[1] || event.endAt : event.endAt,
          ) > now,
      )
      .sort(
        (a, b) =>
          Math.max(now, Date.parse(a.startAt)) - Math.max(now, Date.parse(b.startAt)) ||
          Number(a.status === "predicted") - Number(b.status === "predicted"),
      )[0] || null
  );
}
export function saleCountdown(event: SaleEvent, now: number): string {
  const start = Date.parse(event.startAt),
    end = Date.parse(event.endAt);
  if (event.status === "predicted" && event.startWindow && now >= Date.parse(event.startWindow[0]))
    return "已进入预测窗口";
  if (now >= end) return "已结束";
  const seconds = Math.max(0, Math.floor(((now >= start ? end : start) - now) / 1000));
  const days = Math.floor(seconds / 86400),
    hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return `${event.status === "predicted" ? "预计距开始" : now >= start ? "距结束" : "距开始"} ${days ? days + "天 " : ""}${hours}时 ${minutes}分${event.status === "predicted" ? "" : " " + (seconds % 60) + "秒"}`;
}
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
});
export const saleDate = (value: string) => dateFormatter.format(new Date(value));
export function saleRange(event: SaleEvent): string {
  if (event.status === "predicted" && event.startWindow && event.endWindow)
    return `可能于 ${saleDate(event.startWindow[0])}—${saleDate(event.startWindow[1])} 开始 · 可能于 ${saleDate(event.endWindow[0])}—${saleDate(event.endWindow[1])} 结束`;
  return `${saleDate(event.startAt)}—${saleDate(event.endAt)}`;
}
export function saleRate(event: SaleEvent, channel?: string): string {
  const rates = [
    ...new Set(
      event.discounts.filter((r) => !channel || r.channel === channel).map((r) => r.percentOff),
    ),
  ].sort((a, b) => a - b);
  if (!rates.length)
    return channel && event.channels.includes("bundle") ? "组合价与条件见公告" : "力度见公告";
  const label =
    rates.length === 1
      ? `${(100 - rates[0]) / 10}折`
      : `${(100 - rates[rates.length - 1]) / 10}—${(100 - rates[0]) / 10}折`;
  return `${event.status === "predicted" ? "往年 " : ""}${label}`;
}

/** Calendar date independent of the visitor's OS timezone. */
export function beijingDayKey(value: string | number): string {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10);
}
export function saleCalendarSpan(event: SaleEvent): { start: string; end: string } {
  return {
    start: beijingDayKey(
      event.status === "predicted" ? event.startWindow?.[0] || event.startAt : event.startAt,
    ),
    end: beijingDayKey(
      event.status === "predicted" ? event.endWindow?.[1] || event.endAt : event.endAt,
    ),
  };
}
export const isSaleWatchVehicle = (vehicle: Pick<SaleVehicle, "channel">) =>
  ["ge", "pack", "bundle"].includes(vehicle.channel);

/** One interval per event; retain its lane when it continues into the next week. */
export function placeSaleCalendarRanges(events: SaleEvent[], firstDay: string, lastDay: string) {
  const intervals = events
    .map((event) => ({ event, ...saleCalendarSpan(event) }))
    .filter((item) => item.start <= lastDay && item.end >= firstDay)
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.end.localeCompare(b.end) ||
        a.event.id.localeCompare(b.event.id),
    );
  const laneEnds: string[] = [];
  return intervals.map((item) => {
    let lane = laneEnds.findIndex((end) => end < item.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    return { ...item, lane };
  });
}

export function saleOriginalPrice(vehicle: SaleVehicle): string {
  const price = vehicle.originalPrice;
  if (!price || !Number.isSafeInteger(price.amount) || price.amount === null || price.amount <= 0)
    return vehicle.channel === "ge" ? "金鹰原价待报价" : "礼包原价待报价";
  if (price.currency === "GE") return `原价 ${price.amount.toLocaleString("zh-CN")} 金鹰`;
  const cents = BigInt(price.amount);
  return `礼包原价 ¥ ${(cents / 100n).toLocaleString("zh-CN")}.${(cents % 100n).toString().padStart(2, "0")} · 整包`;
}
