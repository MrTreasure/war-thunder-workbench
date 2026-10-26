import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { GameIcon, type GameIconName } from "./GameIcon";
type Look = { tone?: "primary" | "secondary" | "ghost"; icon?: GameIconName; children: ReactNode };
export function GameButton({
  tone = "secondary",
  icon,
  children,
  busy = false,
  className = "",
  disabled,
  type = "button",
  ...props
}: Look & ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      className={`wt-game-button is-${tone} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-icon={!!icon || undefined}
    >
      {busy ? (
        <span className="wt-control-spinner" aria-hidden="true" />
      ) : icon ? (
        <GameIcon name={icon} />
      ) : null}
      <span className="wt-button-label">{children}</span>
    </button>
  );
}
export function GameLinkButton({
  tone = "secondary",
  icon,
  children,
  className = "",
  ...props
}: Look & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...props} className={`wt-game-button is-${tone} ${className}`}>
      {icon && <GameIcon name={icon} />}
      <span>{children}</span>
    </a>
  );
}
