import { t } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { TagChoice } from "./components/TagSelector";
import { GameTag } from "./components/GameTag";
import { gameTagOptions } from "./game-tag-options";
export function LoadoutTags({ tags }: { tags: TagChoice[] }) {
  useLocale();
  return (
    <div className="wt-mount-tag-list">
      {tags.map((tag) => (
        <GameTag key={tag.id} tagId={tag.id} tone={tag.tone}>
          {t(gameTagOptions.find((option) => option.id === tag.id)?.label || tag.id)}
        </GameTag>
      ))}
    </div>
  );
}
