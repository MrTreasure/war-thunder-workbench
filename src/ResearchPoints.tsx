import cardTheme from "../data/vehicle-card-theme.json";
import "./research-points.css";

export function ResearchPoints({ children }: { children: import("react").ReactNode }) {
  return (
    <span className="wt-research-points">
      {children}
      <img src={cardTheme.icons.rp} width="16" height="16" alt="研发点" />
    </span>
  );
}
