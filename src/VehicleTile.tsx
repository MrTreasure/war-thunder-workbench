import { useVehicleFacts, withVehicleFacts } from "./vehicle-catalog";
import bootstrap from "./generated/bootstrap.json";
import cardTheme from "../data/vehicle-card-theme.json";
import type { CSSProperties } from "react";
import type { Catalog, Mode, PackPrice, Vehicle } from "./models";
import { useAccountWorkspace } from "./workspace-context";
import { vehicleDisplayName } from "./vehicle-display-name";
import { VehicleThumbnail } from "./VehicleThumbnail";
import { compactResearchPoints } from "./research-number-format";
import { format } from "./quotes";
import { cnyPrice } from "./PackPrice";
import { rating } from "./vehicle-labels";

/** A display adapter accepts only known facts; no country data is fetched by a tile. */
export type VehicleTileUnit = Pick<Vehicle, "id" | "name"> & {
  nameEn?: string;
  nameRu?: string | null;
  nameJa?: string | null;
  nameZhCN?: string | null;
  premium?: boolean;
  kind?: string | null;
  role?: string | null;
  br?: Vehicle["br"];
  rank?: string | null;
  rp?: number | null;
  price?: number | null;
  ge?: number | null;
  packPrice?: PackPrice;
  imageUrl?: string;
  thumbnailUrl?: string;
  image?: string;
  thumbnail?: string;
  store?: string | null;
  market?: string | null;
  side?: Vehicle["side"];
};
export function VehicleTile({
  unit: suppliedUnit,
  catalog = bootstrap,
  mode = "rb",
  selected = false,
  onSelect,
  owned: ownedOverride,
  disabled = false,
  className = "",
  modeRating,
  packQuote,
  footerLabel,
}: {
  unit: VehicleTileUnit;
  catalog?: Pick<Catalog, "kinds" | "roles">;
  mode?: Mode;
  selected?: boolean;
  onSelect?: () => void;
  owned?: boolean;
  disabled?: boolean;
  className?: string;
  modeRating?: string;
  packQuote?: { amountCents: number | null; checkedAt: string | null };
  footerLabel?: string;
}) {
  const facts = useVehicleFacts();
  const unit =
    suppliedUnit.br && suppliedUnit.role ? suppliedUnit : withVehicleFacts(suppliedUnit, facts);
  const workspace = useAccountWorkspace();
  const owned = ownedOverride ?? !!workspace?.ownedVehicleIds.has(unit.id);
  const premium =
    unit.premium || unit.kind === "gold" || unit.kind === "pack" || unit.kind === "premium";
  const research =
    unit.side === "research" ||
    ["normal", "research", "squadron"].includes(unit.kind || "") ||
    (unit.kind == null && unit.rp != null);
  const market =
    unit.kind === "market" || !!unit.market || cardTheme.marketIconIds.includes(unit.id);
  const name = vehicleDisplayName(unit.name);
  const price = unit.packPrice;
  const quotedCents =
    packQuote && Number.isSafeInteger(packQuote.amountCents) && (packQuote.amountCents ?? 0) > 0
      ? packQuote.amountCents
      : null;
  const packCents = quotedCents ?? (price?.status === "priced" ? price.amountCents : null);
  const packDate = quotedCents !== null ? packQuote?.checkedAt : price?.checkedAt;
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
    ? unit.rp == null
      ? "研发点 —"
      : `${format(unit.rp)} RP`
    : unit.kind === "gold"
      ? unit.price == null && unit.ge == null
        ? "暂无报价"
        : `${format(unit.price ?? unit.ge!)} GE`
      : catalog.kinds[unit.kind || ""] || "特殊载具";
  const Element = onSelect ? "button" : "span";
  const mediaUnit = {
    ...unit,
    imageUrl: unit.imageUrl || unit.image,
    thumbnailUrl: unit.thumbnailUrl || unit.thumbnail,
  };
  return (
    <Element
      className={`vehicle-card wt-game-card ${premium ? "is-premium" : ""} ${owned ? "is-owned" : ""} ${unit.kind === "squadron" ? "is-squadron" : ""} ${selected ? "is-selected" : ""} ${className}`}
      role={onSelect ? undefined : "group"}
      data-kind={unit.kind || "unknown"}
      data-owned={owned || undefined}
      disabled={onSelect ? disabled : undefined}
      type={onSelect ? "button" : undefined}
      style={{ "--wt-game-owned-icon": `url("${cardTheme.icons.owned}")` } as CSSProperties}
      onClick={onSelect}
      aria-label={`${name}，Rank ${unit.rank || "—"}${owned ? "，已拥有" : ""}，${exact}${onSelect ? "，查看载具详情" : ""}`}
      title={`${name} · ${exact}`}
    >
      {owned && (
        <span
          className="wt-game-owned"
          title="已拥有 · 来自关联游戏账号的公开车库"
          aria-label="已拥有"
        />
      )}
      <VehicleThumbnail unit={mediaUnit} />
      <span className={`unit-name ${name.length > 17 ? "is-long" : ""}`} title={name}>
        {name}
      </span>
      <span className="wt-game-card-bottom">
        <span className="wt-game-card-cost" title={exact}>
          {research ? (
            <>
              {unit.rp == null ? "—" : unit.rp === 0 ? "初始" : compactResearchPoints(unit.rp)}
              {unit.rp !== 0 && (
                <img
                  className="wt-game-currency"
                  src={cardTheme.icons.rp}
                  width={18}
                  height={18}
                  alt="研发点"
                />
              )}
            </>
          ) : unit.kind === "gold" ? (
            <>
              {unit.price == null && unit.ge == null ? "—" : format((unit.price ?? unit.ge)!)}
              <img
                className="wt-game-currency is-ge"
                src={cardTheme.icons.ge}
                width={20}
                height={20}
                alt="金鹰"
              />
            </>
          ) : unit.kind === "pack" ? (
            "礼包"
          ) : market ? (
            <img
              className="wt-game-currency is-gjn"
              src={cardTheme.icons.gjn}
              width={24}
              height={24}
              alt="Gaijin Coin"
            />
          ) : (
            "特殊"
          )}
        </span>
        <span className="wt-game-card-br">{modeRating ?? rating(unit, mode)}</span>
        <span
          className={`wt-game-role ${role}`}
          title={catalog.roles[unit.role || ""] || "常规载具"}
          aria-label={catalog.roles[unit.role || ""] || "常规载具"}
        />
      </span>
      {premium && (
        <img
          className="wt-game-talisman"
          src={cardTheme.icons.talisman}
          width={26}
          height={26}
          alt="护身符"
        />
      )}
      {footerLabel && (
        <span className="wt-game-card-caption" title={footerLabel}>
          {footerLabel}
        </span>
      )}
      {unit.kind === "pack" && (
        <span
          className="wt-game-pack-price"
          title={`${price?.title || name} · 价格核对于 ${packDate?.slice(0, 10) || "—"}`}
        >
          <small>整包</small>
          {packCents != null ? cnyPrice(packCents) : "暂无报价"}
        </span>
      )}
    </Element>
  );
}
