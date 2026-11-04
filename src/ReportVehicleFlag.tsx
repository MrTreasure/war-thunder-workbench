import type { PlayerVehicle } from "./player-stats-api";
import { reportVehicleFlag } from "./report-vehicle-flag";

export default function ReportVehicleFlag({ vehicle }: { vehicle: PlayerVehicle }) {
  const flag = reportVehicleFlag(vehicle);
  return flag ? (
    <img
      key={flag.id}
      className="wt-poster-country-flag"
      src={flag.url}
      alt={`${flag.name}国旗`}
      loading="lazy"
      onError={(event) => {
        if (!event.currentTarget.dataset.fallback) {
          event.currentTarget.dataset.fallback = "1";
          event.currentTarget.src = flag.fallbackUrl;
        } else event.currentTarget.hidden = true;
      }}
    />
  ) : null;
}
