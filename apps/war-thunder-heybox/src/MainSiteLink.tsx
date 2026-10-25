import { useRef, useState } from "react";
import { DetailPage, Icon } from "./ui";
import { sdk } from "./runtime";
export const MAIN_SITE = "https://render.qmuse.pub/p/muse/8645013411493394";

/** The SDK has no arbitrary-URL navigation API. Keep a real HTTPS link and a selectable fallback. */
export function MainSiteLink() {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="hb-main-site" type="button" onClick={() => setOpen(true)}>
        <span>
          <strong>体验工作台完整能力</strong>
          <small>前往主站，继续规划与分析</small>
        </span>
        <Icon name="arrow" />
      </button>
      {open && (
        <DetailPage path="#/main-site" title="前往主站" close={() => setOpen(false)}>
          <h3>体验工作台完整能力</h3>
          <p className="hb-muted">在网页工作台继续使用出击队列、完整车库、地图及更多分析工具。</p>
          <a
            className="hb-primary hb-site-anchor"
            href={MAIN_SITE}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开主站 ↗
          </a>
          <label>
            主站地址
            <input
              ref={input}
              readOnly
              value={MAIN_SITE}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              input.current?.focus();
              input.current?.select();
              void sdk.device
                .setClipboard({ text: MAIN_SITE })
                .then(() => setMessage("主站地址已复制，可在浏览器中打开。"))
                .catch(() => setMessage("请长按地址复制，然后在浏览器中打开。"));
            }}
          >
            复制主站地址
          </button>
          {message && <output aria-live="polite">{message}</output>}
          <p className="hb-fine">
            如果客户端未能打开外部网页，请复制地址到浏览器访问。关联账号后，可继续使用账号中的研发计划。
          </p>
        </DetailPage>
      )}
    </>
  );
}
