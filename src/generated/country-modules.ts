// Generated: load only the selected country's transport module.
export const countryModules: Record<string, () => Promise<{ default: string }>> = {
"country-usa": () => import("./countries/country-usa.7bac6d02e8869603"),
"country-germany": () => import("./countries/country-germany.9616113de65f765a"),
"country-ussr": () => import("./countries/country-ussr.0b954d070fefde39"),
"country-britain": () => import("./countries/country-britain.2d6cd9daff055788"),
"country-japan": () => import("./countries/country-japan.ebb79dcab6cff136"),
"country-china": () => import("./countries/country-china.e705c0d19bc14a2c"),
"country-italy": () => import("./countries/country-italy.cc7f052db0b0e1ab"),
"country-france": () => import("./countries/country-france.ce49e17333b6b231"),
"country-sweden": () => import("./countries/country-sweden.35a5dd1f232ea377"),
"country-israel": () => import("./countries/country-israel.45b8f9b699a2b11b")
};
