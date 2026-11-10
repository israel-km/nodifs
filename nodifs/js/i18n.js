/* NODIFS – language engine.
   - Translates every element with data-i18n (text), data-i18n-placeholder, data-i18n-aria, data-i18n-title.
   - Keys are flat ("nav.home") and live in lang/<code>.json. Missing keys fall back to English.
   - Remembers the visitor's choice and announces changes with the "nodifs:language" event,
     so dynamic parts (news, team, chat…) can re-render themselves. */
(() => {
  const supported = ["en", "fr", "sw", "ln", "lg"];
  const names = { en: ["English", "English"], fr: ["Français", "French"], sw: ["Kiswahili", "Swahili"], ln: ["Lingála", "Lingala"], lg: ["Luganda", "Luganda"] };
  const store = {
    get() { try { return localStorage.getItem("nodifs_lang"); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem("nodifs_lang", v); } catch (_) { /* private mode */ } }
  };
  let dictionary = {};
  let english = {};
  let current = "en";
  let englishPromise = null;

  const get = (obj, path) => (obj && obj[path] !== undefined) ? obj[path]
    : path.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), obj);

  const lookup = key => {
    const v = get(dictionary, key);
    return typeof v === "string" ? v : (typeof get(english, key) === "string" ? get(english, key) : undefined);
  };

  /* t("key", "English fallback", {n: 3}) */
  function t(key, fallback, vars) {
    let text = lookup(key);
    if (text === undefined) text = fallback;
    if (text !== undefined && vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return text;
  }

  function apply(root = document) {
    const each = (selector, fn) => {
      if (root.matches && root.matches(selector)) fn(root);
      root.querySelectorAll(selector).forEach(fn);
    };
    each("[data-i18n]", el => { const v = lookup(el.dataset.i18n); if (v !== undefined) el.textContent = v; });
    each("[data-i18n-placeholder]", el => { const v = lookup(el.dataset.i18nPlaceholder); if (v !== undefined) el.setAttribute("placeholder", v); });
    each("[data-i18n-aria]", el => { const v = lookup(el.dataset.i18nAria); if (v !== undefined) el.setAttribute("aria-label", v); });
    each("[data-i18n-title]", el => { const v = lookup(el.dataset.i18nTitle); if (v !== undefined) el.setAttribute("title", v); });
  }

  async function fetchJSON(code) {
    const response = await fetch(`lang/${code}.json`);
    if (!response.ok) throw new Error("Language file unavailable");
    return response.json();
  }

  async function loadLanguage(code) {
    const actual = supported.includes(code) ? code : "en";
    if (!englishPromise) englishPromise = fetchJSON("en").then(d => { english = d; }).catch(() => {});
    await englishPromise;
    try { dictionary = actual === "en" ? english : await fetchJSON(actual); }
    catch (_) { dictionary = {}; }
    current = actual;
    document.documentElement.lang = actual;
    apply(document);
    store.set(actual);
    const label = document.querySelector("#language-current");
    if (label) label.textContent = names[actual][0];
    document.querySelectorAll(".language-option").forEach(b => {
      const on = b.dataset.lang === actual;
      b.classList.toggle("selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
    window.dispatchEvent(new CustomEvent("nodifs:language", { detail: { code: actual } }));
  }

  function makeMenu() {
    const mount = document.querySelector("#language-menu");
    if (!mount) return;
    mount.innerHTML =
      `<div class="language-group" data-i18n="lang.choose">Choose your language</div>` +
      supported.map(code => `<button type="button" class="language-option" data-lang="${code}" lang="${code}"><span>${names[code][0]}</span><span>${names[code][1]}</span></button>`).join("");
    mount.addEventListener("click", e => {
      const b = e.target.closest("[data-lang]");
      if (!b) return;
      loadLanguage(b.dataset.lang);
      mount.classList.remove("open");
      document.querySelector("#language-toggle")?.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    makeMenu();
    const toggle = document.querySelector("#language-toggle");
    const menu = document.querySelector("#language-menu");
    toggle?.addEventListener("click", e => {
      e.stopPropagation();
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", e => {
      if (menu && !menu.contains(e.target) && !toggle?.contains(e.target)) {
        menu.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && menu?.classList.contains("open")) { menu.classList.remove("open"); toggle?.focus(); }
    });
    loadLanguage(store.get() || "en");
  });

  window.NODIFSi18n = { loadLanguage, apply, t, current: () => current, supported };
})();
