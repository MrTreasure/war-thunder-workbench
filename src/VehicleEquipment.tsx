import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Read-only module grids retain keyboard horizontal scrolling. */
import type { ModificationData, Vehicle, WikiVehicleEquipment } from "./models";
import { ModificationGrid } from "./ModificationGrid";
import { equipmentLabel, equipmentValue } from "./intl-vehicle-equipment";
import { groundWeaponName } from "./VehicleGroundCombat";
import { loadoutWeaponName } from "./intl-loadout-presentation";
import { SupportedLoadoutWeapons } from "./SupportedLoadoutWeapons";
function Feature({
  feature,
  category,
}: {
  feature: WikiVehicleEquipment["features"][number];
  category: string;
}) {
  useLocale();
  const engine = !feature.source && feature.parameters.some((parameter) => parameter.id === "type");
  return (
    <article className="wt-equipment-feature">
      <h4>
        {engine ? t("\u53D1\u52A8\u673A \u00B7 {0}", [feature.name]) : equipmentLabel(feature.name)}
      </h4>
      {feature.weaponName && (
        <small>
          {category === "ground"
            ? groundWeaponName(feature.weaponName)
            : loadoutWeaponName(feature.weaponName)}
        </small>
      )}
      {feature.parameters.length > 0 && (
        <dl>
          {feature.parameters.map((parameter) => (
            <div key={parameter.id} className="wt-equipment-parameter">
              <dt>{equipmentLabel(parameter.label)}</dt>
              <dd>{equipmentValue(parameter.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
export function VehicleEquipment({
  unit,
  category,
  modifications,
}: {
  unit: Vehicle;
  category: string;
  modifications?: ModificationData;
}) {
  useLocale();
  const data = unit.wikiDetails?.performance?.equipment;
  const features = data?.status === "available" ? data.features : [];
  const sensors = features.filter(
    (feature) => /radar|optical|warning/i.test(feature.name) || feature.kind === "radar",
  );
  const engines = features.filter(
    (feature) => !feature.source && feature.parameters.some((parameter) => parameter.id === "type"),
  );
  const systems = features.filter(
    (feature) => !sensors.includes(feature) && !engines.includes(feature),
  );
  const capabilities = systems.filter((feature) => !feature.parameters.length);
  const configuredSystems = systems.filter((feature) => feature.parameters.length);
  return (
    <section
      className="wt-equipment"
      aria-label={t("\u8F7D\u5177\u88C5\u5907\u4E0E\u6A21\u5757\u8D44\u6599")}
    >
      {(category === "aviation" || category === "helicopters") && (
        <SupportedLoadoutWeapons unit={unit} />
      )}
      {data?.status === "available" ? (
        <>
          {data.properties.length > 0 && (
            <>
              <div className="wt-ground-section-heading">
                <h3>{t("\u57FA\u7840\u6784\u578B")}</h3>
              </div>
              <dl className="wt-equipment-properties">
                {data.properties.map((parameter) => (
                  <div key={parameter.id}>
                    <dt>{equipmentLabel(parameter.label)}</dt>
                    <dd>{equipmentValue(parameter.value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {sensors.length > 0 && (
            <>
              <div className="wt-ground-section-heading">
                <h3>{t("\u96F7\u8FBE\u4E0E\u63A2\u6D4B\u8BBE\u5907")}</h3>
              </div>
              <div className="wt-equipment-features">
                {sensors.map((feature) => (
                  <Feature key={feature.id} feature={feature} category={category} />
                ))}
              </div>
            </>
          )}
          {engines.length > 0 && (
            <>
              <div className="wt-ground-section-heading">
                <h3>{t("\u52A8\u529B\u6A21\u5757")}</h3>
              </div>
              <div className="wt-equipment-features">
                {engines.map((feature) => (
                  <Feature key={feature.id} feature={feature} category={category} />
                ))}
              </div>
            </>
          )}
          {systems.length > 0 && (
            <>
              <div className="wt-ground-section-heading">
                <h3>{t("\u9632\u62A4\u3001\u706B\u63A7\u4E0E\u8F85\u52A9\u7CFB\u7EDF")}</h3>
              </div>
              {capabilities.length > 0 && (
                <div className="wt-equipment-capabilities">
                  {capabilities.map((feature) => (
                    <span key={feature.id}>
                      {equipmentLabel(feature.name)}
                      {feature.weaponName && (
                        <small>
                          {category === "ground"
                            ? groundWeaponName(feature.weaponName)
                            : loadoutWeaponName(feature.weaponName)}
                        </small>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {configuredSystems.length > 0 && (
                <div className="wt-equipment-features">
                  {configuredSystems.map((feature) => (
                    <Feature key={feature.id} feature={feature} category={category} />
                  ))}
                </div>
              )}
            </>
          )}
          {data.optics.length > 0 && (
            <>
              <div className="wt-ground-section-heading">
                <h3>{t("\u89C2\u7784\u8BBE\u5907")}</h3>
              </div>
              <dl className="wt-equipment-properties">
                {data.optics.map((parameter) => (
                  <div key={parameter.id}>
                    <dt>{equipmentLabel(parameter.label)}</dt>
                    <dd>{equipmentValue(parameter.value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </>
      ) : (
        <p className="wt-dossier-empty">
          {t(
            "\u6682\u672A\u53D6\u5F97\u6B64\u8F7D\u5177\u7684\u5DF2\u6838\u9A8C\u88C5\u5907\u8D44\u6599\u3002",
          )}
        </p>
      )}
      {modifications && modifications.items.length > 0 && (
        <>
          <div className="wt-ground-section-heading">
            <h3>{t("\u53EF\u7528\u914D\u4EF6\u6A21\u5757")}</h3>
          </div>
          <div
            className="wt-equipment-parts"
            tabIndex={0}
            aria-label={t(
              "\u53EF\u7528\u914D\u4EF6\u6A21\u5757\uFF0C\u53EF\u6A2A\u5411\u6EDA\u52A8",
            )}
          >
            <ModificationGrid
              data={modifications}
              included={false}
              allUnlockedByDefault={modifications.allUnlockedByDefault}
              completed={[]}
              onChange={() => {}}
              readOnly
            />
          </div>
        </>
      )}
    </section>
  );
}
