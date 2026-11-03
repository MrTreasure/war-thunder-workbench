import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

// Run the same display adapter used by the international UI, with its real dictionaries.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;
    if (specifier.startsWith(".") && context.parentURL) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) target = candidate.href;
    }
    if (target.endsWith(".json")) {
      const importAttributes = { ...context.importAttributes, type: "json" };
      return { ...nextResolve(target, { ...context, importAttributes }), importAttributes };
    }
    return nextResolve(target, context);
  },
});
const { setLocale, t } = await import("../src/i18n/core.ts");
const { loadoutWeaponName, loadoutParameterValue, matchesLoadoutText, loadoutWeaponLabelWidth } =
  await import("../src/intl-loadout-presentation.ts");
setLocale("zh-CN");
assert.equal(loadoutWeaponName("R-73E air-to-air missiles"), "R-73E 空对空导弹");
assert.equal(loadoutWeaponName("PL-8B air-to-air missiles"), "PL-8B 空对空导弹");
assert.equal(loadoutParameterValue("16 km"), "16 千米");
assert(matchesLoadoutText("PL-8B air-to-air missiles", "空对空导弹"));
assert(matchesLoadoutText("PL-8B air-to-air missiles", "PL8"));
for (const locale of ["en", "ru", "ja"]) {
  setLocale(locale);
  assert.equal(loadoutWeaponName("R-73E air-to-air missiles"), `R-73E ${t("空对空导弹")}`);
  assert.equal(loadoutWeaponName("PL-8B air-to-air missiles"), `PL-8B ${t("空对空导弹")}`);
  assert.equal(loadoutParameterValue("16 km"), `16 ${t("千米")}`);
  assert(matchesLoadoutText("PL-8B air-to-air missiles", t("空对空导弹")));
  assert(loadoutWeaponLabelWidth("R-73E air-to-air missiles") > 0);
}
setLocale("zh-CN");
assert.equal(loadoutWeaponName("R-73E air-to-air missiles"), "R-73E 空对空导弹");
console.log(
  "Loadout display localization passed: shared matcher, Chinese/English/Russian/Japanese names, units, search and locale switching.",
);
