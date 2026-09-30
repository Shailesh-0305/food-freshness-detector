/* =====================================================================
   FoodLens — script.js
   One file shared by all four pages. Each page has <body data-page="...">
   and only the matching init function runs (see section 12 at the bottom).

   Sections
    0. CONFIG  <-- connect your trained model here
    1. Helpers
    2. Icons + logo + bot SVGs
    3. Shell: navigation + chatbot markup
    4. Navigation (active indicator, page transitions)
    5. Animations (leaves, sparkles, scroll reveal, counters)
    6. Text-to-speech
    7. Intro animation (home page)
    8. History storage
    9. History page
   10. Detection page (upload, camera, capture, analyze, result)
   11. Chatbot
   12. Boot
   ===================================================================== */

/* ---------- 0. CONFIG ---------- */
const CONFIG = {
  /*
    CONNECTING YOUR TRAINED MODEL
    -----------------------------
    Put the URL of your backend here, e.g. "http://localhost:5000/predict".
    While this is empty ("") the site runs in DEMO MODE: it shows clearly
    labelled placeholder data and does NOT pretend to be a real analysis.

    FoodLens sends:  POST (multipart/form-data) with the image in the field
                     named API_FIELD_NAME below.
    FoodLens expects JSON like:
      {
        "food": "Banana",            // or "label": "freshbanana"
        "condition": "Fresh",        // "Fresh" or "Rotten"
        "confidence": 96,            // 0-100 (or 0-1, it is converted)
        "insight": "optional text"   // if missing, a default sentence is used
      }
    If you change the JSON shape, edit normalizePrediction() in section 10.
  */
  API_URL: "/api/analyze",
  API_FIELD_NAME: "image",
  MIN_SCAN_MS: 4200,          // how long the scanning animation plays
  MAX_FILE_MB: 10,
  GREETING: "Welcome to FoodLens. Let's discover the quality of your food.",
};

/* Food photos. These load from Wikimedia Commons.
   For a final project, download photos into an /images folder and replace
   each URL with a local path such as "images/banana.jpg". */
const wiki = (file) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + file + "?width=900";
const IMAGES = {
  banana: wiki("Banana-Single.jpg"),
  apple: wiki("Red_Apple.jpg"),
  tomato: wiki("Tomato_je.jpg"),
  broccoli: wiki("Broccoli_and_cross_section_edit.jpg"),
  strawberry: wiki("PerfectStrawberry.jpg"),
  orange: wiki("Orange-Fruit-Pieces.jpg"),
};

/* Example records shown the first time History opens (marked "Sample data"). */
const SEED_HISTORY = [
  { id: "FL-1004", food: "Banana",   condition: "Fresh",  confidence: 96, timestamp: "2026-09-21T14:15:00", image: IMAGES.banana,   tag: "sample" },
  { id: "FL-1003", food: "Apple",    condition: "Fresh",  confidence: 91, timestamp: "2026-09-20T11:32:00", image: IMAGES.apple,    tag: "sample" },
  { id: "FL-1002", food: "Tomato",   condition: "Rotten", confidence: 94, timestamp: "2026-09-19T09:48:00", image: IMAGES.tomato,   tag: "sample" },
  { id: "FL-1001", food: "Broccoli", condition: "Fresh",  confidence: 89, timestamp: "2026-09-18T16:20:00", image: IMAGES.broccoli, tag: "sample" },
];

/* ---------- 1. HELPERS ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.random() * (max - min) + min;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const formatDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function showToast(message, type = "info") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 500); }, 3600);
}

/* If a photo fails to load (offline, blocked...), show a soft placeholder instead of a broken icon. */
const PLACEHOLDER_IMG = "data:image/svg+xml," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='#d3f1e2'/><stop offset='1' stop-color='#c6f1ee'/></linearGradient></defs>" +
  "<rect width='400' height='300' fill='url(#g)'/><path d='M150 190C145 130 185 95 255 92c2 65-35 105-105 98z' fill='#10a674' opacity='.35'/></svg>"
);
document.addEventListener("error", (e) => {
  const el = e.target;
  if (el.tagName === "IMG" && !el.dataset.fallback) { el.dataset.fallback = "1"; el.src = PLACEHOLDER_IMG; }
}, true);

/* <img data-food="banana"> gets its src from IMAGES */
function hydrateImages() {
  $$("img[data-food]").forEach((img) => { if (IMAGES[img.dataset.food]) img.src = IMAGES[img.dataset.food]; });
}

/* ---------- 2. ICONS + LOGO + BOT ---------- */
const ICON_PATHS = {
  home: '<path d="M3.5 11L12 3.5 20.5 11"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-6h4v6"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="12" r="3.2"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 4v4.5H8"/><path d="M12 8v4.2l2.8 1.8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>',
  upload: '<path d="M12 16V4.5M7 9l5-5 5 5"/><path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3"/>',
  camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  send: '<path d="M21.5 2.5L10.5 13.5"/><path d="M21.5 2.5l-6.5 19-4.5-8-8-4.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sparkles: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  volumeOff: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  zap: '<path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="3"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/>',
  leaf: '<path d="M5 19C4 10 10 4 20 4c0 10-6 16-15 15z"/><path d="M5 19c3-5 6-8 10-11"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
};
function icon(name) {
  return `<svg class="ic ic-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
}
/* <i data-icon="upload"></i> anywhere in the HTML becomes an SVG icon */
function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}

let svgCounter = 0; // gradients need unique ids when the same SVG appears several times
function logoSVG() {
  return '<img class="logo" src="https://i.ibb.co/fVtPbXPh/Chat-GPT-Image-Sep-29-2026-09-15-20-AM.png" alt="FoodLens logo">';
}
function botSVG() {
  const id = "bt" + ++svgCounter;
  return `<svg class="bot" viewBox="0 0 48 48" fill="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8be9c5"/><stop offset="1" stop-color="#12a3a0"/></linearGradient></defs>
    <circle cx="24" cy="6" r="2.8" fill="#34d399"/><path d="M24 8.8v5" stroke="#12a3a0" stroke-width="2" stroke-linecap="round"/>
    <rect x="5" y="13" width="38" height="29" rx="13" fill="url(#${id})"/><rect x="10.5" y="18.5" width="27" height="18.5" rx="9.5" fill="#0f3d33"/>
    <circle cx="18.5" cy="27.5" r="2.9" fill="#8ff5d1"/><circle cx="29.5" cy="27.5" r="2.9" fill="#8ff5d1"/>
    <path d="M21 32.2c1.8 1.6 4.2 1.6 6 0" stroke="#8ff5d1" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

/* ---------- 3. SHELL: navigation + chatbot markup ---------- */
const NAV_ITEMS = [
  { id: "home", label: "Home", href: "index.html", icon: "home" },
  { id: "detection", label: "Detection", href: "detection.html", icon: "scan" },
  { id: "history", label: "History", href: "history.html", icon: "history" },
  { id: "about", label: "About", href: "about.html", icon: "info" },
];

function renderShell() {
  const page = document.body.dataset.page;
  const links = NAV_ITEMS.map((n) =>
    `<a class="nav-link ${n.id === page ? "active" : ""}" href="${n.href}" data-nav="${n.id}" ${n.id === page ? 'aria-current="page"' : ""}>${icon(n.icon)}<span>${n.label}</span></a>`
  ).join("");

  $("#app-nav").innerHTML = `
    <header class="site-header glass">
      <a class="brand" href="index.html">${logoSVG()}<span class="brand-name">FoodLens</span></a>
      <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span><span></span></button>
    </header>
    <aside class="sidebar glass" id="sidebar">
      <nav class="nav-list" id="nav-list" aria-label="Main"><span class="nav-indicator"></span>${links}</nav>
    </aside>
    <nav class="bottom-nav glass" id="bottom-nav" aria-label="Main"><span class="bn-indicator"></span>${links}</nav>`;

  $("#app-chatbot").innerHTML = `
    <button class="chat-fab" id="chat-fab" aria-label="Open FoodLens AI Assistant" aria-expanded="false">${botSVG()}<span class="close-x">${icon("close")}</span></button>
    <section class="chat-window" id="chat-window" role="dialog" aria-label="FoodLens AI Assistant">
      <div class="chat-head">${botSVG()}
        <div><strong>FoodLens AI Assistant</strong><small><i></i>Online</small></div>
        <div class="head-actions">
          <button class="icon-btn" id="voice-toggle" aria-label="Toggle voice">${icon("volume")}</button>
          <button class="icon-btn" id="chat-close" aria-label="Close chat">${icon("close")}</button>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages" aria-live="polite"></div>
      <div class="chips" id="chat-chips"></div>
      <form class="chat-form" id="chat-form" autocomplete="off">
        <input id="chat-input" type="text" placeholder="Type your question..." aria-label="Type your question">
        <button class="send-btn" type="submit" aria-label="Send">${icon("send")}</button>
      </form>
    </section>`;
}

/* ---------- 4. NAVIGATION ---------- */

/* The green highlight slides from the page you came from to the current page. */
function initNavIndicator() {
  const page = document.body.dataset.page;
  const prev = sessionStorage.getItem("fl_prev_page") || page;
  const groups = [
    { box: $("#nav-list"), ind: ".nav-indicator", vertical: true },
    { box: $("#bottom-nav"), ind: ".bn-indicator", vertical: false },
  ];
  function moveTo(id, animate) {
    groups.forEach(({ box, ind, vertical }) => {
      const link = $(`[data-nav="${id}"]`, box);
      const el = $(ind, box);
      if (!link || !el) return;
      el.style.transition = animate ? "" : "none";
      if (vertical) { el.style.height = link.offsetHeight + "px"; el.style.transform = `translateY(${link.offsetTop}px)`; }
      else { el.style.width = link.offsetWidth + "px"; el.style.transform = `translateX(${link.offsetLeft}px)`; }
    });
  }
  moveTo(prev, false);
  requestAnimationFrame(() => requestAnimationFrame(() => moveTo(page, true)));
  window.addEventListener("resize", () => moveTo(page, false));
  sessionStorage.setItem("fl_prev_page", page);
}

function initSidebar() {
  const sidebar = $("#sidebar");
  const toggle = $("#sidebar-toggle");
  if (!sidebar || !toggle) return;
  toggle.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
}

/* Fade the page out before going to another page of the site. */
function initPageTransitions() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (a.target === "_blank" || href.startsWith("#") || /^(https?:|mailto:|tel:)/.test(href) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    document.body.classList.add("page-leaving");
    setTimeout(() => { window.location.href = href; }, 320);
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("page-leaving"); });
}

/* ---------- 5. ANIMATIONS ---------- */
function spawnLeaves(container, count = 9) {
  if (!container || reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const leaf = document.createElement("span");
    leaf.className = "leaf";
    leaf.style.cssText = `--x:${rand(0, 100)}%;--s:${rand(14, 30)}px;--d:${rand(22, 40)}s;--dl:${-rand(0, 40)}s;--dx:${rand(-120, 120)}px`;
    container.appendChild(leaf);
  }
}
function spawnGlowDots(container, count = 20) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "glow-dot";
    dot.style.cssText = `--x:${rand(0, 100)}%;--s:${rand(8, 22)}px;--d:${rand(6, 12)}s;--dl:${-rand(0, 10)}s;--dx:${rand(-60, 60)}px`;
    container.appendChild(dot);
  }
}
/* Twinkling stars. ring:true places them in a circle around the centre. */
function spawnSparkles(container, count = 12, { ring = false, green = false } = {}) {
  if (!container || reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    s.className = "sparkle twinkle" + (green || Math.random() < 0.35 ? " green" : "");
    let x = rand(2, 98), y = rand(2, 98);
    if (ring) { const a = rand(0, Math.PI * 2), r = rand(58, 92); x = 50 + Math.cos(a) * r; y = 50 + Math.sin(a) * r; }
    s.style.cssText = `left:${x}%;top:${y}%;--s:${rand(9, 22)}px;--t:${rand(1.8, 3.4)}s;--dl:${rand(0, 3)}s`;
    container.appendChild(s);
  }
}
/* One-time burst of sparkles flying outwards from the centre. */
function burstSparkles(container, count = 34) {
  if (!container || reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span");
    const a = rand(0, Math.PI * 2), dist = rand(120, 380);
    s.className = "sparkle burst" + (Math.random() < 0.4 ? " green" : "");
    s.style.cssText = `--s:${rand(10, 26)}px;--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px;animation-delay:${rand(0, 0.25)}s`;
    container.appendChild(s);
  }
}
/* Elements with class "reveal" slide up when they scroll into view. Use style="--i:n" to stagger. */
function initScrollReveal() {
  const items = $$(".reveal");
  if (!("IntersectionObserver" in window) || reducedMotion) { items.forEach((i) => i.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
}
/* Number counting animation: 0 -> target */
function animateCount(el, target, { duration = 1300, suffix = "" } = {}) {
  if (!el) return;
  if (reducedMotion) { el.textContent = target + suffix; return; }
  const start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

/* ---------- 6. TEXT-TO-SPEECH ---------- */
const Voice = {
  get enabled() { return localStorage.getItem("fl_voice") !== "off"; },
  set enabled(v) { localStorage.setItem("fl_voice", v ? "on" : "off"); },
  supported: "speechSynthesis" in window,
};
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => /^en/i.test(v.lang) && /(female|samantha|zira|aria|jenny|google uk english female|google us english)/i.test(v.name))
      || voices.find((v) => /^en/i.test(v.lang)) || null;
}
function speak(text, { force = false } = {}) {
  if (!Voice.supported || (!Voice.enabled && !force)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 1; u.pitch = 1.08;
    const v = pickVoice(); if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (err) { /* speech is a bonus, never break the page */ }
}
if (Voice.supported) window.speechSynthesis.onvoiceschanged = () => {};

/* ---------- 7. INTRO ANIMATION (home page only) ---------- */
function runIntro() {
  const intro = $("#intro");
  if (!intro) return;
  speak(CONFIG.GREETING);
  const skipIntro = sessionStorage.getItem("fl_intro_done") === "1" || reducedMotion;
  if (skipIntro) { document.body.classList.remove("intro-active"); intro.remove(); return; }

  // Build the "FOODLENS" letters so each one can animate separately
  const brand = $("#intro-brand");
  brand.innerHTML = [..."FOODLENS"].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("");

  spawnGlowDots($("#intro-particles"), 22);
  spawnSparkles($("#intro-stars"), 18, { ring: true });

  const timers = [];
  let finished = false;
  const at = (ms, fn) => timers.push(setTimeout(() => { if (!finished) fn(); }, ms));
  const stage = (name) => intro.classList.add(name);

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    if (Voice.supported) window.speechSynthesis.cancel();
    sessionStorage.setItem("fl_intro_done", "1");
    intro.classList.add("stage-leave");
    document.body.classList.remove("intro-active"); // hero animations start now
    setTimeout(() => intro.remove(), 1100);
  }
  $("#intro-skip").addEventListener("click", finish);

  // Timeline: welcome text fades in and drops downward while brand appears center-aligned.
  at(400, () => { stage("stage-text"); });
  at(1300, () => { intro.classList.add("stage-brand"); });
  at(2100, () => {
    const welcome = $(".intro-welcome");
    if (welcome) welcome.style.transform = "translateY(18px)";
  });
  at(2500, () => {
    stage("stage-shine");
    spawnSparkles($("#intro-stars"), 6, { ring: true, green: true });
  });
  at(3600, () => {
    burstSparkles($("#intro-burst"), 36);
    spawnSparkles($("#intro-stars"), 24, { ring: true, green: true });
  });
  at(4400, () => { stage("stage-away"); });
  at(5200, finish);
}

/* ---------- 8. HISTORY STORAGE ---------- */
const HISTORY_KEY = "foodlens_history_v1";

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch (e) { /* fall through to seed data */ }
  const seeded = SEED_HISTORY.map((r) => ({ ...r }));
  saveHistory(seeded);
  return seeded;
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); return true; }
  catch (e) { showToast("Could not save to history: browser storage is full or blocked.", "error"); return false; }
}
function nextInspectionId(list) {
  const nums = list.map((r) => parseInt(String(r.id).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  return "FL-" + String((nums.length ? Math.max(...nums) : 1000) + 1).padStart(4, "0");
}
function addHistoryRecord(record) {
  const list = loadHistory();
  list.unshift(record);
  return saveHistory(list);
}

/* ---------- 9. HISTORY PAGE ---------- */
function initHistoryPage() {
  const grid = $("#history-grid");
  const state = { q: "", filter: "all", sort: "newest" };
  let lastStats = "";

  function tagLabel(tag) { return tag === "sample" ? "Sample data" : tag === "demo" ? "Demo result" : ""; }

  function cardHTML(r, i) {
    const cls = r.condition === "Rotten" ? "rotten" : "fresh";
    return `<article class="h-card" style="--i:${i}">
      <div class="h-img"><img src="${escapeHTML(r.image)}" alt="${escapeHTML(r.food)}" loading="lazy"><span class="badge ${cls}">${escapeHTML(r.condition)}</span></div>
      <div class="h-body">
        <div class="h-top"><h3>${escapeHTML(r.food)}</h3><span class="h-conf">${Math.round(r.confidence)}%</span></div>
        <div class="h-meta"><span>${icon("calendar")}${formatDate(r.timestamp)}</span><span>${icon("clock")}${formatTime(r.timestamp)}</span></div>
        <div class="h-foot"><span class="h-id">${escapeHTML(r.id)}</span><span class="h-tag">${tagLabel(r.tag)}</span></div>
      </div></article>`;
  }

  function render() {
    const all = loadHistory();
    let list = all.filter((r) => state.filter === "all" || r.condition.toLowerCase() === state.filter);
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter((r) => [r.food, r.id, r.condition, formatDate(r.timestamp)].join(" ").toLowerCase().includes(q));
    list.sort((a, b) => {
      if (state.sort === "oldest") return new Date(a.timestamp) - new Date(b.timestamp);
      if (state.sort === "confidence") return b.confidence - a.confidence;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    grid.innerHTML = list.length
      ? list.map(cardHTML).join("")
      : `<div class="empty"><h3>${all.length ? "No matching inspections" : "No inspections yet"}</h3><p>${all.length ? "Try a different search or filter." : "Analyze a food image on the Detection page and it will appear here."}</p></div>`;

    const stats = [all.length, all.filter((r) => r.condition === "Fresh").length, all.filter((r) => r.condition === "Rotten").length];
    if (stats.join() !== lastStats) {
      lastStats = stats.join();
      animateCount($("#stat-total"), stats[0]); animateCount($("#stat-fresh"), stats[1]); animateCount($("#stat-rotten"), stats[2]);
    }
  }

  $("#history-search").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("#history-sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $$("#history-filter button").forEach((btn) => btn.addEventListener("click", () => {
    $$("#history-filter button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.filter = btn.dataset.filter;
    render();
  }));
  $("#history-clear").addEventListener("click", () => {
    if (confirm("Delete all saved inspections from this browser?")) { saveHistory([]); render(); }
  });
  render();
}

/* ---------- 10. DETECTION PAGE ---------- */
const scan = { tab: "upload", blob: null, dataURL: null, fileName: "", stream: null, busy: false, timers: [] };

function initDetectionPage() {
  const $tabs = $("#tabs"), $file = $("#file-input"), $drop = $("#dropzone");

  /* Tabs: Upload / Camera */
  $$("[data-tab]", $tabs).forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  /* Upload: click, keyboard, drag & drop */
  $drop.addEventListener("click", () => $file.click());
  $drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $file.click(); } });
  $file.addEventListener("change", () => { if ($file.files[0]) handleFile($file.files[0]); $file.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => $drop.addEventListener(ev, (e) => { e.preventDefault(); $drop.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => $drop.addEventListener(ev, (e) => { e.preventDefault(); $drop.classList.remove("drag"); }));
  $drop.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  /* Camera */
  $("#capture-btn").addEventListener("click", captureFrame);
  $("#camera-retry").addEventListener("click", startCamera);

  /* Preview + result buttons */
  $("#analyze-btn").addEventListener("click", analyze);
  $("#reset-btn").addEventListener("click", resetAll);
  $("#new-scan").addEventListener("click", () => { resetAll(); window.scrollTo({ top: 0, behavior: "smooth" }); });

  window.addEventListener("pagehide", stopCamera);
}

function switchTab(name) {
  if (scan.busy) return;
  scan.tab = name;
  const $tabs = $("#tabs");
  $tabs.dataset.active = name;
  $$("[data-tab]", $tabs).forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  if (name !== "camera") stopCamera();
  resetAll();
}

/* --- Upload --- */
function handleFile(file) {
  const okTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!okTypes.includes(file.type)) { showToast("Please choose a JPG, JPEG, PNG or WEBP image.", "error"); return; }
  if (file.size > CONFIG.MAX_FILE_MB * 1024 * 1024) { showToast(`That image is larger than ${CONFIG.MAX_FILE_MB} MB.`, "error"); return; }
  const reader = new FileReader();
  reader.onload = () => setImage(file, reader.result, file.name);
  reader.readAsDataURL(file);
}

/* --- Preview (shared by upload and camera) --- */
function setImage(blob, dataURL, fileName = "") {
  scan.blob = blob; scan.dataURL = dataURL; scan.fileName = fileName;
  showPane("preview");
  const img = $("#preview-img");
  img.style.animation = "none"; img.offsetWidth; img.style.animation = ""; // replay the entrance animation
  img.src = dataURL;
  $("#analyze-btn").classList.remove("hidden");
  $("#analyze-btn").disabled = false;
  $("#result-wrap").hidden = true;
  $("#result-card").classList.remove("show");
}
function showPane(name) {
  $$(".pane").forEach((p) => p.classList.toggle("active", p.id === "pane-" + name));
}
function resetAll() {
  if (scan.busy) return;
  scan.blob = null; scan.dataURL = null;
  $("#preview-frame").classList.remove("scanning");
  $("#result-wrap").hidden = true;
  $("#result-card").classList.remove("show");
  showPane(scan.tab);
  if (scan.tab === "camera") startCamera();
}

/* --- Camera --- */
function setCameraStatus(text, kind = "ok") {
  const pill = $("#camera-status");
  pill.classList.toggle("wait", kind === "wait");
  $("b", pill).textContent = text;
}
function showCameraError(msg) {
  $("#camera-error-text").textContent = msg;
  $("#camera-error").classList.remove("hidden");
  $("#capture-btn").disabled = true;
  setCameraStatus("Camera unavailable", "wait");
}
async function startCamera() {
  stopCamera();
  $("#camera-error").classList.add("hidden");
  $("#capture-btn").disabled = true;
  $("#camera-stage").classList.remove("live");
  setCameraStatus("Requesting camera...", "wait");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError("This browser cannot open the camera here. Camera access needs HTTPS or localhost. You can still upload an image.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (scan.tab !== "camera") { stream.getTracks().forEach((t) => t.stop()); return; } // user left the tab meanwhile
    scan.stream = stream;
    const video = $("#video");
    video.srcObject = stream;
    await video.play();
    $("#camera-stage").classList.add("live");
    setCameraStatus("Camera Ready", "ok");
    $("#capture-btn").disabled = false;
  } catch (err) {
    const msgs = {
      NotAllowedError: "Camera permission was denied. Allow camera access in your browser settings, then try again.",
      NotFoundError: "No camera was found on this device. You can upload an image instead.",
      NotReadableError: "The camera is being used by another app. Close it and try again.",
    };
    showCameraError(msgs[err.name] || "The camera could not be started. You can upload an image instead.");
  }
}
function stopCamera() {
  if (scan.stream) { scan.stream.getTracks().forEach((t) => t.stop()); scan.stream = null; }
  const video = $("#video");
  if (video) video.srcObject = null;
}
function captureFrame() {
  const video = $("#video");
  if (!video.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const flash = $("#shutter"); flash.classList.remove("go"); flash.offsetWidth; flash.classList.add("go");
  canvas.toBlob((blob) => {
    setImage(blob, canvas.toDataURL("image/jpeg", 0.92), "capture.jpg");
    stopCamera();
  }, "image/jpeg", 0.92);
}

/* --- Analyze --- */
async function analyze() {
  if (scan.busy || !scan.blob) return;
  scan.busy = true;
  const frame = $("#preview-frame");
  $("#analyze-btn").disabled = true;
  $("#reset-btn").disabled = true;
  $("#tabs").classList.add("locked");
  $("#result-wrap").hidden = true;
  $("#result-card").classList.remove("show");

  frame.classList.add("scanning");
  const sparkleBox = $("#scan-particles"); sparkleBox.innerHTML = ""; spawnSparkles(sparkleBox, 18);
  runScanProgress(CONFIG.MIN_SCAN_MS);

  try {
    // Run the request and the animation together; show the result when both are done.
    const [result] = await Promise.all([requestPrediction(scan.blob, scan.fileName), wait(CONFIG.MIN_SCAN_MS)]);
    frame.classList.remove("scanning");
    await showResult(result);
  } catch (err) {
    console.error(err);
    frame.classList.remove("scanning");
    showToast("The analysis could not be completed. Check that your model server is running, then try again.", "error");
    $("#analyze-btn").disabled = false;
  } finally {
    scan.busy = false;
    $("#reset-btn").disabled = false;
    $("#tabs").classList.remove("locked");
  }
}

function runScanProgress(duration) {
  const bar = $("#scan-bar"), text = $("#scan-text");
  scan.timers.forEach(clearTimeout); scan.timers = [];
  bar.style.transition = "none"; bar.style.width = "0%"; bar.offsetWidth;
  bar.style.transition = `width ${duration}ms linear`; bar.style.width = "100%";
  ["Scanning...", "Analyzing image...", "Detecting condition..."].forEach((line, i) => {
    scan.timers.push(setTimeout(() => { text.textContent = line; }, (i * duration) / 3));
  });
}

/* Sends the image to your backend. With no API_URL it returns clearly labelled demo data. */
async function requestPrediction(blob, fileName = "") {
  if (!CONFIG.API_URL) return demoPrediction(fileName);
  const form = new FormData();
  form.append(CONFIG.API_FIELD_NAME, blob, fileName || "image.jpg");
  const res = await fetch(CONFIG.API_URL, { method: "POST", body: form });
  if (!res.ok) throw new Error("Server responded with " + res.status);
  return normalizePrediction(await res.json());
}

/* Turns whatever your backend returns into the shape the result card needs. */
function normalizePrediction(d) {
  let food = d.food || "", condition = d.condition || "";
  const label = String(d.label || d.class || "");        // e.g. "freshbanana" / "rotten_apple"
  const m = label.match(/(fresh|rotten)[\s_-]*(.*)/i);
  if (m) { condition = condition || m[1]; food = food || m[2]; }
  food = food ? food.charAt(0).toUpperCase() + food.slice(1).toLowerCase() : "Unknown food";
  const rotten = /rot|spoil|bad/i.test(condition);
  let conf = Number(d.confidence);
  if (isNaN(conf)) conf = 0;
  if (conf <= 1) conf *= 100;                            // 0.96 -> 96
  conf = Math.max(0, Math.min(100, Math.round(conf)));
  const cond = rotten ? "Rotten" : "Fresh";
  return { food, condition: cond, confidence: conf, insight: d.insight || defaultInsight(cond), demo: false };
}
function defaultInsight(condition) {
  return condition === "Rotten"
    ? "The image appears to show visible signs of deterioration, such as discoloration or damaged areas. This is a visual estimate, so check the food closely before using it."
    : "The image appears to show good visual quality with no obvious signs of deterioration. This is a visual estimate based on the photo only.";
}
/* Editable rules for the "next inspection" suggestion. */
function suggestNextInspection(condition) {
  return condition === "Rotten"
    ? { label: "Not needed", hint: "Consider discarding this item" }
    : { label: "Recommended in 2 days", hint: "About 48 hours from now" };
}
function demoPrediction(fileName) {
  const guess = Object.keys(IMAGES).find((k) => fileName.toLowerCase().includes(k));
  return {
    food: guess ? guess.charAt(0).toUpperCase() + guess.slice(1) : "Sample food",
    condition: "Fresh", confidence: 96, demo: true,
    insight: "Demo mode: no trained model is connected yet, so this is placeholder data and not a real analysis. Set CONFIG.API_URL in script.js to see real predictions.",
  };
}

/* --- Result card --- */
function makeThumbnail(dataURL, max = 380) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

async function showResult(r) {
  const now = new Date();
  const iso = now.toISOString();
  const history = loadHistory();
  const id = nextInspectionId(history);
  const next = suggestNextInspection(r.condition);
  const rotten = r.condition === "Rotten";

  $("#res-img").src = scan.dataURL;
  $("#res-food").textContent = r.food;
  $("#res-food2").textContent = r.food;
  const cond = $("#res-cond"); cond.textContent = r.condition; cond.className = "cond-badge " + (rotten ? "rotten" : "fresh");
  $("#ring").classList.toggle("rotten", rotten);
  $("#res-next").textContent = next.label;
  $("#res-next-hint").textContent = next.hint;
  $("#res-insight").textContent = r.insight;
  $("#res-id").textContent = id;
  $("#res-date").textContent = formatDate(iso);
  $("#res-time").textContent = formatTime(iso);
  $("#demo-banner").hidden = !r.demo;

  // Save to history (small thumbnail so browser storage does not fill up)
  const thumb = await makeThumbnail(scan.dataURL);
  const saved = addHistoryRecord({ id, food: r.food, condition: r.condition, confidence: r.confidence, timestamp: iso, image: thumb, tag: r.demo ? "demo" : "" });
  $("#saved-pill").hidden = !saved;

  // Reveal with scale + fade, then animate the ring and the number
  const wrap = $("#result-wrap"), card = $("#result-card"), ring = $("#ring-fg");
  ring.style.transition = "none"; ring.style.strokeDashoffset = 327; ring.getBoundingClientRect();
  $("#res-conf").textContent = "0%";
  wrap.hidden = false;
  card.classList.remove("show"); card.getBoundingClientRect();
  card.classList.add("show");
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => {
    ring.style.transition = ""; ring.style.strokeDashoffset = 327 * (1 - r.confidence / 100);
    animateCount($("#res-conf"), r.confidence, { suffix: "%" });
  }, 450);

  $("#analyze-btn").classList.add("hidden");
}

/* ---------- 11. CHATBOT ---------- */
const CHAT_FAQ = [
  { q: "What does food condition mean?", keys: ["condition", "mean", "fresh", "rotten"],
    a: "Condition is what the photo suggests about the food's visible quality. FoodLens reports it as Fresh or Rotten. It looks at things like colour, texture and surface marks." },
  { q: "How does FoodLens work?", keys: ["how does", "work", "process", "model", "ai"],
    a: "1. Upload or capture a photo of a fruit or vegetable.\n2. The AI analyzes the image.\n3. You get the food name, its condition, a confidence percentage and a suggested next inspection.\nEvery inspection is saved on the History page." },
  { q: "How accurate is the analysis?", keys: ["accura", "reliable", "correct", "trust", "confidence", "sure"],
    a: "Accuracy depends on the trained model and on your photo: good light, a clear view and a plain background help. The confidence percentage shows how sure the model is about that image. It is a visual estimate, not a food-safety guarantee." },
  { q: "How do I upload an image?", keys: ["upload", "photo", "picture", "camera", "capture", "image", "file"],
    a: "Open the Detection page. Choose Upload Image, then drop a JPG, PNG or WEBP file into the box or press Choose Image. To use your camera instead, switch to the Camera tab and press Capture Image. Then press Analyze Food." },
  { q: "How often should I inspect food?", keys: ["often", "frequency", "inspect", "when", "check", "schedule"],
    a: "FoodLens suggests a next inspection time with every result. As a general habit, check fresh produce every day or two, and sooner for soft fruits and leafy vegetables." },
];
const CHAT_GREETING_TEXT = "Hi! I'm your FoodLens AI Assistant 🌿\nHow can I help you?";
const CHAT_GREETING_SPEECH = "Hi! I'm your FoodLens AI Assistant. How can I help you?";
const CHAT_FALLBACK = "I can help with how FoodLens works, what condition means, accuracy, uploading images and how often to inspect food. Try one of the questions below.";
const chat = { open: false, busy: false, log: [] };

function findAnswer(text) {
  const exact = CHAT_FAQ.find((f) => f.q === text);
  if (exact) return exact.a;
  const t = text.toLowerCase();
  if (/^(hi|hello|hey)\b/.test(t)) return "Hello! Ask me anything about food condition, uploading images or how FoodLens works.";
  if (/thank/.test(t)) return "You're welcome! 🌿";
  let best = null, top = 0;
  CHAT_FAQ.forEach((f) => { const score = f.keys.filter((k) => t.includes(k)).length; if (score > top) { top = score; best = f; } });
  return best ? best.a : CHAT_FALLBACK;
}
function chatSave() { try { sessionStorage.setItem("fl_chat", JSON.stringify(chat.log)); } catch (e) {} }
function chatAdd(role, text, { save = true, animate = true } = {}) {
  const box = $("#chat-messages");
  const div = document.createElement("div");
  div.className = "msg " + role;
  if (!animate) div.style.animation = "none";
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (save) { chat.log.push({ role, text }); chatSave(); }
}
async function chatBotSays(text, speech) {
  const box = $("#chat-messages");
  const typing = document.createElement("div");
  typing.className = "msg bot typing"; typing.innerHTML = "<i></i><i></i><i></i>";
  box.appendChild(typing); box.scrollTop = box.scrollHeight;
  await wait(650 + Math.min(text.length * 6, 900));
  typing.remove();
  chatAdd("bot", text);
  if (speech) speak(speech);
}
async function chatAsk(text) {
  text = text.trim();
  if (!text || chat.busy) return;
  chat.busy = true;
  chatAdd("user", text);
  await chatBotSays(findAnswer(text));
  chat.busy = false;
}
function setChatOpen(open) {
  chat.open = open;
  $("#chat-window").classList.toggle("open", open);
  const fab = $("#chat-fab");
  fab.classList.toggle("open", open);
  fab.setAttribute("aria-expanded", String(open));
  if (open) {
    if (chat.log.length === 0 && !chat.busy) {
      chat.busy = true;
      chatBotSays(CHAT_GREETING_TEXT, CHAT_GREETING_SPEECH).then(() => { chat.busy = false; });
    }
    setTimeout(() => $("#chat-input").focus({ preventScroll: true }), 400);
  } else if (Voice.supported) { window.speechSynthesis.cancel(); }
}
function updateVoiceButton() {
  const btn = $("#voice-toggle");
  btn.innerHTML = icon(Voice.enabled ? "volume" : "volumeOff");
  btn.classList.toggle("off", !Voice.enabled);
  btn.title = Voice.enabled ? "Voice on" : "Voice off";
  if (!Voice.supported) btn.classList.add("hidden");
}
function initChatbot() {
  try { chat.log = JSON.parse(sessionStorage.getItem("fl_chat") || "[]"); } catch (e) { chat.log = []; }
  chat.log.forEach((m) => chatAdd(m.role, m.text, { save: false, animate: false }));

  $("#chat-chips").innerHTML = CHAT_FAQ.map((f) => `<button type="button">${f.q}</button>`).join("");
  $$("#chat-chips button").forEach((b) => b.addEventListener("click", () => chatAsk(b.textContent)));

  $("#chat-fab").addEventListener("click", () => setChatOpen(!chat.open));
  $("#chat-close").addEventListener("click", () => setChatOpen(false));
  $$("[data-open-chat]").forEach((b) => b.addEventListener("click", () => setChatOpen(true)));
  $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chat-input"); const v = i.value; i.value = ""; chatAsk(v); });
  $("#voice-toggle").addEventListener("click", () => {
    Voice.enabled = !Voice.enabled;
    if (!Voice.enabled && Voice.supported) window.speechSynthesis.cancel();
    updateVoiceButton();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && chat.open) setChatOpen(false); });
  updateVoiceButton();
}

/* ---------- 12. BOOT ---------- */
function initHome() {
  spawnSparkles($("#hero-sparkles"), 12);
  runIntro();
}

/* ---------- 13. FLOATING FRUITS + CURSOR INTERACTIVITY ---------- */
const FRUIT_EMOJIS = ['🍎', '🍌', '🍊', '🍇', '🍓', '🍑', '🥝', '🍐', '🍅', '🥭', '🍍', '🫐', '🍒', '🍈', '🥑', '🍋'];

const fruitState = {
  fruits: [],         // { el, baseX, baseY, offX, offY, velX, velY, size }
  mouseX: -9999,
  mouseY: -9999,
  prevMouseX: -9999,
  prevMouseY: -9999,
  mouseSpeed: 0,
  trailTimer: 0,
  raf: null,
};

function spawnFloatingFruits() {
  if (reducedMotion) return;

  const layer = document.createElement('div');
  layer.id = 'fruit-layer';
  document.body.appendChild(layer);

  // Cursor glow
  const glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.appendChild(glow);

  const count = Math.min(16, Math.max(10, Math.floor(window.innerWidth / 120)));
  const shuffled = [...FRUIT_EMOJIS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'float-fruit';
    el.textContent = shuffled[i % shuffled.length];

    const size = rand(28, 52);
    const opa = rand(0.3, 0.6);
    const dur = rand(18, 35);
    const x = rand(3, 97);
    const y = rand(5, 92);

    // Unique orbit paths per fruit for organic motion
    el.style.cssText = `
      --size: ${size}px;
      --opa: ${opa};
      --dur: ${dur}s;
      --dl: ${-rand(0, dur)}s;
      --r0: ${rand(-15, 15)}deg;
      --r1: ${rand(-20, 20)}deg;
      --r2: ${rand(-18, 18)}deg;
      --r3: ${rand(-22, 22)}deg;
      --r4: ${rand(-16, 16)}deg;
      --dx1: ${rand(-40, 40)}px;
      --dy1: ${rand(-35, 35)}px;
      --dx2: ${rand(-50, 50)}px;
      --dy2: ${rand(-40, 40)}px;
      --dx3: ${rand(-45, 45)}px;
      --dy3: ${rand(-30, 30)}px;
      --dx4: ${rand(-35, 35)}px;
      --dy4: ${rand(-45, 45)}px;
      left: ${x}%;
      top: ${y}%;
    `;

    layer.appendChild(el);

    // Staggered fade-in
    setTimeout(() => el.classList.add('visible'), 400 + i * 150);

    fruitState.fruits.push({
      el,
      baseX: (x / 100) * window.innerWidth,
      baseY: (y / 100) * window.innerHeight,
      offX: 0, offY: 0,
      velX: 0, velY: 0,
      size,
    });
  }

  // Mouse tracking
  document.addEventListener('mousemove', onFruitMouseMove);
  document.addEventListener('mouseleave', onFruitMouseLeave);
  document.addEventListener('click', onFruitClick);

  // Start physics loop
  fruitPhysicsLoop();
}

function onFruitMouseMove(e) {
  fruitState.prevMouseX = fruitState.mouseX;
  fruitState.prevMouseY = fruitState.mouseY;
  fruitState.mouseX = e.clientX;
  fruitState.mouseY = e.clientY;

  const dx = fruitState.mouseX - fruitState.prevMouseX;
  const dy = fruitState.mouseY - fruitState.prevMouseY;
  fruitState.mouseSpeed = Math.sqrt(dx * dx + dy * dy);

  // Update cursor glow position
  const glow = $('#cursor-glow');
  if (glow) {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    glow.classList.add('active');
  }

  // Spawn trail sparks when moving fast
  fruitState.trailTimer++;
  if (fruitState.mouseSpeed > 4 && fruitState.trailTimer % 3 === 0) {
    spawnTrailSpark(e.clientX, e.clientY);
  }
}

function onFruitMouseLeave() {
  fruitState.mouseX = -9999;
  fruitState.mouseY = -9999;
  const glow = $('#cursor-glow');
  if (glow) glow.classList.remove('active');
}

function onFruitClick(e) {
  // Ripple effect on click
  const ripple = document.createElement('div');
  ripple.className = 'cursor-ripple';
  ripple.style.left = e.clientX + 'px';
  ripple.style.top = e.clientY + 'px';
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 750);

  // Burst of sparks from click
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i + rand(-0.3, 0.3);
    const dist = rand(15, 40);
    spawnTrailSpark(
      e.clientX + Math.cos(angle) * 4,
      e.clientY + Math.sin(angle) * 4,
      Math.cos(angle) * dist,
      Math.sin(angle) * dist
    );
  }

  // Extra push to nearby fruits on click
  fruitState.fruits.forEach((f) => {
    const dx = (f.baseX + f.offX) - e.clientX;
    const dy = (f.baseY + f.offY) - e.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 200) {
      const force = (200 - dist) / 200 * 8;
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      f.velX += nx * force;
      f.velY += ny * force;
    }
  });
}

function spawnTrailSpark(x, y, tdx, tdy) {
  const spark = document.createElement('div');
  spark.className = 'trail-spark';
  spark.style.left = x + 'px';
  spark.style.top = y + 'px';
  spark.style.width = rand(3, 7) + 'px';
  spark.style.height = spark.style.width;
  if (tdx !== undefined) {
    spark.style.setProperty('--tdx', tdx + 'px');
    spark.style.setProperty('--tdy', tdy + 'px');
  } else {
    spark.style.setProperty('--tdx', rand(-20, 20) + 'px');
    spark.style.setProperty('--tdy', rand(-20, 20) + 'px');
  }
  document.body.appendChild(spark);
  setTimeout(() => spark.remove(), 650);
}

function fruitPhysicsLoop() {
  const REPEL_RADIUS = 160;
  const REPEL_STRENGTH = 3.5;
  const SPRING = 0.012;       // Pull back to base position
  const DAMPING = 0.92;       // Velocity decay
  const MAX_OFF = 120;        // Max offset from base position

  fruitState.fruits.forEach((f) => {
    // 1. Magnetic repulsion from cursor
    const fx = f.baseX + f.offX;
    const fy = f.baseY + f.offY;
    const dx = fx - fruitState.mouseX;
    const dy = fy - fruitState.mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < REPEL_RADIUS && dist > 0) {
      const force = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * REPEL_STRENGTH;
      const speedBoost = 1 + Math.min(fruitState.mouseSpeed * 0.05, 2);
      const nx = dx / dist;
      const ny = dy / dist;
      f.velX += nx * force * speedBoost;
      f.velY += ny * force * speedBoost;
      f.el.classList.add('repelled');
    } else {
      f.el.classList.remove('repelled');
    }

    // 2. Spring force back to origin
    f.velX -= f.offX * SPRING;
    f.velY -= f.offY * SPRING;

    // 3. Apply damping
    f.velX *= DAMPING;
    f.velY *= DAMPING;

    // 4. Update position
    f.offX += f.velX;
    f.offY += f.velY;

    // 5. Clamp max offset
    const offDist = Math.sqrt(f.offX * f.offX + f.offY * f.offY);
    if (offDist > MAX_OFF) {
      f.offX *= MAX_OFF / offDist;
      f.offY *= MAX_OFF / offDist;
    }

    // 6. Apply transform (additive on top of CSS animation)
    f.el.style.translate = `${f.offX}px ${f.offY}px`;
  });

  fruitState.raf = requestAnimationFrame(fruitPhysicsLoop);
}

// Recalculate base positions on resize
window.addEventListener('resize', () => {
  fruitState.fruits.forEach((f) => {
    const rect = f.el.getBoundingClientRect();
    f.baseX = rect.left + rect.width / 2 - f.offX;
    f.baseY = rect.top + rect.height / 2 - f.offY;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  renderShell();
  hydrateImages();
  hydrateIcons();
  initNavIndicator();
  initSidebar();
  initPageTransitions();
  spawnLeaves($("#leaf-layer"), 9);
  spawnFloatingFruits();
  initChatbot();
  initScrollReveal();

  const page = document.body.dataset.page;
  if (page === "home") initHome();
  if (page === "detection") initDetectionPage();
  if (page === "history") initHistoryPage();
});

