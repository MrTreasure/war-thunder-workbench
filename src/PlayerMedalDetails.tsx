import { useState } from "react";
import registry from "../data/player-medal-details.json";
import images from "../data/player-medal-images.json";
import type { PlayerMedal } from "./player-rankings-api";
import { GameButton } from "./components/GameButton";

const details = new Map(registry.items.map((item) => [item.id, item]));
const artwork = new Map(images.items.map((item) => [item.id, item]));

/** Static public game descriptions; ownership still comes exclusively from player details. */
export default function PlayerMedalDetails({ medal }: { medal: PlayerMedal }) {
  const item = details.get(medal.id);
  const image = artwork.get(medal.id)?.detail;
  const [imageState, setImageState] = useState<"primary" | "fallback" | "failed">("primary");
  return (
    <div className="wt-player-medal-detail-body">
      <div className="wt-player-medal-detail-art">
        {image && imageState !== "failed" ? (
          <img
            src={imageState === "fallback" ? image.fallbackUrl : image.url}
            alt={medal.names["zh-CN"] || medal.names.en || "勋章"}
            width={256}
            height={256}
            onError={() => setImageState((state) => (state === "primary" ? "fallback" : "failed"))}
          />
        ) : (
          <div aria-live="polite">
            <p>勋章图片暂时无法加载</p>
            <GameButton onClick={() => setImageState("primary")}>重试图片</GameButton>
          </div>
        )}
      </div>
      <div className="wt-player-medal-detail-info">
        {medal.names.en && (
          <p className="wt-player-medal-english" lang="en">
            {medal.names.en}
          </p>
        )}
        <section aria-label="获取条件">
          <h3>获取条件</h3>
          <p className="wt-player-medal-objective">
            {item?.objective || "原始资料未提供常规获取条件"}
          </p>
          {!!item?.conditions.length && (
            <ul>
              {item.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          )}
          {item && Object.keys(item.multipliers).length > 0 && (
            <dl className="wt-player-medal-multipliers" aria-label="模式进度倍率">
              {(
                [
                  ["ab", "街机"],
                  ["rb", "历史"],
                  ["sb", "全真"],
                ] as const
              ).map(([mode, name]) => {
                const multiplier = item.multipliers[mode];
                return multiplier == null ? null : (
                  <div key={mode}>
                    <dt>{name}</dt>
                    <dd>×{multiplier}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          {item && Object.keys(item.multipliers).length > 0 && (
            <p className="wt-player-medal-detail-note">倍率用于累计获取进度，不代表勋章数量。</p>
          )}
        </section>
        <section aria-label="其他说明">
          <h3>其他说明</h3>
          <p>{item?.description || "游戏勋章语言资料未提供额外背景说明。"}</p>
          {!!item?.notes.length && (
            <ul>
              {item.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          <p className="wt-player-medal-detail-note">
            当前玩家已获得此勋章；公开资料未提供获得时间及个人解锁进度。
          </p>
        </section>
        <footer className="wt-player-medal-detail-source">
          <p>条件据游戏配置整理，实际适用规则以游戏内为准。</p>
          <a href={registry.sources[0].url} target="_blank" rel="noreferrer">
            查看条件来源
          </a>
          <a href={registry.sources[1].url} target="_blank" rel="noreferrer">
            查看说明来源
          </a>
          <p>图片来自社区游戏资源镜像，非官方直供。</p>
          {image && (
            <a href={image.fallbackUrl} target="_blank" rel="noreferrer">
              查看图片来源
            </a>
          )}
        </footer>
      </div>
    </div>
  );
}
