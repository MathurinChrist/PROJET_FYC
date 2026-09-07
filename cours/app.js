const articles = [...document.querySelectorAll("article[data-id]")];
const links = [...document.querySelectorAll("nav a[href^='#']")];
const prevBtn = document.querySelector("[data-prev]");
const nextBtn = document.querySelector("[data-next]");

function show(id) {
  const article = articles.find((a) => a.dataset.id === id) || articles[0];
  articles.forEach((a) => a.classList.toggle("visible", a === article));
  links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + article.dataset.id));
  const idx = articles.indexOf(article);
  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = idx >= articles.length - 1;
  prevBtn.dataset.target = idx > 0 ? articles[idx - 1].dataset.id : "";
  nextBtn.dataset.target = idx < articles.length - 1 ? articles[idx + 1].dataset.id : "";
  history.replaceState(null, "", "#" + article.dataset.id);
  article.closest("main")?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

function currentId() {
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  return articles.some((a) => a.dataset.id === hash) ? hash : articles[0].dataset.id;
}

document.querySelector("nav").addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#']");
  if (!a) return;
  e.preventDefault();
  show(a.getAttribute("href").slice(1));
});

prevBtn.addEventListener("click", () => prevBtn.dataset.target && show(prevBtn.dataset.target));
nextBtn.addEventListener("click", () => nextBtn.dataset.target && show(nextBtn.dataset.target));

window.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key === "ArrowRight" || e.key === "j") nextBtn.click();
  if (e.key === "ArrowLeft" || e.key === "k") prevBtn.click();
});

show(currentId());
window.addEventListener("hashchange", () => show(currentId()));
