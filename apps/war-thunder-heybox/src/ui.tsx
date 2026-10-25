export { DetailPage } from "./navigation";
export const num = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("zh-CN");
export const ratio = (value: number | string | null | undefined) =>
  typeof value === "number" ? value.toFixed(2) : value === "∞" ? "∞" : "—";
export { GameUIIcon as Icon } from "./GameUIIcon";
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
