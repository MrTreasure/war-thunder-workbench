import { QueryClient } from "@tanstack/react-query";
import { createBrowserHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // The stock hash history appends the outer legacy query to the hash query.
  // Keep these namespaces separate: Workbench reads the outer country/mode,
  // while file routes own filters and public share IDs after the hash.
  const hashHistory = createBrowserHistory({
    parseLocation: () => {
      const parsed = new URL(location.hash.slice(1) || "/", location.origin);
      return {
        href: `${parsed.pathname}${parsed.search}${parsed.hash}`,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        state: history.state,
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
