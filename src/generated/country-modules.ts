// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.11953ec0ae266278"),
"country-germany": () => import("./countries/country-germany.975ecfec12862e5c"),
"country-ussr": () => import("./countries/country-ussr.d98db10c0978d932"),
"country-britain": () => import("./countries/country-britain.5673acaacdd2d6bf"),
"country-japan": () => import("./countries/country-japan.0f95eb37a19f83a7"),
"country-china": () => import("./countries/country-china.cfb542b5cf1cb52f"),
"country-italy": () => import("./countries/country-italy.844302fc4fbe8c6e"),
"country-france": () => import("./countries/country-france.dd5a3e261dcc4153"),
"country-sweden": () => import("./countries/country-sweden.53916c661e0708bd"),
"country-israel": () => import("./countries/country-israel.813f6a82289acb82")
};
