import type { CSSProperties } from "react";
import type { Modification, ModificationData } from "./models";
import { compactResearchPoints } from "./research-number-format";
import { format } from "./quotes";
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
  completed,
  onChange,
}: {
  data: ModificationData;
  included: boolean;
  completed: string[];
  onChange: (id: string, checked: boolean) => void;
}) {
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
        <span className="wt-part-name" title={item.name}>
          {item.name}
        </span>
        <strong title={item.rp === null ? undefined : `${format(item.rp)} RP`}>
          {item.rp === null ? "官方未提供" : `${compactResearchPoints(item.rp)} RP`}
        </strong>
      </label>
    );
  }
  const located = data.items.filter((item) => item.position);
  const remaining = data.items.filter((item) => !item.position);
  return (
    <div className="wt-parts-board">
      {!!data.presentation && located.length > 0 && (
        <div
          className="wt-part-groups"
          style={{
            gridTemplateColumns: `24px ${data.presentation.groups.map((group) => `minmax(0, ${Math.max(1, group.columns)}fr)`).join(" ")}`,
          }}
        >
          <aside className="wt-part-ranks" aria-label="配件等级">
            {Array.from(
              { length: Math.max(0, ...located.map((item) => item.position?.row || 0)) },
              (_, i) => (
                <span key={i}>{["I", "II", "III", "IV", "V", "VI"][i] || i + 1}</span>
              ),
            )}
          </aside>
          {data.presentation.groups.map((group, index) => (
            <section className="wt-part-group" key={index}>
              <h4>{groupNames[group.name] || group.name}</h4>
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
      {remaining.length > 0 && (
        <div className="wt-part-grid is-unmapped">{remaining.map((item) => card(item))}</div>
      )}
    </div>
  );
}
