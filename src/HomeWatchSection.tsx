import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GameIcon } from "./components/GameIcon";
import { VehicleTile } from "./VehicleTile";
import { useVehicleFacts } from "./vehicle-catalog";
import { homeWatchPresentation } from "./home-dashboard-model";
import { cachedSaleCalendar, readSaleCalendar } from "./sale-calendar-api";
import type { SaleVehicle } from "./sale-calendar-model";
import {
  HOME_WATCH_PAGE_SIZE,
  homeWatchActiveSale,
  homeWatchPage,
} from "./home-watch-section-model";
import "./home-watch-section.css";

export function HomeWatchSection({
  watches,
  pending = false,
}: {
  watches: SaleVehicle[];
  pending?: boolean;
}) {
  const facts = useVehicleFacts();
  const [requested, setRequested] = useState(1);
  const [calendar, setCalendar] = useState(cachedSaleCalendar);
  const [clock, setClock] = useState(Date.now);
  const [serverOffset, setServerOffset] = useState(() =>
    calendar ? Date.parse(calendar.serverNow) - Date.now() : 0,
  );
  const now = clock + serverOffset;
  const { page, pages, offset } = homeWatchPage(watches.length, requested);
  useEffect(() => {
    const controller = new AbortController();
    void readSaleCalendar(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setCalendar(value);
          setServerOffset(Date.parse(value.serverNow) - Date.now());
          setClock(Date.now());
        }
      })
      .catch(() => {
        /* Last verified calendar remains useful; absent data never creates a badge. */
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const boundaries = (calendar?.events || [])
      .flatMap((event) => [Date.parse(event.startAt), Date.parse(event.endAt)])
      .filter((value) => Number.isFinite(value) && value > now);
    const delay = Math.min(60_000, ...boundaries.map((value) => Math.max(1, value - now)));
    const tick = () => setClock(Date.now());
    const timer = window.setTimeout(tick, delay);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [calendar, now]);
  return (
    <section className="wt-home-section wt-home-watch-section">
      <header>
        <h3>
          <GameIcon name="details" />
          载具关注 <span>{watches.length}</span>
        </h3>
        <Link to="/sales" preload={false}>
          查看全部关注 →
        </Link>
      </header>
      {watches.length ? (
        <>
          <div className="wt-home-watch-list" aria-live="polite">
            {watches.slice(offset, offset + HOME_WATCH_PAGE_SIZE).map((watch) => {
              const presentation = homeWatchPresentation(watch);
              const sale = homeWatchActiveSale(watch, calendar?.events || [], now);
              return (
                <div className="wt-home-watch-entry" key={`${watch.country}:${watch.id}`}>
                  <VehicleTile
                    unit={facts.get(watch.id) || presentation.unit}
                    country={watch.country}
                    countryFlag={presentation.flag}
                    showRank
                    showAcquisition={presentation.known}
                  />
                  {sale && (
                    <Link
                      className="wt-home-watch-sale"
                      to="/sales"
                      preload={false}
                      title={sale.event.title}
                    >
                      {sale.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          <nav className="wt-home-watch-pagination" aria-label="关注载具分页">
            <button
              type="button"
              className="quiet-button"
              disabled={page <= 1}
              onClick={() => setRequested(page - 1)}
            >
              上一页
            </button>
            <span>
              第 {page} / {pages} 页 · 共 {watches.length} 辆
            </span>
            <button
              type="button"
              className="quiet-button"
              disabled={page >= pages}
              onClick={() => setRequested(page + 1)}
            >
              下一页
            </button>
          </nav>
        </>
      ) : (
        <p className="wt-home-empty">
          {pending ? "关注列表正在恢复。" : "还没有关注的载具。在折扣日历添加关注，方便下次查看。"}
        </p>
      )}
    </section>
  );
}
