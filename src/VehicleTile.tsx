import { t, localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useVehicleFacts, withVehicleFacts } from "./vehicle-catalog";
import bootstrap from "./generated/bootstrap.json";
import cardTheme from "../data/vehicle-card-theme.json";
import acquisitionRegistry from "../data/vehicle-acquisition.json";
import roleIcons from "../data/vehicle-role-icons.json";
import type { CSSProperties } from "react";
import type { Catalog, Mode, PackPrice, MarketPrice, Vehicle } from "./models";
import { useAccountWorkspace } from "./workspace-context";
import { vehicleName } from "./i18n/core";
import { VehicleThumbnail } from "./VehicleThumbnail";
import { compactResearchPoints } from "./research-number-format";
import { format } from "./quotes";
import { cnyPrice } from "./PackPrice";
import { rating } from "./vehicle-labels";
import flags from "../data/flags.json";
import { marketPriceLabel } from "./MarketPrice";

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
  marketPrice?: MarketPrice;
  acquisition?: Vehicle["acquisition"];
  gePrice?: Vehicle["gePrice"];
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
  href,
  owned: ownedOverride,
  disabled = false,
  className = "",
  modeRating,
  packQuote,
  footerLabel,
  showRank = false,
  showAcquisition = true,
  showPackPrice = true,
  countryLabel,
  country,
}: {
  unit: VehicleTileUnit;
  catalog?: Pick<Catalog, "kinds" | "roles">;
  mode?: Mode;
  selected?: boolean;
  onSelect?: () => void;
  /** Optional trusted destination for read-only vehicle listings. */
  href?: string;
  owned?: boolean;
  disabled?: boolean;
  className?: string;
  modeRating?: string;
  packQuote?: { amountCents: number | null; checkedAt: string | null };
  footerLabel?: string;
  /** Adds rank to the shared right caption; tree rank bands can leave it hidden. */
  showRank?: boolean;
  /** Whether to display RP, GE or acquisition type in the card body. */
  showAcquisition?: boolean;
  /** Keep acquisition type visible while omitting the external pack quote. */
  showPackPrice?: boolean;
  /** Omit when the surrounding page already identifies the country. */
  countryLabel?: string;
  /** Optional in-card country identity; does not load another country payload. */
  country?: string;
}) {
  useLocale();
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
  const special =
    !research &&
    !premium &&
    unit.kind !== "squadron" &&
    (unit.side === "special" || unit.kind === "special" || unit.kind === "market");
  const market =
    unit.kind === "market" || !!unit.market || cardTheme.marketIconIds.includes(unit.id);
  // Acquisition identity must also work with saved country snapshots that
  // predate this metadata. Keep the verified registry authoritative for awards.
  const registeredAcquisition = (
    acquisitionRegistry.vehicles as Record<string, Vehicle["acquisition"]>
  )[unit.id];
  const acquisition = registeredAcquisition ?? unit.acquisition;
  const tournament = !market && acquisition?.kind === "tournament";
  const acquisitionLabel = tournament ? "赛事" : acquisition?.label || (premium ? "高级" : "特殊");
  const availability = !market && unit.kind !== "pack" ? acquisition?.availabilityLabel : undefined;
  const name = vehicleName(unit);
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
  const roleIconKey = roleIcons.roles[unit.role as keyof typeof roleIcons.roles];
  const roleIcon = roleIconKey
    ? roleIcons.icons[roleIconKey as keyof typeof roleIcons.icons].url
    : null;
  const exact = research
    ? unit.rp == null
      ? "研发点 —"
      : `${format(unit.rp)} RP`
    : unit.kind === "gold"
      ? unit.price == null && unit.ge == null
        ? "暂无报价"
        : `${format(unit.price ?? unit.ge!)} GE`
      : tournament
        ? `${t(acquisition!.label)} · ${t(acquisition!.reason)}`
        : acquisition?.label
          ? `${t(acquisition.label)} · ${t(acquisition.reason)}`
          : premium
            ? "高级载具"
            : catalog.kinds[unit.kind || ""] || "特殊载具";
  const caption = [
    !country && countryLabel,
    footerLabel,
    showRank && unit.rank ? `Rank ${unit.rank}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const Element = onSelect ? "button" : href ? "a" : "span";
  const mediaUnit = {
    ...unit,
    imageUrl: unit.imageUrl || unit.image,
    thumbnailUrl: unit.thumbnailUrl || unit.thumbnail,
  };
  return (
    <Element
      className={`vehicle-card wt-game-card ${premium ? "is-premium" : ""} ${special ? "is-special" : ""} ${market ? "is-market" : ""} ${tournament ? "is-tournament" : ""} ${owned ? "is-owned" : ""} ${unit.kind === "squadron" ? "is-squadron" : ""} ${selected ? "is-selected" : ""} ${className}`}
      role={onSelect || href ? undefined : "group"}
      href={onSelect ? undefined : href}
      target={!onSelect && href ? "_blank" : undefined}
      rel={!onSelect && href ? "noreferrer" : undefined}
      data-kind={unit.kind || "unknown"}
      data-country={country || undefined}
      data-owned={owned || undefined}
      disabled={onSelect ? disabled : undefined}
      type={onSelect ? "button" : undefined}
      style={
        {
          "--wt-game-owned-icon": `url("${cardTheme.icons.owned}")`,
          ...(tournament
            ? {
                "--wt-tournament-background": owned
                  ? cardTheme.championship.ownedBackground
                  : cardTheme.championship.background,
                "--wt-tournament-border": cardTheme.championship.border,
                "--wt-tournament-top": cardTheme.championship.topLine,
              }
            : {}),
          ...(market
            ? {
                "--wt-market-background": owned
                  ? cardTheme.market.ownedBackground
                  : cardTheme.market.background,
                "--wt-market-crown": cardTheme.market.crown,
                "--wt-market-bottom": cardTheme.market.bottom,
                "--wt-market-border": cardTheme.market.border,
                "--wt-market-top": cardTheme.market.topLine,
                "--wt-market-highlight": cardTheme.market.highlight,
              }
            : {}),
        } as CSSProperties
      }
      onClick={onSelect}
      aria-label={localize(
        showAcquisition
          ? `${name}，${country ? (countryLabel || bootstrap.countries[country as keyof typeof bootstrap.countries] || country) + "，" : ""}Rank ${unit.rank || "—"}${owned ? "，已拥有" : ""}，${exact}${onSelect ? "，查看载具详情" : ""}`
          : `${name}${owned ? "，已拥有" : ""}${onSelect ? "，查看载具详情" : ""}`,
      )}
      title={localize(showAcquisition ? `${name} · ${exact}` : name)}
    >
      {localize(
        owned && (
          <span
            className="wt-game-owned"
            title={t("已拥有 · 来自关联游戏账号的公开车库")}
            aria-label={t("已拥有")}
          />
        ),
      )}
      <VehicleThumbnail unit={mediaUnit} />
      {localize(
        country && (
          <span className="wt-game-card-country">
            {localize(
              (flags as Record<string, string>)[country] && (
                <img
                  src={(flags as Record<string, string>)[country]}
                  width={20}
                  height={14}
                  alt=""
                />
              ),
            )}
            <span>
              {localize(
                countryLabel ||
                  bootstrap.countries[country as keyof typeof bootstrap.countries] ||
                  country,
              )}
            </span>
          </span>
        ),
      )}
      <span className={`unit-name ${name.length > 17 ? "is-long" : ""}`} title={localize(name)}>
        {localize(name)}
      </span>
      <span className="wt-game-card-bottom">
        {localize(
          showAcquisition && (
            <span className="wt-game-card-cost" title={localize(exact)}>
              {localize(
                research ? (
                  <>
                    {localize(
                      unit.rp == null
                        ? "—"
                        : unit.rp === 0
                          ? "初始"
                          : compactResearchPoints(unit.rp),
                    )}
                    {localize(
                      unit.rp !== 0 && (
                        <img
                          className="wt-game-currency"
                          src={cardTheme.icons.rp}
                          width={18}
                          height={18}
                          alt={t("研发点")}
                        />
                      ),
                    )}
                  </>
                ) : unit.kind === "gold" ? (
                  <>
                    {localize(
                      unit.price == null && unit.ge == null
                        ? "—"
                        : format((unit.price ?? unit.ge)!),
                    )}
                    <img
                      className="wt-game-currency is-ge"
                      src={cardTheme.icons.ge}
                      width={20}
                      height={20}
                      alt={t("金鹰")}
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
                ) : tournament ? (
                  "赛事"
                ) : (
                  acquisitionLabel
                ),
              )}
            </span>
          ),
        )}
        <span className="wt-game-card-br">{localize(modeRating ?? rating(unit, mode))}</span>
        {localize(
          (roleIcon || role !== "other") && (
            <span
              className={`wt-game-role ${roleIcon ? "is-symbol" : role}`}
              style={
                roleIcon
                  ? { maskImage: `url("${roleIcon}")`, WebkitMaskImage: `url("${roleIcon}")` }
                  : undefined
              }
              title={localize(catalog.roles[unit.role || ""] || "常规载具")}
              aria-label={localize(catalog.roles[unit.role || ""] || "常规载具")}
            />
          ),
        )}
      </span>
      {localize(
        premium && (
          <img
            className="wt-game-talisman"
            src={cardTheme.icons.talisman}
            width={26}
            height={26}
            alt={t("护身符")}
          />
        ),
      )}
      {localize(
        caption && (
          <span className="wt-game-card-caption" title={localize(caption)}>
            {localize(
              ((!country && countryLabel) || footerLabel) && (
                <span className="wt-game-card-caption-context">
                  {localize([!country && countryLabel, footerLabel].filter(Boolean).join(" · "))}
                </span>
              ),
            )}
            {localize(
              showRank && unit.rank && (
                <span className="wt-game-card-caption-rank">Rank {localize(unit.rank)}</span>
              ),
            )}
          </span>
        ),
      )}
      {localize(
        showAcquisition && showPackPrice && unit.kind === "pack" && (
          <span
            className="wt-game-pack-price"
            title={localize(
              `${price?.title || name} · 价格核对于 ${packDate?.slice(0, 10) || "—"}`,
            )}
          >
            <small>{t("整包")}</small>
            {localize(packCents != null ? cnyPrice(packCents) : "暂无报价")}
          </span>
        ),
      )}
      {localize(
        showAcquisition && showPackPrice && market && unit.kind !== "pack" && (
          <span
            className="wt-game-pack-price"
            title={localize(
              `${unit.marketPrice?.quoteKind === "user-reference-limit" ? "估值参考上限" : "最低挂售价"} · 核对于 ${unit.marketPrice?.checkedAt.slice(0, 10) || "—"}`,
            )}
          >
            <small>
              {localize(
                unit.marketPrice?.quoteKind === "user-reference-limit" ? "参考上限" : "交易所",
              )}
            </small>
            {localize(marketPriceLabel(unit.marketPrice))}
          </span>
        ),
      )}
      {localize(
        showAcquisition && showPackPrice && availability && (
          <span
            className="wt-game-pack-price is-availability"
            title={localize(acquisition?.availabilityReason || acquisition?.reason)}
          >
            <small>{localize(availability)}</small>
          </span>
        ),
      )}
    </Element>
  );
}
