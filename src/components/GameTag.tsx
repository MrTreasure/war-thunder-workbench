import type { ReactNode } from "react";
import "./game-tag.css";

export type GameTagTone = "silver" | "gold" | "red" | "blue";
export type GameTagProps = {
  children: ReactNode;
  tone?: GameTagTone;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

/** Shared game tag: original metal skin, semantic tone and optional selection. */
export function GameTag({
  children,
  tone = "silver",
  selected = false,
  disabled = false,
  onClick,
}: GameTagProps) {
  const content = (
    <>
      <span className="wt-game-tag-skin" aria-hidden="true" />
      <span className="wt-game-tag-label">{children}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="wt-game-tag is-interactive"
      data-tone={tone}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <span className="wt-game-tag" data-tone={tone}>
      {content}
    </span>
  );
}
