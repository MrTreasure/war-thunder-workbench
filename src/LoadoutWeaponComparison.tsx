import { localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Named table scroller supports keyboard scrolling. */
import { useLayoutEffect, useState } from "react";
import { GameSelect } from "./components/GameSelect";
import { missilePurposes } from "./intl-comparison-purpose";
import "./comparison-purpose.css";
import { Modal } from "./Modal";
import { loadoutWeaponName, loadoutParameterValue } from "./intl-loadout-presentation";
import {
  missileComparisonLimit,
  missileComparisonRows,
  type ComparedMissile,
} from "./loadout-weapon-details";
export function LoadoutCompareDock({ count, onOpen }: { count: number; onOpen: () => void }) {
  useLocale();
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
      {t("对比导弹")}
      {localize(" ")}
      <strong>
        {localize(count)}/{localize(missileComparisonLimit)}
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
  useLocale();
  const allRows = missileComparisonRows(items);
  const [purposeId, setPurposeId] = useState("");
  const purposes = missilePurposes.filter((purpose) =>
    allRows.some((row) => purpose.fields.includes(row.id) && row.values.some(Boolean)),
  );
  const purpose = purposes.find((item) => item.id === purposeId);
  const rows = purpose
    ? [
        ...allRows.filter((row) => purpose.fields.includes(row.id)),
        ...allRows.filter((row) => !purpose.fields.includes(row.id)),
      ]
    : allRows;
  return (
    <Modal
      title={t("导弹对比 \u00B7 {0}/{1}", [items.length, missileComparisonLimit])}
      subtitle={t("保留选中时的 Wiki 参数，未知值不补零；弹体质量与整组挂载重量分别记录。")}
      close={close}
      className="wt-mount-compare"
    >
      <div className="wt-mount-compare-tools">
        <span>{t("最多对比6个型号，可跨机型选择。")}</span>
        <button onClick={onClear}>{t("清空对比")}</button>
      </div>
      {localize(
        !!items.length && (
          <section className="wt-purpose-panel" aria-label={t("导弹比较用途")}>
            <label>
              {t("比较用途")}
              <GameSelect value={purpose?.id || ""} onValueChange={setPurposeId}>
                <option value="">{t("全部参数")}</option>
                {localize(
                  purposes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {localize(item.label)}
                    </option>
                  )),
                )}
              </GameSelect>
            </label>
            {localize(
              purpose && (
                <p>
                  {localize(purpose.note)}
                  {t("相关行已移至前列，未知值保留未知，不提供总分或最佳型号。")}
                </p>
              ),
            )}
          </section>
        ),
      )}
      {localize(
        !items.length ? (
          <p className="wt-mount-note">{t("对比列表已清空，在挂载选项中重新勾选导弹。")}</p>
        ) : (
          <section
            className="wt-mount-compare-scroll"
            tabIndex={0}
            aria-label={t("导弹参数对比表")}
          >
            <table style={{ minWidth: 140 + items.length * 180 }}>
              <thead>
                <tr>
                  <th scope="col">{t("参数")}</th>
                  {localize(
                    items.map((item) => (
                      <th scope="col" key={item.key}>
                        {localize(
                          item.imageUrl && (
                            <img src={item.imageUrl} alt="" width={48} height={36} />
                          ),
                        )}
                        <strong>{localize(loadoutWeaponName(item.name))}</strong>
                        <button
                          onClick={() => onRemove(item.key)}
                          aria-label={t("移除 {0}", [loadoutWeaponName(item.name)])}
                        >
                          {t("移除")}
                        </button>
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {localize(
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={purpose?.fields.includes(row.id) ? "wt-purpose-row" : undefined}
                    >
                      <th scope="row">{localize(row.label)}</th>
                      {localize(
                        row.values.map((value, index) => (
                          <td key={items[index].key}>
                            {localize(value ? loadoutParameterValue(value) : t("未知"))}
                          </td>
                        )),
                      )}
                    </tr>
                  )),
                )}
                <tr>
                  <th scope="row">{t("资料日期与来源")}</th>
                  {localize(
                    items.map((item) => (
                      <td key={item.key}>
                        <a href={item.source} target="_blank" rel="noopener noreferrer">
                          {localize(item.checkedAt.slice(0, 10))}
                          {t("\u00B7 官方 Wiki \u2197")}
                        </a>
                      </td>
                    )),
                  )}
                </tr>
              </tbody>
            </table>
          </section>
        ),
      )}
    </Modal>
  );
}
