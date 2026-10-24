import { localize } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { t } from "./i18n/core";
import { useAccountWorkspace } from "./workspace-context";
import { useState } from "react";
import type { CartItem } from "./models";
import { Modal, Metrics } from "./Modal";
import { aggregate, format, money, quoteCents } from "./quotes";
export function Cart({
  items,
  remove,
  close,
  error,
}: {
  items: CartItem[];
  remove: (id: string) => void;
  close: () => void;
  error: string;
}) {
  useLocale();

  const workspace = useAccountWorkspace();
  const [copyMessage, setCopyMessage] = useState("");
  const summary = aggregate(items);
  const text = [
    t("战争雷霆研发购物车"),
    ...items.flatMap((item) => [
      t("{0} · {1}", [item.title, item.kind === "vehicle" ? t("载具研发") : t("配件研发")]),
      item.details,
      t("快照：{0}", [item.dataVersion]),
    ]),
    t("去重后 {0} RP", [format(summary.rp)]),
    summary.conflicts.length
      ? t("单价冲突：{0}，请先移除冲突报价", [summary.conflicts.join("、")])
      : t("总价 {0}", [money(summary.cents)]),
    t("共有前置按载具去重，取较大的待研 RP；金额按去重后各项单价统一计算到分。"),
  ].join("\n");
  return (
    <Modal
      title={t("研发购物车")}
      subtitle={t("{0} · 报价快照不会随数据更新自动改变", [
        workspace?.userId ? t("随账号保存") : t("保存在此浏览器"),
      ])}
      close={close}
    >
      <div className="cart-content">
        <p className="calc-note">
          {t(
            "购物车保存的是当时的报价。绑定、解除关联或更新车库后，请重新计算相关报价，以使用最新的已拥有载具状态。",
          )}
        </p>
        <Metrics rp={summary.rp} cents={summary.conflicts.length ? null : summary.cents} />
        <output className={`calc-status ${summary.conflicts.length ? "has-error" : ""}`}>
          {localize(
            summary.conflicts.length
              ? t("共有载具单价不一致：{0}。请移除旧报价后重新加入。", [
                  summary.conflicts.join("、"),
                ])
              : t(
                  "{0} 项报价 · 合并 {1} 项重复研发工作。共享前置仅计一次，按较大的待研 RP 计费。",
                  [items.length, summary.duplicates],
                ),
          )}
        </output>
        <div className="cart-actions">
          <button
            className="quiet-button"
            onClick={() => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    { schemaVersion: 1, exportedAt: new Date().toISOString(), items },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              );
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = "war-thunder-cart.json";
              link.click();
              URL.revokeObjectURL(link.href);
            }}
          >
            {t("导出 JSON 备份")}
          </button>
          <button
            className="quiet-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopyMessage(t("已复制报价清单"));
              } catch {
                setCopyMessage(t("无法访问剪贴板，请使用 JSON 导出。"));
              }
            }}
          >
            {t("复制报价清单")}
          </button>
        </div>
        {localize(copyMessage && <output className="calc-note">{localize(copyMessage)}</output>)}
        {localize(
          error && (
            <p className="calc-status has-error" role="alert">
              {localize(error)}
            </p>
          ),
        )}
        {localize(
          !items.length && (
            <p className="calc-note">
              {t("还没有报价。先计算载具或配件研发，再点击“加入购物车”。")}
            </p>
          ),
        )}
        {localize(
          items.map((item) => (
            <article className="cart-item" key={item.id}>
              <div className="cart-item-title">
                <div>
                  <h3>{localize(item.title)}</h3>
                  <p>
                    {localize(item.kind === "vehicle" ? t("载具研发") : t("配件研发"))} ·
                    {localize(" ")}
                    {localize(new Date(item.createdAt).toLocaleString("zh-CN"))} ·{localize(" ")}
                    {localize(format(item.lines.reduce((sum, line) => sum + line.rp, 0)))} RP
                  </p>
                </div>
                <strong>{localize(money(quoteCents(item.lines)))}</strong>
                <button className="quiet-button" onClick={() => remove(item.id)}>
                  {t("移除")}
                </button>
              </div>
              <details>
                <summary>{t("研发明细 / 计价依据")}</summary>
                <pre>{localize(item.details)}</pre>
              </details>
            </article>
          )),
        )}
        <p className="calc-note">
          {t(
            "不同类型的研发分别计价；配件报价按同一载具更新已有条目。加入多个目标时，共有前置不会重复收费。购物车不是游戏实际进度记录，请在新报价中保持已有载具和已研 RP 一致。",
          )}
        </p>
      </div>
    </Modal>
  );
}
