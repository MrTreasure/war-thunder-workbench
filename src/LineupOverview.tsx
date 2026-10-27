import { t, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { VehicleTile } from "./VehicleTile";
import type { CatalogIndex, LineupRules, Mode } from "./models";
import type { Lineup, LineupRating, LineupVehicle } from "./lineups";
import { lineupCardRating, lineupVehicleKind, lineupRatings } from "./lineups";
import { modes } from "./TreeCanvas";
// A horizontal native list needs keyboard focus for scrolling, without changing its list semantics.
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex */
export function LineupSummary({
  lineup,
  units,
  mode,
  catalog,
}: {
  lineup: Lineup;
  units: Map<string, LineupVehicle>;
  mode: Mode;
  catalog: CatalogIndex;
}) {
  useLocale();
  return (
    <ol
      className="lineup-summary-slots"
      tabIndex={0}
      aria-label={t("{0} 的槽位预览", [localize(lineup.name)])}
    >
      {localize(
        lineup.slots
          .slice(
            0,
            Math.max(
              1,
              lineup.slots.reduce((last, id, i) => (id ? i + 1 : last), 0),
            ),
          )
          .map((id, index) => {
            const unit = id ? units.get(id) : undefined;
            return (
              <li key={index} className={unit ? `is-kind-${lineupVehicleKind(unit)}` : "is-empty"}>
                <span className="lineup-summary-number">{localize(index + 1)}</span>
                {localize(
                  unit ? (
                    <VehicleTile
                      unit={unit}
                      catalog={catalog}
                      mode={mode}
                      showRank
                      modeRating={lineupCardRating(unit, lineup.battleType, mode)}
                    />
                  ) : (
                    <span className="lineup-summary-placeholder">
                      {localize(id ? t("资料待更新") : t("空槽位"))}
                    </span>
                  ),
                )}
                {localize(
                  unit?.category === "aviation" &&
                    lineup.battleType === "air" &&
                    lineup.activeAircraft === id && <small>{t("RB 出击")}</small>,
                )}
              </li>
            );
          }),
      )}
    </ol>
  );
}
/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */
export function LineupSummaryRatings({
  lineup,
  units,
  rules,
}: {
  lineup: Lineup;
  units: Map<string, LineupVehicle>;
  rules: LineupRules;
}) {
  useLocale();
  return (
    <div className="lineup-summary-ratings" aria-label={t("队列不同模式权重")}>
      {localize(
        lineupRatings(lineup, units, rules)
          .filter((value) => value.mode !== "sb")
          .map((value) => (
            <span
              key={value.mode}
              title={value.note}
              aria-label={`${modes[value.mode]}：${value.label}。${value.note}`}
            >
              {localize(value.mode.toUpperCase())} <strong>{localize(value.label)}</strong>
            </span>
          )),
      )}
    </div>
  );
}
export function LineupRatingsView({
  ratings,
  units,
}: {
  ratings: LineupRating[];
  units: Map<string, LineupVehicle>;
}) {
  useLocale();
  return (
    <div className="lineup-ratings" aria-label={t("不同模式的队列权重")}>
      {localize(
        ratings
          .filter((value) => value.mode !== "sb")
          .map((value) => (
            <div key={value.mode} className="lineup-rating">
              <span>
                {localize(modes[value.mode])} {localize(value.mode.toUpperCase())}
              </span>
              <strong>{localize(value.label)}</strong>
              <p>{localize(value.note)}</p>
              {localize(
                value.excluded.length > 0 && (
                  <details>
                    <summary>
                      {localize(value.excluded.length)}
                      {t("辆不参与此模式计算")}
                    </summary>
                    <p>
                      {localize(value.excluded.map((id) => units.get(id)?.name || id).join("、"))}
                    </p>
                  </details>
                ),
              )}
            </div>
          )),
      )}
    </div>
  );
}
export function LineupRulesNotes({ rules }: { rules: LineupRules }) {
  useLocale();
  return (
    <details className="lineup-rule-notes">
      <summary>{t("权重规则与来源")}</summary>
      <p>
        {t(
          "空战 AB 取前三架，A/2+B/4+C/4；两架取 (A+B)/2，单架取自身。B/C 与 A 的计算差距最多两档，按最近 BR 档位取整，正中间向上，最终最多比 A 低一档。",
        )}
      </p>
      <p>
        {t(
          "陆战 RB 的固定翼飞机采用陆战专用权重，直升机使用 RB 权重；陆战 AB 的机库固定翼飞机与直升机不计入。海战的飞机不得超过最高舰艇一档，超限飞机不可出击。",
        )}
      </p>
      <p>
        {t(
          "直升机可加入陆战混合队列；不参与固定翼空战或海战队列计算，直升机 PVE 等独立玩法另按活动规则。",
        )}
      </p>
      <p>{t("这是机库队列估算；损坏、锁定、临时活动和未解锁槽位等账号状态请以游戏为准。")}</p>
      {localize(
        rules.sources.map((source, i) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
            {localize(
              i === 0
                ? t("官方 Wiki 匹配规则")
                : i === 1
                  ? t("官方空战权重与取整说明")
                  : t("官方乘员槽位说明"),
            )}
            {localize(" ")}↗
          </a>
        )),
      )}
    </details>
  );
}
