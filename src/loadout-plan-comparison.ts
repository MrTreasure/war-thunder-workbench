import type { WikiLoadouts } from "./models";
import {
  checkLoadout,
  loadoutRevision,
  optionKey,
  presetKey,
  weaponKey,
  type LoadoutPlan,
} from "./loadouts.ts";
import { loadoutBombs, estimateBombingTiers } from "./loadout-bombing.ts";
import { weaponTypes } from "./loadout-weapon-filters.ts";
/** Old content identities must never be resolved against a different source revision. */
export function planComparisonProblem(plans: LoadoutPlan[], data?: WikiLoadouts) {
  if (plans.length < 2) return "请选择至少两套方案。";
  if (plans.length > 4) return "一次最多比较四套方案。";
  const first = plans[0];
  if (plans.some((plan) => plan.country !== first.country || plan.vehicleId !== first.vehicleId))
    return "机型或国家不同，无法直接比较。请选择同机型方案。";
  if (plans.some((plan) => plan.sourceHash !== first.sourceHash))
    return "资料版本不同，无法直接比较。请分别打开旧方案并核对新资料，再明确保存。";
  if (data && (data.vehicleId !== first.vehicleId || loadoutRevision(data) !== first.sourceHash))
    return "方案与当前可用资料版本不同，无法还原比较；原方案保持不变。";
  return "";
}
export function compareLoadoutPlans(
  plans: LoadoutPlan[],
  data: WikiLoadouts,
  airRbRating?: string,
) {
  const problem = planComparisonProblem(plans, data);
  if (problem) return { problem, entries: [] };
  return {
    problem: "",
    entries: plans.map((plan) => {
      const check = checkLoadout(data, plan.mounts, plan.preset);
      const selected =
        plan.preset !== null
          ? data.presets
              .find((item) => presetKey(item) === plan.preset)
              ?.items.map((item) => ({ name: item.name, count: item.count })) || []
          : plan.mounts.flatMap((mount) => {
              const option = data.compatibility.find(
                (item) =>
                  optionKey(item) === mount.option &&
                  item.stations.some((station) => station.hardpointId === mount.station),
              );
              return option
                ? [
                    {
                      name: option.name,
                      count: option.stations.find(
                        (station) => station.hardpointId === mount.station,
                      )!.count,
                    },
                  ]
                : [];
            });
      const names = [
        ...new Map(selected.map((item) => [weaponKey(item.name), item.name])).values(),
      ];
      const weapons = names.map((name) => {
        const parts = selected.filter((item) => weaponKey(item.name) === weaponKey(name));
        return {
          key: weaponKey(name),
          name,
          count: parts.some((item) => item.count === null)
            ? null
            : parts.reduce((sum, item) => sum + item.count!, 0),
          types: weaponTypes.filter((type) => type.matches.test(name)).map((type) => type.label),
        };
      });
      const payload = loadoutBombs(data, plan.mounts, plan.preset);
      return { plan, check, weapons, payload, tiers: estimateBombingTiers(payload, airRbRating) };
    }),
  };
}
