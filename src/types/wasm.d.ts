/**
 * Vite URL type for the declared local efficiency-score binary.
 * See data/player-efficiency-wasm.json and docs/wasm-assets.md.
 * Vite emits the original file as a separate same-origin application/wasm asset.
 * The protected calculation source is not distributed with the application.
 */
declare module "*.wasm?no-inline&url" {
  const url: string;
  export default url;
}
