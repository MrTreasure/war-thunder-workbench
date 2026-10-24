import { useEffect, useState } from "react";
import type { ReactNode } from "react";
/** Keep closing contents alive for the disclosure motion; collapsed cards stay inert. */
export function TreeFolder({ open, children }: { open: boolean; children: ReactNode }) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => setPresent(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const timer = window.setTimeout(() => setPresent(false), 320);
    return () => window.clearTimeout(timer);
  }, [open]);
  return (
    <div className="wt-tree-folder" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="wt-tree-folder-clip">{(open || present) && children}</div>
    </div>
  );
}
