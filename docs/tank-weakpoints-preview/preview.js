// This standalone review uses the built data literal. It makes no API or account requests.
const $ = (id) => document.getElementById(id);
const countries = { usa: "美国", germany: "德国", ussr: "苏联", britain: "英国", japan: "日本", china: "中国", italy: "意大利", france: "法国", sweden: "瑞典", israel: "以色列" };
const eras = [["all", "全部年代"], ["ww2", "二战"], ["cold-war", "冷战"], ["modern", "现代"]];
let selected = -1;
let point = 0;
let original = false;
let country = "all";
let rank = "all";
let era = "all";
let includeIs = false;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function sourceOf(model) { return model.source || SAMPLE.source || {}; }
function isSupplement(model) { return String(model.family || "").toLowerCase() === "is" && !(Number(model.rank) >= 6); }
function matches(model) {
  if (country !== "all" && (model.country || "unknown") !== country) return false;
  if (era !== "all" && model.era !== era) return false;
  if (isSupplement(model)) return includeIs;
  return rank === "all" || Number(model.rank) === Number(rank);
}
function videoUrl(source, time) {
  if (!source.url) return null;
  try { const url = new URL(source.url); if (Number.isFinite(time)) url.searchParams.set("t", String(Math.floor(time))); return url.href; } catch { return null; }
}
function sourceLink(title, href, detail) {
  const article = element("div", undefined, "source-card");
  const link = element(href ? "a" : "span", title + (href ? " ↗" : ""));
  if (href) { link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; }
  article.append(link, element("small", detail));
  return article;
}
function renderPoint() {
  const pin = SAMPLE.models[selected]?.pins?.[point];
  $("point-title").textContent = pin?.label || "尚无标注";
  $("point-detail").textContent = pin?.detail || "该车型的攻击位置说明尚未补充。";
  for (const host of [$("pins"), $("pin-buttons")])
    [...host.children].forEach((button, index) => button.setAttribute("aria-pressed", String(index === point)));
}
function imageMissing(message) {
  $("photo").hidden = true;
  $("pins").hidden = true;
  $("image-status").textContent = message;
  $("image-status").hidden = false;
}
function render() {
  const model = SAMPLE.models[selected];
  if (!model) return;
  const source = sourceOf(model);
  $("vehicle-name").textContent = model.name;
  const metadata = [model.role, model.countryName || countries[model.country], model.rank ? `Rank ${model.rank}` : null, isSupplement(model) ? "IS 系列补充" : null].filter(Boolean);
  $("vehicle-role").textContent = metadata.join(" · ");
  $("wiki-summary").textContent = model.wikiSummary || "Wiki 要点待核对。";
  $("wiki-points").replaceChildren(...(model.wikiPoints || []).map((text) => element("li", text)));
  $("reload-time").textContent = model.reload?.display || "待核对";
  $("reload-gun").textContent = model.reload?.gun || "";
  $("reload-note").textContent = model.reload?.note || "";
  $("video-section").hidden = !model.videoAdvice?.length;
  $("video-advice").replaceChildren(...(model.videoAdvice || []).map((advice) => {
    const article = element("article", undefined, "advice");
    article.append(element("h4", advice.label), element("p", advice.text));
    const href = videoUrl(source, advice.time);
    if (href) {
      const link = element("a", Number.isFinite(advice.time) ? `${Math.floor(advice.time / 60)}:${String(Math.floor(advice.time % 60)).padStart(2, "0")} ↗` : "查看视频 ↗");
      link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
      article.append(link);
    }
    return article;
  }));
  const image = $("photo");
  const rawOnly = !model.imageUrl && !!model.rawUrl;
  const showRaw = original || rawOnly;
  const imageUrl = showRaw ? model.rawUrl : model.imageUrl;
  image.hidden = !imageUrl;
  $("image-status").hidden = !!imageUrl;
  const fallbackUrl = showRaw ? model.rawFallbackUrl : model.imageFallbackUrl;
  let triedFallback = false;
  image.onerror = () => {
    if (fallbackUrl && !triedFallback) { triedFallback = true; image.src = fallbackUrl; return; }
    imageMissing("高清正面图加载失败，请稍后重试；此图暂不显示标注。");
  };
  if (imageUrl) image.src = imageUrl;
  else { image.removeAttribute("src"); imageMissing("高清正面图尚未归档，此车型资料仍在补充。"); }
  image.alt = model.name + (showRaw ? "原始防护分析视频帧" : "正面防护分析截图与区域标注");
  image.width = showRaw ? (model.sourceDimensions?.[0] || 1920) : (model.crop?.[2] || 1100);
  image.height = showRaw ? (model.sourceDimensions?.[1] || 1080) : (model.crop?.[3] || 690);
  $("toggle-original").hidden = !(model.imageUrl && model.rawUrl);
  $("toggle-original").textContent = original ? "返回标注图" : "查看完整原始帧";
  $("toggle-original").setAttribute("aria-pressed", String(original));
  $("figure-caption").textContent = imageUrl ? `画面：${source.author || "来源见下方"} / 《战争雷霆》。${showRaw ? "当前为完整原始帧。" : "金色编号为讲解标注。"}原始游戏热图颜色取决于当时的弹种与视角。` : "图像资料待补充，不以其他车型画面代替。";
  $("pins").hidden = showRaw || !imageUrl;
  $("pins").replaceChildren();
  $("pin-buttons").replaceChildren();
  (model.pins || []).forEach((pin, index) => {
    const marker = element("button", undefined, "pin");
    marker.type = "button";
    marker.style.setProperty("--x", String(pin.x)); marker.style.setProperty("--y", String(pin.y));
    marker.setAttribute("aria-label", `${index + 1} · ${pin.label}`);
    marker.append(element("b", String(index + 1)), element("span", pin.label));
    const alternative = element("button", `${index + 1} · ${pin.label}`);
    alternative.type = "button";
    const choose = () => { point = index; renderPoint(); };
    marker.addEventListener("click", choose); alternative.addEventListener("click", choose);
    $("pins").append(marker); $("pin-buttons").append(alternative);
  });
  const records = [];
  if (source.url) records.push(sourceLink(source.title || "视频来源", videoUrl(source, model.time), [source.author, source.publishedAt, source.gameVersion ? `游戏版本 ${source.gameVersion}` : null, Number.isFinite(model.time) ? `${Math.floor(model.time / 60)}:${String(Math.floor(model.time % 60)).padStart(2, "0")}` : null, model.imageQuality].filter(Boolean).join(" · ")));
  if (model.wikiUrl) records.push(sourceLink("官方 Wiki · " + model.name, model.wikiUrl, `核对日期 ${model.collectedAt || SAMPLE.collectedAt || "待补充"} · 车型、装甲与主炮装填资料${model.wikiGameVersion ? ` · 游戏版本 ${model.wikiGameVersion}` : ""}`));
  $("sources").replaceChildren(...records);
  [...$("vehicles").children].forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.id === model.id)));
  renderPoint();
}
function select(index) { selected = index; point = 0; original = false; render(); }
function updateList(preferredId) {
  const visible = SAMPLE.models.filter(matches);
  $("vehicles").replaceChildren(...visible.map((model) => {
    const button = element("button", model.name + (!model.imageUrl && !model.rawUrl ? " · 待补图" : ""));
    button.type = "button"; button.dataset.id = model.id;
    button.addEventListener("click", () => { select(SAMPLE.models.indexOf(model)); location.hash = `vehicle=${model.id}`; });
    return button;
  }));
  for (const id of ["study", "source-section"]) $(id).hidden = !visible.length;
  $("empty-state").hidden = !!visible.length;
  const illustrated = visible.filter((model) => model.imageUrl).length;
  $("result-count").textContent = `${visible.length} 辆资料 · ${illustrated} 辆已配正面图 · ${visible.length - illustrated} 辆待补图${includeIs ? " · 已包含 IS 系列补充" : ""}`;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const active = button.dataset.value === ({ country, rank, era }[button.dataset.filter]);
    button.setAttribute("aria-pressed", String(active));
    if (button.dataset.filter === "era") { if (active) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current"); }
  });
  const currentId = preferredId || SAMPLE.models[selected]?.id;
  const next = visible.find((model) => model.id === currentId) || visible[0];
  select(next ? SAMPLE.models.indexOf(next) : -1);
}
function addFilter(host, kind, value, title) {
  const button = element("button", title); button.type = "button";
  button.dataset.filter = kind; button.dataset.value = value;
  button.addEventListener("click", () => {
    if (kind === "country") country = value;
    if (kind === "rank") rank = value;
    if (kind === "era") era = value;
    updateList();
  });
  $(host).append(button);
}
addFilter("countries", "country", "all", "全部国家");
for (const code of new Set(SAMPLE.models.map((model) => model.country || "unknown"))) {
  const model = SAMPLE.models.find((entry) => entry.country === code);
  addFilter("countries", "country", code, model?.countryName || countries[code] || (code === "unknown" ? "国家待标注" : code));
}
for (const [value, label] of [["all", "全部等级"], ["6", "VI 级"], ["7", "VII 级"], ["8", "VIII 级"]]) addFilter("ranks", "rank", value, label);
for (const [value, label] of eras) addFilter("eras", "era", value, label);
function fromHash() {
  const id = new URLSearchParams(location.hash.slice(1)).get("vehicle");
  const model = SAMPLE.models.find((entry) => entry.id === id);
  if (model && !matches(model)) {
    country = "all"; rank = "all"; era = "all";
    if (isSupplement(model)) { includeIs = true; $("include-is").checked = true; }
  }
  updateList(id);
}
$("include-is").addEventListener("change", () => { includeIs = $("include-is").checked; updateList(); });
$("reset-filters").addEventListener("click", () => { country = "all"; rank = "all"; era = "all"; includeIs = false; $("include-is").checked = false; updateList(); });
$("toggle-original").addEventListener("click", () => { original = !original; render(); });
window.addEventListener("hashchange", fromHash);
fromHash();
