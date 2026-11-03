// This standalone review uses the built data literal. It makes no API or account requests.
const $ = (id) => document.getElementById(id);
const countries = { usa: "美国", germany: "德国", ussr: "苏联", britain: "英国", japan: "日本", china: "中国", italy: "意大利", france: "法国", sweden: "瑞典", israel: "以色列" };
const countryEntries = SAMPLE.countries || [];
const filterSelects = [];
const eras = [["all", "全部年代"], ["ww2", "二战"], ["cold-war", "冷战"], ["modern", "现代"]];
let selected = -1;
let point = 0;
let original = false;
let evidenceId = null;
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
function sourceOf(model) {
  if (model.source) return model.source;
  if (model.source === null || (!model.imageUrl && !model.rawUrl && !model.frame)) return {};
  return SAMPLE.source || {};
}
function selectedEvidence(model) { return model?.protectionEvidence?.find((item) => item.id === evidenceId) || null; }
function shellTypeLabel(test) {
  const code = test?.shellTypeCode?.trim();
  const label = test?.shellTypeLabel?.trim();
  return [code, label && label !== code ? label : null].filter(Boolean).join(" · ") || "来源未显示／待核对";
}
function penetrationLabel(test) {
  const penetration = test?.displayedPenetrationMm;
  const distance = test?.distanceMeters;
  return Number.isFinite(penetration)
    ? `${penetration} 毫米${Number.isFinite(distance) ? `（${distance} 米）` : "（距离待核对）"}`
    : `来源未显示／待核对${Number.isFinite(distance) ? `（${distance} 米）` : ""}`;
}
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
  const evidence = selectedEvidence(SAMPLE.models[selected]);
  $("point-kind").textContent = evidence ? "防护分析证据" : "选中标注";
  if (evidence) {
    $("point-title").textContent = evidence.label;
    $("point-detail").textContent = evidence.description;
    return;
  }
  const pin = SAMPLE.models[selected]?.pins?.[point];
  const model = SAMPLE.models[selected];
  const summary = model?.frontSummary || model?.videoAdvice?.[0]?.text;
  if (!pin && summary) $("point-kind").textContent = "整体打法";
  $("point-title").textContent = pin?.label || (summary ? (sourceOf(model || {}).kind === "forum-image" ? "来源打法摘要" : "视频打法摘要") : "尚无标注");
  $("point-detail").textContent = pin?.detail || summary || "该车型的攻击位置说明尚未补充。";
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
  const staticSource = source.kind === "forum-image";
  const evidence = selectedEvidence(model);
  const imageViews = $("image-views");
  const views = [{ id: null, label: model.mainViewKind === "protection-analysis" ? "防护分析" : "外观与标注" }, ...(model.protectionEvidence || [])];
  imageViews.hidden = views.length < 2;
  imageViews.replaceChildren(...views.map((view) => {
    const button = element("button", view.label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(view.id === evidenceId));
    button.addEventListener("click", () => { evidenceId = view.id; original = false; render(); });
    return button;
  }));
  $("vehicle-name").textContent = model.name;
  const metadata = [model.role, model.countryName || countries[model.country], model.rank ? `Rank ${model.rank}` : null, isSupplement(model) ? "IS 系列补充" : null, model.coverageNotice].filter(Boolean);
  $("vehicle-role").textContent = metadata.join(" · ");
  $("wiki-summary").textContent = model.wikiSummary || "Wiki 要点待核对。";
  $("wiki-points").replaceChildren(...(model.wikiPoints || []).map((text) => element("li", text)));
  $("reload-time").textContent = model.reload?.display || "待核对";
  $("reload-gun").textContent = model.reload?.gun || "";
  $("reload-note").textContent = model.reload?.note || "";
  const test = evidence ? model.testCases?.find((item) => item.id === evidence.caseId) : model.testContext;
  const hasVideoTest = !!(model.frame || test || (source.url && model.videoAdvice?.length));
  $("test-section").hidden = !hasVideoTest;
  $("test-attacker").textContent = test?.attacker?.trim() || "来源未显示／待核对";
  $("test-shell").textContent = test?.shell?.trim() || "来源未显示／待核对";
  $("test-shell-type").textContent = shellTypeLabel(test);
  $("test-penetration").textContent = penetrationLabel(test);
  const testNote = evidence ? evidence.conditionNote : test?.note;
  $("test-note").textContent = testNote || "";
  $("test-note").hidden = !testNote;
  const staticTest = test?.sourceKind === "forum-image";
  const testHref = staticTest ? videoUrl({ url: test.sourceUrl || source.url }) : Number.isFinite(test?.sourceTime) ? videoUrl({ url: test.sourceUrl || source.url }, test.sourceTime) : null;
  $("test-link").hidden = !testHref;
  if (testHref) {
    $("test-link").href = testHref;
    $("test-link").textContent = staticTest ? "查看原帖证据 ↗" : `查看测试片段 ${Math.floor(test.sourceTime / 60)}:${String(Math.floor(test.sourceTime % 60)).padStart(2, "0")} ↗`;
  } else $("test-link").removeAttribute("href");
  $("video-section").hidden = !model.videoAdvice?.length;
  $("video-advice").replaceChildren(...(model.videoAdvice || []).map((advice) => {
    const article = element("article", undefined, "advice");
    article.append(element("h4", advice.label), element("p", advice.text));
    const testCase = model.testCases?.find((item) => item.id === advice.caseId);
    if (testCase) article.append(element("p", [testCase.attacker || "攻击车辆待核对", testCase.shell || "炮弹待核对", testCase.shellTypeCode || "弹种待核对", penetrationLabel(testCase)].join(" · "), "case-summary"));
    const adviceTime = Number.isFinite(advice.sourceTime) ? advice.sourceTime : advice.time;
    const href = videoUrl({ url: advice.sourceUrl || testCase?.sourceUrl || source.url }, adviceTime);
    if (href) {
      const link = element("a", Number.isFinite(adviceTime) ? `${Math.floor(adviceTime / 60)}:${String(Math.floor(adviceTime % 60)).padStart(2, "0")} ↗` : advice.sourceKind === "forum-image" || staticSource ? "查看原帖 ↗" : "查看视频 ↗");
      link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
      article.append(link);
    }
    return article;
  }));
  const image = $("photo");
  const rawOnly = !model.imageUrl && !!model.rawUrl;
  const showRaw = original || rawOnly;
  const imageUrl = evidence?.imageUrl || (showRaw ? model.rawUrl : model.imageUrl);
  image.hidden = !imageUrl;
  $("image-status").hidden = !!imageUrl;
  const fallbackUrl = evidence?.imageFallbackUrl || (showRaw ? model.rawFallbackUrl : model.imageFallbackUrl);
  let triedFallback = false;
  image.onerror = () => {
    if (fallbackUrl && !triedFallback) { triedFallback = true; image.src = fallbackUrl; return; }
    imageMissing("高清正面图加载失败，请稍后重试；此图暂不显示标注。");
  };
  if (imageUrl) image.src = imageUrl;
  else { image.removeAttribute("src"); imageMissing("高清正面图尚未归档，此车型资料仍在补充。"); }
  image.alt = model.name + (evidence ? ` · ${evidence.label} · 防护分析画面` : showRaw ? staticSource ? "原帖完整防护分析截图" : "原始防护分析视频帧" : model.mainViewKind === "protection-analysis" ? "正面防护分析原图" : "正面截图与区域说明");
  image.width = evidence?.sourceDimensions?.[0] || (showRaw ? (model.sourceDimensions?.[0] || 1920) : (model.crop?.[2] || 1100));
  image.height = evidence?.sourceDimensions?.[1] || (showRaw ? (model.sourceDimensions?.[1] || 1080) : (model.crop?.[3] || 690));
  $("toggle-original").hidden = !!evidence || !(model.imageUrl && model.rawUrl);
  $("toggle-original").textContent = original ? "返回标注图" : "查看完整原始帧";
  $("toggle-original").setAttribute("aria-pressed", String(original));
  $("evidence-full").hidden = !evidence;
  if (evidence) $("evidence-full").href = evidence.rawUrl || evidence.imageUrl;
  else $("evidence-full").removeAttribute("href");
  const imageDescription = showRaw ? "当前为完整原始画面。" : model.mainViewKind === "protection-analysis" ? `${staticSource ? "原帖截图" : "原视频"}防护分析，保留游戏原始着色。` : model.pins?.length ? "金色编号为讲解标注。" : "来源载具外观。";
  const versionDescription = staticSource && source.gameVersion ? `截图版本 ${source.gameVersion}。` : "";
  $("figure-caption").textContent = evidence ? evidence.caption : imageUrl ? `画面：${source.author || "来源见下方"} / 《战争雷霆》。${imageDescription}${versionDescription}防护分析颜色对应当时的弹种与视角，条件见来源测试。` : "图像资料待补充，不以其他车型画面代替。";
  $("pins").hidden = !!evidence || showRaw || !imageUrl;
  $("pins").replaceChildren();
  $("pin-buttons").replaceChildren();
  $("pin-buttons").hidden = !!evidence;
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
  if (source.url) records.push(sourceLink(source.title || (staticSource ? "原帖来源" : "视频来源"), videoUrl(source, model.time), [source.author, source.publishedAt, source.gameVersion ? `游戏版本 ${source.gameVersion}` : null, Number.isFinite(model.time) ? `${Math.floor(model.time / 60)}:${String(Math.floor(model.time % 60)).padStart(2, "0")}` : null, model.imageQuality].filter(Boolean).join(" · ")));
  if (staticSource && source.imageUrl) records.push(sourceLink("原帖公开图片", source.imageUrl, "原始附件；高清归档保留同一截图的原生尺寸。"));
  const sourceUrls = new Set([source.url].filter(Boolean));
  for (const related of model.relatedSources || []) {
    if (!related.url || sourceUrls.has(related.url)) continue;
    const href = videoUrl(related, related.time);
    if (!href) continue;
    sourceUrls.add(related.url);
    records.push(sourceLink(related.title || "关联攻略", href, [related.author, related.publishedAt, related.scopeNote].filter(Boolean).join(" · ")));
  }
  if (model.wikiUrl) records.push(sourceLink("官方 Wiki · " + model.name, model.wikiUrl, `核对日期 ${model.collectedAt || SAMPLE.collectedAt || "待补充"} · 车型、装甲与主炮装填资料${model.wikiGameVersion ? ` · 游戏版本 ${model.wikiGameVersion}` : ""}`));
  const ammoReferences = new Map();
  for (const item of [test, ...(model.testCases || [])]) {
    const reference = item?.shellTypeReference;
    if (reference?.url) ammoReferences.set(reference.url + ":" + reference.officialShellName, reference);
  }
  for (const reference of ammoReferences.values()) records.push(sourceLink("测试弹种资料 · " + (reference.sourceShellLabelOriginal || reference.officialShellName), reference.url, ["官方 Wiki", reference.mainGun, reference.gameVersion ? `游戏版本 ${reference.gameVersion}` : null].filter(Boolean).join(" · ")));
  if (evidence) records.push(sourceLink("防护分析截图 · " + evidence.label, videoUrl({ url: test?.sourceUrl }, evidence.sourceTime), [evidence.caption, Number.isFinite(evidence.sourceTime) ? `${Math.floor(evidence.sourceTime / 60)}:${String(Math.floor(evidence.sourceTime % 60)).padStart(2, "0")}` : null].filter(Boolean).join(" · ")));
  $("sources").replaceChildren(...records);
  renderPoint();
}
function select(index) { selected = index; point = 0; original = false; evidenceId = SAMPLE.models[index]?.defaultEvidenceId || null; render(); }
function updateList(preferredId) {
  const visible = SAMPLE.models.filter(matches);
  for (const id of ["study", "source-section"]) $(id).hidden = !visible.length;
  $("empty-state").hidden = !!visible.length;
  const illustrated = visible.filter((model) => model.imageUrl).length;
  $("result-count").textContent = `${visible.length} 辆资料 · ${illustrated} 辆已配正面图 · ${visible.length - illustrated} 辆待补图${includeIs ? " · 已包含 IS 系列补充" : ""}`;
  const currentId = preferredId || SAMPLE.models[selected]?.id;
  const next = visible.find((model) => model.id === currentId) || visible[0];
  select(next ? SAMPLE.models.indexOf(next) : -1);
  vehicleSelect.setOptions(visible.map((model) => ({ value: model.id, label: model.name + (!model.imageUrl && !model.rawUrl ? " · 待补图" : "") })));
  filterSelects.forEach((control) => control.sync());
}
// Standalone equivalent of components/GameSelect: trigger focus + top-layer listbox.
function createFilter(host, kind, entries, labelledBy) {
  const trigger = element("button", undefined, "wt-select");
  trigger.type = "button"; trigger.id = `${kind}-trigger`;
  trigger.setAttribute("role", "combobox"); trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-labelledby", `${labelledBy} ${kind}-value`);
  const valueLabel = element("span", undefined, "wt-select-label"); valueLabel.id = `${kind}-value`;
  // Exact geometry and dimensions from src/components/Chevron.tsx.
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries({ class: `wt-chevron wt-select-chevron${kind === "country" ? " country-chevron" : ""}`, width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", focusable: "false" })) chevron.setAttribute(name, value);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  for (const [name, value] of Object.entries({ d: "m4 6 4 4 4-4", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round" })) path.setAttribute(name, value);
  chevron.append(path);
  trigger.append(valueLabel, chevron);
  const menu = element("div", undefined, "wt-select-menu"); menu.id = `${kind}-menu`;
  menu.setAttribute("role", "listbox"); menu.setAttribute("popover", "auto");
  menu.setAttribute("aria-labelledby", trigger.id); menu.hidden = true;
  $(host).append(trigger, menu);
  let open = false, active = 0, search = "", searchAt = 0;
  const current = () => kind === "vehicle" ? SAMPLE.models[selected]?.id || "" : ({ country, rank, era }[kind]);
  function content(entry) {
    const row = element("span", undefined, "select-option-label");
    const flags = entry.flagUrl ? [entry.flagUrl] : [];
    if (flags.length) {
      const icons = element("span", undefined, "country-icon");
      icons.setAttribute("aria-hidden", "true");
      flags.forEach((url) => { const image = element("img"); image.src = url; image.alt = ""; image.width = 24; image.height = 18; icons.append(image); });
      row.append(icons);
    }
    row.append(element("span", entry.label)); return row;
  }
  let options = [];
  function setOptions(nextEntries) {
    close(); entries = nextEntries;
    options = entries.map((entry, index) => {
    const option = element("div", undefined, "wt-select-option"); option.id = `${menu.id}-${index}`;
    option.setAttribute("role", "option"); option.tabIndex = -1;
    option.append(element("span", "", "wt-select-check"), content(entry));
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse") setActive(index); });
    option.addEventListener("click", () => choose(index));
    return option;
    });
    menu.replaceChildren(...options); sync();
  }
  function setActive(index) {
    active = index;
    options.forEach((option, i) => option.setAttribute("data-active", String(i === active)));
    trigger.setAttribute("aria-activedescendant", options[active].id);
    options[active].scrollIntoView({ block: "nearest" });
  }
  function sync() {
    const chosen = entries.findIndex((entry) => entry.value === current());
    trigger.disabled = !entries.length;
    valueLabel.replaceChildren(content(entries[Math.max(0, chosen)] || { label: "暂无符合条件的车型" }));
    options.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === chosen));
      option.children[0].textContent = index === chosen ? "✓" : "";
    });
    trigger.setAttribute("aria-expanded", String(open));
  }
  function close() {
    open = false;
    if (menu.hidePopover && !menu.hidden) menu.hidePopover();
    menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); trigger.removeAttribute("aria-activedescendant");
  }
  function place() {
    if (!open) return;
    const rect = trigger.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || document.documentElement.clientWidth, height = viewport?.height || window.innerHeight;
    const below = top + height - rect.bottom - 12, above = rect.top - top - 12;
    const up = below < Math.min(menu.scrollHeight, 240) && above > below;
    const popupWidth = Math.min(Math.max(rect.width, kind === "country" ? 196 : 160), width - 16);
    const maxHeight = Math.max(44, Math.min(344, up ? above : below));
    Object.assign(menu.style, { width: `${popupWidth}px`, maxHeight: `${maxHeight}px`, left: `${Math.max(left + 8, Math.min(rect.left, left + width - popupWidth - 8))}px`, top: `${up ? Math.max(top + 8, rect.top - Math.min(menu.scrollHeight, maxHeight) - 4) : rect.bottom + 4}px` });
  }
  function show(index = entries.findIndex((entry) => entry.value === current())) {
    if (!entries.length) return;
    filterSelects.forEach((control) => control.close());
    open = true; menu.hidden = false; menu.showPopover?.();
    trigger.setAttribute("aria-expanded", "true"); place(); setActive(Math.max(0, index));
  }
  function choose(index) {
    if (!entries[index]) return;
    const value = entries[index].value;
    if (kind === "country") country = value;
    if (kind === "rank") rank = value;
    if (kind === "era") era = value;
    if (kind === "vehicle") location.hash = `vehicle=${value}`;
    close(); updateList(kind === "vehicle" ? value : undefined); trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener("click", () => open ? close() : show());
  trigger.addEventListener("blur", close);
  trigger.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (!entries.length) return;
    const chosen = Math.max(0, entries.findIndex((entry) => entry.value === current()));
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Escape") close();
      else if (event.key === "Enter" || event.key === " ") { if (open) choose(active); else show(); }
      else {
        const index = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : ((open ? active : chosen) + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length;
        if (open) setActive(index); else show(event.key === "Home" || event.key === "End" ? index : chosen);
      }
    } else if (event.key === "Tab") close();
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now(); search = now - searchAt > 700 ? event.key : search + event.key; searchAt = now;
      const repeated = [...search].every((char) => char === search[0]);
      const needle = (repeated ? search[0] : search).toLocaleLowerCase();
      const start = repeated ? (open ? active : chosen) + 1 : (open ? active : chosen);
      const index = entries.map((_, offset) => (start + offset) % entries.length).find((i) => entries[i].label.toLocaleLowerCase().startsWith(needle));
      if (index !== undefined) { event.preventDefault(); if (open) setActive(index); else show(index); }
    }
  });
  menu.addEventListener("toggle", (event) => { if (event.newState === "closed" && open) close(); });
  document.addEventListener("pointerdown", (event) => { if (open && !menu.contains(event.target) && !trigger.contains(event.target)) close(); });
  window.addEventListener("resize", place);
  window.addEventListener("scroll", (event) => { if (event.target !== menu) place(); }, true);
  window.visualViewport?.addEventListener("resize", place); window.visualViewport?.addEventListener("scroll", place);
  const control = { sync, close, setOptions };
  filterSelects.push(control); setOptions(entries); return control;
}
createFilter("countries", "country", [{ value: "all", label: "全部国家" }, ...countryEntries.map((entry) => ({ value: entry.id, label: entry.name, flagUrl: entry.flagUrl }))], "country-label");
createFilter("ranks", "rank", [["all", "全部等级"], ["6", "VI 级"], ["7", "VII 级"], ["8", "VIII 级"]].map(([value, label]) => ({ value, label })), "rank-label");
createFilter("eras", "era", eras.map(([value, label]) => ({ value, label })), "era-label");
const vehicleSelect = createFilter("vehicles", "vehicle", [], "vehicle-label");
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
