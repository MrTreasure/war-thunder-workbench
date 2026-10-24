import { vehicleSearchText } from "./i18n/core";
import { localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { getLocale, t, vehicleName } from "./i18n/core";
import cardTheme from "../data/vehicle-card-theme.json";
import { useAccountWorkspace } from "./workspace-context";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { Catalog, Mode, Tree, TreeNode, Vehicle } from "./models";
import { format } from "./quotes";
import { cnyPrice } from "./PackPrice";
import { compactResearchPoints } from "./research-number-format";
import { VehicleThumbnail } from "./VehicleThumbnail";
export const modes: Record<Mode, string> = { ab: "街机", rb: "历史", sb: "全真" };
export const rating = (unit: Vehicle, mode: Mode) =>
  typeof unit.br[mode] === "number" && unit.br[mode]! >= 0
    ? (unit.br[mode]! / 3 + 1).toFixed(1)
    : "—";
export const rpText = (unit: Vehicle) =>
  unit.rp === undefined
    ? t("研发点 —")
    : unit.rp === 0
      ? t("免费研发")
      : `${compactResearchPoints(unit.rp, getLocale())} RP`;
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
    ? 100 + (expanded.has(node.id) && count ? 18 + count * 88 + Math.max(0, count - 1) * 18 : 0)
    : 102;
}
export function treeLayout(tree: Tree, expanded: Set<string>) {
  const cell = cardTheme.geometry.cellWidth,
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
    const heights = Array.from({ length: rowCount }, () => 102);
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
  const premium = unit.premium || unit.kind === "gold" || unit.kind === "pack";
  const research = unit.side === "research" || unit.kind === "squadron";
  const market = !!unit.market || cardTheme.marketIconIds.includes(unit.id);
  const name = vehicleName(unit);
  const price = unit.packPrice;
  const role =
    unit.role === "spaa"
      ? "aa"
      : unit.role === "tank_destroyer"
        ? "td"
        : unit.role === "heavy_tank"
          ? "heavy"
          : unit.role === "medium_tank"
            ? "medium"
            : unit.role === "light_tank"
              ? "light"
              : "other";
  const exact = research
    ? unit.rp === undefined
      ? t("研发点 —")
      : `${format(unit.rp)} RP`
    : unit.kind === "gold"
      ? unit.price === null
        ? t("暂无报价")
        : `${format(unit.price)} GE`
      : localize(catalog.kinds[unit.kind]);
  return (
    <button
      className={`vehicle-card wt-game-card ${premium ? "is-premium" : ""} ${owned ? "is-owned" : ""} ${unit.kind === "squadron" ? "is-squadron" : ""} ${selected ? "is-selected" : ""}`}
      data-kind={unit.kind}
      onClick={onSelect}
      aria-label={t("{0}，Rank {1}{2}，{3}，查看研发信息", [
        name,
        unit.rank,
        owned ? t("，已拥有") : "",
        exact,
      ])}
      title={`${name} · ${exact}`}
    >
      {owned && (
        <span
          className="wt-game-owned"
          title={t("已拥有 · 来自关联游戏账号的公开车库")}
          aria-label={t("已拥有")}
        />
      )}
      <VehicleThumbnail unit={unit} />
      <span className={`unit-name ${name.length > 17 ? "is-long" : ""}`} title={name}>
        {name}
      </span>
      <span className="wt-game-card-bottom">
        <span className="wt-game-card-cost" title={exact}>
          {research ? (
            <>
              {unit.rp === undefined
                ? "—"
                : unit.rp === 0
                  ? t("初始")
                  : compactResearchPoints(unit.rp, getLocale())}
              {unit.rp !== 0 && (
                <img
                  className="wt-game-currency"
                  src={cardTheme.icons.rp}
                  width={18}
                  height={18}
                  alt={t("研发点")}
                />
              )}
            </>
          ) : unit.kind === "gold" ? (
            <>
              {unit.price === null ? "—" : format(unit.price)}
              <img
                className="wt-game-currency is-ge"
                src={cardTheme.icons.ge}
                width={20}
                height={20}
                alt={t("金鹰")}
              />
            </>
          ) : unit.kind === "pack" ? (
            t("礼包")
          ) : market ? (
            <img
              className="wt-game-currency is-gjn"
              src={cardTheme.icons.gjn}
              width={24}
              height={24}
              alt="Gaijin Coin"
            />
          ) : (
            t("特殊")
          )}
        </span>
        <span className="wt-game-card-br">{rating(unit, mode)}</span>
        <span
          className={`wt-game-role ${role}`}
          title={localize(catalog.roles[unit.role || ""] || t("常规载具"))}
          aria-label={localize(catalog.roles[unit.role || ""] || t("常规载具"))}
        />
      </span>
      {premium && (
        <img
          className="wt-game-talisman"
          src={cardTheme.icons.talisman}
          width={26}
          height={26}
          alt={t("护身符")}
        />
      )}
      {unit.kind === "pack" && (
        <span
          className="wt-game-pack-price"
          title={t("{0} · 价格核对于 {1}", [
            price?.title || name,
            price?.checkedAt.slice(0, 10) || "—",
          ])}
        >
          <small>{t("整包")}</small>
          {price?.status === "priced" && price.amountCents !== null
            ? cnyPrice(price.amountCents)
            : t("暂无报价")}
        </span>
      )}
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
        style={
          {
            width: layout.width,
            height: layout.height,
            transform: `scale(${zoom})`,
            "--wt-game-owned-icon": `url("${cardTheme.icons.owned}")`,
          } as CSSProperties
        }
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
          {tree.edges.map((edge) => {
            const from = layout.positions.get(edge.from),
              to = layout.positions.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + cardTheme.geometry.cardWidth / 2,
              y1 = from.y + from.height + 2,
              x2 = to.x + cardTheme.geometry.cardWidth / 2,
              y2 = to.y - 5,
              rail = x1 < x2 ? to.x - 10 : to.x + cardTheme.geometry.cardWidth + 10;
            const folder = nodeMap.get(edge.from)?.group && expanded.has(edge.from);
            const d = folder
              ? `M${from.x + cardTheme.geometry.cardWidth + 2},${from.y + 38} H${from.x + cardTheme.geometry.cardWidth + 10} V${y2 - 9} H${x2} V${y2}`
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
          })}
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
