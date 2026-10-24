import { useEffect, useId, useRef, type ReactNode } from "react";
export const num = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("zh-CN");
export const ratio = (value: number | string | null | undefined) =>
  typeof value === "number" ? value.toFixed(2) : value === "∞" ? "∞" : "—";
export function Sheet({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog ref={ref} className="hb-sheet" aria-labelledby={id} onCancel={close}>
      <header>
        <h2 id={id}>{title}</h2>
        <button type="button" className="hb-icon" onClick={close} aria-label="关闭">
          ×
        </button>
      </header>
      <div className="hb-sheet-body">{children}</div>
    </dialog>
  );
}
export function Icon({ name }: { name: "research" | "stats" | "account" | "filter" | "arrow" }) {
  const paths = {
    research: "M4 4h6v5H4zM14 15h6v5h-6zM4 15h6v5H4zM7 9v6m0-3h10v3",
    stats: "M4 19V9m8 10V4m8 15v-7",
    account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
    filter: "M4 6h16M7 12h10m-7 6h4",
    arrow: "m9 5 7 7-7 7",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function ErrorNote({ error }: { error: string }) {
  return error ? (
    <p className="hb-error" role="alert">
      {error}
    </p>
  ) : null;
}

export function errorText(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "AUTHORIZATION_CANCELLED") return "已取消授权，可继续以游客身份使用。";
  if (code === "HEYBOX_APP_LOGIN_REQUIRED") return "请先登录小黑盒 App 后再试。";
  if (code === "USER_GESTURE_REQUIRED") return "请重新点击授权按钮。";
  if (code === "AUTHORIZATION_CONTEXT_CHANGED") return "小黑盒账号已变化，请重新授权。";
  if (code === "SERVER_API_REQUIRED") return "当前调试未启用网络能力，可先使用研发功能。";
  return error instanceof Error ? error.message : "操作暂未完成，请稍后重试。";
}
