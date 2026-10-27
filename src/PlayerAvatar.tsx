import { t } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useState } from "react";
import { playerAvatarFrame } from "./player-avatar-frame";

/** The portrait and its equipped game frame are independent, aligned image layers. */
export function PlayerAvatar({
  url,
  name,
  frameKey,
}: {
  url: string | null;
  name: string;
  frameKey?: string | null;
}) {
  useLocale();
  const [failedPortrait, setFailedPortrait] = useState<string | null>(null);
  const [failedFrame, setFailedFrame] = useState<string | null>(null);
  const frame = frameKey !== failedFrame ? playerAvatarFrame(frameKey) : null;
  return (
    <span className={`wt-player-avatar${frame ? " wt-player-avatar-framed" : ""}`}>
      <span className="wt-player-avatar-portrait">
        <span aria-hidden="true">{Array.from(name)[0]}</span>
        {url && url !== failedPortrait && (
          <img src={url} alt={t("{0}的游戏头像", [name])} onError={() => setFailedPortrait(url)} />
        )}
      </span>
      {frame && (
        <img
          className="wt-player-avatar-frame"
          src={frame.url}
          alt=""
          aria-hidden="true"
          onError={() => setFailedFrame(frame.id)}
        />
      )}
    </span>
  );
}
