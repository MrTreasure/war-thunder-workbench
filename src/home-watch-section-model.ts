import { t, getLocale } from "./i18n/core";
import type { SaleEvent, SaleVehicle } from "./sale-calendar-model";
import { matchesSale } from "./sale-event-matching";

export const HOME_WATCH_PAGE_SIZE = 4;
export function homeWatchPage(total: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / HOME_WATCH_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Math.floor(requested) || 1));
  return { page, pages, offset: (page - 1) * HOME_WATCH_PAGE_SIZE };
}

/** Participation and rate are separate facts; channel-wide ranges do not establish a vehicle's rate. */
export function homeWatchActiveSale(vehicle: SaleVehicle, events: SaleEvent[], now: number) {
  const active = events
    .filter(
      (event) =>
        event.status === "confirmed" &&
        Date.parse(event.startAt) <= now &&
        now < Date.parse(event.endAt) &&
        matchesSale(vehicle, event),
    )
    .sort((a, b) => Date.parse(a.endAt) - Date.parse(b.endAt) || a.id.localeCompare(b.id));
  if (!active.length) return null;
  // Never combine separate promotions or apply a bundle rate to a single vehicle.
  const event = active[0];
  const rates = [
    ...new Set(
      event.discounts
        .filter((rate) => rate.channel === vehicle.channel)
        .map((rate) => rate.percentOff),
    ),
  ];
  const percent =
    rates.length === 1 && Number.isInteger(rates[0]) && rates[0] > 0 && rates[0] < 100
      ? rates[0]
      : null;
  return {
    event,
    label:
      percent === null
        ? t("当前活动 · 力度见公告")
        : getLocale() === "zh-CN"
          ? t("当前 {0}折", [(100 - percent) / 10])
          : t("当前优惠 {0}%", [percent]),
  };
}
