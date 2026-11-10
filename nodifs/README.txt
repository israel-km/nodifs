NODIFS website
==============

Static website made with plain HTML, CSS and vanilla JavaScript.

HOW TO RUN (static website)
1. Open a terminal in the nodifs folder.
2. Run: python -m http.server 8000
3. Open http://localhost:8000 in your browser.

Optional Node backend
1. In the nodifs folder run: npm init -y
2. Run: npm install express node-fetch
3. Set OPENAI_API_KEY in your terminal environment (never in browser code).
   Windows PowerShell: $env:OPENAI_API_KEY="your-key"
   Windows CMD: set OPENAI_API_KEY=your-key
   macOS/Linux: export OPENAI_API_KEY=your-key
4. In js/chat.js change CONFIG.apiEndpoint from null to "/api/nodifs-gpt".
5. Run: node server.js and open http://localhost:3000.

WhatsApp
Replace NODIFS_WHATSAPP in js/whatsapp.js with the school's real number,
including country code, without a plus sign or spaces.

Important launch checks
- Replace info@nodifs.example, placeholder phone details, and the WhatsApp number
  with official school contact details.
- Confirm school address, admissions requirements, fees, dates, faculty names,
  curriculum, exam pass rate, student count and nationalities before publishing.
- The forms are front-end demonstrations only; connect them to an approved form
  service or backend before using them to receive real applications.
- The news items are sample school content and can be edited in data/news.json.
- For language files that do not exist (Spanish, Portuguese, Arabic, Chinese,
  Kikongo and Tshiluba), the language selector gracefully displays English.

About page slideshow & animations
- css/about-motion.css and js/about-motion.js control the changing background photos
  and all About-page animations. See images/about/HOW-TO-ADD-PHOTOS.txt for photos.

Team section (About page)
- Edit people in data/team.json (name, photo, role, bio). Photos go in images/team/.
- Bios and roles have "en" and "fr" text; add "sw", "ln" or "lg" to translate more.
  Languages without text show the English version.
- Long bios get a "Read more" button automatically.

Languages
- Page text lives in lang/*.json (keys such as "about.title"). Lingala and Luganda
  translations should be reviewed by native speakers before launch.

Languages (whole site)
- Choose a language from the button at the top right. Every page changes: menus, headings,
  forms, footer, news articles, team bios, the slideshow, the chat assistant and its answers.
- The choice is remembered on every page and on the visitor's next visit.
- UI text:       lang/en.json, fr.json, sw.json, ln.json, lg.json   (same keys in each file)
- News articles: data/news.json   -> "translations": { "fr": {title, excerpt, body, ticker}, ... }
- Team bios:     data/team.json   -> "role" and "bio" have en, fr, sw, ln, lg
- To make new text translatable, add data-i18n="your.key" to the HTML element and add
  "your.key" to all five lang files. Missing translations fall back to English.
- Please have native speakers review the Lingala (ln) and Luganda (lg) text, and ideally Swahili,
  before the site goes live.
