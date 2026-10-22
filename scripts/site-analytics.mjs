import { readFile } from "node:fs/promises";

/** This is a public beacon identifier, never a Cloudflare management credential. */
export async function cloudflareAnalyticsSnippet() {
  if (process.env.WT_DEPLOY_TARGET !== "cf") return "";
  const config = JSON.parse(
    await readFile(new URL("../data/site-analytics.json", import.meta.url), "utf8"),
  );
  if (
    config.provider !== "cloudflare-web-analytics" ||
    config.hostname !== "wt.mrtreasure.cc" ||
    !/^[a-f0-9]{32}$/.test(config.token)
  )
    throw Error("CF deployment requires a valid public analytics configuration");
  // Wait for parsed HTML so Cloudflare's existing zone-level injection can be detected.
  // Hash navigation is app state; don't add custom events containing player/query data.
  return `<script data-wt-cf-analytics="true">(function(){function start(){if(location.origin!=="https://wt.mrtreasure.cc"||document.querySelector('script[data-cf-beacon],script[src^="https://static.cloudflareinsights.com/beacon.min.js"]'))return;var script=document.createElement("script");script.defer=true;script.src="https://static.cloudflareinsights.com/beacon.min.js";script.setAttribute("data-cf-beacon",${JSON.stringify(JSON.stringify({ token: config.token, spa: false }))});document.head.append(script)}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start()})();</script>`;
}
