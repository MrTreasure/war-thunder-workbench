/** Identical point topology lets browsers interpolate prerequisite wires with the cards. */
export function treeEdgePath(
  from: { x: number; y: number; height: number; rowBottom: number },
  to: { x: number; y: number },
  cardWidth: number,
  folderOpen: boolean,
): string {
  const x1 = from.x + cardWidth / 2,
    y1 = from.y + from.height + 2,
    x2 = to.x + cardWidth / 2,
    y2 = to.y - 14;
  const rail = x1 < x2 ? to.x - 10 : to.x + cardWidth + 10;
  const points = folderOpen
    ? [
        [from.x + cardWidth + 2, from.y + 38],
        [from.x + cardWidth + 10, from.y + 38],
        [from.x + cardWidth + 10, y2 - 9],
        [x2, y2 - 9],
        [x2, y2 - 1],
        [x2, y2],
      ]
    : x1 === x2
      ? [
          [x1, y1],
          [x1, y1],
          [x1, y1],
          [x2, y2 - 2],
          [x2, y2 - 1],
          [x2, y2],
        ]
      : [
          [x1, y1],
          [x1, from.rowBottom + 12],
          [rail, from.rowBottom + 12],
          [rail, y2 - 9],
          [x2, y2 - 9],
          [x2, y2],
        ];
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
}
