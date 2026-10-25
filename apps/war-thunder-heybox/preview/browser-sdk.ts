/** Browser-only adapter for the static acceptance build. Never bundled in the miniapp. */
import type { SDK } from "../src/api";

const prefix = "wt-heybox-browser-preview:";
const gateway = "https://api.mrtreasure.cc/wt-stats/v1/";
const unavailable = () =>
  Promise.reject(
    Object.assign(new Error("静态预览不提供小黑盒授权，请在小黑盒 APP 内验证登录和关联确认。"), {
      code: "NATIVE_AUTH_REQUIRED",
    }),
  );
const browserSDK = {
  auth: {
    getAccountState: async () => ({ isHeyboxAppLoggedIn: false, accountKey: null }),
    login: unavailable,
  },
  device: {
    async setClipboard({ text }: { text: string }) {
      if (!navigator.clipboard) throw new Error("此浏览器未开放剪贴板，请长按地址复制。");
      await navigator.clipboard.writeText(text);
    },
  },
  storage: {
    async getStorage<T>({ key }: { key: string }) {
      const value = localStorage.getItem(prefix + key);
      return { data: value === null ? null : (JSON.parse(value) as T) };
    },
    async setStorage({ key, data }: { key: string; data: unknown }) {
      localStorage.setItem(prefix + key, JSON.stringify(data));
    },
  },
  viewport: {
    async getWindowInfo() {
      return {
        windowWidth: innerWidth,
        windowHeight: innerHeight,
        screenWidth: innerWidth,
        screenHeight: innerHeight,
        pixelRatio: devicePixelRatio,
        screenTop: 0,
        statusBarHeight: 0,
        safeArea: {
          top: 0,
          left: 0,
          right: innerWidth,
          bottom: innerHeight,
          width: innerWidth,
          height: innerHeight,
        },
      };
    },
    setNavigationBarStyle: async () => {},
  },
  onHandshakeStateChange(callback: (value: { status: string }) => void) {
    // This is browser readiness, not a real Host handshake or account authorization.
    callback({ status: "ready" });
    return () => {};
  },
  on(event: string, callback: (value?: unknown) => void) {
    if (event !== "hide" && event !== "show") return () => {};
    const listener = () => {
      if ((document.visibilityState === "hidden") === (event === "hide")) callback();
    };
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
  network: {
    async request(config: Parameters<SDK["network"]["request"]>[0]) {
      if (!config.url.startsWith(gateway)) throw new Error("预览请求只能使用 CF API 通道");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeout || 9000);
      try {
        const response = await fetch(config.url, {
          method: config.method || "GET",
          headers: config.headers as Record<string, string>,
          ...(config.data === undefined ? {} : { body: JSON.stringify(config.data) }),
          credentials: "omit",
          redirect: "error",
          signal: controller.signal,
        });
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return { status: response.status, data: await response.text(), headers };
      } catch (error) {
        throw Object.assign(new Error("CF API 连接暂不可用"), {
          code: controller.signal.aborted ? "REQUEST_TIMEOUT" : "REQUEST_FAILED",
          cause: error,
        });
      } finally {
        clearTimeout(timer);
      }
    },
  },
};
export default browserSDK as unknown as SDK;
