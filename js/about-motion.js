/* NODIFS – About page motion: background slideshow, scroll reveals, progress bar */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const icon = {
    prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    pause: '<svg class="i-pause" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
    play: '<svg class="i-play" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>'
  };

  /* ---------- Background slideshow ---------- */
  document.querySelectorAll("[data-slideshow]").forEach(root => {
    const slides = [...root.querySelectorAll(".slide")];
    if (slides.length < 2) return;

    let index = 0;
    let playing = !reduce;
    let hovering = false;

    const T = (key, fallback, vars) => (window.NODIFSi18n ? window.NODIFSi18n.t(key, fallback, vars) : fallback);
    const ui = document.createElement("div");
    ui.className = "container slideshow-ui";
    ui.innerHTML =
      `<p class="slide-caption" aria-live="polite"><b></b><span></span></p>` +
      `<div class="slide-controls">` +
      `<button type="button" class="sl-btn sl-prev" data-i18n-aria="about.prev" aria-label="Previous photo">${icon.prev}</button>` +
      `<div class="sl-dots">${slides.map((_, n) => `<button type="button" class="sl-dot" data-n="${n + 1}" aria-label="Show photo ${n + 1}"><i></i></button>`).join("")}</div>` +
      `<button type="button" class="sl-btn sl-next" data-i18n-aria="about.next" aria-label="Next photo">${icon.next}</button>` +
      `<button type="button" class="sl-btn sl-play" aria-label="Pause slideshow">${icon.pause}${icon.play}</button>` +
      `</div>`;
    root.appendChild(ui);
    const cue = document.createElement("span");
    cue.className = "scroll-cue";
    cue.setAttribute("aria-hidden", "true");
    root.appendChild(cue);

    const dots = [...ui.querySelectorAll(".sl-dot")];
    const caption = ui.querySelector(".slide-caption");
    const capNum = caption.querySelector("b");
    const capText = caption.querySelector("span");
    const playBtn = ui.querySelector(".sl-play");

    const pad = n => String(n).padStart(2, "0");
    const labels = () => {
      ui.querySelector(".sl-prev").setAttribute("aria-label", T("about.prev", "Previous photo"));
      ui.querySelector(".sl-next").setAttribute("aria-label", T("about.next", "Next photo"));
      playBtn.setAttribute("aria-label", playing ? T("about.pause", "Pause slideshow") : T("about.play", "Play slideshow"));
      dots.forEach(d => d.setAttribute("aria-label", T("about.photo", "Show photo {n}", { n: d.dataset.n })));
      root.setAttribute("aria-label", T("about.carousel", "Photos of life at NODIFS"));
    };
    const captionOf = el => { const f = el.querySelector("figcaption"); return f ? f.textContent : (el.dataset.caption || ""); };

    function renderState() {
      root.classList.toggle("is-paused", !playing || hovering);
      root.classList.toggle("is-manual", !playing);
      playBtn.classList.toggle("is-off", !playing);
      labels();
    }

    function show(n, first) {
      n = (n + slides.length) % slides.length;
      if (!first && n === index) return;
      if (!first) {
        const prev = slides[index];
        prev.classList.remove("is-active");
        prev.classList.add("is-leaving");
        clearTimeout(prev._t);
        prev._t = setTimeout(() => prev.classList.remove("is-leaving"), 2000);
      }
      index = n;
      const cur = slides[index];
      clearTimeout(cur._t);
      cur.classList.remove("is-leaving");
      cur.classList.add("is-active");
      dots.forEach((d, k) => {
        d.classList.remove("is-active");
        d.removeAttribute("aria-current");
      });
      void dots[index].offsetWidth;                /* restart the progress fill */
      dots[index].classList.add("is-active");
      dots[index].setAttribute("aria-current", "true");
      capNum.textContent = pad(index + 1);
      capText.textContent = captionOf(cur);
      caption.classList.remove("swap");
      void caption.offsetWidth;
      caption.classList.add("swap");
    }

    /* the progress bar's own CSS animation is the timer, so pause/hover stay perfectly in sync */
    ui.addEventListener("animationend", e => {
      if (e.animationName === "slFill" && playing) show(index + 1);
    });

    ui.querySelector(".sl-prev").addEventListener("click", () => show(index - 1));
    ui.querySelector(".sl-next").addEventListener("click", () => show(index + 1));
    dots.forEach((d, n) => d.addEventListener("click", () => show(n)));
    playBtn.addEventListener("click", () => { playing = !playing; renderState(); if (playing) show(index, false); });

    ui.addEventListener("mouseenter", () => { hovering = true; renderState(); });
    ui.addEventListener("mouseleave", () => { hovering = false; renderState(); });
    ui.addEventListener("focusin", () => { hovering = true; renderState(); });
    ui.addEventListener("focusout", () => { hovering = false; renderState(); });

    root.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });

    let startX = null;
    root.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    }, { passive: true });

    show(0, true);
    renderState();
    window.addEventListener("nodifs:language", () => { capText.textContent = captionOf(slides[index]); labels(); });

    /* gentle parallax on the photos while scrolling */
    if (!reduce) {
      const layer = root.querySelector(".slides");
      let ticking = false;
      addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = Math.min(Math.max(scrollY * 0.28, 0), 60);
          layer.style.transform = `translate3d(0,${y}px,0)`;
          ticking = false;
        });
      }, { passive: true });
    }
  });

  /* ---------- Scroll reveal ---------- */
  document.querySelectorAll("[data-stagger]").forEach(parent => {
    [...parent.children].forEach((child, k) => {
      child.classList.add("anim");
      child.style.setProperty("--d", k);
      if (!child.dataset.anim) child.dataset.anim = parent.dataset.stagger || "up";
    });
  });
  document.querySelectorAll("[data-anim]").forEach(el => el.classList.add("anim"));
  const items = [...document.querySelectorAll(".anim")];
  const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }) : null;
  const reveal = el => { el.classList.add("anim"); io ? io.observe(el) : el.classList.add("in"); };
  items.forEach(reveal);
  window.NODIFSMotion = { reveal };

  /* ---------- Scrolling words band follows the chosen language ---------- */
  function buildMarquee() {
    const track = document.querySelector(".marquee-track");
    if (!track || !window.NODIFSi18n) return;
    const t = window.NODIFSi18n.t;
    const motto = (t("footer.motto", "Learn · Connect · Grow") || "").split("·").map(s => s.trim()).filter(Boolean);
    const words = [t("about.v2t", "Curiosity"), t("about.v3t", "Respect"), t("about.v4t", "Excellence"), t("about.v1t", "Global-mindedness")].concat(motto);
    const row = words.concat(words);                                    /* repeated so one group is wider than the screen */
    const group = () => {
      const g = document.createElement("div");
      g.className = "marquee-group";
      row.forEach(w => {
        const s = document.createElement("span"); s.textContent = w;
        const e = document.createElement("em"); e.textContent = "✦";
        g.append(s, e);
      });
      return g;
    };
    track.replaceChildren(group(), group());
  }

  /* ---------- Language change: re-split the headline, soft fade on user switch ---------- */
  let userSwitched = false;
  document.addEventListener("click", e => { if (e.target.closest(".language-option")) userSwitched = true; });
  window.addEventListener("nodifs:language", () => {
    buildMarquee();
    const h1 = document.querySelector(".hero-slideshow h1");
    if (h1) {
      const words = h1.textContent.trim().split(/\s+/);
      h1.replaceChildren();
      words.forEach((w, k) => {
        const span = document.createElement("span");
        span.className = "w";
        span.style.setProperty("--d", k + 1);
        span.textContent = w;
        h1.append(span, k < words.length - 1 ? " " : "");
      });
    }
    if (userSwitched) {
      userSwitched = false;
      document.documentElement.classList.add("lang-flash");
      setTimeout(() => document.documentElement.classList.remove("lang-flash"), 700);
    }
  });

  /* ---------- Reading progress bar ---------- */
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  let barTick = false;
  const updateBar = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
    barTick = false;
  };
  addEventListener("scroll", () => { if (!barTick) { barTick = true; requestAnimationFrame(updateBar); } }, { passive: true });
  updateBar();
})();
