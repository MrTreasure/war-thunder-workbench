// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.1b33cbf63fdc1e8d"),
"country-germany": () => import("./countries/country-germany.dec1febf00979885"),
"country-ussr": () => import("./countries/country-ussr.52b119c45f94b994"),
"country-britain": () => import("./countries/country-britain.b0002900de8c8071"),
"country-japan": () => import("./countries/country-japan.ce9781747722604f"),
"country-china": () => import("./countries/country-china.7306147e96b2e08b"),
"country-italy": () => import("./countries/country-italy.8161761bf6e48eb2"),
"country-france": () => import("./countries/country-france.15bedd7b50217884"),
"country-sweden": () => import("./countries/country-sweden.41c5b967e97c2adf"),
"country-israel": () => import("./countries/country-israel.73b5d175116ecf1b")
};
