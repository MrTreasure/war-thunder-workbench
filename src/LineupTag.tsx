import { useTagCatalog, tagLabel } from "./game-tag-catalog";
import { GameTag } from "./components/GameTag";
import type { GameTagProps } from "./components/GameTag";

/** Lineup registry adapter; visual and interactive behavior belongs to GameTag. */
export function LineupTag({
  id,
  tone = "original",
  ...props
}: { id: string } & Omit<GameTagProps, "children">) {
  const catalogue = useTagCatalog();
  const label = tagLabel(id, catalogue.items);
  if (!label) return null;
  return (
    <GameTag tagId={id} tone={tone} {...props}>
      {label}
    </GameTag>
  );
}
