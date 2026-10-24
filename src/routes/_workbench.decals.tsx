import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
export const Route = createFileRoute("/_workbench/decals")({
  codeSplitGroupings: [],
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q.slice(0, 80) : "",
    category: typeof s.category === "string" ? s.category.slice(0, 64) : "",
    kind: ["configured", "localization", "announcement"].includes(String(s.kind))
      ? String(s.kind)
      : "configured",
    unlock: ["linked", "unknown"].includes(String(s.unlock)) ? String(s.unlock) : "",
    image: s.image === "yes" ? "yes" : "",
    page: Math.max(1, Math.min(400, Math.floor(Number(s.page) || 1))),
  }),
  component: lazyRouteComponent(() => import("../DecalCatalog"), "DecalCatalog"),
});
