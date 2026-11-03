import presentation from "../data/loadout-presentation.json" with { type: "json" };

export const loadoutRanks = presentation.ranks;
type TranslateTerm = (source: string) => string;
const unchangedTerm: TranslateTerm = (source) => source;
const terms = Object.entries(presentation.terms).sort(([a], [b]) => b.length - a.length);
const termTranslations = new Map(terms);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termPattern = new RegExp(
  `\\b(?:${terms.map(([source]) => escape(source)).join("|")})\\b`,
  "gi",
);
/** Display only: match source terms once, never translate already-rendered text again. */
export function loadoutWeaponName(original: string, translate: TranslateTerm = unchangedTerm) {
  return original.replace(termPattern, (term) =>
    translate(termTranslations.get(term.toLowerCase()) ?? term),
  );
}
export function loadoutParameterValue(original: string, translate: TranslateTerm = unchangedTerm) {
  return original
    .split("+")
    .map((part) =>
      translate(
        presentation.parameterValues[part.trim() as keyof typeof presentation.parameterValues] ||
          loadoutWeaponName(part.trim(), translate),
      ),
    )
    .join(" + ")
    .replace(
      /([\d.,]+)\s*(m\/s|km|m|s|g)\b/g,
      (_, value: string, unit: string) =>
        `${value} ${translate({ "m/s": "米/秒", km: "千米", m: "米", s: "秒", g: "克" }[unit]!)}`,
    );
}
const searchableWeaponText = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{Dash_Punctuation}]+/gu, "");
export const matchesLoadoutText = (
  original: string,
  query: string,
  translate: TranslateTerm = unchangedTerm,
) =>
  searchableWeaponText(`${original} ${loadoutWeaponName(original, translate)}`).includes(
    searchableWeaponText(query),
  );

/** Approximate inline text width in em; a bounded CSS track handles font fallback differences. */
export function loadoutWeaponLabelWidth(
  original: string,
  translate: TranslateTerm = unchangedTerm,
) {
  return [...loadoutWeaponName(original, translate).normalize("NFKC")].reduce(
    (width, letter) =>
      width +
      (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(letter)
        ? 1
        : /[MW@]/.test(letter)
          ? 0.85
          : /[il.,' ]/.test(letter)
            ? 0.28
            : 0.56),
    0,
  );
}
