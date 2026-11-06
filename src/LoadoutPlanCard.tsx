import { t, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { ReactNode } from "react";
import type { LoadoutPreview, LoadoutVehicle } from "./loadout-shares";
import type { TagChoice } from "./components/TagSelector";
import { LoadoutSummaryStrip } from "./LoadoutSummaryStrip";
import { LoadoutTags } from "./LoadoutTags";

/** Shared saved/public plan composition: identity, equipment, then metadata/actions. */
export function LoadoutPlanCard({
  title,
  vehicle,
  preview,
  tags,
  meta,
  recommended = false,
  children,
}: {
  title: string;
  vehicle?: LoadoutVehicle;
  preview?: LoadoutPreview;
  tags?: TagChoice[];
  meta: ReactNode;
  recommended?: boolean;
  children: ReactNode;
}) {
  useLocale();
  return (
    <article className="wt-mount-plan-card">
      <header className="wt-mount-card-heading">
        <div className="wt-mount-card-identity">
          <h4>{localize(title)}</h4>
          {localize(
            recommended && <span className="wt-mount-recommended-state">{t("已发布")}</span>,
          )}
        </div>
        {localize(!!tags?.length && <LoadoutTags tags={tags} />)}
      </header>
      <LoadoutSummaryStrip vehicle={vehicle} preview={preview} />
      <footer className="wt-mount-card-footer">
        <p>{localize(meta)}</p>
        <div className="wt-mount-card-actions">{localize(children)}</div>
      </footer>
    </article>
  );
}
