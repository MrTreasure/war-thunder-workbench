type Mark = { kind: string; team: number; label: string; x: number; y: number };

// Some mission exports concatenate AB/RB/SB briefing points. Keep the first
// supplied capture per team/label as the default set, preserving raw API data.
// Spawn areas can legitimately have several positions; only exact repeats merge.
export function displayMapMarks<T extends Mark>(marks: readonly T[]): T[] {
  const seen = new Set<string>();
  return marks.filter((mark) => {
    const key = JSON.stringify([
      mark.kind,
      mark.team,
      mark.label,
      ...(mark.kind === "capture" ? [] : [mark.x, mark.y]),
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
