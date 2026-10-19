import type { Tree, IndexedVehicle, Profile } from "./models";
// Pure planning logic: no DOM, persistence, prices or network requests.

const ranks = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const rankNumber = (rank: string) => ranks.indexOf(rank) + 1;
export function indexTree(tree: Tree | null) {
  const units = new Map<string, IndexedVehicle>(),
    aliases = new Map<string, string>(),
    parents = new Map<string, string>();
  if (!tree) return { units, aliases, parents };
  for (const rank of tree.ranks)
    for (const node of [...rank.research, ...rank.special]) {
      aliases.set(node.id, node.members[0].id);
      for (const unit of node.members) {
        const id = node.variant ? node.members[0].id : unit.id;
        aliases.set(unit.id, id);
        if (!node.variant || unit.id === id)
          units.set(id, { ...unit, rankNumber: rankNumber(unit.rank), node });
      }
    }
  for (const [id, unit] of units) {
    const req = unit.req || (unit.id === unit.node.members[0].id ? unit.node.req : null);
    const parent = (req ? aliases.get(req) : null) || req;
    if (parent && parent !== id) parents.set(id, parent);
  }
  return { units, aliases, parents };
}
// Actual purchased branch history is independent of the manual pricing floor.
export function prerequisitePath(index: ReturnType<typeof indexTree>, targetId: string) {
  const result: IndexedVehicle[] = [];
  const seen = new Set<string>();
  let id = index.aliases.get(targetId) || targetId;
  seen.add(id);
  while (index.parents.has(id)) {
    id = index.parents.get(id)!;
    if (seen.has(id)) break;
    seen.add(id);
    const unit = index.units.get(id);
    if (!unit || unit.side !== "research") break;
    result.unshift(unit);
  }
  return result;
}
export function branchOwned(
  index: ReturnType<typeof indexTree>,
  targetId: string,
  owned: string[],
  through: string,
) {
  const target = index.aliases.get(targetId) || targetId;
  const branch = [...prerequisitePath(index, target).map((unit) => unit.id), target];
  const stop = through === "" ? -1 : branch.indexOf(index.aliases.get(through) || through);
  if (through && stop < 0) return owned;
  const scope = new Set(branch);
  return [
    ...new Set([
      ...owned.map((id) => index.aliases.get(id) || id).filter((id) => !scope.has(id)),
      ...branch.slice(0, stop + 1),
    ]),
  ];
}
export function calculate(tree: Tree, options: Partial<Profile> = {}) {
  const index = indexTree(tree),
    { units, aliases, parents } = index;
  const canonical = (id: string) => aliases.get(id) || id;
  const owned = new Set((options.owned || []).map(canonical).filter((id) => units.has(id)));
  const target = units.get(canonical(options.target || ""));
  const pricingFloor =
    typeof options.unlocked === "number" &&
    Number.isInteger(options.unlocked) &&
    tree.ranks.some((rank) => rankNumber(rank.rank) === options.unlocked)
      ? options.unlocked
      : 0;
  const errors: string[] = [],
    selected = new Set<string>(),
    mandatory = new Set<string>(),
    pinned = new Set<string>();
  const banned = new Set((options.banned || []).map(canonical));
  const overrides = options.costs || {};
  const cost = (id: string): number | null => {
    const value = overrides[id] ?? units.get(id)?.rp;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const progress =
    typeof options.progress === "number" &&
    Number.isSafeInteger(options.progress) &&
    options.progress >= 0
      ? options.progress
      : 0;
  const remaining = (id: string) =>
    cost(id) === null ? null : Math.max(0, cost(id)! - (id === target?.id ? progress : 0));
  const closure = (id: string, base: Set<string>) => {
    const additions = new Set<string>(),
      visiting = new Set<string>();
    function visit(raw: string) {
      const uid = canonical(raw);
      if (owned.has(uid) || base.has(uid) || additions.has(uid)) return;
      const unit = units.get(uid);
      if (unit && unit.rankNumber < pricingFloor) return;
      if (!unit || unit.side !== "research")
        throw new Error(`缺失可研发前置：${unit?.name || uid}`);
      if (visiting.has(uid)) throw new Error("前置关系出现循环，请核对数据");
      visiting.add(uid);
      if (parents.has(uid)) visit(parents.get(uid)!);
      visiting.delete(uid);
      additions.add(uid);
    }
    visit(id);
    return additions;
  };
  if (!target || target.side !== "research")
    return {
      ...index,
      owned,
      rows: [],
      gates: [],
      errors: ["请选择常规研发载具作为目标"],
      total: null,
      unknown: [] as string[],
      unlocked: 0,
      knownTotal: 0,
      target: undefined,
    };
  // Owning a regular vehicle proves that its rank has already been opened.
  // Owning a premium / squadron / event vehicle does not prove this.
  const firstRank = Math.min(...tree.ranks.map((rank) => rankNumber(rank.rank)));
  const unlocked = Math.max(
    firstRank,
    typeof options.unlocked === "number" && Number.isInteger(options.unlocked)
      ? options.unlocked
      : 0,
    ...[...owned]
      .filter((id) => units.get(id)!.side === "research")
      .map((id) => units.get(id)!.rankNumber),
  );
  try {
    for (const id of closure(target.id, selected)) {
      selected.add(id);
      mandatory.add(id);
    }
    if (!owned.has(target.id) && target.rankNumber >= pricingFloor)
      for (const raw of options.pins || []) {
        const id = canonical(raw),
          unit = units.get(id);
        if (!unit || unit.side !== "research" || unit.rankNumber > target.rankNumber) continue;
        for (const uid of closure(id, selected)) {
          selected.add(uid);
          pinned.add(uid);
        }
      }
    for (const rank of [...tree.ranks].reverse()) {
      const number = rankNumber(rank.rank);
      const needed =
        [...selected].some((id) => units.get(id)!.rankNumber > number) && number >= unlocked;
      if (!needed) continue;
      const required = options.gates?.[rank.rank];
      if (typeof required !== "number" || !Number.isInteger(required) || required < 0) {
        errors.push(`Rank ${rank.rank} 的解锁数量缺失，请填写`);
        continue;
      }
      const count = () =>
        [...new Set([...owned, ...selected])].filter((id) => units.get(id)?.rankNumber === number)
          .length;
      while (count() < required) {
        const candidates = [];
        for (const [id, unit] of units) {
          if (
            unit.side !== "research" ||
            unit.rankNumber !== number ||
            owned.has(id) ||
            selected.has(id) ||
            banned.has(id)
          )
            continue;
          const additions = closure(id, selected);
          if (
            [...additions].some((uid) => banned.has(uid) && !mandatory.has(uid) && !pinned.has(uid))
          )
            continue;
          const gain = [...additions].filter((uid) => units.get(uid)!.rankNumber === number).length;
          if (!gain) continue;
          const unknown = [...additions].filter((uid) => remaining(uid) === null).length;
          const rp = [...additions].reduce((sum, uid) => sum + (remaining(uid) || 0), 0);
          candidates.push({
            id,
            additions,
            unknown,
            rp,
            score: rp / Math.min(gain, required - count()),
          });
        }
        candidates.sort(
          (a, b) =>
            a.unknown - b.unknown || a.score - b.score || a.rp - b.rp || a.id.localeCompare(b.id),
        );
        const best = candidates[0];
        if (!best) {
          errors.push(
            `Rank ${rank.rank} 数量不足：${count()} / ${required}，请调整排除项或勾选已拥有载具`,
          );
          break;
        }
        for (const id of best.additions) selected.add(id);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  // Return an executable order. A preceding rank is completed before moving up;
  // same-rank explicit prerequisites are topologically ordered.
  const ordered: string[] = [],
    seen = new Set<string>();
  function emit(id: string) {
    if (seen.has(id) || !selected.has(id)) return;
    seen.add(id);
    if (parents.has(id)) emit(parents.get(id)!);
    ordered.push(id);
  }
  for (const id of [...selected].sort(
    (a, b) => units.get(a)!.rankNumber - units.get(b)!.rankNumber,
  ))
    emit(id);
  const rows = ordered.map((id) => ({
    unit: units.get(id)!,
    rp: remaining(id),
    baseRp: cost(id),
    reason: mandatory.has(id)
      ? id === target.id
        ? "目标载具"
        : "目标前置"
      : pinned.has(id)
        ? "指定补研"
        : "等级补位",
  }));
  const gates = tree.ranks
    .filter((rank) => rankNumber(rank.rank) < target.rankNumber)
    .map((rank) => {
      const number = rankNumber(rank.rank),
        have = [...owned].filter((id) => units.get(id)!.rankNumber === number).length;
      const added = rows.filter((row) => row.unit.rankNumber === number).length;
      const required = options.gates?.[rank.rank];
      return {
        rank: rank.rank,
        number,
        next: ranks[number],
        required,
        have,
        added,
        alreadyOpen: number < unlocked || owned.has(target.id),
        needed: rows.some((row) => row.unit.rankNumber > number) && number >= unlocked,
      };
    });
  for (const gate of gates)
    if (
      gate.needed &&
      (typeof gate.required !== "number" ||
        !Number.isInteger(gate.required) ||
        gate.have + gate.added < gate.required)
    ) {
      if (!errors.some((error) => error.includes(`Rank ${gate.rank} `)))
        errors.push(`Rank ${gate.rank} 门槛未满足`);
    }
  const unknown = rows.filter((row) => row.rp === null).map((row) => row.unit.id);
  const knownTotal = rows.reduce((sum, row) => sum + (row.rp || 0), 0);
  return {
    ...index,
    target,
    owned,
    rows,
    gates,
    errors,
    unknown,
    knownTotal,
    total: unknown.length || errors.length ? null : knownTotal,
    unlocked,
  };
}
