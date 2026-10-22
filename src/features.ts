export const workbenchPage = (pathname: string) =>
  pathname === "/maps" || pathname.startsWith("/maps/")
    ? "maps"
    : pathname === "/sales"
      ? "sales"
      : pathname === "/stats"
        ? "stats"
        : pathname === "/lineups"
          ? "lineups"
          : "tree";
