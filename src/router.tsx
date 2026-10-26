import { QueryClient } from "@tanstack/react-query";
import { createBrowserHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // The stock hash history appends the outer legacy query to the hash query.
  // Keep these namespaces separate: Workbench reads the outer country/mode,
  // while file routes own filters and public share IDs after the hash.
  // Native hash links and old browser entries may have no TanStack state.
  // Persist a stable key before returning the entry, using the unwrapped method
  // so normalization cannot recursively notify the history subscriber.
  const replaceNativeState = window.history.replaceState.bind(window.history);
  const hashHistory = createBrowserHistory({
    parseLocation: () => {
      const parsed = new URL(location.hash.slice(1) || "/", location.origin);
      let state = window.history.state;
      if (!state || !Number.isSafeInteger(state.__TSR_index) || !state.__TSR_key) {
        const key = state?.__TSR_key || state?.key || crypto.randomUUID();
        state = {
          ...(state && typeof state === "object" ? state : {}),
          __TSR_index: Number.isSafeInteger(state?.__TSR_index) ? state.__TSR_index : 0,
          key,
          __TSR_key: key,
        };
        replaceNativeState(state, "");
      }
      return {
        href: `${parsed.pathname}${parsed.search}${parsed.hash}`,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state,
      };
    },
    createHref: (href) => `${location.pathname}${location.search}#${href}`,
  });

  const router = createRouter({
    routeTree,
    history: hashHistory,
    context: { queryClient },
    scrollRestoration: true,
    scrollToTopSelectors: ["#workbench-content"],
    defaultPreloadStaleTime: 0,
  });

  return router;
};
