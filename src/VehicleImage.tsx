import { vehicleMedia } from "./vehicle-media";
import { vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
import { useState } from "react";
import type { Vehicle } from "./models";
export function VehicleImage({ unit }: { unit: Vehicle }) {
  useLocale();
  const media = vehicleMedia(unit.id, unit.imageUrl, unit.thumbnailUrl);

  const [source, setSource] = useState<"large" | "thumbnail" | "failed">("large");
  const [loaded, setLoaded] = useState(false);
  if (source === "failed")
    return (
      <span className="vehicle-image-unavailable">
        {t("官方图片暂时无法载入，可点击载具标题查看官方资料。")}
      </span>
    );
  return (
    <span className="vehicle-image-frame" data-loading={!loaded}>
      {localize(
        !loaded && <output className="vehicle-image-status">{t("正在载入官方图片…")}</output>,
      )}
      <img
        src={source === "large" ? media.imageUrl : media.thumbnailUrl}
        alt={localize(`${localize(vehicleName(unit))} 官方载具图片`)}
        width={1000}
        height={600}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setSource(source === "large" ? "thumbnail" : "failed");
        }}
      />
      {localize(
        source === "thumbnail" && loaded && (
          <small className="vehicle-image-status">{t("大图暂不可用，显示官方预览图")}</small>
        ),
      )}
    </span>
  );
}
