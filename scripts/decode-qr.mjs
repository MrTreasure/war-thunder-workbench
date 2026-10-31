/** Decode ordinary QR codes in a local image. No remote page or URL is loaded. */
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const help = `Decode QR codes from a local PNG, JPEG, WebP or GIF image.

Usage: pnpm run decode:qr <image> [--json] [--all] [--crop x,y,width,height]

  --json   Print decoded text and corner coordinates as JSON.
  --all    Find up to eight QR codes in the image.
  --crop   Decode only the given rectangle, using original image pixels.
  --help   Show this help.

Exit status: 0 decoded; 2 no QR code found; 1 invalid input or decoding error.
This tool reads local images and prints QR contents; it does not solve CAPTCHAs.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean" },
      json: { type: "boolean" },
      all: { type: "boolean" },
      crop: { type: "string" },
    },
  });
  if (values.help) {
    console.log(help);
    return;
  }
  if (positionals.length !== 1) throw Error(help);
  const path = resolve(positionals[0]);
  const info = await stat(path);
  if (!info.isFile() || info.size === 0 || info.size > 25 * 1024 * 1024)
    throw Error("Expected a local image file between 1 byte and 25 MiB.");
  const body = await readFile(path);
  let mime;
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    mime = "image/png";
  else if (body[0] === 255 && body[1] === 216) mime = "image/jpeg";
  else if (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP")
    mime = "image/webp";
  else if (["GIF87a", "GIF89a"].includes(body.toString("ascii", 0, 6))) mime = "image/gif";
  else throw Error("Supported image formats: PNG, JPEG, WebP, GIF.");

  const crop = values.crop?.split(",").map(Number);
  if (
    crop &&
    (crop.length !== 4 ||
      crop.some((n) => !Number.isSafeInteger(n)) ||
      crop[0] < 0 ||
      crop[1] < 0 ||
      crop[2] <= 0 ||
      crop[3] <= 0)
  )
    throw Error("Crop must be x,y,width,height with nonnegative origin and positive size.");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.WT_PLAYWRIGHT_EXECUTABLE
      ? { executablePath: process.env.WT_PLAYWRIGHT_EXECUTABLE }
      : {}),
  });
  let deadline;
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(
      "<!doctype html><html><head><title>Local QR decoder</title></head></html>",
    );
    await page.addScriptTag({ path: createRequire(import.meta.url).resolve("jsqr") });
    const result = await Promise.race([
      page.evaluate(
        async ({ base64, mime, crop, all }) => {
          const input = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([input], { type: mime }));
          try {
            if (bitmap.width * bitmap.height > 20_000_000)
              throw Error("Image exceeds the 20 megapixel decoding limit.");
            const [x, y, width, height] = crop || [0, 0, bitmap.width, bitmap.height];
            if (x + width > bitmap.width || y + height > bitmap.height)
              throw Error("Crop rectangle extends outside the image.");
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
            const pixels = ctx.getImageData(0, 0, width, height);
            const found = [];
            for (let count = 0; count < (all ? 8 : 1); count++) {
              const qr = window.jsQR(pixels.data, width, height, {
                inversionAttempts: "attemptBoth",
              });
              if (!qr) break;
              const corners = [
                qr.location.topLeftCorner,
                qr.location.topRightCorner,
                qr.location.bottomRightCorner,
                qr.location.bottomLeftCorner,
              ];
              found.push({
                text: qr.data,
                format: "qr_code",
                corners: corners.map((p) => ({ x: p.x + x, y: p.y + y })),
              });
              const minX = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x))) - 3);
              const maxX = Math.min(width, Math.ceil(Math.max(...corners.map((p) => p.x))) + 3);
              const minY = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))) - 3);
              const maxY = Math.min(height, Math.ceil(Math.max(...corners.map((p) => p.y))) + 3);
              for (let row = minY; row < maxY; row++)
                pixels.data.fill(255, (row * width + minX) * 4, (row * width + maxX) * 4);
            }
            return found;
          } finally {
            bitmap.close();
          }
        },
        { base64: body.toString("base64"), mime, crop, all: !!values.all },
      ),
      new Promise((_, reject) => {
        deadline = setTimeout(() => reject(Error("QR decoding timed out.")), 30_000);
      }),
    ]);
    if (values.json) console.log(JSON.stringify({ codes: result }, null, 2));
    else for (const qr of result) console.log(qr.text);
    if (!result.length) {
      console.error("No QR code found. For screenshots with multiple panels, try --crop.");
      process.exitCode = 2;
    }
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
