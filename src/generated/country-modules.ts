// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.c070ffe26bc96825"),
"country-germany": () => import("./countries/country-germany.159f74c303182bc7"),
"country-ussr": () => import("./countries/country-ussr.ab9747d2920e9a65"),
"country-britain": () => import("./countries/country-britain.15de43ab7fab0844"),
"country-japan": () => import("./countries/country-japan.5491a2553e42af99"),
"country-china": () => import("./countries/country-china.ad176ad3af30a70f"),
"country-italy": () => import("./countries/country-italy.58297df3f6f63c36"),
"country-france": () => import("./countries/country-france.29e1664b2acf33cf"),
"country-sweden": () => import("./countries/country-sweden.1a67ee9b8bbc3d13"),
"country-israel": () => import("./countries/country-israel.e4a6c35220672f26")
};
