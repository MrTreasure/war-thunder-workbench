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
  fetch(api + "/public-data/manifest/appearance", { credentials: "omit", signal: AbortSignal.timeout(5000) })
    .then(function (response) { if (!response.ok) throw new Error("appearance"); return response.json(); })
    .then(async function (manifest) {
      if (manifest.schemaVersion !== 1 || manifest.resource !== "appearance" || !/^[a-f0-9]{64}$/.test(manifest.sha256) || manifest.path !== "public-data/objects/" + manifest.sha256 || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1 || manifest.bytes > 16384) throw new Error("appearance manifest");
      var response = await fetch(api + "/" + manifest.path, { credentials: "omit", cache: "force-cache", signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("appearance object");
      var bytes = await response.arrayBuffer();
      var hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(function (v) { return v.toString(16).padStart(2, "0"); }).join("");
      if (bytes.byteLength !== manifest.bytes || hash !== manifest.sha256) throw new Error("appearance hash");
      return JSON.parse(new TextDecoder().decode(bytes));
    })
    .then(function (value) {
      if (!valid(value)) return;
      var image = new Image();
      image.onload = function () { apply(value); try { localStorage.setItem(key, JSON.stringify({ value: value, savedAt: Date.now() })); } catch (_) {} };
      image.onerror = function () { /* Preserve the previous artwork on a failed update. */ };
      image.src = value.backgroundUrl;
    }).catch(function () { /* The built-in or last saved theme remains available. */ });
})(__WT_APPEARANCE_DEFAULT__, __WT_APPEARANCE_API__);
