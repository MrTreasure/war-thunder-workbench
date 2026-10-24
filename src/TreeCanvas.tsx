import { vehicleSearchText } from "./i18n/core";
import { localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t, vehicleName } from "./i18n/core";
import workspaceAssets from "../data/account-workspace.json";
import { useAccountWorkspace } from "./workspace-context";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { Catalog, Mode, Tree, TreeNode, Vehicle } from "./models";
import { format } from "./quotes";
import { packPriceLabel } from "./PackPrice";
export const modes: Record<Mode, string> = { ab: "街机", rb: "历史", sb: "全真" };
export const rating = (unit: Vehicle, mode: Mode) =>
  typeof unit.br[mode] === "number" && unit.br[mode]! >= 0
    ? (unit.br[mode]! / 3 + 1).toFixed(1)
    : "—";
export const rpText = (unit: Vehicle) =>
  unit.rp === undefined ? t("研发点 —") : unit.rp === 0 ? t("免费研发") : `${format(unit.rp)} RP`;
const at = (left: number, top: number, width?: number, height?: number): CSSProperties => ({
  left,
  top,
  width,
  height,
  position: "absolute",
});
function nodeHeight(node: TreeNode, expanded: Set<string>) {
  const count = node.members.length - 1;
  return node.group
    ? 135 + (expanded.has(node.id) && count ? 25 + count * 94 + Math.max(0, count - 1) * 18 : 0)
    : 110;
}
export function treeLayout(tree: Tree, expanded: Set<string>) {
  const cell = 188,
    mainX = 68,
    mainWidth = tree.columns * cell + 4,
    specialX = mainX + mainWidth + 28,
    specialWidth = Math.max(1, tree.specialColumns) * cell + 4,
    width = specialX + specialWidth + 14;
  const positions = new Map<string, { x: number; y: number; height: number; rowBottom: number }>();
  let cursor = 50;
  const ranks = tree.ranks.map((rank) => {
    const start = cursor;
    const rowCount = Math.max(rank.rows, ...rank.special.map((node) => node.row + 1), 1);
    const heights = Array.from({ length: rowCount }, () => 110);
    for (const node of [...rank.research, ...rank.special])
      heights[node.row] = Math.max(heights[node.row], nodeHeight(node, expanded));
    const starts: number[] = [];
    let y = cursor + 32;
    for (const height of heights) {
      starts.push(y);
      y += height + 30;
    }
    for (const side of ["research", "special"] as const)
      for (const node of rank[side]) {
        const x = (side === "research" ? mainX : specialX) + 12 + node.column * cell;
        positions.set(node.id, {
          x,
          y: starts[node.row],
          height: nodeHeight(node, expanded),
          rowBottom: starts[node.row] + heights[node.row],
        });
      }
    cursor = y + 7;
    return { rank, start };
  });
  return { positions, ranks, width, height: cursor + 10, mainX, mainWidth, specialX, specialWidth };
}
export function VehicleCard({
  unit,
  catalog,
  mode,
  selected,
  onSelect,
}: {
  unit: Vehicle;
  catalog: Catalog;
  mode: Mode;
  selected: boolean;
  onSelect: () => void;
}) {
  useLocale();

  const workspace = useAccountWorkspace();
  const owned = !!workspace?.ownedVehicleIds.has(unit.id);
  return (
    <button
      className={`vehicle-card ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      aria-label={t("{0}，Rank {1}{2}，查看研发信息", [
        vehicleName(unit),
        unit.rank,
        owned ? t("，已拥有") : "",
      ])}
    >
      <img
        src={unit.thumbnailUrl}
        width={83}
        height={49}
        alt=""
        loading="lazy"
        onError={(e) => {
          e.currentTarget.hidden = true;
        }}
      />
      {localize(
        owned && (
          <span
            className={`wt-owned-marker ${unit.kind === "squadron" ? "is-squadron" : unit.premium ? "is-premium" : ""}`}
            style={
              {
                "--wt-owned-slot-image": `url("${workspaceAssets.ownedMarker.background.url}")`,
              } as CSSProperties
            }
            title={t("已拥有 · 来自关联游戏账号的公开车库")}
            aria-label={t("已拥有")}
          >
            <span className="wt-owned-slot" aria-hidden="true" />
            <img
              src={workspaceAssets.ownedMarker.background.url}
              width={92}
              height={92}
              alt=""
              onLoad={(e) => {
                e.currentTarget.parentElement?.style.setProperty(
                  "--wt-owned-slot-image",
                  `url("${e.currentTarget.currentSrc || e.currentTarget.src}")`,
                );
              }}
              onError={(e) => {
                if (e.currentTarget.dataset.fallback !== "1") {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = workspaceAssets.ownedMarker.background.fallbackUrl;
                } else {
                  e.currentTarget.parentElement?.setAttribute("data-unavailable", "true");
                }
              }}
            />
            <span className="wt-owned-fallback" aria-hidden="true">
              ♠
            </span>
          </span>
        ),
      )}
      <span className="unit-role">{localize(catalog.roles[unit.role || ""] || t("常规载具"))}</span>
      <span className="unit-name" title={vehicleName(unit)}>
        {vehicleName(unit)}
      </span>
      <span className="unit-meta">
        <span
          className={`unit-badge ${unit.side === "research" || unit.kind === "squadron" ? "unit-rp" : ""}`}
        >
          {localize(
            unit.side === "research" || unit.kind === "squadron"
              ? rpText(unit)
              : unit.kind === "gold" && unit.price !== null
                ? `${format(unit.price)} GE`
                : unit.kind === "pack"
                  ? packPriceLabel(unit)
                  : catalog.kinds[unit.kind],
          )}
        </span>
      </span>
      <span className="battle-ratings">
        <span className="battle-rating" title={`${modes[mode]} ${rating(unit, mode)}`}>
          <span className="rating-mode">
            {localize(modes[mode])} {localize(mode.toUpperCase())}
          </span>
          <strong>{localize(rating(unit, mode))}</strong>
        </span>
      </span>
    </button>
  );
}
export function TreeCanvas({
  tree,
  catalog,
  mode,
  selected,
  query,
  expanded,
  toggle,
  zoom,
  filter,
  onSelect,
  locate,
}: {
  tree: Tree;
  catalog: Catalog;
  mode: Mode;
  selected: string | null;
  query: string;
  expanded: Set<string>;
  toggle: (id: string) => void;
  zoom: number;
  filter: string;
  onSelect: (id: string) => void;
  locate: number;
}) {
  useLocale();

  const layout = useMemo(() => treeLayout(tree, expanded), [tree, expanded]);
  const refs = useRef(new Map<string, HTMLElement>());
  const nodes = tree.ranks.flatMap((rank) => [...rank.research, ...rank.special]);
  const owners = new Map(
    nodes.flatMap((node) => node.members.map((unit) => [unit.id, node.id] as const)),
  );
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(tree.edges.map((edge) => [edge.to, edge.from]));
  const route = new Set<string>();
  let id = selected ? owners.get(selected) : undefined;
  while (id && !route.has(id)) {
    route.add(id);
    id = incoming.get(id);
  }
  const normal = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
  const needle = normal(query);
  const visible = (unit: Vehicle) =>
    filter === "all" ||
    (filter === "premium" && unit.premium) ||
    (filter === "other" && !unit.premium && unit.kind !== "squadron") ||
    unit.kind === filter;
  useEffect(() => {
    if (locate && selected) {
      for (const node of tree.ranks.flatMap((rank) => [...rank.research, ...rank.special]))
        if (node.members.some((unit) => unit.id === selected))
          refs.current.get(node.id)?.scrollIntoView({ block: "center", inline: "center" });
    }
  }, [locate, selected, tree]);
  return (
    <div
      className="canvas-space"
      style={{ width: Math.ceil(layout.width * zoom), height: Math.ceil(layout.height * zoom) }}
    >
      <div
        className={`canvas ${selected ? "has-route" : ""}`}
        style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}
      >
        <div className="column-panel" style={at(layout.mainX, 12, layout.mainWidth)} />
        <div
          className="column-panel is-special"
          style={at(layout.specialX, 12, layout.specialWidth)}
        />
        <div className="panel-heading" style={at(layout.mainX + 13, 29, layout.mainWidth - 26)}>
          {t("常规研发")}
          <small>{t("原始列位置 · 沿箭头向下")}</small>
        </div>
        <div
          className="panel-heading is-special"
          style={at(layout.specialX + 13, 29, layout.specialWidth - 26)}
        >
          {t("金币 / 礼包及特殊载具")}
          <small>{t("独立获取")}</small>
        </div>
        {localize(
          layout.ranks.map(({ rank, start }) => (
            <div key={rank.rank}>
              <div
                className="rank-band"
                style={at(layout.mainX + 1, start, layout.width - layout.mainX - 15)}
              />
              <div className="rank-label" style={at(10, start + 12)}>
                RANK<b>{localize(rank.rank)}</b>
              </div>
              <div className="rank-note" style={at(layout.mainX + 13, start + 13)}>
                {localize(rank.research.reduce((sum, node) => sum + node.members.length, 0))}{" "}
                {t("辆 · 常规研发")}
              </div>
            </div>
          )),
        )}
        <svg className="edges" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 L8 4 L0 8Z" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 L8 4 L0 8Z" />
            </marker>
          </defs>
          {localize(
            tree.edges.map((edge) => {
              const from = layout.positions.get(edge.from),
                to = layout.positions.get(edge.to);
              if (!from || !to) return null;
              const x1 = from.x + 84,
                y1 = from.y + from.height + 2,
                x2 = to.x + 84,
                y2 = to.y - 5,
                rail = x1 < x2 ? to.x - 10 : to.x + 178;
              const folder = nodeMap.get(edge.from)?.group && expanded.has(edge.from);
              const d = folder
                ? `M${from.x + 170},${from.y + 55} H${from.x + 178} V${y2 - 9} H${x2} V${y2}`
                : x1 === x2
                  ? `M${x1},${y1} V${y2}`
                  : `M${x1},${y1} V${from.rowBottom + 12} H${rail} V${y2 - 9} H${x2} V${y2}`;
              const active = route.has(edge.from) && route.has(edge.to);
              return (
                <path
                  key={`${edge.from}:${edge.to}`}
                  d={d}
                  className={`edge ${active ? "is-route" : ""}`}
                  markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"}
                />
              );
            }),
          )}
        </svg>
        {nodes.map((node) => {
          const p = layout.positions.get(node.id)!;
          const side = node.members[0].side;
          const muted = Boolean(
            (query &&
              !node.members.some((unit) => normal(vehicleSearchText(unit)).includes(needle)) &&
              !route.has(node.id)) ||
            (selected && !route.has(node.id)),
          );
          return (
            <article
              ref={(element) => {
                if (element) refs.current.set(node.id, element);
                else refs.current.delete(node.id);
              }}
              className={`node ${side === "special" ? "is-special" : ""} ${node.members.some((unit) => unit.premium) ? "is-premium" : ""} ${node.group ? "is-group" : ""} ${expanded.has(node.id) ? "is-open" : ""} ${muted ? "is-muted" : ""} ${route.has(node.id) ? "is-route" : ""} ${node.members.some((unit) => unit.id === selected) ? "is-selected" : ""}`}
              key={node.id}
              style={at(p.x, p.y)}
              hidden={side === "special" && !node.members.some(visible)}
            >
              <VehicleCard
                unit={node.members[0]}
                {...{ catalog, mode }}
                selected={node.members[0].id === selected}
                onSelect={() => onSelect(node.members[0].id)}
              />
              {localize(
                node.group && (
                  <>
                    <button
                      className="folder-toggle"
                      aria-expanded={expanded.has(node.id)}
                      onClick={() => toggle(node.id)}
                    >
                      <span>
                        {localize(node.variant ? t("联动系统") : t("折叠组"))} ·{" "}
                        {localize(node.members.length)} {t("辆")}
                      </span>
                      <span>{localize(expanded.has(node.id) ? "−" : "＋")}</span>
                    </button>
                    {localize(
                      expanded.has(node.id) && (
                        <div className="folder-members">
                          {localize(
                            node.members.slice(1).map((unit) => (
                              <div className="folder-member" key={unit.id}>
                                {localize(
                                  unit.req &&
                                    node.members.some((previous) => previous.id === unit.req) && (
                                      <span className="folder-link" />
                                    ),
                                )}
                                <VehicleCard
                                  {...{ unit, catalog, mode }}
                                  selected={unit.id === selected}
                                  onSelect={() => onSelect(unit.id)}
                                />
                              </div>
                            )),
                          )}
                        </div>
                      ),
                    )}
                  </>
                ),
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
