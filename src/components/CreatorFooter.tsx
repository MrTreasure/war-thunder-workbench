import { Button } from "./ui/button";
export function CreatorFooter() {
  return (
    <div className="creator-footer" aria-label="创作自己的工具">
      <Button asChild variant="ghost" className="creator-footer-link">
        <a
          href="https://qmuse.cn/oauth-login?inviteCode=QMUSE-B0E123AB"
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
          <span>点击创作自己的工具页面，支持AI应用</span>
          <span className="creator-footer-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      </Button>
    </div>
  );
}
