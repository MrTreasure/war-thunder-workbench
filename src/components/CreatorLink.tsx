import { useLocale } from "../i18n/react";
import { t } from "../i18n/core";
import { Button } from "./ui/button";
export function CreatorLink() {
  useLocale();

  return (
    <div className="creator-promo" aria-label={t("QMuse 创作平台")}>
      <Button asChild variant="ghost" className="creator-promo-link">
        <a
          href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB"
          aria-label={t("QMuse，让灵感触手可及（新窗口打开）")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://mdn.alipayobjects.com/huamei_4fgr8p/afts/img/a_I3RIgbaagAAAAAQDAAAAgADtNGAQFr/original"
            alt="QMuse"
            width={20}
            height={20}
            loading="lazy"
          />
          <span className="creator-promo-text">{t("让灵感触手可及")}</span>
          <span className="creator-promo-short" aria-hidden="true">
            {t("让灵感触手可及")}
          </span>
          <span className="creator-promo-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      </Button>
    </div>
  );
}
