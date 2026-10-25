import { VehicleTile } from "./VehicleTile";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  DragEvent as ReactDragEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Mode } from "./models";
import type { BattleType, LineupVehicle } from "./lineups";
import { lineupCardRating } from "./lineups";
import { moveLineupSlot } from "./lineups";
interface DragView {
  from: number;
  to: number;
  x: number;
  y: number;
}
interface Gesture extends DragView {
  pointerId: number;
  startX: number;
  startY: number;
  scrollStart: number;
  phase: "pending" | "scroll" | "drag";
  element: HTMLButtonElement;
  timer: ReturnType<typeof setTimeout> | null;
  frame: number | null;
}
export function LineupRoster({
  slots,
  units,
  activeSlot,
  selectSlot,
  battleType,
  activeAircraft,
  mode,
  reorder,
  clear,
  chooseAircraft,
}: {
  slots: (string | null)[];
  units: Map<string, LineupVehicle>;
  activeSlot: number;
  selectSlot: (index: number) => void;
  battleType: BattleType;
  activeAircraft: string | null;
  mode: Mode;
  categories: Record<string, string>;
  reorder: (slots: (string | null)[], active: number) => void;
  clear: (index: number) => void;
  chooseAircraft: (id: string) => void;
}) {
  const rail = useRef<HTMLOListElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const stop = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (current?.timer) clearTimeout(current.timer);
    if (current?.frame) cancelAnimationFrame(current.frame);
    if (current?.element.hasPointerCapture(current.pointerId))
      current.element.releasePointerCapture(current.pointerId);
    setDrag(null);
  }, []);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture.current) {
        stop();
        setAnnouncement("拖动已取消，顺序未改变。");
      }
    };
    const preventDragScroll = (event: TouchEvent) => {
      if (gesture.current?.phase === "drag" && event.cancelable) event.preventDefault();
    };
    const cancelHidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", cancelHidden);
    window.addEventListener("keydown", cancel);
    document.addEventListener("touchmove", preventDragScroll, { passive: false });
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", cancelHidden);
      window.removeEventListener("keydown", cancel);
      document.removeEventListener("touchmove", preventDragScroll);
      const current = gesture.current;
      gesture.current = null;
      if (current?.timer) clearTimeout(current.timer);
      if (current?.frame) cancelAnimationFrame(current.frame);
      if (current?.element.hasPointerCapture(current.pointerId))
        current.element.releasePointerCapture(current.pointerId);
    };
  }, [stop]);
  function targetAt(x: number) {
    const items = rail.current?.querySelectorAll<HTMLElement>("[data-slot-index]");
    let nearest = 0,
      distance = Infinity;
    for (const item of items || []) {
      const bounds = item.getBoundingClientRect();
      const delta = Math.abs(x - (bounds.left + bounds.width / 2));
      if (delta < distance) {
        distance = delta;
        nearest = Number(item.dataset.slotIndex);
      }
    }
    return nearest;
  }
  function trackDrag() {
    const current = gesture.current;
    const element = rail.current;
    if (!current || current.phase !== "drag" || !element) return;
    const rect = element.getBoundingClientRect();
    const edge = 48;
    const left = Math.max(0, Math.min(1, (rect.left + edge - current.x) / edge));
    const right = Math.max(0, Math.min(1, (current.x - rect.right + edge) / edge));
    const before = element.scrollLeft;
    element.scrollLeft += (right - left) * 14;
    if (before !== element.scrollLeft) {
      current.to = targetAt(current.x);
      setDrag({ from: current.from, to: current.to, x: current.x, y: current.y });
    }
    current.frame = requestAnimationFrame(trackDrag);
  }
  function down(event: ReactPointerEvent<HTMLButtonElement>, index: number, handle = false) {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    suppressClick.current = false;
    const current: Gesture = {
      pointerId: event.pointerId,
      from: index,
      to: index,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      scrollStart: rail.current?.scrollLeft || 0,
      phase: "pending",
      element: event.currentTarget,
      timer: null,
      frame: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = current;
    const lift = () => {
      if (gesture.current !== current) return;
      current.phase = "drag";
      current.timer = null;
      suppressClick.current = true;
      selectSlot(index);
      setDrag({ from: index, to: index, x: current.x, y: current.y });
      setAnnouncement(`已提起槽位 ${index + 1}，拖到目标位置后松开；Esc 取消。`);
      current.frame = requestAnimationFrame(trackDrag);
    };
    // A handle is an explicit drag target. Do not route its first movement into
    // the card's horizontal-scroll gesture or let the browser claim touch pan.
    if (handle) {
      event.preventDefault();
      lift();
    } else current.timer = setTimeout(lift, 350);
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (current.phase === "pending") {
      const dx = event.clientX - current.startX,
        dy = event.clientY - current.startY;
      if (Math.hypot(dx, dy) <= 8) return;
      if (current.timer) clearTimeout(current.timer);
      current.timer = null;
      if (Math.abs(dy) > Math.abs(dx)) {
        stop();
        return;
      }
      current.phase = "scroll";
      suppressClick.current = true;
    }
    event.preventDefault();
    if (current.phase === "scroll") {
      if (rail.current)
        rail.current.scrollLeft = current.scrollStart - (event.clientX - current.startX);
    } else {
      current.to = targetAt(event.clientX);
      setDrag({ from: current.from, to: current.to, x: current.x, y: current.y });
    }
  }
  function up(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.phase === "drag") {
      const bounds = rail.current?.getBoundingClientRect();
      if (
        bounds &&
        event.clientY >= bounds.top - 24 &&
        event.clientY <= bounds.bottom + 24 &&
        event.clientX >= bounds.left - 48 &&
        event.clientX <= bounds.right + 48
      ) {
        const to = targetAt(event.clientX);
        reorder(moveLineupSlot(slots, current.from, to), to);
        setAnnouncement(`槽位 ${current.from + 1} 已移至 ${to + 1}。`);
      } else setAnnouncement("已在队列外松开，顺序未改变。");
    }
    stop();
  }
  function keyMove(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const to = index + (event.key === "ArrowLeft" ? -1 : 1);
    if (to < 0 || to >= slots.length) return;
    stop();
    reorder(moveLineupSlot(slots, index, to), to);
    setAnnouncement(`槽位 ${index + 1} 已移至 ${to + 1}。`);
    requestAnimationFrame(() => {
      const element = rail.current?.querySelector<HTMLButtonElement>(
        `[data-slot-index="${to}"] .lineup-slot-select`,
      );
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  const dragId = drag ? slots[drag.from] : null;
  const dragUnit = dragId ? units.get(dragId) : undefined;
  return (
    <>
      <ol
        className={`lineup-slots ${drag ? "is-dragging" : ""}`}
        ref={rail}
        aria-label="横向乘员槽位，可长按拖动排序"
      >
        {slots.map((id, index) => {
          const unit = id ? units.get(id) : undefined;
          const handlers = {
            onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => down(event, index),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: () => stop(),
            onLostPointerCapture: () => {
              if (gesture.current) stop();
            },
            onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => keyMove(event, index),
            onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => event.preventDefault(),
            onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => event.preventDefault(),
          };
          return (
            <li
              key={index}
              data-slot-index={index}
              className={`${activeSlot === index ? "is-active" : ""} ${drag?.from === index ? "is-drag-source" : ""} ${drag?.to === index ? "is-drop-target" : ""}`}
            >
              <button
                type="button"
                className="lineup-slot-select"
                aria-pressed={activeSlot === index}
                aria-label={`槽位 ${index + 1}：${unit?.name || "空位"}，长按拖动；Alt 加左右方向键排序`}
                {...handlers}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  selectSlot(index);
                }}
              >
                <span className="lineup-slot-number">{index + 1}</span>
                {unit ? (
                  <VehicleTile
                    unit={unit}
                    mode={mode}
                    selected={activeSlot === index}
                    showRank
                    modeRating={lineupCardRating(unit, battleType, mode)}
                  />
                ) : (
                  <span className="lineup-slot-placeholder">＋</span>
                )}
                {!unit && (
                  <span className="lineup-slot-caption">{id ? `资料缺失：${id}` : "选择载具"}</span>
                )}
              </button>
              <div className="lineup-slot-tools">
                <button
                  type="button"
                  className="lineup-drag-handle"
                  {...handlers}
                  onPointerDown={(event) => down(event, index, true)}
                  aria-label={`按住拖动槽位 ${index + 1}`}
                  title="按住即可拖动；Alt + 左右方向键排序"
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    selectSlot(index);
                  }}
                >
                  ⠿
                </button>
                {battleType === "air" && unit?.category === "aviation" && (
                  <label className="lineup-active-aircraft">
                    <input
                      type="radio"
                      name="lineup-rb-aircraft"
                      checked={activeAircraft === id}
                      onChange={() => chooseAircraft(unit.id)}
                    />
                    RB 出击
                  </label>
                )}
                <button
                  type="button"
                  className="lineup-slot-clear"
                  disabled={!id}
                  aria-label={`清空槽位 ${index + 1}`}
                  onClick={() => clear(index)}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <output className="lineup-drag-status" aria-live="polite">
        {announcement}
      </output>
      {drag &&
        createPortal(
          <div
            className="lineup-drag-ghost"
            aria-hidden="true"
            style={{ left: Math.max(100, Math.min(window.innerWidth - 100, drag.x)), top: drag.y }}
          >
            <span>
              槽位 {drag.from + 1} → {drag.to + 1}
            </span>
            <strong>{dragUnit?.name || "空槽位"}</strong>
          </div>,
          document.body,
        )}
    </>
  );
}
