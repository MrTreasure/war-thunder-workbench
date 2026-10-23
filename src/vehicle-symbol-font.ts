import fontUrl from "./assets/WTSymbols.ttf?url";

let pending: Promise<void> | undefined;
/** Canvas exports must await the official marker font before measuring text. */
export function loadVehicleSymbols(): Promise<void> {
  pending ||= (async () => {
    const font = new FontFace("WTSymbols", `url("${fontUrl}")`, {
      unicodeRange: "U+22E0,U+2417,U+2419,U+2420,U+2580,U+2582-2585,U+25C4,U+25CA-25CD,U+25D0,U+25D4,U+25D7-25D8,U+25E1-25E2,U+25E5,U+F059",
    });
    document.fonts.add(await font.load());
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
