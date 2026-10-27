import { useId, useRef, type ReactNode } from "react";
import { GameIcon, type GameIconName } from "./GameIcon";
export type GameTab<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: GameIconName;
  disabled?: boolean;
};
/** Roving keyboard focus; callers own matching panels and keep their local drafts mounted. */
export function GameTabs<T extends string>({
  id,
  label,
  value,
  items,
  onValueChange,
  className = "",
  panelId,
}: {
  id?: string;
  label: string;
  value: T;
  items: readonly GameTab<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  panelId?: string;
}) {
  const generated = useId(),
    prefix = id || generated,
    refs = useRef(new Map<T, HTMLButtonElement>());
  return (
    <div className={`wt-game-tabs ${className}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          ref={(node) => {
            if (node) refs.current.set(item.value, node);
            else refs.current.delete(item.value);
          }}
          type="button"
          role="tab"
          id={`${prefix}-${item.value}-tab`}
          aria-controls={panelId || `${prefix}-${item.value}-panel`}
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          disabled={item.disabled}
          onClick={() => onValueChange(item.value)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const available = items.filter((v) => !v.disabled),
              index = available.findIndex((v) => v.value === item.value);
            const next =
              event.key === "Home"
                ? available[0]
                : event.key === "End"
                  ? available.at(-1)
                  : available[
                      (index + (event.key === "ArrowRight" ? 1 : -1) + available.length) %
                        available.length
                    ];
            if (next) {
              onValueChange(next.value);
              refs.current.get(next.value)?.focus();
            }
          }}
        >
          {item.icon && <GameIcon name={item.icon} />}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
