// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.69db945765f492ce"),
"country-germany": () => import("./countries/country-germany.256c6d8d935579a6"),
"country-ussr": () => import("./countries/country-ussr.7844b0d14ece67ec"),
"country-britain": () => import("./countries/country-britain.02887c774fa22e7b"),
"country-japan": () => import("./countries/country-japan.80c31db8301b27b5"),
"country-china": () => import("./countries/country-china.fba1c45f847436bb"),
"country-italy": () => import("./countries/country-italy.70b97c9f8b0771bb"),
"country-france": () => import("./countries/country-france.f408028aa414e917"),
"country-sweden": () => import("./countries/country-sweden.0a33e435e2fa93b4"),
"country-israel": () => import("./countries/country-israel.cbaeb1a766ac28b3")
};
