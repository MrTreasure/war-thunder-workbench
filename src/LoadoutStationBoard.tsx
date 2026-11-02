import { useLocale } from "./i18n/react";
import { t, getLocale } from "./i18n/core";
import type { CSSProperties } from "react";
import type { WikiLoadouts, WikiLoadoutOption } from "./models";
import type { Mount } from "./loadouts";
import { optionKey, stationLoadoutOptions } from "./loadouts";
import { loadoutWeaponName } from "./intl-loadout-presentation";
import { GameTip } from "./components/GameTip";
import { GameIcon } from "./components/GameIcon";
import { LoadoutWeaponDetails } from "./LoadoutWeaponDetails";
const regions = [
  { side: "left", label: "左翼" },
  { side: "center", label: "机身" },
  { side: "right", label: "右翼" },
] as const;
export function LoadoutStationBoard({
  data,
  mounts,
  selected,
  conflicts,
  onChoose,
}: {
  data: WikiLoadouts;
  mounts: Mount[];
  selected: string;
  conflicts: Set<string>;
  onChoose: (station: string) => void;
}) {
  useLocale();
  const choice = (id: string): WikiLoadoutOption | undefined => {
    const mount = mounts.find((item) => item.station === id);
    return mount
      ? data.compatibility.find(
          (option) =>
            optionKey(option) === mount.option &&
            option.stations.some((point) => point.hardpointId === id),
        )
      : undefined;
  };
  const unknown = data.hardpoints.filter((point) => !point.side);
  return (
    <>
      <div
        className="wt-mount-point-strip"
        aria-label={t("全部挂点，按来源编号排列")}
        style={{ "--wt-point-count": data.hardpoints.length } as CSSProperties}
      >
        {data.hardpoints.map((point) => {
          const mounted = choice(point.id);
          const hasMount = mounts.some((item) => item.station === point.id);
          const available = stationLoadoutOptions(data, point.id).length > 0;
          const state = mounted
            ? t("已挂载")
            : hasMount
              ? t("挂载失效")
              : available
                ? t("空挂点")
                : t("不可挂载");
          return (
            <article
              key={point.id}
              className="wt-mount-point"
              data-side={point.side}
              data-selected={selected === point.id || undefined}
              data-conflict={conflicts.has(point.id) || undefined}
              data-unavailable={!available || undefined}
            >
              <button
                className="wt-mount-point-select"
                disabled={!available && !hasMount}
                onClick={() => onChoose(point.id)}
                aria-label={t("为挂点 {0} 选择或更换挂载", [point.label])}
              >
                {t("挂点")}
                {point.label}
              </button>
              {mounted ? (
                <GameTip
                  className="wt-mount-point-icon"
                  label={t("挂点 {0} \u00B7 {1}", [point.label, loadoutWeaponName(mounted.name)])}
                  triggerLabel={t("查看挂点 {0} 的完整挂载信息", [point.label])}
                  icon={
                    mounted.imageUrl ? (
                      <img src={mounted.imageUrl} alt="" width={44} height={36} />
                    ) : (
                      <GameIcon name="loadout" />
                    )
                  }
                >
                  <p>
                    {point.side === "left"
                      ? t("左翼")
                      : point.side === "right"
                        ? t("右翼")
                        : point.side === "center"
                          ? t("机身")
                          : t("位置未标明")}{" "}
                    ·{" "}
                    {mounted.weightKg === null
                      ? t("挂载重量未知")
                      : t("{0} 千克", [mounted.weightKg.toLocaleString(getLocale())])}
                  </p>
                  <LoadoutWeaponDetails option={mounted} />
                </GameTip>
              ) : (
                <button
                  className="wt-mount-point-empty"
                  disabled={!available && !hasMount}
                  onClick={() => onChoose(point.id)}
                  aria-label={t("{0}挂点 {1} 的挂载", [
                    available ? t("选择") : t("查看"),
                    point.label,
                  ])}
                >
                  {hasMount ? "!" : available ? "＋" : "—"}
                </button>
              )}
              <small>{state}</small>
            </article>
          );
        })}
      </div>
      <div className="wt-mount-regions" aria-label={t("按翼侧查看挂载")}>
        {regions.map((region) => (
          <section key={region.side} className="wt-mount-region">
            <h4>{t(region.label)}</h4>
            <ul>
              {data.hardpoints
                .filter((point) => point.side === region.side)
                .map((point) => {
                  const mounted = choice(point.id);
                  const available = stationLoadoutOptions(data, point.id).length > 0;
                  const present = mounts.some((m) => m.station === point.id);
                  const count = mounted?.stations.find((s) => s.hardpointId === point.id)?.count;
                  return (
                    <li key={point.id}>
                      <button disabled={!available && !present} onClick={() => onChoose(point.id)}>
                        <span>
                          {t("挂点")}
                          {point.label}
                        </span>
                        <strong>
                          {mounted
                            ? `${loadoutWeaponName(mounted.name.normalize("NFKC").replace(/^\d+\s*×\s*/, ""))} × ${count ?? t("未知")}`
                            : present
                              ? t("原挂载已失效")
                              : available
                                ? t("未挂载")
                                : t("不可挂载")}
                        </strong>
                      </button>
                    </li>
                  );
                })}
              {!data.hardpoints.some((point) => point.side === region.side) && (
                <li className="wt-mount-note">{t("来源未列出该位置挂点")}</li>
              )}
            </ul>
          </section>
        ))}
      </div>
      {!!unknown.length && (
        <p className="wt-mount-note">
          {t("来源未标明翼侧：")}
          {unknown
            .map((point) =>
              t("挂点 {0}{1}", [
                point.label,
                choice(point.id) ? " · " + loadoutWeaponName(choice(point.id)!.name) : "",
              ]),
            )
            .join("；")}
          {t("。不将这些挂点归入机身或任一侧翼。")}
        </p>
      )}
    </>
  );
}
