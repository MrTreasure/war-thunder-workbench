/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Read-only module grids retain keyboard horizontal scrolling. */
import type { ModificationData, Vehicle, WikiVehicleEquipment } from "./models";
import { ModificationGrid } from "./ModificationGrid";
import { equipmentLabel, equipmentValue } from "./vehicle-equipment";
import { groundWeaponName } from "./VehicleGroundCombat";
import { loadoutWeaponName } from "./loadout-presentation";
import { modificationAmmunitionImage } from "./modification-ammunition";
function Feature({
  feature,
  category,
}: {
  feature: WikiVehicleEquipment["features"][number];
  category: string;
}) {
  const engine = !feature.source && feature.parameters.some((parameter) => parameter.id === "type");
  return (
    <article className="wt-equipment-feature">
      <h4>{engine ? `发动机 · ${feature.name}` : equipmentLabel(feature.name)}</h4>
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
    <section className="wt-equipment" aria-label="载具装备与模块资料">
      {data?.status === "available" ? (
        <>
          {data.properties.length > 0 && (
            <>
              <div className="wt-ground-section-heading">
                <h3>基础构型</h3>
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
                <h3>雷达与探测设备</h3>
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
                <h3>动力模块</h3>
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
                <h3>防护、火控与辅助系统</h3>
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
                <h3>观瞄设备</h3>
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
        <p className="wt-dossier-empty">暂未取得此载具的已核验装备资料。</p>
      )}
      {modifications && modifications.items.length > 0 && (
        <>
          <div className="wt-ground-section-heading">
            <h3>可用配件模块</h3>
          </div>
          <div className="wt-equipment-parts" tabIndex={0} aria-label="可用配件模块，可横向滚动">
            <ModificationGrid
              data={modifications}
              included={false}
              allUnlockedByDefault={modifications.allUnlockedByDefault}
              completed={[]}
              onChange={() => {}}
              readOnly
              imageForItem={(item) => modificationAmmunitionImage(unit, item)}
            />
          </div>
        </>
      )}
    </section>
  );
}
