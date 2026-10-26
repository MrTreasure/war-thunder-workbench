import assets from "../../data/workbench-ui-assets.json";
export type GameIconName =
  | "research"
  | "performance"
  | "details"
  | "crew"
  | "loadout"
  | "route"
  | "store"
  | "external"
  | "close";
/** Game symbols retain their original official CDN source. Navigation glyphs are structural UI. */
export function GameIcon({ name, className = "" }: { name: GameIconName; className?: string }) {
  const official =
    name === "research"
      ? assets.icons.research
      : name === "performance"
        ? assets.icons.engine
        : name === "loadout"
          ? assets.icons.loadout
          : name === "details"
            ? assets.icons.stats
            : name === "crew"
              ? assets.icons.account
              : null;
  if (official)
    return (
      <img
        className={`wt-control-icon ${className}`}
        src={official.url}
        width={20}
        height={20}
        alt=""
        aria-hidden="true"
      />
    );
  return (
    <svg
      className={`wt-control-icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {name === "close" ? (
        <path d="m5 5 10 10M15 5 5 15" />
      ) : name === "external" ? (
        <>
          <path d="M11 3h6v6M17 3l-8 8M8 4H4v12h12v-4" />
        </>
      ) : name === "route" ? (
        <>
          <path d="M4 4h4v4H4zM12 12h4v4h-4zM6 8v6h6M8 6h6v6" />
        </>
      ) : name === "store" ? (
        <>
          <path d="M3 3h2l2 10h8l2-7H6M8 16h.01M14 16h.01" />
        </>
      ) : (
        <>
          <path d="M10 3v13M5 7h10M3 12h14M5 12v4M15 12v4M7 7V5M13 7V5" />
        </>
      )}
    </svg>
  );
}
