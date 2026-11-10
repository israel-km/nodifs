/* NODIFS – news feed (home preview, ticker, news page, article panel).
   Articles live in data/news.json. Each article has English text at the top level and optional
   "translations": { fr: {title, excerpt, body, ticker}, sw: {...}, ... }.  Missing languages fall back to English. */
(() => {
  let articles = [];
  let filter = "All";
  let openId = null;

  const lang = () => document.documentElement.lang || "en";
  const T = (key, fallback) => (window.NODIFSi18n ? window.NODIFSi18n.t(key, fallback) : fallback);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* article text in the visitor's language (English if that translation is missing) */
  const loc = a => Object.assign({}, a, (a.translations && a.translations[lang()]) || {});

  const categoryLabel = c => (c === "Academics" ? T("nav.academics", c) : T("cat." + c, c));

  /* Lingala and Luganda month names are built in, because many browsers have no date data for them */
  const MONTHS = {
    ln: ["yanwáli", "febwáli", "mársi", "apríli", "mai", "yuni", "yuli", "agosto", "sɛtɛ́mbɛ", "ɔkɔtɔ́bɛ", "novɛ́mbɛ", "desɛ́mbɛ"],
    lg: ["Janwali", "Febwali", "Marisi", "Apuli", "Maayi", "Juuni", "Julaayi", "Agusito", "Sebutemba", "Okitobba", "Novemba", "Desemba"]
  };

  function dateLabel(a) {
    try {
      const code = lang();
      const d = new Date(a.date + "T00:00:00");
      if (MONTHS[code]) return `${d.getDate()} ${MONTHS[code][d.getMonth()]} ${d.getFullYear()}`;
      const locale = Intl.DateTimeFormat.supportedLocalesOf([code]).length ? code : "en";
      return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(d);
    } catch (_) { return a.dateLabel; }
  }

  const meta = a => `<div class="news-meta"><span class="category">${esc(categoryLabel(a.category))}</span><span>•</span><time datetime="${esc(a.date)}">${esc(dateLabel(a))}</time></div>`;
  const readMore = () => esc(T("news.read", "Read more →"));

  async function load() {
    try {
      const r = await fetch("data/news.json");
      if (!r.ok) throw new Error("Could not load news");
      articles = await r.json();
    } catch (_) {
      articles = [];
      document.querySelectorAll("#home-news,#news-list,#news-ticker").forEach(el => {
        el.innerHTML = `<p class="quiet-note">${esc(T("np.unavailable", "News is temporarily unavailable. Please refresh or try again later."))}</p>`;
      });
      return;
    }
    renderAll();
    const id = new URLSearchParams(location.search).get("id");
    if (id) openArticle(id, false);
  }

  function renderAll() { renderHome(); renderTicker(); renderList(); if (openId) openArticle(openId, false); }

  function renderTicker() {
    const el = document.querySelector("#news-ticker");
    if (!el || !articles.length) return;
    const lines = articles.map(a => `<span>${esc(loc(a).ticker || loc(a).title)}</span>`);
    el.innerHTML = lines.concat(lines).join("");
    const length = lines.join("").length;
    el.style.animationDuration = Math.max(28, Math.min(85, length * 0.075)) + "s";
  }

  function renderHome() {
    const el = document.querySelector("#home-news");
    if (!el) return;
    el.innerHTML = articles.slice(0, 3).map(raw => {
      const a = loc(raw);
      return `<article class="news-card reveal visible"><div class="news-thumb" aria-hidden="true">${esc(a.emoji)}</div><div class="news-card-body">${meta(a)}<h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p><a class="text-link" href="news.html?id=${encodeURIComponent(a.id)}">${readMore()}</a></div></article>`;
    }).join("");
  }

  function renderList() {
    const el = document.querySelector("#news-list");
    if (!el) return;
    const list = filter === "All" ? articles : articles.filter(a => a.category === filter);
    if (!list.length) {
      el.innerHTML = `<div class="empty-news">${esc(T("np.empty", "No news items are available in this category yet."))}</div>`;
      return;
    }
    el.innerHTML = list.map(raw => {
      const a = loc(raw);
      return `<article class="news-row" role="button" tabindex="0" data-id="${esc(a.id)}" aria-label="${esc(a.title)}"><div class="news-row-thumb" aria-hidden="true">${esc(a.emoji)}</div><div class="news-row-content">${meta(a)}<h2>${esc(a.title)}</h2><p>${esc(a.excerpt)}</p><span class="text-link">${readMore()}</span></div></article>`;
    }).join("");
    el.querySelectorAll(".news-row").forEach(row => {
      row.addEventListener("click", () => openArticle(row.dataset.id));
      row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openArticle(row.dataset.id); } });
    });
  }

  function openArticle(id, update = true) {
    const raw = articles.find(x => x.id === id);
    if (!raw) return;
    const a = loc(raw);
    const panel = document.querySelector("#article-panel");
    const backdrop = document.querySelector("#article-backdrop");
    const content = document.querySelector("#article-content");
    if (!panel || !content) return;
    openId = id;
    content.className = "article-content";
    content.innerHTML = `<div class="article-emoji">${esc(a.emoji)}</div>${meta(a)}<h1>${esc(a.title)}</h1><p class="article-body">${esc(a.body)}</p>`;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    backdrop?.classList.add("open");
    document.body.classList.add("no-scroll");
    if (update) history.replaceState(null, "", `news.html?id=${encodeURIComponent(a.id)}`);
  }

  function closeArticle() {
    openId = null;
    const panel = document.querySelector("#article-panel");
    const backdrop = document.querySelector("#article-backdrop");
    panel?.classList.remove("open");
    panel?.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("open");
    document.body.classList.remove("no-scroll");
    if (location.pathname.endsWith("news.html") && new URLSearchParams(location.search).has("id")) history.replaceState(null, "", "news.html");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#news-filters")?.addEventListener("click", e => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      filter = b.dataset.filter;
      document.querySelectorAll(".filter-chip").forEach(x => x.classList.toggle("active", x === b));
      renderList();
    });
    document.querySelector("#article-close")?.addEventListener("click", closeArticle);
    document.querySelector("#article-backdrop")?.addEventListener("click", closeArticle);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeArticle(); });
    load();
  });

  /* re-render everything in the new language when the visitor switches */
  window.addEventListener("nodifs:language", () => { if (articles.length) renderAll(); });
})();
