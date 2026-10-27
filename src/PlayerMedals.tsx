import { useLocale } from "./i18n/react";
import { t, getLocale } from "./i18n/core";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import imageRegistry from "../data/player-medal-images.json";
import { GameSelect } from "./components/GameSelect";
import { statsCountryLabel } from "./stats-country";
import type { PlayerMedals as Medals, PlayerMedal } from "./player-rankings-api";

const medalImages = new Map(imageRegistry.items.map((item) => [item.id, item]));
const PlayerMedalDetails = lazy(() => import("./PlayerMedalDetails"));

function medalName(medal: PlayerMedal) {
  return medal.names[getLocale()] || medal.names.en || t("已获勋章");
}

function MedalBadge({
  medal,
  unavailable,
  inspect,
}: {
  medal: PlayerMedal;
  unavailable: (id: string) => void;
  inspect: (medal: PlayerMedal, trigger: HTMLButtonElement) => void;
}) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = medalImages.get(medal.id)!;
  return (
    <button
      type="button"
      aria-label={t("{0}，点击放大查看详情", [medalName(medal)])}
      aria-haspopup="dialog"
      title={medalName(medal)}
      className="wt-player-medal"
      onClick={(event) => inspect(medal, event.currentTarget)}
    >
      {failed ? (
        <span aria-hidden="true">?</span>
      ) : (
        <span className="wt-player-medal-art">
          <img
            src={fallback ? image.fallbackUrl : image.url}
            width={24}
            height={24}
            alt=""
            onError={() => {
              if (!fallback) setFallback(true);
              else {
                setFailed(true);
                unavailable(medal.id);
              }
            }}
          />
          <span
            className="wt-player-medal-luster"
            aria-hidden="true"
            style={{ maskImage: `url("${fallback ? image.fallbackUrl : image.url}")` }}
          />
        </span>
      )}
    </button>
  );
}

/** Compact earned artwork only; transport failures must never erase ownership. */
export function PlayerMedals({
  medals,
  busy = false,
  error = "",
  retry,
}: {
  medals?: Medals | null;
  busy?: boolean;
  error?: string;
  retry?: () => void;
}) {
  useLocale();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlayerMedal | null>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [country, setCountry] = useState("all");
  const trigger = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [columns, setColumns] = useState(4);
  const limit = Math.min(48, columns * 2 - 2);
  const owned = medals?.items.filter((item) => medalImages.has(item.id)) || [];
  const available = owned.filter((item) => !failed.includes(item.id));
  const visible = available.slice(0, limit);
  useLayoutEffect(() => {
    const element = strip.current;
    if (!element) return;
    const measure = () => {
      const step = matchMedia("(pointer: coarse)").matches ? 48 : 36;
      setColumns(Math.max(2, Math.floor((element.clientWidth + 4) / step)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [medals, busy, error]);
  const unavailable = (id: string) => setFailed((ids) => (ids.includes(id) ? ids : [...ids, id]));
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  const inspect = (medal: PlayerMedal, button: HTMLButtonElement) => {
    selectedTrigger.current = button;
    setSelected(medal);
  };
  const closeDetails = () => {
    setSelected(null);
    requestAnimationFrame(() => {
      const button = selectedTrigger.current;
      (button?.isConnected ? button : trigger.current)?.focus({ preventScroll: true });
    });
  };
  if (!owned.length) {
    if (busy)
      return (
        <div
          className="wt-player-medals"
          ref={strip}
          aria-label={t("正在读取勋章")}
          aria-busy="true"
        >
          <span className="wt-player-medals-loading" />
        </div>
      );
    if (error)
      return (
        <div className="wt-player-medals" ref={strip}>
          <button type="button" className="wt-player-medals-retry" onClick={retry} title={error}>
            {t("重新加载勋章")}
          </button>
        </div>
      );
    return null;
  }
  const count = owned.length;
  const countries = [...new Set(owned.map((item) => item.country))];
  const filtered = owned.filter((item) => country === "all" || item.country === country);
  return (
    <div
      className="wt-player-medals"
      ref={strip}
      data-rows={visible.length + 2 <= columns ? 1 : 2}
      aria-label={t("已获勋章 {0} 枚", [count])}
    >
      {visible.map((item) => (
        <MedalBadge key={item.id} medal={item} unavailable={unavailable} inspect={inspect} />
      ))}
      <button
        type="button"
        className="wt-player-medals-trigger"
        ref={trigger}
        aria-haspopup="dialog"
        aria-label={t("查看已获勋章 · {0}", [count])}
        onClick={() => setOpen(true)}
        title={t("查看已获勋章 · {0}", [count])}
      >
        {visible.length < count ? `+${count - visible.length}` : count}
      </button>
      {open && (
        <Modal
          title={t("已获勋章 · {0}", [count])}
          close={close}
          className="wt-player-medals-dialog"
        >
          <div className="wt-player-medals-controls">
            <GameSelect aria-label={t("勋章所属国家")} value={country} onValueChange={setCountry}>
              <option value="all">{t("全部国家")}</option>
              {countries.map((id) => (
                <option key={id} value={id}>
                  {statsCountryLabel(id)}
                </option>
              ))}
            </GameSelect>
            <span>
              {t("{0} 枚", [
                owned.filter((item) => country === "all" || item.country === country).length,
              ])}
            </span>
          </div>
          <ul className="wt-player-medals-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <MedalBadge
                  key={imageAttempt}
                  medal={item}
                  unavailable={unavailable}
                  inspect={inspect}
                />
              </li>
            ))}
          </ul>
          {failed.length > 0 && (
            <button
              type="button"
              className="wt-player-medals-retry"
              onClick={() => {
                setFailed([]);
                setImageAttempt((value) => value + 1);
              }}
            >
              {t("重新加载图标")}
            </button>
          )}
        </Modal>
      )}
      {selected && (
        <Modal
          title={medalName(selected)}
          subtitle={t("{0} · 已获得", [statsCountryLabel(selected.country)])}
          close={closeDetails}
          className="wt-player-medal-detail-dialog"
        >
          <Suspense fallback={<output>{t("正在读取勋章详情…")}</output>}>
            <PlayerMedalDetails medal={selected} />
          </Suspense>
        </Modal>
      )}
    </div>
  );
}
