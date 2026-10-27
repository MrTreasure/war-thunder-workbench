import { useLocale } from "../i18n/react";
import { t, localize } from "../i18n/core";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import "./game-tip.css";

/** Read-only top-layer popup: hovering, keyboard focus and tapping never change table geometry. */
export function GameTip({
  label,
  children,
  icon,
  className = "",
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  useLocale();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  function cancelLeave() {
    clearTimeout(leaveTimer.current);
  }
  function show() {
    cancelLeave();
    setHost(trigger.current?.closest("dialog") || document.body);
    setOpen(true);
  }
  function leave() {
    cancelLeave();
    leaveTimer.current = setTimeout(() => {
      if (
        !popup.current?.contains(document.activeElement) &&
        !trigger.current?.matches(":focus-visible")
      )
        setOpen(false);
    }, 140);
  }
  useLayoutEffect(() => () => cancelLeave(), []);
  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;
    const panel = popup.current,
      anchor = trigger.current;
    function place(event?: Event) {
      if (event?.target === panel) return;
      const box = anchor.getBoundingClientRect(),
        viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0,
        top = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth,
        height = viewport?.height || innerHeight;
      if (box.bottom < top || box.top > top + height) {
        setOpen(false);
        return;
      }
      const below = top + height - box.bottom - 12,
        above = box.top - top - 12;
      const up = below < Math.min(panel.scrollHeight, 280) && above > below;
      panel.style.width = `${Math.min(360, width - 16)}px`;
      panel.style.maxHeight = `${Math.max(80, Math.min(400, up ? above : below, height - 16))}px`;
      panel.style.left = `${Math.max(left + 8, Math.min(box.right - panel.offsetWidth, left + width - panel.offsetWidth - 8))}px`;
      panel.style.top = `${Math.max(top + 8, Math.min(up ? box.top - panel.offsetHeight - 6 : box.bottom + 6, top + height - panel.offsetHeight - 8))}px`;
    }
    const toggled = (event: ToggleEvent) => {
      if (event.newState === "closed") setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (panel.contains(document.activeElement)) anchor.focus({ preventScroll: true });
      setOpen(false);
    };
    panel.addEventListener("toggle", toggled);
    panel.showPopover();
    place();
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      cancelLeave();
      panel.removeEventListener("toggle", toggled);
      panel.hidePopover();
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`wt-game-tip-trigger ${className}`}
        aria-label={t("{0}说明", [localize(label)])}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") show();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") leave();
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) show();
        }}
        onBlur={leave}
        onClick={show}
        onKeyDown={(event) => {
          if (open && ["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            popup.current?.scrollBy({
              top:
                (event.key.endsWith("Down") ? 1 : -1) * (event.key.startsWith("Page") ? 180 : 40),
            });
          }
        }}
      >
        {icon ?? (
          <svg
            viewBox="0 0 20 20"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7" />
            <path d="M10 9v5M10 6v1" />
          </svg>
        )}
      </button>
      {localize(
        open &&
          host &&
          createPortal(
            <div
              ref={popup}
              id={id}
              role="tooltip"
              popover="auto"
              className="wt-game-tip-popup"
              onPointerEnter={cancelLeave}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") leave();
              }}
            >
              <strong>{localize(label)}</strong>
              <div className="wt-game-tip-body">{localize(children)}</div>
            </div>,
            host,
          ),
      )}
    </>
  );
}
