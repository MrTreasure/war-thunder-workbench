import { t } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { CSSProperties } from "react";
import { communityTags, communityRules } from "./lineup-community-api";
export function LineupTag({ id }: { id: string }) {
  useLocale();
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
      <span className="wt-lineup-tag-text">{t(tag.label)}</span>
    </span>
  );
}
