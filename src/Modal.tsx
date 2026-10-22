import { getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { localize, t } from "./i18n/core";
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
  useLocale();

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
          <h2 id={titleId}>{localize(title)}</h2>
          <p>{localize(subtitle)}</p>
        </div>
        <button className="quiet-button" onClick={close}>
          {t("关闭 ×")}
        </button>
      </header>
      {localize(children)}
    </dialog>
  );
}
export function Metrics({ rp, cents }: { rp: number | null; cents: number | null }) {
  useLocale();

  return (
    <div className="calc-metrics">
      <div>
        <span>{t("待研发总量")}</span>
        <strong>
          {localize(rp === null ? "待核对" : `${localize(rp.toLocaleString(getLocale()))} RP`)}
        </strong>
      </div>
      <div>
        <span>{t("预估价格")}</span>
        <strong>
          {localize(
            cents === null
              ? "待报价"
              : `¥ ${localize((cents / 100).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}`,
          )}
        </strong>
      </div>
    </div>
  );
}
