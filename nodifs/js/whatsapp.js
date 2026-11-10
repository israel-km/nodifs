(() => {
  // Replace this placeholder with the school's real WhatsApp number (country code, no +, no spaces).
  const NODIFS_WHATSAPP = "243000000000";
  const T = (key, fallback) => (window.NODIFSi18n ? window.NODIFSi18n.t(key, fallback) : fallback);
  document.addEventListener("DOMContentLoaded", () => {
    const stack = document.createElement("div");
    stack.className = "fab-stack";
    const a = document.createElement("a");
    a.className = "fab fab-whatsapp";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "☏";
    const refresh = () => {
      a.href = `https://wa.me/${NODIFS_WHATSAPP}?text=${encodeURIComponent(T("wa.msg", "Hello NODIFS, I would like to know more about the school."))}`;
      a.setAttribute("aria-label", T("wa.aria", "Contact NODIFS on WhatsApp"));
    };
    refresh();
    window.addEventListener("nodifs:language", refresh);   /* greeting + label follow the chosen language */
    stack.appendChild(a);
    document.body.appendChild(stack);
    window.NODIFSfabStack = stack;
  });
})();
