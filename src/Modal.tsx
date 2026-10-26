import { t, getLocale } from "./i18n/core";
import { useLocale } from "./i18n/react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { GameButton } from "./components/GameButton";
import { ResearchPoints } from "./ResearchPoints";
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
      onCancel={(event) => {
        event.stopPropagation();
        close();
      }}
    >
      <header className="calc-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <GameButton tone="ghost" icon="close" onClick={close}>
          {t("关闭")}
        </GameButton>
      </header>
      {children}
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
          {rp === null ? (
            t("待核对")
          ) : (
            <ResearchPoints>{rp.toLocaleString(getLocale())}</ResearchPoints>
          )}
        </strong>
      </div>
      <div>
        <span>{t("预估价格")}</span>
        <strong>
          {cents === null
            ? t("待估算")
            : `¥ ${(cents / 100).toLocaleString(getLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </strong>
      </div>
    </div>
  );
}
