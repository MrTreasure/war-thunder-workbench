import { useLocale } from "../i18n/react";
import { localize } from "../i18n/core";
import type { CSSProperties, ReactNode } from "react";
import theme from "../../data/game-tag-theme.json";
import "./game-tag.css";

export type GameTagTone = keyof typeof theme.tones;
export const gameTagTiers = theme.tiers as GameTagTone[];
export const gameTagTones = theme.tones;
export const gameTagBasicColors = theme.basicColors as GameTagTone[];
export const gameTagChoiceGroups: { label: string; tones: GameTagTone[] }[] = [
  { label: "官方原版", tones: ["original", "red"] },
  { label: "基本颜色", tones: gameTagBasicColors },
  { label: "材质与特效", tones: gameTagTiers },
];
export type GameTagProps = {
  children: ReactNode;
  tagId?: string;
  tone?: GameTagTone;
  selected?: boolean;
  disabled?: boolean;
  animated?: boolean;
  /** Rainbow is an always-animated privilege effect, as requested by the user. */
  motionOverride?: boolean;
  onClick?: () => void;
};

/** Official skin uses nine-slice edges so corners and eyelet never stretch.
 * RGB tint multiplies the actual texture, matching the game's background color.
 * Text selection and appearance are independent. No account or network dependency. */
export function GameTag({
  children,
  tagId,
  tone = "silver",
  selected = false,
  disabled = false,
  animated = true,
  motionOverride = tone === "rainbow",
  onClick,
}: GameTagProps) {
  useLocale();
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
      <span className="wt-game-tag-material" aria-hidden="true" />
      {gameTagTiers.includes(tone) && tone !== "rainbow" && (
        <span className="wt-game-tag-luster" aria-hidden="true" />
      )}
      <span className="wt-game-tag-label">{localize(children)}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="wt-game-tag is-interactive"
      data-tag-id={tagId}
      data-tone={tone}
      data-animated={animated || undefined}
      data-motion-override={motionOverride || undefined}
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
      data-tag-id={tagId}
      data-tone={tone}
      data-animated={animated || undefined}
      data-motion-override={motionOverride || undefined}
      style={style}
    >
      {content}
    </span>
  );
}
