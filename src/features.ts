export const workbenchPage = (pathname: string) =>
  pathname === "/maps" || pathname.startsWith("/maps/")
    ? "maps"
    : pathname === "/lineups"
      ? "lineups"
      : "tree";
