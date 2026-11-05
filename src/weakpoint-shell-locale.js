/** Translate fixed interface labels only; source prose, titles and vehicle records remain verbatim. */
const root = document.documentElement;
const messages = JSON.parse(root.dataset.wtMessages || "{}");
const protectedContent =
  "#wiki-summary, #wiki-points, #video-advice, #sources, #point-detail, #point-title, #green-note, #figure-caption, #test-note, #reload-note, #base-reference";
const translate = (value) => {
  const trimmed = value.trim();
  return Object.hasOwn(messages, trimmed) ? value.replace(trimmed, messages[trimmed]) : value;
};
function contextual(value, parent) {
  const patterns = [
    [
      /^待补绿区清单 · 当前国家／等级／搜索 (\d+) 辆$/,
      "待补绿区清单 · 当前国家／等级／搜索 {0} 辆",
    ],
    [
      /^(\d+) 辆资料 · (\d+) 辆已配正面图 · (\d+) 辆待补图 · (\d+) 辆有局部绿区 · (\d+) 辆仅单点$/,
      "{0} 辆资料 · {1} 辆已配正面图 · {2} 辆待补图 · {3} 辆有局部绿区 · {4} 辆仅单点",
    ],
  ];
  if (parent?.closest("#result-count, #missing-summary")) {
    for (const [pattern, key] of patterns) {
      const match = value.match(pattern);
      if (match && messages[key])
        return messages[key].replace(/\{(\d+)\}/g, (_, index) => match[Number(index) + 1]);
    }
  }
  if (parent?.closest("#test-penetration, #reload-time"))
    return value.replace(
      /来源未显示／待核对|（距离待核对）|毫米|米|秒/g,
      (unit) => messages[unit] || unit,
    );
  return translate(value);
}
function visit(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!node.parentElement?.closest(`script, style, ${protectedContent}`)) {
      const next = contextual(node.nodeValue || "", node.parentElement);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    return;
  }
  if (!(node instanceof Element) || node.closest(`script, style, ${protectedContent}`)) return;
  for (const attribute of ["aria-label", "title", "placeholder"]) {
    const value = node.getAttribute(attribute);
    if (value) {
      const next = translate(value);
      if (next !== value) node.setAttribute(attribute, next);
    }
  }
  for (const child of node.childNodes) visit(child);
}
visit(document.body);
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "characterData" || record.type === "attributes") visit(record.target);
    else for (const node of record.addedNodes) visit(node);
  }
}).observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-label", "title", "placeholder"],
});
