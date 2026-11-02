/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Named table scroller supports keyboard scrolling. */
import { useLayoutEffect, useState } from "react";
import { Modal } from "./Modal";
import { loadoutWeaponName, loadoutParameterValue } from "./loadout-presentation";
import {
  missileComparisonLimit,
  missileComparisonRows,
  type ComparedMissile,
} from "./loadout-weapon-details";
export function LoadoutCompareDock({ count, onOpen }: { count: number; onOpen: () => void }) {
  const [offset, setOffset] = useState(16);
  useLayoutEffect(() => {
    const footer = document.querySelector<HTMLElement>(".wt-app-footer");
    if (!footer) return;
    const observer = new ResizeObserver(() =>
      setOffset(Math.ceil(footer.getBoundingClientRect().height) + 16),
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  return (
    <button
      type="button"
      className="wt-mount-compare-dock"
      style={{ bottom: offset }}
      onClick={onOpen}
    >
      对比导弹{" "}
      <strong>
        {count}/{missileComparisonLimit}
      </strong>
    </button>
  );
}
export function LoadoutWeaponComparison({
  items,
  onRemove,
  onClear,
  close,
}: {
  items: ComparedMissile[];
  onRemove: (key: string) => void;
  onClear: () => void;
  close: () => void;
}) {
  const rows = missileComparisonRows(items);
  return (
    <Modal
      title={`导弹对比 · ${items.length}/${missileComparisonLimit}`}
      subtitle="保留选中时的 Wiki 参数，未知值不补零；弹体质量与整组挂载重量分别记录。"
      close={close}
      className="wt-mount-compare"
    >
      <div className="wt-mount-compare-tools">
        <span>最多对比6个型号，可跨机型选择。</span>
        <button onClick={onClear}>清空对比</button>
      </div>
      {!items.length ? (
        <p className="wt-mount-note">对比列表已清空，在挂载选项中重新勾选导弹。</p>
      ) : (
        <section className="wt-mount-compare-scroll" tabIndex={0} aria-label="导弹参数对比表">
          <table style={{ minWidth: 140 + items.length * 180 }}>
            <thead>
              <tr>
                <th scope="col">参数</th>
                {items.map((item) => (
                  <th scope="col" key={item.key}>
                    {item.imageUrl && <img src={item.imageUrl} alt="" width={48} height={36} />}
                    <strong>{loadoutWeaponName(item.name)}</strong>
                    <button
                      onClick={() => onRemove(item.key)}
                      aria-label={`移除 ${loadoutWeaponName(item.name)}`}
                    >
                      移除
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={items[index].key}>{value ? loadoutParameterValue(value) : "未知"}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">资料日期与来源</th>
                {items.map((item) => (
                  <td key={item.key}>
                    <a href={item.source} target="_blank" rel="noopener noreferrer">
                      {item.checkedAt.slice(0, 10)} · 官方 Wiki ↗
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </Modal>
  );
}
