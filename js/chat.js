/* NODIFS GPT – on-page assistant.
   Works in all five site languages: the interface, the built-in answers and the keyword matching.
   Set CONFIG.apiEndpoint to use the optional Node backend (server.js); the chosen language is sent along. */
(() => {
  const CONFIG = { apiEndpoint: null };
  const VOICE = { en: "en-US", fr: "fr-FR", sw: "sw-KE", ln: "fr-FR", lg: "en-UG" };   /* browsers have no Lingala/Luganda voices */
  const QUICK = [["apply", "chat.apply", "How do I apply?"], ["programs", "chat.programs", "What programs do you offer?"], ["location", "chat.location", "Where are you located?"], ["fees", "chat.fees", "Tuition fees?"]];

  /* topics, with keywords in English, French, Kiswahili, Lingala and Luganda (accents are ignored when matching) */
  const TOPICS = [
    { id: "apply", reply: "chat.r.apply", keys: ["apply", "admission", "enrol", "enroll", "register", "application", "postul", "inscri", "candidat", "omba", "ombi", "uandikishaji", "jiunge", "kosenga", "bosengi", "kokota", "saba", "okwewandiisa", "okwewandiika"] },
    { id: "programs", reply: "chat.r.programs", keys: ["program", "grade", "maternelle", "primaire", "college", "lycee", "curriculum", "academics", "niveau", "cours", "enseignement", "masomo", "darasa", "mtaala", "programu", "mateya", "ebyenjigiriza", "ebisomesebwa"] },
    { id: "fees", reply: "chat.r.fees", keys: ["fee", "tuition", "price", "cost", "payment", "frais", "scolarite", "tarif", "prix", "cout", "paiement", "ada", "bei", "gharama", "malipo", "mbongo", "talo", "kofuta", "ssente", "omuwendo", "okusasula"] },
    { id: "location", reply: "chat.r.location", keys: ["where", "location", "address", "located", "kampala", "map", "ou est", "ou se trouve", "adresse", "emplacement", "situe", "carte", "localisation", "wapi", "anwani", "mahali", "ramani", "esika", "adrese", "karte", "musangibwa", "ekifo", "endagiriro", "maapu"] },
    { id: "languages", reply: "chat.r.languages", keys: ["language", "french", "english", "lingala", "swahili", "luganda", "langue", "francais", "anglais", "lugha", "kifaransa", "kiingereza", "kiswahili", "monoko", "minoko", "lifalanse", "olulimi", "ennimi", "oluganda", "oluffaransa", "olungereza"] },
    { id: "contact", reply: "chat.r.contact", keys: ["contact", "email", "phone", "whatsapp", "call", "courriel", "telephone", "appeler", "mawasiliano", "simu", "barua pepe", "boyokani", "telefone", "imeli", "tukwasagane", "essimu", "okukwatagana"] },
    { id: "news", reply: "chat.r.news", keys: ["news", "event", "announcement", "calendar", "actualite", "evenement", "annonce", "nouvelles", "habari", "matukio", "tangazo", "sango", "milulu", "molulu", "amawulire", "emikolo", "ekirango"] },
    { id: "hello", reply: "chat.welcome", keys: ["hello", "hi", "bonjour", "bonsoir", "salut", "mbote", "good morning", "good afternoon", "hujambo", "jambo", "salamu", "mambo", "wangi", "gyebale", "oli otya", "osiibye", "wasuze", "agandi"] }
  ];
  const DOMAIN = /nodifs|school|ecole|shule|eskoli|essomero|student|eleve|mwanafunzi|eyekoli|muyizi|kelasi/;

  let history = [], voiceOn = false, recognition = null, listening = false;
  const lang = () => document.documentElement.lang || "en";
  const T = (key, fallback) => (window.NODIFSi18n ? window.NODIFSi18n.t(key, fallback) : fallback);
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hasKey = (q, k) => k.length <= 3 ? new RegExp(`(^|[^\\p{L}])${k}($|[^\\p{L}])`, "u").test(q) : q.includes(k);

  function detectTopic(text) {
    const q = norm(text);
    return TOPICS.find(t => t.keys.some(k => hasKey(q, k)));
  }
  function localAnswer(text, topicId) {
    const topic = topicId ? TOPICS.find(t => t.id === topicId) : detectTopic(text);
    if (topic) return T(topic.reply, "");
    return DOMAIN.test(norm(text)) ? T("chat.generic", "") : T("chat.offtopic", "");
  }

  function setup() {
    const stack = window.NODIFSfabStack || document.querySelector(".fab-stack");
    if (!stack) { setTimeout(setup, 80); return; }

    const button = document.createElement("button");
    button.className = "fab fab-chat";
    button.type = "button";
    button.setAttribute("data-i18n-aria", "chat.open");
    button.setAttribute("aria-label", "Open NODIFS GPT chat");
    button.innerHTML = '✧<span class="fab-badge">1</span>';
    stack.prepend(button);

    const panel = document.createElement("section");
    panel.className = "chat-panel";
    panel.setAttribute("data-i18n-aria", "chat.panelAria");
    panel.setAttribute("aria-label", "NODIFS GPT assistant");
    panel.innerHTML =
      `<header class="chat-head"><div class="chat-avatar">✧</div><div class="chat-head-copy"><strong>NODIFS GPT</strong><small data-i18n="chat.status">Online · Ask me anything</small></div>` +
      `<button class="voice-btn" id="chat-voice" data-i18n-aria="chat.voice" data-i18n-title="chat.voice" aria-label="Toggle voice replies" title="Toggle voice replies">🔇</button>` +
      `<button id="chat-close" data-i18n-aria="chat.close" aria-label="Close chat">×</button></header>` +
      `<div class="chat-messages" id="chat-messages" aria-live="polite"></div>` +
      `<div class="quick-replies" id="quick-replies">${QUICK.map(([id, k, en]) => `<button type="button" data-quick="${id}" data-i18n="${k}">${en}</button>`).join("")}</div>` +
      `<div class="chat-error" id="chat-error" hidden></div>` +
      `<div class="chat-input-area"><div class="listening-pill" id="listening-pill" data-i18n="chat.listening">● Listening…</div>` +
      `<div class="chat-input-row"><button class="mic-btn" id="chat-mic" type="button" data-i18n-aria="chat.mic" aria-label="Speak your question">🎙</button>` +
      `<textarea id="chat-input" rows="1" data-i18n-placeholder="chat.placeholder" data-i18n-aria="chat.inputAria" placeholder="Ask a question about NODIFS…" aria-label="Your message"></textarea>` +
      `<button class="send-btn" id="chat-send" type="button" data-i18n-aria="chat.send" aria-label="Send message">➤</button></div>` +
      `<p class="chat-disclaimer" data-i18n="chat.disclaimer">NODIFS GPT can make mistakes. Confirm important details with the school office.</p></div>`;
    document.body.appendChild(panel);
    if (window.NODIFSi18n) window.NODIFSi18n.apply(panel);

    const messages = panel.querySelector("#chat-messages");
    const input = panel.querySelector("#chat-input");
    const quickEl = panel.querySelector("#quick-replies");
    const error = panel.querySelector("#chat-error");
    const sendBtn = panel.querySelector("#chat-send");
    const mic = panel.querySelector("#chat-mic");
    let welcomeEl = null;

    function addMessage(role, text) {
      const el = document.createElement("div");
      el.className = `chat-message ${role}`;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
      return el;
    }
    const showError = text => { error.hidden = false; error.textContent = text; };

    button.addEventListener("click", () => {
      panel.classList.add("open");
      button.querySelector(".fab-badge")?.remove();
      if (!messages.children.length) welcomeEl = addMessage("bot", T("chat.welcome", "Hello! I’m NODIFS GPT, the school’s virtual assistant."));
      input.focus();
    });
    panel.querySelector("#chat-close").addEventListener("click", () => { panel.classList.remove("open"); stopListening(); });
    panel.querySelector("#chat-voice").addEventListener("click", e => {
      voiceOn = !voiceOn;
      e.currentTarget.textContent = voiceOn ? "🔊" : "🔇";
      if (!voiceOn && "speechSynthesis" in window) speechSynthesis.cancel();
    });
    sendBtn.addEventListener("click", () => send());
    input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; });
    quickEl.addEventListener("click", e => {
      const b = e.target.closest("[data-quick]");
      if (!b) return;
      input.value = b.textContent;
      quickEl.hidden = true;
      send(b.dataset.quick);
    });

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognition = new SR();
      recognition.lang = VOICE[lang()] || "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = e => { input.value = e.results[0][0].transcript; send(); };
      recognition.onerror = () => showError(T("chat.voiceUnavail", "Voice input was unavailable. Please type your question instead."));
      recognition.onend = () => stopListening();
      mic.addEventListener("click", () => {
        if (listening) { stopListening(); return; }
        try {
          recognition.lang = VOICE[lang()] || "en-US";
          recognition.start();
          listening = true;
          panel.querySelector("#listening-pill").classList.add("active");
          mic.textContent = "■";
        } catch (_) { showError(T("chat.voiceStart", "Voice input could not start. Please type your question instead.")); }
      });
    } else mic.hidden = true;

    async function send(topicId) {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      input.style.height = "38px";
      quickEl.hidden = true;
      error.hidden = true;
      addMessage("user", text);
      history.push({ role: "user", content: text });
      history = history.slice(-8);
      const typing = document.createElement("div");
      typing.className = "typing";
      typing.innerHTML = "<i></i><i></i><i></i>";
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
      sendBtn.disabled = true;
      let reply;
      try {
        if (CONFIG.apiEndpoint) {
          const response = await fetch(CONFIG.apiEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, lang: lang(), history: history.slice(-8, -1) }) });
          if (!response.ok) throw new Error("API unavailable");
          const data = await response.json();
          reply = data.reply || T("chat.noAnswer", "Sorry, I couldn't find an answer. Please contact the school office.");
        } else reply = localAnswer(text, topicId);
      } catch (_) {
        reply = T("chat.trouble", "I'm having trouble reaching the assistant service right now.");
        showError(T("chat.svcUnavail", "Assistant service temporarily unavailable."));
      } finally { typing.remove(); sendBtn.disabled = false; }
      addMessage("bot", reply);
      history.push({ role: "assistant", content: reply });
      history = history.slice(-8);
      if (voiceOn && "speechSynthesis" in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = VOICE[lang()] || "en-US";
        speechSynthesis.speak(utterance);
      }
    }

    function stopListening() {
      if (!listening) return;
      listening = false;
      try { recognition?.stop(); } catch (_) { /* already stopped */ }
      panel.querySelector("#listening-pill").classList.remove("active");
      mic.textContent = "🎙";
    }

    /* the visitor switched language: relabel the panel and refresh the greeting if it is still the only message */
    window.addEventListener("nodifs:language", () => {
      if (window.NODIFSi18n) window.NODIFSi18n.apply(panel);
      if (welcomeEl && messages.children.length === 1) welcomeEl.textContent = T("chat.welcome", welcomeEl.textContent);
      error.hidden = true;
    });
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
