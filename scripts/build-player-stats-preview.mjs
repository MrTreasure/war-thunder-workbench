/** Keep previously shared preview links opening the implemented stats page. */
import { mkdir, writeFile, rm } from "node:fs/promises";
const output = new URL("../public/design/player-stats/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(
  new URL("preview.html", output),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>战绩查询与授勋战报</title><style>body{background:#202529;color:#e5e6dc;font:16px system-ui;padding:30px}a{color:#d5b66c}</style><p>正在打开战绩查询与授勋战报…</p><a href="../../#/stats">点击进入</a><script>const q=new URLSearchParams(location.search);const next=new URLSearchParams();if(q.get('player'))next.set('player',q.get('player').slice(0,64));if(q.get('view')==='report')next.set('view','report');location.replace('../../#/stats'+(next.size?'?'+next.toString():''));</script></html>`,
);
console.log("Prepared compatibility link to #/stats; no player fixtures published.");
