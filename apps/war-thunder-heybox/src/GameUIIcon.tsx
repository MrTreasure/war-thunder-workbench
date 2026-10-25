import assets from "../../../data/workbench-ui-assets.json";
export type GameIconName = "research" | "stats" | "account" | "filter" | "arrow" | "back";
/** Preserve original game geometry and colors; labels remain readable if images fail. */
export function GameUIIcon({ name }: { name: GameIconName }) {
  return (
    <img
      className={"hb-game-icon hb-game-icon-" + name}
      src={assets.icons[name].url}
      width={24}
      height={24}
      alt=""
      aria-hidden="true"
      referrerPolicy="no-referrer"
    />
  );
}
