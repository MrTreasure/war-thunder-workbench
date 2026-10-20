// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.dc1db07533af1c7d"),
"country-germany": () => import("./countries/country-germany.c9eeb4e1a930dd87"),
"country-ussr": () => import("./countries/country-ussr.d7eeae9821a2130d"),
"country-britain": () => import("./countries/country-britain.f0c075e76bf71aca"),
"country-japan": () => import("./countries/country-japan.0828ea092aaa2234"),
"country-china": () => import("./countries/country-china.1e5a646d6172f7b5"),
"country-italy": () => import("./countries/country-italy.5e7c8dcc7b8bb441"),
"country-france": () => import("./countries/country-france.32ad9d46bc367e16"),
"country-sweden": () => import("./countries/country-sweden.5639c787217faf49"),
"country-israel": () => import("./countries/country-israel.8f4050f0a5fe8021")
};
