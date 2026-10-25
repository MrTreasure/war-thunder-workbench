import type { Mode, Vehicle } from "./models";
import { modes, rating } from "./vehicle-labels";

/** Preserve separate aircraft air/ground ratings; never substitute an air BR. */
export function VehicleBattleRatings({
  unit,
  category,
  mode,
}: {
  unit: Vehicle;
  category: string;
  mode: Mode;
}) {
  if (category !== "aviation")
    return (
      <div className="wt-detail-ratings" aria-label="各模式战斗评级">
        {(["ab", "rb", "sb"] as const).map((value) => (
          <span key={value} className={value === mode ? "is-current" : ""}>
            <small>
              {modes[value]} {value.toUpperCase()}
            </small>
            <strong>{rating(unit, value)}</strong>
          </span>
        ))}
      </div>
    );
  return (
    <section className="wt-aircraft-ratings" aria-label="飞机分模式战斗评级">
      <table>
        <caption>战斗评级 BR</caption>
        <thead>
          <tr>
            <th scope="col">对战类型</th>
            {(["ab", "rb", "sb"] as const).map((value) => (
              <th scope="col" key={value} className={value === mode ? "is-current" : ""}>
                {modes[value]} <span>{value.toUpperCase()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">空战</th>
            {(["ab", "rb", "sb"] as const).map((value) => (
              <td key={value} className={value === mode ? "is-current" : ""}>
                {rating(unit, value)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">陆战</th>
            <td>
              <span className="wt-rating-unavailable" title="机库飞机不参与陆战街机">
                —
              </span>
            </td>
            <td className={mode === "rb" ? "is-current" : ""}>{rating(unit, "trb")}</td>
            <td className={mode === "sb" ? "is-current" : ""}>{rating(unit, "tsb")}</td>
          </tr>
        </tbody>
      </table>
      <p>陆战历史使用飞机的独立权重；陆战全真仍以活动允许名单为准。</p>
    </section>
  );
}
