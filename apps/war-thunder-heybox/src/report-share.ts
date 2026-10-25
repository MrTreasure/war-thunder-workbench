import type { SDK } from "./api";
/** Capture only the visible poster; Host owns saving, watermarking and user-confirmed sharing. */
export async function shareReportPoster(
  sdk: Pick<SDK, "viewport" | "share">,
  target: HTMLElement,
  live: () => boolean,
) {
  await document.fonts.ready;
  await Promise.all(
    [...target.querySelectorAll("img")].map((image) =>
      image.decode().catch(() => {
        throw Error("图片尚未加载完成，请稍后重试。");
      }),
    ),
  );
  const window = await sdk.viewport.getWindowInfo(),
    rect = target.getBoundingClientRect();
  const reserve = target
    .querySelector<HTMLElement>(".hb-achievement-watermark-reserve")
    ?.getBoundingClientRect();
  if (!live()) throw Error("分享预览已关闭。");
  if (
    ![rect.left, rect.top, rect.width, rect.height, window.windowWidth, window.windowHeight].every(
      Number.isFinite,
    ) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.left < 0 ||
    rect.top < 0 ||
    rect.right > window.windowWidth + 0.5 ||
    rect.bottom > window.windowHeight + 0.5
  )
    throw Error("成就卡未完整显示，请返回后重试。");
  if (!reserve || reserve.height < 57 || Math.abs(reserve.bottom - rect.bottom) > 0.5)
    throw Error("截图底部水印区域不足，请返回后重试。");
  await sdk.share.screenshot({
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    delay: 100,
    watermarkTheme: "dark",
    saveToAlbum: true,
    post: { topics: ["战争雷霆", "战雷工作台"] },
  });
  // Deliberately discard the opaque return value; it never proves a save or post.
}
