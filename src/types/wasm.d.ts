/** Vite emits this explicitly declared runtime as a separate same-origin asset. */
declare module "*.wasm?no-inline&url" {
  const url: string;
  export default url;
}
