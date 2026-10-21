export const guidesEnabled = () => new URLSearchParams(location.search).get("guides") === "1";
export const workbenchPage = (pathname: string) =>
  pathname === "/maps" || pathname.startsWith("/maps/")
    ? "maps"
    : pathname === "/lineups"
      ? "lineups"
      : "tree";
