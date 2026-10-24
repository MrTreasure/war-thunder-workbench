import { t, getLocale, localize, vehicleName } from "./i18n/core";
import { useLocale } from "./i18n/react";
import type { CSSProperties } from "react";
import type { Modification, ModificationData } from "./models";
import { compactResearchPoints } from "./research-number-format";
import { format } from "./quotes";
import { ResearchPoints } from "./ResearchPoints";
const groupNames: Record<string, string> = {
  Mobility: "机动",
  Protection: "防护",
  Firepower: "火力",
  "Flight performance": "飞行性能",
  Survivability: "生存性",
  Weaponry: "武器",
};
export function ModificationGrid({
  data,
  included,
  allUnlockedByDefault,
  completed,
  onChange,
}: {
  data: ModificationData;
  included: boolean;
  allUnlockedByDefault: boolean;
  completed: string[];
  onChange: (id: string, checked: boolean) => void;
}) {
  useLocale();
  function card(item: Modification, positioned = false) {
    return (
      <label
        key={item.id}
        className={`wt-part-card ${included || completed.includes(item.id) ? "is-complete" : ""}`}
        style={
          positioned && item.position
            ? ({
                gridColumn: item.position.column + 1,
                gridRow: item.position.row,
              } as CSSProperties)
            : undefined
        }
      >
        <input
          type="checkbox"
          disabled={!data.itemCostsComplete || included}
          checked={included || (data.itemCostsComplete && completed.includes(item.id))}
          onChange={(e) => onChange(item.id, e.target.checked)}
        />
        <span className="wt-part-image">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              width="72"
              height="56"
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
        </span>
        <span className="wt-part-name" title={vehicleName(item)}>
          {vehicleName(item)}
        </span>
        {!allUnlockedByDefault && (
          <strong
            title={item.rp === null ? undefined : t("{0} 研发点", [localize(format(item.rp))])}
          >
            {item.rp === null ? (
              t("官方未提供")
            ) : (
              <ResearchPoints>{compactResearchPoints(item.rp, getLocale())}</ResearchPoints>
            )}
          </strong>
        )}
      </label>
    );
  }
  const located = data.items.filter((item) => item.position);
  const remaining = data.items.filter((item) => !item.position);
  const tiers = [
    ...new Set(
      remaining.map((item) => item.tier).filter((tier): tier is number => tier !== undefined),
    ),
  ].sort((a, b) => a - b);
  const unknown = remaining.filter((item) => item.tier === undefined);
  return (
    <div className="wt-parts-board">
      {!!data.presentation && located.length > 0 && (
        <div
          className="wt-part-groups"
          style={{
            gridTemplateColumns: `24px ${data.presentation.groups.map((group) => `calc(${Math.max(1, group.columns)} * var(--wt-part-card-width) + ${Math.max(0, group.columns - 1)} * 6px)`).join(" ")}`,
          }}
        >
          <aside className="wt-part-ranks" aria-label={t("配件等级")}>
            {Array.from(
              { length: Math.max(0, ...located.map((item) => item.position?.row || 0)) },
              (_, i) => (
                <span key={i}>{["I", "II", "III", "IV", "V", "VI"][i] || i + 1}</span>
              ),
            )}
          </aside>
          {data.presentation.groups.map((group, index) => (
            <section className="wt-part-group" key={index}>
              <h4>{t(groupNames[group.name] || group.name)}</h4>
              <div
                className="wt-part-grid"
                style={{ "--wt-part-columns": Math.max(1, group.columns) } as CSSProperties}
              >
                {located
                  .filter((item) => item.position?.group === index)
                  .map((item) => card(item, true))}
              </div>
            </section>
          ))}
        </div>
      )}
      {tiers.length > 0 && (
        <div className="wt-part-tier-list">
          {tiers.map((tier) => (
            <section
              className="wt-part-tier-row"
              key={tier}
              aria-label={t("配件等级 {0}", [localize(tier)])}
            >
              <h4>{["I", "II", "III", "IV", "V", "VI"][tier - 1] || tier}</h4>
              <div className="wt-part-grid is-unmapped">
                {remaining.filter((item) => item.tier === tier).map((item) => card(item))}
              </div>
            </section>
          ))}
        </div>
      )}
      {unknown.length > 0 && (
        <section className="wt-part-unknown">
          <h4>{t("等级待核对")}</h4>
          <div className="wt-part-grid is-unmapped">{unknown.map((item) => card(item))}</div>
        </section>
      )}
    </div>
  );
}
