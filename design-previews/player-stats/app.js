import DATA from "./data.js";
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const number = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—";
const ratio = (n, d, percent = false) =>
  typeof n !== "number" || typeof d !== "number" || d <= 0
    ? "—"
    : ((n / d) * (percent ? 100 : 1)).toFixed(2) + (percent ? "%" : "");
const kills = (v) =>
  typeof v.airKills === "number" && typeof v.groundKills === "number"
    ? v.airKills + v.groundKills
    : null;
const time = (value) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const MODES = { ab: "街机战斗", rb: "历史战斗", sb: "全真战斗" };
let selected = DATA.players[0];
let mode = "ab";
let theme = "auto";
let tone = "review";
let currentTab = "overview";
let filterText = "";
let category = "all";
const top = () =>
  selected
    ? selected.vehicles
        .filter((v) => v.mode === mode && typeof v.battles === "number")
        .sort(
          (a, b) =>
            b.battles - a.battles ||
            (b.sorties ?? -1) - (a.sorties ?? -1) ||
            a.id.localeCompare(b.id, "en"),
        )
        .slice(0, 5)
    : [];
const image = (url, alt, cls = "") =>
  `<img src="${escape(url)}" alt="${escape(alt)}" class="${cls}" loading="lazy" decoding="async">`;
function dialog(title, text) {
  $("#dialog-title").textContent = title;
  $("#dialog-copy").textContent = text;
  $("#info-dialog").showModal();
}
function switchTab(tab) {
  currentTab = tab;
  for (const name of ["overview", "report"]) {
    $(`#${name}`).hidden = name !== tab;
    $(`#${name}-tab`).setAttribute("aria-selected", String(name === tab));
    $(`#${name}-tab`).tabIndex = name === tab ? 0 : -1;
  }
  if (tab === "report") renderReport();
}
function renderProfile() {
  if (!selected) {
    $("#overview-content").innerHTML =
      `<div class="panel empty"><h2>Starfall · 正在核对玩家身份</h2><p style="margin-top:12px">${escape(DATA.lookup.note)}</p><p class="fine" style="margin-top:8px">可以切回 ArthurDaynee 查看真实战绩与战报样式。</p></div>`;
    return;
  }
  const p = selected,
    s = p.modes[mode],
    first = top()[0],
    owned = p.countries.reduce((sum, c) => sum + (c.owned ?? 0), 0);
  const branches = s.branches,
    maxTime = Math.max(1, ...branches.map((v) => v.seconds));
  $("#overview-content").innerHTML =
    `<div class="overview-grid"><aside class="panel profile"><div class="profile-art">${first ? image(first.image, first.name) : ""}<span class="level" aria-label="等级 ${number(p.level)}">${number(p.level)}</span></div><div class="profile-body"><h2>${escape(p.name)}</h2><p class="profile-title">${p.title === "Tankman" ? "坦克兵" : "公开玩家资料"}</p><p class="identity"><span>UID ${escape(p.uid)}</span><span>等级 ${number(p.level)}</span></p><div class="owned"><strong>${number(owned)}</strong><span>已返回的拥有载具</span></div><button type="button" class="primary" id="make-report">生成我的战报 ↗</button><div class="country-list"><p class="fine">各国拥有载具</p>${[
      ...p.countries,
    ]
      .sort((a, b) => (b.owned ?? 0) - (a.owned ?? 0))
      .map(
        (c) =>
          `<div class="country-row">${image(c.flag, c.name)}<span>${escape(c.name)}</span><strong>${number(c.owned)}</strong></div>`,
      )
      .join(
        "",
      )}</div></div></aside><div class="content-column"><div class="section-toolbar"><h2>生涯表现</h2><div class="segmented" aria-label="战斗模式">${Object.entries(
      MODES,
    )
      .map(
        ([key, name]) =>
          `<button type="button" data-mode="${key}" aria-pressed="${key === mode}">${escape(name)}</button>`,
      )
      .join("")}</div></div><div class="stats-grid">${[
      ["战斗场次", number(s.battles), "同一模式的生涯场次"],
      ["胜率", ratio(s.wins, s.battles, true), `${number(s.wins)} 场胜利`],
      ["空陆 K/D", ratio(kills(s), s.deaths), "空陆击毁 / 死亡次数"],
      ["出击次数", number(s.sorties), "一场战斗可多次出击"],
    ]
      .map(
        ([label, value, note], i) =>
          `<div class="stat ${i === 1 ? "highlight" : ""}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`,
      )
      .join(
        "",
      )}</div><div class="middle-grid"><section class="panel"><h3>常用类型</h3><p class="section-subtitle">按已返回类型的使用时长排序</p>${
      [...branches]
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 5)
        .map(
          (v) =>
            `<div class="branch-row"><span class="branch-name">${image(DATA.assets.armyBase + v.icon + ".svg", "")}${escape(v.name)}</span><div class="bar"><i style="width:${(v.seconds / maxTime) * 100}%"></i></div><strong>${(v.seconds / 3600).toFixed(1)} h</strong></div>`,
        )
        .join("") || '<p class="empty">暂无已返回的类型时长</p>'
    }</section><section class="panel"><h3>战斗记录</h3><p class="section-subtitle">${MODES[mode]} · 累计公开统计</p><dl class="combat-details">${[
      ["空中目标击毁", s.airKills],
      ["地面目标击毁", s.groundKills],
      ["死亡次数", s.deaths],
      ["胜利场次", s.wins],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${number(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p class="fine">效率算法、收益口径仍待确认，当前不展示分值与收益。</p></section></div><section class="panel table-panel"><div class="table-heading"><div class="section-toolbar"><h2>载具战绩</h2><span class="fine" id="vehicle-count"></span></div><p class="section-subtitle">按战斗场次排序。生成战报时仅选取前五辆。</p><div class="table-tools"><input id="vehicle-search" type="search" placeholder="搜索载具名称或型号" aria-label="搜索载具"><label for="category">军种</label><select id="category"><option value="all">全部军种</option><option value="ground">陆军</option><option value="aviation">空军</option><option value="helicopters">直升机</option><option value="ships">远洋海军</option><option value="boats">近岸海军</option></select></div></div><div class="table-scroll"><table><thead><tr><th scope="col">载具</th><th scope="col">场次</th><th scope="col">胜率</th><th scope="col">空陆 K/D</th><th scope="col">击毁空中</th><th scope="col">击毁地面</th><th scope="col">出击</th></tr></thead><tbody id="vehicle-rows"></tbody></table></div><p class="table-foot">“—”表示未返回或暂不可计算。单车场次不可相加作为玩家总场次。</p></section></div></div>`;
  $("#make-report").addEventListener("click", () => switchTab("report"));
  document.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      $("#report-mode").value = mode;
      renderProfile();
    }),
  );
  $("#vehicle-search").value = filterText;
  $("#vehicle-search").addEventListener("input", (event) => {
    filterText = event.target.value;
    renderRows();
  });
  $("#category").value = category;
  $("#category").addEventListener("change", (event) => {
    category = event.target.value;
    renderRows();
  });
  renderRows();
}
function renderRows() {
  const rows = selected.vehicles
    .filter(
      (v) =>
        v.mode === mode &&
        (category === "all" || v.category === category) &&
        (!filterText || (v.name + " " + v.id).toLowerCase().includes(filterText.toLowerCase())),
    )
    .sort(
      (a, b) =>
        (b.battles ?? -1) - (a.battles ?? -1) ||
        (b.sorties ?? -1) - (a.sorties ?? -1) ||
        a.id.localeCompare(b.id, "en"),
    );
  $("#vehicle-count").textContent = rows.length + " 辆";
  $("#vehicle-rows").innerHTML =
    rows
      .map(
        (v) =>
          `<tr><td class="vehicle-cell"><div class="vehicle-identity">${image(v.thumbnail, "")}<span><b>${escape(v.name)}</b><small>${v.rank ? escape(v.rank) + " 级 · " : ""}BR ${number(v.br[mode])}</small></span></div></td><td class="number">${number(v.battles)}</td><td class="number">${ratio(v.wins, v.battles, true)}</td><td class="number">${ratio(kills(v), v.deaths)}</td><td class="number">${number(v.airKills)}</td><td class="number">${number(v.groundKills)}</td><td class="number">${number(v.sorties)}</td></tr>`,
      )
      .join("") || '<tr><td colspan="7" class="empty">没有符合条件的载具记录</td></tr>';
}
function renderReport() {
  if (!selected) {
    $("#poster").innerHTML = '<div class="empty">玩家身份尚未确认，暂不生成战报。</div>';
    return;
  }
  const vehicles = top();
  if (!vehicles.length) {
    $("#poster").innerHTML =
      '<div class="empty"><h2>这个模式还没有可用的载具记录</h2><p>切换至街机战斗或历史战斗查看。</p></div>';
    $("#poster").style.removeProperty("--report-bg");
    return;
  }
  const counts = vehicles.reduce((sum, v) => {
    const c = v.category || "ground";
    sum[c] = (sum[c] || 0) + (v.sorties ?? 0);
    return sum;
  }, {});
  const effectiveTheme =
    theme === "auto"
      ? (counts.aviation ?? 0) > (counts.ground ?? 0)
        ? "aviation"
        : "ground"
      : theme;
  const branch = effectiveTheme === "aviation" ? "航空战报" : "陆战战报";
  $("#theme-caption").textContent =
    (theme === "auto" ? "自动匹配 · " : "") +
    (effectiveTheme === "aviation" ? "长空之上" : "钢铁前线");
  $("#poster").className = "poster " + effectiveTheme;
  $("#poster").style.setProperty("--report-bg", `url("${DATA.assets[effectiveTheme]}")`);
  // All metrics below are scoped to the five rows, never the whole career.
  const totalBattles = vehicles.reduce((n, v) => n + (v.battles ?? 0), 0);
  const topCountry = vehicles.reduce((result, v) => {
    if (v.country) result[v.country] = (result[v.country] || 0) + (v.battles ?? 0);
    return result;
  }, {});
  const countryId = Object.keys(topCountry).sort((a, b) => topCountry[b] - topCountry[a])[0];
  const country = selected.countries.find((c) => c.id === countryId)?.name || "多国出击";
  const sample = DATA.sampleReviews[selected.uid]?.[mode]?.[tone];
  $("#poster").innerHTML =
    `<div class="poster-top">${image(DATA.assets.logo, "War Thunder", "poster-logo")}<span class="poster-mode">${MODES[mode]} · ${mode.toUpperCase()}</span></div><div class="poster-identity"><p>我的战雷 · 常用载具战报</p><h2 class="poster-name">${escape(selected.name)}</h2><div class="poster-meta">${image(DATA.assets.armyBase + (effectiveTheme === "aviation" ? "army_fighter" : "army_tank") + ".svg", "")}<span>${branch} · Lv.${number(selected.level)} · UID ${escape(selected.uid)}</span></div></div><div class="poster-summary"><div><strong>${vehicles.length}</strong><span>常用载具</span></div><div><strong>${number(totalBattles)}</strong><span>单车场次合计*</span></div><div><strong>${escape(country)}</strong><span>常用国家</span></div></div><div class="poster-section-heading"><h3>最常出击 TOP 5</h3><span>同一模式 · 按战斗场次</span></div>${vehicles.map((v, i) => `<section class="top-vehicle"><span class="vehicle-place">${String(i + 1).padStart(2, "0")}</span>${image(v.image, v.name)}<div><h3>${escape(v.name)}</h3><div class="poster-values"><span><b>${number(v.battles)}</b>场</span><span><b>${ratio(v.wins, v.battles, true)}</b>胜率</span><span><b>${ratio(kills(v), v.deaths)}</b>空陆 K/D</span></div></div></section>`).join("")}<section class="poster-review"><div class="review-label">AI 战术评价 <span class="sample-tag">示例文案</span></div><h3>${escape(sample?.title || "等待生成评价")}</h3><p>${escape(sample?.text || "仅根据以上五辆载具的数据生成评价。")}</p></section><div class="poster-bottom"><span>资料采集 ${time(selected.capturedAt)} · 战雷个人工具</span><span>*含同场多车，不代表玩家总场次</span></div>`;
}
function updatePlayer() {
  selected = DATA.players.find((p) => p.uid === $("#player").value) || null;
  mode = selected?.preferredMode || "ab";
  $("#report-mode").value = mode;
  $("#lookup-status").textContent = selected
    ? `UID ${selected.uid} · Lv.${selected.level}`
    : "满级玩家身份待确认";
  $("#capture-time").textContent = selected
    ? "采集于 " + time(selected.capturedAt)
    : "Starfall 身份待确认";
  renderProfile();
  if (currentTab === "report") renderReport();
}
$("#player").innerHTML = DATA.players
  .map((p) => `<option value="${escape(p.uid)}">${escape(p.name)} · Lv.${number(p.level)}</option>`)
  .join("");
const params = new URLSearchParams(window.location.search);
const initial = DATA.players.find(
  (p) => p.name === params.get("player") || p.uid === params.get("player"),
);
if (initial) $("#player").value = initial.uid;
$("#player").addEventListener("change", updatePlayer);
for (const name of ["overview", "report"])
  $(`#${name}-tab`).addEventListener("click", () => switchTab(name));
$(".page-tabs").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? "overview"
      : event.key === "End"
        ? "report"
        : currentTab === "overview"
          ? "report"
          : "overview";
  switchTab(next);
  $(`#${next}-tab`).focus();
});
$("#report-mode").addEventListener("change", (event) => {
  mode = event.target.value;
  renderProfile();
  renderReport();
});
$("#tone").addEventListener("change", (event) => {
  tone = event.target.value;
  renderReport();
});
document.querySelectorAll("[data-theme]").forEach((button) =>
  button.addEventListener("click", () => {
    theme = button.dataset.theme;
    document
      .querySelectorAll("[data-theme]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    renderReport();
  }),
);
$("#preview-report").addEventListener("click", renderReport);
$("#mobile-page").addEventListener("change", (event) => {
  if (event.target.value !== "stats") window.location.assign("../../#/" + event.target.value);
});
$("#login").addEventListener("click", () =>
  dialog(
    "统一账号登录",
    "这里预留统一账号的登录入口，与控制台共用账号。当前为设计预览，不会提交登录信息；正式接入后，已登录用户不限每日查询与战报次数。",
  ),
);
$("#download-info").addEventListener("click", () =>
  dialog(
    "图片保存样式预览",
    "目前用于确认战报排版。正式接入后可保存高清图片；更换背景与重复保存不消耗战报生成次数。",
  ),
);
$(".dialog-close").addEventListener("click", () => $("#info-dialog").close());
$(".dialog-done").addEventListener("click", () => $("#info-dialog").close());
updatePlayer();
if (params.get("view") === "report") switchTab("report");
