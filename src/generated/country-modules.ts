// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.faa975c87ee0514b"),
"country-germany": () => import("./countries/country-germany.e07083b2adb1f1f5"),
"country-ussr": () => import("./countries/country-ussr.aa4806414a817553"),
"country-britain": () => import("./countries/country-britain.d17d677f9fcaadc5"),
"country-japan": () => import("./countries/country-japan.7fa5a3a7bda9380d"),
"country-china": () => import("./countries/country-china.5fd07bfc517f769b"),
"country-italy": () => import("./countries/country-italy.59071c7610562f0d"),
"country-france": () => import("./countries/country-france.60f4525f244ad168"),
"country-sweden": () => import("./countries/country-sweden.2346b512a94bcc4c"),
"country-israel": () => import("./countries/country-israel.13738bc5814d05f3")
};
