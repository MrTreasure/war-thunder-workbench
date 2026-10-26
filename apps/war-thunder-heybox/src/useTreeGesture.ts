import { useEffect, useLayoutEffect, useRef } from "react";

/** Own touch panning and pinch zoom so the WebView cannot claim the gesture midway. */
export function useTreeGesture(zoom: number, setZoom: (n: number) => void, enabled: boolean) {
  const element = useRef<HTMLDivElement>(null),
    current = useRef(zoom);
  const pending = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  useLayoutEffect(() => {
    current.current = zoom;
    const el = element.current,
      anchor = pending.current;
    if (!el || !anchor) return;
    const canvas = el.querySelector<HTMLElement>(".canvas-space");
    el.scrollLeft = (canvas?.offsetLeft || 0) + anchor.x * zoom - anchor.cx;
    el.scrollTop = (canvas?.offsetTop || 0) + anchor.y * zoom - anchor.cy;
    pending.current = null;
  }, [zoom]);
  useEffect(() => {
    const el = element.current;
    if (!el || !enabled) return;
    const points = new Map<number, { x: number; y: number }>();
    let pan: { x: number; y: number; left: number; top: number } | null = null;
    let pinch: { distance: number; zoom: number; x: number; y: number } | null = null;
    let dragged = false;
    const measure = () => {
      const [a, b] = [...points.values()],
        rect = el.getBoundingClientRect();
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2 - rect.left,
        cy: (a.y + b.y) / 2 - rect.top,
      };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") {
        dragged = false;
        return;
      }
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 1) {
        dragged = false;
        pan = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      } else if (points.size === 2) {
        e.preventDefault();
        dragged = true;
        const p = measure(),
          outer = el.getBoundingClientRect(),
          canvas = el.querySelector<HTMLElement>(".canvas-space")?.getBoundingClientRect();
        pinch = {
          distance: Math.max(1, p.distance),
          zoom: current.current,
          x: (p.cx + outer.left - (canvas?.left ?? outer.left)) / current.current,
          y: (p.cy + outer.top - (canvas?.top ?? outer.top)) / current.current,
        };
        for (const id of points.keys()) {
          try {
            el.setPointerCapture(id);
          } catch {
            /* Pointer already ended. */
          }
        }
      }
    };
    const move = (e: PointerEvent) => {
      if (!points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2 && pinch) {
        e.preventDefault();
        const p = measure();
        pending.current = { x: pinch.x, y: pinch.y, cx: p.cx, cy: p.cy };
        setZoom(Math.max(0.2, Math.min(2, (pinch.zoom * p.distance) / pinch.distance)));
      } else if (points.size === 1 && pan) {
        const dx = e.clientX - pan.x,
          dy = e.clientY - pan.y;
        if (!dragged && Math.hypot(dx, dy) < 5) return;
        e.preventDefault();
        dragged = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* Pointer already ended. */
        }
        el.scrollLeft = pan.left - dx;
        el.scrollTop = pan.top - dy;
      }
    };
    const up = (e: PointerEvent) => {
      points.delete(e.pointerId);
      pinch = null;
      const remaining = [...points.values()][0];
      pan = remaining
        ? { x: remaining.x, y: remaining.y, left: el.scrollLeft, top: el.scrollTop }
        : null;
    };
    const click = (e: MouseEvent) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        dragged = false;
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move, { passive: false });
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
    };
  }, [enabled, setZoom]);
  return element;
}
