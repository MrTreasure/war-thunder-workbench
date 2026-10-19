// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.051aba99a1c5ac1c"),
"country-germany": () => import("./countries/country-germany.7fa029863c0c1104"),
"country-ussr": () => import("./countries/country-ussr.d4ce74e51004604c"),
"country-britain": () => import("./countries/country-britain.26faad42b13f1423"),
"country-japan": () => import("./countries/country-japan.8df3d8400ff7fe5f"),
"country-china": () => import("./countries/country-china.c8902bb03b5a0ee8"),
"country-italy": () => import("./countries/country-italy.56018f7f2f6a48e1"),
"country-france": () => import("./countries/country-france.0ffe55d46d801d86"),
"country-sweden": () => import("./countries/country-sweden.78249f06db9373d3"),
"country-israel": () => import("./countries/country-israel.b5bd8fc723802a79")
};
