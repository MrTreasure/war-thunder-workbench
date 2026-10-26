// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.297929854f2f56ed"),
"country-germany": () => import("./countries/country-germany.dc0cb91ebc72cd62"),
"country-ussr": () => import("./countries/country-ussr.45a77aef4dc50c64"),
"country-britain": () => import("./countries/country-britain.7b029fabb1f54f8f"),
"country-japan": () => import("./countries/country-japan.fc9b9f200add9427"),
"country-china": () => import("./countries/country-china.0a59820ebd8ddc73"),
"country-italy": () => import("./countries/country-italy.e6858b7dcc618ed3"),
"country-france": () => import("./countries/country-france.76bfbef6a9e10992"),
"country-sweden": () => import("./countries/country-sweden.11e9a25190644338"),
"country-israel": () => import("./countries/country-israel.5ecef4ef6e8247a4")
};
