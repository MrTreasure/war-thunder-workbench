// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.4d0661d8d1afdc73"),
"country-germany": () => import("./countries/country-germany.a82e26d6da2b1d2b"),
"country-ussr": () => import("./countries/country-ussr.b4ab92d80dc8443c"),
"country-britain": () => import("./countries/country-britain.73d50ad27a4bdcf3"),
"country-japan": () => import("./countries/country-japan.8c60d9e3b981d2ca"),
"country-china": () => import("./countries/country-china.1e6c540608bec4f0"),
"country-italy": () => import("./countries/country-italy.ee822550953f26e0"),
"country-france": () => import("./countries/country-france.77c258ce2933ee76"),
"country-sweden": () => import("./countries/country-sweden.d70b0108b4ed5a5d"),
"country-israel": () => import("./countries/country-israel.a4a9d55751804a73")
};
