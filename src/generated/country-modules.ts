// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.e9eebe0730f5b4d4"),
"country-germany": () => import("./countries/country-germany.e03addcda1333544"),
"country-ussr": () => import("./countries/country-ussr.c80ede9924aa3baf"),
"country-britain": () => import("./countries/country-britain.98195be0a5c7b84b"),
"country-japan": () => import("./countries/country-japan.3de06203c1216a1a"),
"country-china": () => import("./countries/country-china.c40ba5400c513af0"),
"country-italy": () => import("./countries/country-italy.29331f05c2f84b42"),
"country-france": () => import("./countries/country-france.80216eb7eb879b97"),
"country-sweden": () => import("./countries/country-sweden.f80a134439dca273"),
"country-israel": () => import("./countries/country-israel.a6ad1a9b15b73e6b")
};
