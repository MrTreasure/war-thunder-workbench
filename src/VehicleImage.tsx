import { vehicleDisplayName } from "./vehicle-display-name";
import { useState } from "react";
import type { Vehicle } from "./models";
export function VehicleImage({ unit }: { unit: Vehicle }) {
  const [source, setSource] = useState<"large" | "thumbnail" | "failed">("large");
  const [loaded, setLoaded] = useState(false);
  if (source === "failed")
    return (
      <span className="vehicle-image-unavailable">
        官方图片暂时无法载入，可点击载具标题查看官方资料。
      </span>
    );
  return (
    <span className="vehicle-image-frame" data-loading={!loaded}>
      {!loaded && <output className="vehicle-image-status">正在载入官方图片…</output>}
      <img
        src={source === "large" ? unit.imageUrl : unit.thumbnailUrl}
        alt={`${vehicleDisplayName(unit.name)} 官方载具图片`}
        width={1000}
        height={600}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setSource(source === "large" ? "thumbnail" : "failed");
        }}
      />
      {source === "thumbnail" && loaded && (
        <small className="vehicle-image-status">大图暂不可用，显示官方预览图</small>
      )}
    </span>
  );
}
