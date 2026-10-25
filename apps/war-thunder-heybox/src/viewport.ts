import { useEffect } from "react";
import { sdk } from "./runtime";

/** Host insets are logical window pixels, never device pixels or screen offsets. */
export function useHostViewport() {
  useEffect(() => {
    let live = true;
    const apply = (info: Awaited<ReturnType<typeof sdk.viewport.getWindowInfo>>) => {
      if (!live) return;
      const values = {
        top: info.safeArea.top,
        right: info.windowWidth - info.safeArea.right,
        bottom: info.windowHeight - info.safeArea.bottom,
        left: info.safeArea.left,
      };
      for (const [edge, value] of Object.entries(values)) {
        if (Number.isFinite(value) && value >= 0)
          document.documentElement.style.setProperty(`--wt-host-safe-${edge}`, `${value}px`);
      }
      document.documentElement.dataset.hostViewport = "ready";
    };
    const read = () => {
      void sdk.viewport.setNavigationBarStyle({ foregroundStyle: "light" }).catch(() => {
        /* Older Hosts keep their own foreground style. */
      });
      void sdk.viewport
        .getWindowInfo()
        .then(apply)
        .catch(() => {
          /* CSS reserves the native top rail until measurement succeeds. */
        });
    };
    const stopViewport = sdk.on("viewport_change", apply);
    const stopShow = sdk.on("show", read);
    read();
    window.addEventListener("resize", read);
    return () => {
      live = false;
      stopViewport();
      stopShow();
      window.removeEventListener("resize", read);
    };
  }, []);
}
