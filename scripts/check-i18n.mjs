/** Locale completeness, interpolation safety and compact-label gates (no browser automation). */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const dictionaries = Object.fromEntries(
  await Promise.all(
    ["zh-CN", "en", "ru", "ja"].map(async (lang) => [
      lang,
      JSON.parse(await readFile(new URL(`data/i18n/${lang}.json`, root), "utf8")),
    ]),
  ),
);
for (const [lang, messages] of Object.entries(dictionaries))
  assert.deepEqual(
    Object.keys(messages).sort(),
    Object.keys(dictionaries["zh-CN"]).sort(),
    `Locale key mismatch: ${lang}`,
  );
const dictionary = Object.fromEntries(
  Object.keys(dictionaries["zh-CN"]).map((key) => [
    key,
    [dictionaries.en[key], dictionaries.ru[key], dictionaries.ja[key]],
  ]),
);
const placeholders = (value) => [...value.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
for (const [key, translations] of Object.entries(dictionary)) {
  assert.equal(translations.length, 3, `Missing locale: ${key}`);
  for (const [index, translated] of translations.entries()) {
    assert.equal(typeof translated, "string", `Invalid locale value: ${key}`);
    assert(
      index === 2 || !/\p{Script=Han}/u.test(translated),
      `Untranslated foreign message: ${key}`,
    );
    assert.deepEqual(placeholders(translated), placeholders(key), `Changed placeholders: ${key}`);
    assert(
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(translated),
      `Control character: ${key}`,
    );
  }
}
let sources = 0,
  staticCalls = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["generated", "i18n"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!/\.tsx?$/.test(path) || path.endsWith("routeTree.gen.ts")) continue;
    const source = await readFile(path, "utf8");
    sources++;
    for (const match of source.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) {
      const text = JSON.parse(match[1]);
      if (!/\p{Script=Han}/u.test(text)) continue;
      assert(
        Object.hasOwn(dictionary, text.trim().replace(/\s+/g, " ")),
        `Missing message in ${path}: ${text}`,
      );
      staticCalls++;
    }
    if (path.endsWith(".tsx") && !path.endsWith("LanguageSwitch.tsx")) {
      for (const match of source.matchAll(/>([^{}<>"'`]+)</g)) {
        assert(
          !/\p{Script=Han}/u.test(match[1]),
          `Unlocalized JSX text in ${path}: ${match[1].trim()}`,
        );
      }
    }
  }
}
await scan(fileURLToPath(new URL("src", root)));
// These labels must remain concise enough for the shared compact navigation.
for (const key of ["科技树", "出击队列", "陆战地图", "战绩查询", "折扣日历"]) {
  for (const translated of dictionary[key])
    assert(translated.length <= 22, `Navigation needs shortening: ${translated}`);
}
for (const key of ["登录", "重试", "取消", "完成", "关闭"]) {
  for (const translated of dictionary[key])
    assert(translated.length <= 14, `Compact action too long: ${translated}`);
}
for (const key of [
  "雷达：胜率",
  "雷达：对空",
  "雷达：对地",
  "雷达：综合",
  "雷达：出击",
  "雷达：场均",
]) {
  for (const text of dictionary[key])
    assert(Array.from(text).length <= 9, `Radar label too long: ${key}`);
}
const localization = JSON.parse(await readFile(new URL("data/localization.json", root), "utf8"));
assert.equal(localization.columns.ru, "<Russian>");
assert.equal(localization.columns.ja, "<Japanese>");
assert(
  Object.values(localization.vehicles).every((value) => value.nameJa),
  "Missing Japanese vehicle mappings",
);
const russianVehicles = Object.values(localization.vehicles).filter((value) => value.nameRu).length;
assert.equal(
  russianVehicles,
  Object.keys(localization.vehicles).length,
  "Missing Russian vehicle mappings",
);
console.log(
  JSON.stringify({
    locales: ["zh-CN", "en", "ru", "ja"],
    messages: Object.keys(dictionary).length,
    sourceFiles: sources,
    translatedCalls: staticCalls,
    russianVehicles,
    check:
      "dictionary, placeholders, source JSX and compact labels passed; visual acceptance is manual",
  }),
);
