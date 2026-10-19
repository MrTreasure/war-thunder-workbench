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
  const [copyMessage, setCopyMessage] = useState("");
  const summary = aggregate(items);
  const text = [
    "战争雷霆研发购物车",
    ...items.flatMap((item) => [
      `${item.title} · ${item.kind === "vehicle" ? "载具研发" : "配件研发"}`,
      item.details,
      `快照：${item.dataVersion}`,
    ]),
    `去重后 ${format(summary.rp)} RP`,
    summary.conflicts.length
      ? `单价冲突：${summary.conflicts.join("、")}，请先移除冲突报价`
      : `总价 ${money(summary.cents)}`,
    "共有前置按载具去重，取较大的待研 RP；金额按去重后各项单价统一计算到分。",
  ].join("\n");
  return (
    <Modal
      title="研发购物车"
      subtitle="保存在此浏览器 · 报价快照不会随数据更新自动改变"
      close={close}
    >
      <div className="cart-content">
        <Metrics rp={summary.rp} cents={summary.conflicts.length ? null : summary.cents} />
        <output className={`calc-status ${summary.conflicts.length ? "has-error" : ""}`}>
          {summary.conflicts.length
            ? `共有载具单价不一致：${summary.conflicts.join("、")}。请移除旧报价后重新加入。`
            : `${items.length} 项报价 · 合并 ${summary.duplicates} 项重复研发工作。共享前置仅计一次，按较大的待研 RP 计费。`}
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
            导出 JSON 备份
          </button>
          <button
            className="quiet-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopyMessage("已复制报价清单");
              } catch {
                setCopyMessage("无法访问剪贴板，请使用 JSON 导出。");
              }
            }}
          >
            复制报价清单
          </button>
        </div>
        {copyMessage && <output className="calc-note">{copyMessage}</output>}
        {error && (
          <p className="calc-status has-error" role="alert">
            {error}
          </p>
        )}
        {!items.length && (
          <p className="calc-note">还没有报价。先计算载具或配件研发，再点击“加入购物车”。</p>
        )}
        {items.map((item) => (
          <article className="cart-item" key={item.id}>
            <div className="cart-item-title">
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.kind === "vehicle" ? "载具研发" : "配件研发"} ·{" "}
                  {new Date(item.createdAt).toLocaleString("zh-CN")} ·{" "}
                  {format(item.lines.reduce((sum, line) => sum + line.rp, 0))} RP
                </p>
              </div>
              <strong>{money(quoteCents(item.lines))}</strong>
              <button className="quiet-button" onClick={() => remove(item.id)}>
                移除
              </button>
            </div>
            <details>
              <summary>研发明细 / 计价依据</summary>
              <pre>{item.details}</pre>
            </details>
          </article>
        ))}
        <p className="calc-note">
          不同类型的研发分别计价；配件报价按同一载具更新已有条目。加入多个目标时，共有前置不会重复收费。购物车不是游戏实际进度记录，请在新报价中保持已有载具和已研
          RP 一致。
        </p>
      </div>
    </Modal>
  );
}
