import seo from "../../data/site-seo.json";
import { useLocale } from "../i18n/react";
import { localeGuidePath, localeAppPath, appBasePath } from "../i18n/urls";

/** Visible help links remain available after React replaces the static entry. */
export function SiteGuideLinks() {
  const locale = useLocale();
  const copy = seo.locales[locale];
  const ownEntry = !!document.querySelector('meta[name="wt-localized-entries"]');
  const base = ownEntry
    ? new URL(appBasePath(location.pathname), location.origin)
    : new URL(seo.siteUrl);
  return (
    <aside className="wt-site-guide" aria-label={copy.guideLabel}>
      <p>{copy.intro}</p>
      <nav aria-label={copy.guideLabel}>
        {copy.features.map((feature) => (
          <a key={feature.slug} href={new URL(localeGuidePath(locale, feature.slug), base).href}>
            {feature.title}
          </a>
        ))}
      </nav>
      <div>
        <a href={new URL(localeGuidePath(locale), base).href}>{copy.guideLabel}</a>
        {Object.entries(seo.locales).map(([code, other]) => (
          <a
            key={code}
            lang={code}
            hrefLang={code}
            href={new URL(localeAppPath("/", code as typeof locale).slice(1), base).href}
          >
            {other.name}
          </a>
        ))}
      </div>
    </aside>
  );
}
