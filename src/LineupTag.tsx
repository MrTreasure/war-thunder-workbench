import type { CSSProperties } from "react";
import { communityTags, communityRules } from "./lineup-community-api";
export function LineupTag({ id }: { id: string }) {
  const tag = communityTags.find((item) => item.id === id);
  if (!tag) return null;
  return (
    <span
      className="wt-lineup-tag"
      style={
        {
          "--wt-tag-tint": communityRules.colors[tag.color as keyof typeof communityRules.colors],
        } as CSSProperties
      }
    >
      <span className="wt-lineup-tag-skin" aria-hidden="true" />
      <span className="wt-lineup-tag-tint" aria-hidden="true" />
      <span className="wt-lineup-tag-text">{tag.label}</span>
    </span>
  );
}
