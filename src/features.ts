export const workbenchPage = (pathname: string) =>
  pathname === "/disclaimer"
    ? "disclaimer"
    : pathname === "/decals"
      ? "decals"
      : pathname === "/maps" || pathname.startsWith("/maps/")
        ? "maps"
        : pathname === "/sales"
          ? "sales"
          : pathname === "/stats" || pathname.startsWith("/stats/")
            ? "stats"
            : pathname === "/lineups" || pathname.startsWith("/lineups/")
              ? "lineups"
              : "tree";
