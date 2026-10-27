import { useRef, useState } from "react";
import { Modal } from "./Modal";
import imageRegistry from "../data/player-medal-images.json";
import { GameSelect } from "./components/GameSelect";
import { statsCountryLabel } from "./stats-country";
import type { PlayerMedals as Medals, PlayerMedal } from "./player-rankings-api";

const medalImages = new Map(
  (imageRegistry.items as { id: string; url: string }[]).map((item) => [item.id, item.url]),
);

function medalName(medal: PlayerMedal) {
  return medal.names["zh-CN"] || medal.names.en || "已获勋章";
}

/** Renders earned unlocks only. An absent old snapshot is not an empty medal collection. */
export function PlayerMedals({ medals }: { medals?: Medals | null }) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("all");
  const trigger = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const owned = medals?.items.filter((item) => medalImages.has(item.id)) || [];
  const visible = owned.filter((item) => !failed.includes(item.id));
  if (!visible.length) return null;
  const count = owned.length;
  const countries = [...new Set(owned.map((item) => item.country))];
  const filtered = owned.filter((item) => country === "all" || item.country === country);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  return (
    <div className="wt-player-medals">
      <button
        type="button"
        className="wt-player-medals-trigger"
        ref={trigger}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        title="查看已获勋章"
      >
        <img
          src={medalImages.get(visible[0].id)}
          width={32}
          height={40}
          alt=""
          onError={() => setFailed((ids) => [...ids, visible[0].id])}
        />
        <span>
          已获勋章 <b>{count}</b>
        </span>
        <span className="wt-player-medals-names" aria-hidden="true">
          {visible.slice(0, 2).map((item) => (
            <span key={item.id}>{medalName(item)}</span>
          ))}
        </span>
        <span aria-hidden="true">›</span>
      </button>
      {open && (
        <Modal title={`已获勋章 · ${count}`} close={close} className="wt-player-medals-dialog">
          <div className="wt-player-medals-controls">
            <GameSelect aria-label="勋章所属国家" value={country} onValueChange={setCountry}>
              <option value="all">全部国家</option>
              {countries.map((id) => (
                <option key={id} value={id}>
                  {statsCountryLabel(id)}
                </option>
              ))}
            </GameSelect>
            <span>{filtered.length} 枚</span>
          </div>
          <ul className="wt-player-medals-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <img
                  src={medalImages.get(item.id)}
                  width={40}
                  height={48}
                  hidden={failed.includes(item.id)}
                  loading="lazy"
                  alt=""
                  onError={() => setFailed((ids) => [...ids, item.id])}
                />
                <div>
                  <strong>{medalName(item)}</strong>
                  <small>{statsCountryLabel(item.country)}</small>
                </div>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
