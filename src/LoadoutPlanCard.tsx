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
  return (
    <article className="wt-mount-plan-card">
      <header className="wt-mount-card-heading">
        <div className="wt-mount-card-identity">
          <h4>{title}</h4>
          {recommended && <span className="wt-mount-recommended-state">已发布</span>}
        </div>
        {!!tags?.length && <LoadoutTags tags={tags} />}
      </header>
      <LoadoutSummaryStrip vehicle={vehicle} preview={preview} />
      <footer className="wt-mount-card-footer">
        <p>{meta}</p>
        <div className="wt-mount-card-actions">{children}</div>
      </footer>
    </article>
  );
}
