import { Button } from "./ui/button";
export function CreatorLink() {
  return (
    <div className="creator-promo" aria-label="创作自己的工具">
      <Button asChild variant="ghost" className="creator-promo-link">
        <a
          href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB"
          aria-label="点击创作自己的工具页面，支持AI应用"
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
          <span className="creator-promo-text">点击创作自己的工具页面，支持AI应用</span>
          <span className="creator-promo-short" aria-hidden="true">
            创作工具
          </span>
          <span className="creator-promo-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      </Button>
    </div>
  );
}
