import { communityTags } from "./lineup-community-api";
import { GameTag } from "./components/GameTag";
import type { GameTagProps, GameTagTone } from "./components/GameTag";

/** Lineup registry adapter; visual and interactive behavior belongs to GameTag. */
export function LineupTag({
  id,
  ...props
}: { id: string } & Omit<GameTagProps, "children" | "tone">) {
  const tag = communityTags.find((item) => item.id === id);
  if (!tag) return null;
  return (
    <GameTag tone={tag.color as GameTagTone} {...props}>
      {tag.label}
    </GameTag>
  );
}
