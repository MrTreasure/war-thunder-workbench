import { useEffect, useLayoutEffect, useRef } from "react";
export function useTreeGesture(zoom: number, setZoom: (n: number) => void, enabled: boolean) {
  const element = useRef<HTMLDivElement>(null),
    current = useRef(zoom);
  const pending = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  useLayoutEffect(() => {
    current.current = zoom;
    const el = element.current,
      a = pending.current;
    if (!el || !a) return;
    const canvas = el.querySelector<HTMLElement>(".canvas-space");
    el.scrollLeft = (canvas?.offsetLeft || 0) + a.x * zoom - a.cx;
    el.scrollTop = (canvas?.offsetTop || 0) + a.y * zoom - a.cy;
    pending.current = null;
  }, [zoom]);
  useEffect(() => {
    const el = element.current;
    if (!el || !enabled) return;
    let gesture: { distance: number; zoom: number; x: number; y: number } | null = null;
    let suppressClick = false;
    const points = (e: TouchEvent) => {
      const a = e.touches[0],
        b = e.touches[1],
        rect = el.getBoundingClientRect();
      return {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        cx: (a.clientX + b.clientX) / 2 - rect.left,
        cy: (a.clientY + b.clientY) / 2 - rect.top,
      };
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const p = points(e);
      if (p.distance < 1) return;
      const canvas = el.querySelector<HTMLElement>(".canvas-space"),
        rect = canvas?.getBoundingClientRect(),
        outer = el.getBoundingClientRect();
      gesture = {
        distance: p.distance,
        zoom: current.current,
        x: (p.cx + outer.left - (rect?.left || outer.left)) / current.current,
        y: (p.cy + outer.top - (rect?.top || outer.top)) / current.current,
      };
      suppressClick = true;
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !gesture) return;
      e.preventDefault();
      const p = points(e);
      pending.current = { x: gesture.x, y: gesture.y, cx: p.cx, cy: p.cy };
      setZoom(Math.max(0.3, Math.min(1.6, (gesture.zoom * p.distance) / gesture.distance)));
    };
    const end = () => {
      gesture = null;
    };
    const click = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    };
    const single = (e: TouchEvent) => {
      if (e.touches.length === 1) suppressClick = false;
    };
    el.addEventListener("touchstart", single, { passive: true });
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("touchstart", single);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("click", click, true);
    };
  }, [enabled, setZoom]);
  return element;
}
