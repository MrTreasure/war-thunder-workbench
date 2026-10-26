import titles from "../data/game-tag-texts.json";
import { communityTags } from "./lineup-community-api";
import { GameTag } from "./components/GameTag";
import type { GameTagProps } from "./components/GameTag";

/** Lineup registry adapter; visual and interactive behavior belongs to GameTag. */
export function LineupTag({
  id,
  tone = "original",
  ...props
}: { id: string } & Omit<GameTagProps, "children">) {
  const tag =
    communityTags.find((item) => item.id === id) || titles.titles.find((item) => item.id === id);
  if (!tag) return null;
  return (
    <GameTag tagId={id} tone={tone} {...props}>
      {tag.label}
    </GameTag>
  );
}
