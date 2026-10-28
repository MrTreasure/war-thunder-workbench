import { t } from "./i18n/core";
import type { Catalog, Vehicle } from "./models";
import { GameButton } from "./components/GameButton";
import { useWorkbenchAccount } from "./WorkbenchAccount";
import { useAccountWorkspace } from "./workspace-context";
import { useStored } from "./storage";
import { normalizeSaleWatch, saleWatchEnvelope, saleWatchKey } from "./sale-watch-storage";
import type { SaleVehicle } from "./sale-calendar-model";

/** Uses the discount calendar's account list, separate from research quotes. */
export function VehicleSaleCartAction({
  unit,
  catalog,
  country,
  category,
}: {
  unit: Vehicle;
  catalog: Catalog;
  country: string;
  category: string;
}) {
  const account = useWorkbenchAccount();
  const workspace = useAccountWorkspace();
  const [stored, save, error] = useStored<unknown[]>(
    saleWatchKey,
    [],
    saleWatchEnvelope,
    normalizeSaleWatch,
    true,
  );
  const channel =
    unit.kind === "squadron" || unit.market
      ? null
      : unit.store
        ? "pack"
        : unit.side === "special" && (unit.kind === "gold" || (unit.premium && unit.price !== null))
          ? "ge"
          : null;
  if (!channel) return null;
  const watch = normalizeSaleWatch(stored);
  const registered = !!account.session?.user?.id;
  const ready =
    registered &&
    workspace?.userId === account.session?.user?.id &&
    workspace?.ready &&
    workspace.consented;
  const owned = !!workspace?.ownedVehicleIds.has(unit.id);
  const added = watch.some((vehicle) => vehicle.id === unit.id);
  const full = watch.length >= 60;
  const title = owned
    ? t("已拥有此载具")
    : !registered
      ? t("仅注册并登录的用户可加入折扣日历购物车")
      : !ready
        ? t("请先在用户名菜单的云端数据中完成同步")
        : full && !added
          ? t("购物车最多保存 60 辆载具")
          : t("折扣日历 · 我的购物车");
  function add() {
    if (!ready || owned || added || full || !channel) return;
    const price = unit.packPrice;
    const vehicle: SaleVehicle = {
      id: unit.id,
      name: unit.name,
      nameEn: unit.nameEn || "",
      country,
      category,
      channel,
      image: unit.thumbnailUrl || unit.imageUrl,
      rank: unit.rank,
      store: unit.store,
      market: unit.market,
      originalPrice:
        channel === "ge"
          ? {
              currency: "GE",
              amount: unit.price,
              checkedAt: catalog.checkedAt,
              source: catalog.sources[category]?.url || null,
            }
          : {
              currency: "CNY",
              amount: price?.regularAmountCents ?? null,
              checkedAt: price?.checkedAt ?? null,
              source: price?.source || unit.store,
            },
    };
    save([...watch, ...normalizeSaleWatch([vehicle])]);
  }
  return (
    <>
      <GameButton
        icon="store"
        disabled={!ready || owned || added || full}
        title={title}
        onClick={add}
      >
        {owned
          ? t("已拥有")
          : !registered
            ? t("登录后加入")
            : added
              ? t("已加入购物车")
              : t("加入购物车")}
      </GameButton>
      {registered && error && <p role="alert">{error}</p>}
    </>
  );
}
