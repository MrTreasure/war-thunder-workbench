// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.3bd6667d8077c936"),
"country-germany": () => import("./countries/country-germany.4b34990e2b5929db"),
"country-ussr": () => import("./countries/country-ussr.cfa6e7d38907dcd0"),
"country-britain": () => import("./countries/country-britain.19da698cceae5546"),
"country-japan": () => import("./countries/country-japan.18a8cf15daed8c5c"),
"country-china": () => import("./countries/country-china.46038c52a6a65832"),
"country-italy": () => import("./countries/country-italy.1745827971e23ea9"),
"country-france": () => import("./countries/country-france.2c45b890cdeaa357"),
"country-sweden": () => import("./countries/country-sweden.7e2e716a12776fe2"),
"country-israel": () => import("./countries/country-israel.4cace1953dcb48da")
};
