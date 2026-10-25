import { useEffect, useMemo, useState } from "react";
import { VehicleTile, type VehicleTileUnit } from "../../../src/VehicleTile";
import {
  loadBundledVehicleCountry,
  useVehicleFacts,
  withVehicleFacts,
} from "../../../src/vehicle-catalog";
import type { Mode } from "../../../src/models";
import catalog from "../../../src/generated/bootstrap.json";
import { useRuntime } from "./context";

/** Page-scoped bundled metadata only: no public-browser API or per-card reads. */
export function useMiniappVehicleFacts(countries: string[]) {
  const facts = useVehicleFacts();
  const [failure, setFailure] = useState<{ key: string; attempt: number; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const key = [...new Set(countries)]
    .filter((id) => Object.hasOwn(catalog.countries, id))
    .sort()
    .join(",");
  useEffect(() => {
    let active = true;
    void Promise.all(key.split(",").filter(Boolean).map(loadBundledVehicleCountry)).catch(() => {
      if (active)
        setFailure({ key, attempt, message: "部分载具资料暂不可用，已保留现有信息，可重新载入。" });
    });
    return () => {
      active = false;
    };
  }, [key, attempt]);
  return {
    facts,
    error: failure?.key === key && failure.attempt === attempt ? failure.message : "",
    retry: () => setAttempt((value) => value + 1),
  };
}
export function useMiniappOwnedVehicles() {
  const { view, cloud } = useRuntime();
  return useMemo(
    () =>
      new Set(
        view.status === "authenticated"
          ? cloud?.binding?.vehicles.map((unit) => unit.id) || []
          : [],
      ),
    [view.status, cloud?.binding],
  );
}
export function VehiclePresentation({
  unit: supplied,
  country,
  category,
  mode = "rb",
  owned = false,
  onSelect,
  selected = false,
}: {
  unit: VehicleTileUnit;
  country?: string | null;
  category?: string | null;
  mode?: Mode;
  owned?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const facts = useVehicleFacts();
  const unit = withVehicleFacts(supplied, facts);
  const countryId = unit.country || country || "",
    categoryId = unit.category || category || "";
  const acquisition =
    unit.kind === "squadron"
      ? catalog.lineupKinds.squadron
      : unit.kind === "gold"
        ? "金鹰载具"
        : unit.kind === "pack"
          ? catalog.lineupKinds.pack
          : unit.side === "research"
            ? catalog.lineupKinds.research
            : unit.kind
              ? catalog.lineupKinds.special
              : "获取类型待核对";
  const roles = catalog.roles as Record<string, string>;
  return (
    <div className="hb-vehicle-presentation" data-kind={unit.kind}>
      <VehicleTile
        unit={unit}
        mode={mode}
        owned={owned}
        onSelect={onSelect}
        selected={selected}
        footerLabel={unit.rank ? `等级 ${unit.rank}` : "等级待核对"}
      />
      <div className="hb-vehicle-caption">
        <span>{roles[unit.role || ""] || "类型待核对"}</span>
        <span>
          {acquisition} · {(catalog.countries as Record<string, string>)[countryId] || "国家待匹配"}
          {categoryId
            ? ` · ${(catalog.categories as Record<string, string>)[categoryId] || categoryId}`
            : ""}
        </span>
      </div>
    </div>
  );
}
