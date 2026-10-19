import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
export function Modal({
  title,
  subtitle,
  close,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: string;
  close: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`calculator ${className}`}
      aria-labelledby={titleId}
      onCancel={close}
    >
      <header className="calc-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="quiet-button" onClick={close}>
          关闭 ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Metrics({ rp, cents }: { rp: number | null; cents: number | null }) {
  return (
    <div className="calc-metrics">
      <div>
        <span>待研发总量</span>
        <strong>{rp === null ? "待核对" : `${rp.toLocaleString("zh-CN")} RP`}</strong>
      </div>
      <div>
        <span>预估价格</span>
        <strong>
          {cents === null
            ? "待报价"
            : `¥ ${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </strong>
      </div>
    </div>
  );
}
