(function (defaults, api) {
  var key = "wt-workbench-appearance-v1", ttl = 300000;
  function valid(value) {
    if (!value || typeof value.theme !== "string" || !Number.isInteger(value.positionX) || !Number.isInteger(value.positionY) || value.positionX < 0 || value.positionX > 100 || value.positionY < 0 || value.positionY > 100) return false;
    try { var url = new URL(value.backgroundUrl); return url.protocol === "https:" && url.host === "staticfiles.warthunder.com" && !url.search && !url.hash && /^\/upload\/image\/[A-Za-z0-9_.\/-]+\.(jpg|jpeg|png|webp)$/i.test(url.pathname); } catch (_) { return false; }
  }
  var appliedUrl;
  function apply(value) {
    appliedUrl = value.backgroundUrl;
    document.documentElement.style.setProperty("--wt-loading-background-image", "url(" + JSON.stringify(value.backgroundUrl) + ")");
    document.documentElement.style.setProperty("--wt-loading-background-position", value.positionX + "% " + value.positionY + "%");
  }
  apply(defaults);
  var cached;
  try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
  if (cached && valid(cached.value)) {
    apply(cached.value);
    var previousImage = new Image();
    previousImage.onerror = function () { if (appliedUrl === cached.value.backgroundUrl) apply(defaults); };
    previousImage.src = cached.value.backgroundUrl;
  }
  if (cached && valid(cached.value) && cached.savedAt <= Date.now() && Date.now() - cached.savedAt < ttl) return;
  fetch(api + "/appearance", { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(5000) })
    .then(function (response) { if (!response.ok) throw new Error("appearance"); return response.json(); })
    .then(function (value) {
      if (!valid(value)) return;
      var image = new Image();
      image.onload = function () { apply(value); try { localStorage.setItem(key, JSON.stringify({ value: value, savedAt: Date.now() })); } catch (_) {} };
      image.onerror = function () { /* Preserve the previous artwork on a failed update. */ };
      image.src = value.backgroundUrl;
    }).catch(function () { /* The built-in or last saved theme remains available. */ });
})(__WT_APPEARANCE_DEFAULT__, __WT_APPEARANCE_API__);
