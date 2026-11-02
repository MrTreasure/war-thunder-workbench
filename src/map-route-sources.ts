// Source links only: these hosts are never used as arbitrary fetch/proxy targets.
export function isMapGuideSourceURL(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const path = url.pathname;
    switch (url.hostname) {
      case "www.xiaoheihe.cn":
        return /^\/app\/bbs\/link\/[A-Za-z0-9]+\/?$/.test(path);
      case "www.bilibili.com":
        return /^\/video\/BV[A-Za-z0-9]{10}\/?$/.test(path);
      case "forum.warthunder.com":
        return /^\/t\/[^/]+\/\d+(?:\/\d+)?\/?$/.test(path);
      case "www.youtube.com":
      case "youtube.com":
        return (
          path === "/watch" &&
          url.searchParams.getAll("v").length === 1 &&
          /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") || "")
        );
      case "youtu.be":
        return /^\/[A-Za-z0-9_-]{11}\/?$/.test(path);
      case "tieba.baidu.com":
        return /^\/p\/\d+\/?$/.test(path);
      default:
        return false;
    }
  } catch {
    return false;
  }
}
