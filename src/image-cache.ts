/** The shared source ships to both sites; only the international origin opts in. */
export function imageCacheEnabled(origin: string, production: boolean) {
  return production && origin === "https://wt.mrtreasure.cc";
}

export function registerImageCache() {
  if (
    !imageCacheEnabled(window.location.origin, import.meta.env.PROD) ||
    !("serviceWorker" in navigator)
  )
    return;

  const register = () => {
    // Mutable, same-origin entry; updates never reload an open page.
    void navigator.serviceWorker
      .register("/wt-image-cache-sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Unsupported storage/security policies retain the browser's normal HTTP cache.
      });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
