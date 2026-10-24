// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.ca2786eadf416857"),
"country-germany": () => import("./countries/country-germany.9877cb583e0a47d7"),
"country-ussr": () => import("./countries/country-ussr.970d0806bbf7d227"),
"country-britain": () => import("./countries/country-britain.daf334a15a0fac18"),
"country-japan": () => import("./countries/country-japan.68ff8a214a769098"),
"country-china": () => import("./countries/country-china.50cc3dfd73a2711a"),
"country-italy": () => import("./countries/country-italy.995e101de229597f"),
"country-france": () => import("./countries/country-france.814c6479dcc276fd"),
"country-sweden": () => import("./countries/country-sweden.54c11161ef2292a0"),
"country-israel": () => import("./countries/country-israel.b0d406ebceb50582")
};
