// This standalone review uses the built data literal. It makes no API or account requests.
const $ = (id) => document.getElementById(id);
let selected = 0;
let point = 0;
let original = false;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function sourceLink(title, href, detail) {
  const article = element("div", undefined, "source-card");
  const link = element("a", title + " ↗");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  article.append(link, element("small", detail));
  return article;
}
function renderPoint() {
  const model = SAMPLE.models[selected];
  const pin = model.pins[point];
  $("point-title").textContent = pin.label;
  $("point-detail").textContent = pin.detail;
  for (const host of [$("pins"), $("pin-buttons")])
    [...host.children].forEach((button, index) => button.setAttribute("aria-pressed", String(index === point)));
}
function render() {
  const model = SAMPLE.models[selected];
  $("vehicle-name").textContent = model.name;
  $("vehicle-role").textContent = model.role;
  $("overview").textContent = model.overview;
  $("wiki-summary").textContent = model.wikiSummary;
  $("comparison").textContent = model.comparison;
  $("limits").textContent = model.limits;
  $("versions").textContent = `视频游戏版本 ${SAMPLE.source.gameVersion}；当前 Wiki 数据版本 ${model.wikiGameVersion}。尚未在当前客户端重新做保护分析。`;
  const image = $("photo");
  image.src = original ? model.rawUrl : model.imageUrl;
  image.alt = model.name + (original ? "原始防护分析视频帧" : "防护分析截图与区域标注");
  image.width = original ? 1920 : model.crop[2];
  image.height = original ? 1080 : model.crop[3];
  $("toggle-original").textContent = original ? "返回标注图" : "查看完整原始帧";
  $("toggle-original").setAttribute("aria-pressed", String(original));
  $("pins").hidden = original;
  $("pins").replaceChildren();
  $("pin-buttons").replaceChildren();
  model.pins.forEach((pin, index) => {
    const marker = element("button", undefined, "pin");
    marker.type = "button";
    marker.style.setProperty("--x", String(pin.x));
    marker.style.setProperty("--y", String(pin.y));
    marker.setAttribute("aria-label", `${index + 1} · ${pin.label}`);
    marker.append(element("b", String(index + 1)), element("span", pin.label));
    const alternative = element("button", `${index + 1} · ${pin.label}`);
    alternative.type = "button";
    const choose = () => { point = index; renderPoint(); };
    marker.addEventListener("click", choose);
    alternative.addEventListener("click", choose);
    $("pins").append(marker);
    $("pin-buttons").append(alternative);
  });
  const time = `${Math.floor(model.time / 60)}:${String(Math.floor(model.time % 60)).padStart(2, "0")}`;
  $("conditions").replaceChildren();
  for (const [label, value] of [["攻击来源", model.ammo.attacker], ["源视频弹种", model.ammo.shell], ["距离设置", `${model.ammo.rangeM} m`], ["弹药面板穿深", `${model.ammo.panelPenetrationMm} mm`], ["视频时间点", time], ["画面类型", "游戏防护分析"]])
    $("conditions").append(element("dt", label), element("dd", value));
  $("sources").replaceChildren(
    sourceLink("B 站 · " + SAMPLE.source.title, `${SAMPLE.source.url}?t=${Math.floor(model.time)}`, `${SAMPLE.source.author} · ${SAMPLE.source.publishedAt} · ${time} · 面板穿深不是被测装甲厚度`),
    sourceLink("官方 Wiki · " + model.name, model.wikiUrl, `核对日期 ${SAMPLE.collectedAt} · 车型、结构与基础数据对照`),
  );
  [...$("vehicles").children].forEach((button, index) => button.setAttribute("aria-pressed", String(index === selected)));
  renderPoint();
}
function select(index) {
  selected = index;
  point = 0;
  original = false;
  render();
}
for (const [index, model] of SAMPLE.models.entries()) {
  const button = element("button", model.name);
  button.type = "button";
  button.addEventListener("click", () => { location.hash = `vehicle=${model.id}`; });
  $("vehicles").append(button);
}
function fromHash() {
  const id = new URLSearchParams(location.hash.slice(1)).get("vehicle");
  const index = SAMPLE.models.findIndex((model) => model.id === id);
  select(index >= 0 ? index : 0);
}
$("toggle-original").addEventListener("click", () => { original = !original; render(); });
window.addEventListener("hashchange", fromHash);
fromHash();
