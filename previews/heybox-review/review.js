const pages = JSON.parse(document.getElementById("screens").textContent);
function select(index) {
  const page = pages[index];
  if (!page) return;
  document.getElementById("shot").src = page.src;
  document.getElementById("shot").alt = page.title + "，" + page.device + " 实际截图";
  document.getElementById("original").href = page.src;
  document.getElementById("shot-title").textContent = page.title;
  document.getElementById("shot-device").textContent = page.device;
  document.getElementById("shot-note").textContent = page.note;
  document.getElementById("page-select").value = String(index);
  document
    .querySelectorAll("[data-page]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(Number(button.dataset.page) === index)),
    );
}
document
  .querySelectorAll("[data-page]")
  .forEach((button) => button.addEventListener("click", () => select(Number(button.dataset.page))));
document
  .getElementById("page-select")
  .addEventListener("change", (event) => select(Number(event.target.value)));
const initialPage = Number(new URLSearchParams(location.search).get("page") || 0);
select(Number.isInteger(initialPage) && pages[initialPage] ? initialPage : 0);
