export const workbenchPage = (pathname: string) =>
  pathname === "/decals"
    ? "decals"
    : pathname === "/maps" || pathname.startsWith("/maps/")
      ? "maps"
      : pathname === "/sales"
        ? "sales"
        : pathname === "/stats"
          ? "stats"
          : pathname === "/lineups"
            ? "lineups"
            : "tree";
