import { useLocale } from "../i18n/react";
import { t } from "../i18n/core";
import { Link } from "@tanstack/react-router";
export function LineupNavigation({ garage = false }: { garage?: boolean }) {
  useLocale();

  return (
    <nav className="wt-lineup-sections" aria-label={t("出击队列功能")}>
      <Link to="/lineups" aria-current={!garage ? "page" : undefined}>
        {t("出击队列")}
      </Link>
      <Link to="/lineups/garage" aria-current={garage ? "page" : undefined}>
        {t("我的车库")}
      </Link>
    </nav>
  );
}
