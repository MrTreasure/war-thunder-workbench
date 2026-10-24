import { t } from "./i18n/core";
import { useState } from "react";
import type { Vehicle } from "./models";
import { vehicleMedia } from "./vehicle-media";
function Thumbnail({ unit }: { unit: Vehicle }) {
  const media = vehicleMedia(unit.id, unit.imageUrl, unit.thumbnailUrl);
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="unit-art-unavailable" aria-label={t("图片暂缺")}>
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
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!fallback && media.imageUrl !== media.thumbnailUrl) setFallback(true);
        else setFailed(true);
      }}
    />
  );
}
export function VehicleThumbnail({ unit }: { unit: Vehicle }) {
  return <Thumbnail key={unit.id} unit={unit} />;
}
