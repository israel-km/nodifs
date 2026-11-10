/* NODIFS – Team section: builds cards from data/team.json, follows the chosen language,
   shows initials if a photo is missing, and adds "Read more" to long biographies. */
(() => {
  const grid = document.querySelector("#team-grid");
  if (!grid) return;

  const T = (key, fallback) => (window.NODIFSi18n && window.NODIFSi18n.t && window.NODIFSi18n.t(key)) || fallback;
  const lang = () => document.documentElement.lang || "en";
  const pick = (obj, code) => (obj && (obj[code] || obj.en)) || "";
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  let cards = [];

  function build(person, i) {
    const card = document.createElement("article");
    card.className = "team-card";
    card.dataset.anim = "zoom";
    card.style.setProperty("--d", i % 3);

    const photo = document.createElement("div");
    photo.className = "team-photo";
    const showInitials = () => {
      photo.classList.add("no-photo");
      photo.innerHTML = `<span aria-hidden="true">${initials(person.name)}</span>`;
    };
    if (person.photo) {
      const img = new Image();
      img.alt = person.name;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", showInitials);
      img.src = person.photo;
      photo.appendChild(img);
    } else showInitials();

    const body = document.createElement("div");
    body.className = "team-body";
    const bioId = `bio-${i}`;
    body.innerHTML =
      `<h3></h3><p class="team-role"></p>` +
      `<div class="bio" id="${bioId}"><p></p></div>` +
      `<button type="button" class="bio-toggle" aria-expanded="false" aria-controls="${bioId}" hidden><span></span>${chevron}</button>`;
    body.querySelector("h3").textContent = person.name;

    card.append(photo, body);
    const entry = { person, card, bio: body.querySelector(".bio"), btn: body.querySelector(".bio-toggle"), open: false };
    entry.btn.addEventListener("click", () => toggle(entry));
    return entry;
  }

function measure(entry){
  const {bio,btn}=entry;
  entry.open=false;
  bio.classList.remove("is-open","is-clamped");
  btn.hidden=true;
  btn.setAttribute("aria-expanded","false");
  btn.firstElementChild.textContent=T("about.readMore","Read more");
  if(bio.firstElementChild.scrollHeight>bio.clientHeight+4){
    bio.classList.add("is-clamped");
    btn.hidden=false;
  }
}
function toggle(entry){
  const {bio,btn}=entry;
  entry.open=!entry.open;
  bio.classList.toggle("is-clamped",!entry.open);
  btn.setAttribute("aria-expanded",String(entry.open));
  btn.firstElementChild.textContent=entry.open?T("about.readLess","Show less"):T("about.readMore","Read more");
}

  function applyLanguage() {
    const code = lang();
    cards.forEach(entry => {
      entry.card.querySelector(".team-role").textContent = pick(entry.person.role, code);
      entry.bio.firstElementChild.textContent = pick(entry.person.bio, code);
      measure(entry);
    });
  }

  fetch("data/team.json")
    .then(r => { if (!r.ok) throw new Error("team.json"); return r.json(); })
    .then(people => {
      cards = people.map(build);
      grid.replaceChildren(...cards.map(c => c.card));
      applyLanguage();
      if (window.NODIFSMotion) cards.forEach(c => window.NODIFSMotion.reveal(c.card));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => cards.forEach(measure));
    })
    .catch(() => {
      const msg = document.createElement("p");
      msg.className = "empty-news";
      msg.textContent = T("about.teamError", "The team could not be loaded. Please open the site through a web server (see README).");
      grid.replaceChildren(msg);
    });

  window.addEventListener("nodifs:language", applyLanguage);

  let resizeTimer, lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;      /* ignore mobile address-bar height changes */
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => cards.forEach(measure), 200);
  });
})();
