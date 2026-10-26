import type { CSSProperties, ReactNode } from "react";
import theme from "../../data/game-tag-theme.json";
import "./game-tag.css";

export type GameTagTone = keyof typeof theme.tones;
export const gameTagTiers = theme.tiers as GameTagTone[];
export const gameTagTones = theme.tones;
export type GameTagProps = {
  children: ReactNode;
  tone?: GameTagTone;
  selected?: boolean;
  disabled?: boolean;
  animated?: boolean;
  onClick?: () => void;
};

/** Official skin uses nine-slice edges so corners and eyelet never stretch.
 * RGB tint multiplies the actual texture, matching the game's background color.
 * Text selection and appearance are independent. No account or network dependency. */
export function GameTag({
  children,
  tone = "silver",
  selected = false,
  disabled = false,
  animated = true,
  onClick,
}: GameTagProps) {
  const finish = gameTagTones[tone] || gameTagTones.silver;
  const style = {
    "--wt-tag-tint": finish.tint,
    "--wt-tag-text": finish.text,
    "--wt-tag-image": `url("${theme.source.url}")`,
  } as CSSProperties;
  const content = (
    <>
      <span className="wt-game-tag-skin" aria-hidden="true" />
      <span className="wt-game-tag-tint" aria-hidden="true" />
      <span className="wt-game-tag-label">{children}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="wt-game-tag is-interactive"
      data-tone={tone}
      data-animated={animated || undefined}
      style={style}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <span
      className="wt-game-tag"
      data-tone={tone}
      data-animated={animated || undefined}
      style={style}
    >
      {content}
    </span>
  );
}
