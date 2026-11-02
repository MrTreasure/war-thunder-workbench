import { useEffect, useId, useRef, useState } from "react";
import { Chevron } from "./Chevron";

type Layer = { label: string; checked: boolean; toggle: () => void };

/** Independent layer switches stay open for multiple changes without resizing the map. */
export function MapLayerMenu({ label, layers }: { label: string; layers: Layer[] }) {
  const id = useId();
  const panel = useRef<HTMLFieldSetElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => panel.current?.hidePopover();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close);
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="ground-layer-trigger"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (panel.current) {
            panel.current.style.top = `${rect.bottom + 6}px`;
            panel.current.style.right = `${Math.max(8, innerWidth - rect.right)}px`;
            panel.current.style.maxHeight = `${Math.max(44, innerHeight - rect.bottom - 14)}px`;
          }
        }}
      >
        {label}
        <Chevron />
      </button>
      <fieldset
        id={id}
        ref={panel}
        popover="auto"
        className="ground-layer-menu"
        aria-label={label}
        onToggle={(event) => setOpen(event.newState === "open")}
      >
        <legend className="sr-only">{label}</legend>
        {layers.map((layer) => (
          <label key={layer.label}>
            <input type="checkbox" checked={layer.checked} onChange={layer.toggle} />
            <span>{layer.label}</span>
          </label>
        ))}
      </fieldset>
    </>
  );
}
