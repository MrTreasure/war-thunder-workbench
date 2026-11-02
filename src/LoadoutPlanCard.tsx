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
  children,
}: {
  title: string;
  vehicle?: LoadoutVehicle;
  preview?: LoadoutPreview;
  tags?: TagChoice[];
  meta: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="wt-mount-plan-card">
      <header className="wt-mount-card-heading">
        <h4>{title}</h4>
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
