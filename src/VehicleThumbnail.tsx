import { useState } from "react";
type ThumbnailVehicle = { id: string; imageUrl?: string; thumbnailUrl?: string };
import { vehicleMedia } from "./vehicle-media";
function Thumbnail({ unit }: { unit: ThumbnailVehicle }) {
  const media = vehicleMedia(unit.id, unit.imageUrl, unit.thumbnailUrl);
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="unit-art-unavailable" aria-label="图片暂缺">
        —
      </span>
    );
  return (
    <img
      className="unit-art"
      src={fallback ? media.imageUrl : media.thumbnailUrl}
      width={116}
      height={68}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!fallback && media.imageUrl !== media.thumbnailUrl) setFallback(true);
        else setFailed(true);
      }}
    />
  );
}
export function VehicleThumbnail({ unit }: { unit: ThumbnailVehicle }) {
  return <Thumbnail key={unit.id} unit={unit} />;
}
