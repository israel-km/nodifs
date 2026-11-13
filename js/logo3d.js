/* NODIFS – floating 3D crest.
   Put <div data-logo3d></div> anywhere and load this file with <script type="module" src="js/logo3d.js">.
   The crest has a transparent background and fills its box, so give the box a size in CSS.

   Options (attributes on the element):
     data-intro="once"     assemble animation: "once" per visit (default), "always" or "never"
     data-wordmark         also show NODIFS and the school name under the crest
     data-follow="false"   do not tilt towards the mouse
     data-theme="dark"     for dark backgrounds: brighter navy edges and silver lettering
     data-label="…"        accessible name (default "NODIFS logo")

   Each element gets el.logo3d = { replay() } once it has loaded.
   Without WebGL (or with an error) the flat logo image is shown instead.
   Pieces come from data/logo3d.json (traced from images/nodifs-logo.png). */

const BASE = new URL("..", import.meta.url);
const SEEN_KEY = "nodifs_logo3d_seen";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let threePromise = null, dataPromise = null;
const loadThree = () => threePromise ||= Promise.all([
  import("./vendor/three/three.module.min.js"),
  import("./vendor/three/RoomEnvironment.js")
]).then(([THREE, env]) => ({ THREE, RoomEnvironment: env.RoomEnvironment }));
const loadData = () => dataPromise ||= fetch(new URL("data/logo3d.json", BASE)).then(r => {
  if (!r.ok) throw new Error("logo3d.json");
  return r.json();
});

const store = {
  get() { try { return sessionStorage.getItem(SEEN_KEY); } catch (_) { return null; } },
  set() { try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (_) { /* private mode */ } }
};

function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (_) { return false; }
}

function fallback(el) {
  if (el.querySelector(".logo3d-fallback")) return;
  const img = new Image();
  img.className = "logo3d-fallback";
  img.alt = el.dataset.label || "NODIFS logo";
  img.src = new URL(el.hasAttribute("data-wordmark") ? "images/logo/nodifs-logo.svg" : "images/logo/nodifs-crest.svg", BASE).href;
  el.replaceChildren(img);
  el.classList.add("is-ready", "is-flat");
}

/* ---------- colours, depth and choreography ---------- */

const COLOURS = { navy: 0x0d1c50, blue: 0x66a4ef, red: 0xc52c28, white: 0xf5f7fb };

/* front / back of each piece in traced pixels (the crest is ~1500px tall) */
function depthOf(p) {
  const g = p.g, c = p.c;
  if (g === "plate") return [0, -46];
  if (g === "shield") return c === "navy" ? [26, -46] : c === "white" ? [14, -4] : [8, -4];
  if (g === "globe") return c === "white" ? [30, 4] : c === "blue" ? [36, 20] : [40, 20];
  if (g === "star") return [36, 6];
  if (g === "book") return c === "white" ? [24, 4] : [30, 8];
  if (g === "cap") return c === "navy" ? [34, -10] : [24, -6];
  if (g === "laurelL" || g === "laurelR") return c === "navy" ? [24, -2] : [20, -4];
  if (g === "ribbon") return c === "navy" ? [38, 14] : [34, 12];
  if (g === "word") return [18, -6];
  return [10, 0];
}

const TAU = Math.PI * 2;
const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c = 1.45; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
};

/* where each piece comes from (offsets in traced pixels, y down), when it starts and how long it takes */
function choreograph(pieces, data) {
  const rnd = mulberry(7);
  const laurelOrder = g => pieces.filter(p => p.g === g).sort((a, b) => b.y - a.y);
  const order = { laurelL: laurelOrder("laurelL"), laurelR: laurelOrder("laurelR") };
  const words = pieces.filter(p => p.g === "word").sort((a, b) => a.x - b.x);
  return pieces.map(p => {
    const r = () => rnd() * 2 - 1;
    switch (p.g) {
      case "plate": return { dz: -700, ry: -1.7, s: .35, t0: 0, dur: 1.4, e: "out" };
      case "shield":
        if (p.c === "navy") return { dz: -700, ry: -1.7, s: .35, t0: 0, dur: 1.4, e: "out" };
        if (p.c === "blue") return { dx: -1100, dz: 200, ry: .9, t0: .35, dur: 1.2, e: "out" };
        if (p.c === "red") return { dx: 1100, dz: 200, ry: -.9, t0: .5, dur: 1.2, e: "out" };
        return { dz: 260, s: 1.35, t0: 1.05, dur: .8, e: "out" };
      case "globe": {
        const late = p.c === "white" ? 0 : .18 + rnd() * .2;
        return { dz: 1100, dy: -150, ry: TAU * (p.c === "white" ? 1 : 1.25), s: .15, t0: 1.25 + late, dur: 1.25, e: "out" };
      }
      case "star": return { dz: 500, rz: -TAU, s: 0, t0: 2.45, dur: .9, e: "back" };
      case "book": return { dy: 320, dz: 120, rx: -1.45, s: .7, t0: 1.9 + rnd() * .35, dur: 1, e: "back" };
      case "cap": return { dy: -800, dz: 200, rz: p.c === "navy" ? .5 : .3, rx: .6, t0: 2.75 + (p.c === "blue" ? .08 : 0), dur: 1.05, e: "back" };
      case "laurelL": case "laurelR": {
        const side = p.g === "laurelL" ? -1 : 1;
        const k = order[p.g].indexOf(p);
        return { dx: side * (520 + rnd() * 260), dy: 120 + r() * 120, dz: 300 + rnd() * 300, rz: side * -(1 + rnd() * .8), ry: side * .9, s: .2,
          t0: 1.55 + k * .14, dur: .95, e: "back" };
      }
      case "ribbon": {
        const side = p.x < data.globe.cx ? -1 : 1;
        return { dx: side * 1300, dy: 60, ry: side * -.6, s: .5, t0: 1.45 + (p.c === "blue" ? .12 : 0), dur: 1.1, e: "out" };
      }
      case "word": return { dy: 220, dz: 150, rx: 1.3, s: .4, t0: 3.3 + words.indexOf(p) * .025, dur: .75, e: "back" };
      default: return { s: 0, t0: 0, dur: 1, e: "out" };
    }
  });
}
const INTRO_END = 4.6;          /* last piece lands */
const SWEEP = [4.0, 5.6];       /* light sweep across the finished crest */

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------- SVG path → THREE.Shape ---------- */

function toShape(THREE, d) {
  const subs = d.split("Z").filter(s => s.trim());
  const paths = subs.map(sub => {
    const path = new THREE.Path();
    const toks = sub.match(/[MLC]|-?\d+(?:\.\d+)?/g);
    let i = 0, cmd = "M";
    const n = () => parseFloat(toks[i++]);
    while (i < toks.length) {
      if (/[MLC]/.test(toks[i])) cmd = toks[i++];
      if (cmd === "M") { path.moveTo(n(), -n()); cmd = "L"; }
      else if (cmd === "L") path.lineTo(n(), -n());
      else path.bezierCurveTo(n(), -n(), n(), -n(), n(), -n());
    }
    return path;
  });
  const shape = new THREE.Shape(paths[0].getPoints(4));
  shape.holes = paths.slice(1).map(p => new THREE.Path(p.getPoints(4)));
  return shape;
}

/* ---------- one crest ---------- */

async function mount(el) {
  const { THREE, RoomEnvironment } = await loadThree();
  const data = await loadData();
  const showWord = el.hasAttribute("data-wordmark");
  const follow = el.dataset.follow !== "false";
  const introMode = el.dataset.intro || "once";
  let playIntro = !reduceMotion && (introMode === "always" || (introMode === "once" && !store.get()));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = "logo3d-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", el.dataset.label || "NODIFS logo");

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc4ff, el.dataset.theme === "dark" ? 2.2 : 1.1); rim.position.set(3, 1, -2); scene.add(rim);
  const sweep = new THREE.PointLight(0xffffff, 0, 6, 1.4); scene.add(sweep);

  const dark = el.dataset.theme === "dark";
  const palette = Object.assign({}, COLOURS, dark ? { navy: 0x24459a, word: 0xe8edf7 } : { word: COLOURS.navy });
  const mats = {};
  for (const [name, hex] of Object.entries(palette)) {
    mats[name] = new THREE.MeshPhysicalMaterial({
      color: hex, metalness: name === "white" ? .05 : name === "word" && dark ? .6 : .2, roughness: name === "white" ? .35 : .3,
      clearcoat: 1, clearcoatRoughness: .14, envMapIntensity: .9
    });
  }

  const pieces = data.pieces.filter(p => showWord || p.g !== "word");
  const plan = choreograph(pieces, data);

  const crest = new THREE.Group();
  const content = new THREE.Group();
  crest.add(content);
  scene.add(crest);

  const BEVEL = 2;
  const items = pieces.map((p, i) => {
    const [front, back] = depthOf(p);
    const geo = new THREE.ExtrudeGeometry(toShape(THREE, p.d), {
      depth: Math.max(front - back - BEVEL * 2, 1), bevelEnabled: true, bevelThickness: BEVEL,
      bevelSize: p.g === "word" ? 1 : 1.6, bevelSegments: 2, curveSegments: 4
    });
    geo.translate(-p.x, p.y, back + BEVEL);              /* pivot each piece around its own centre */
    const mesh = new THREE.Mesh(geo, mats[p.g === "word" && p.c === "navy" ? "word" : p.c]);
    mesh.position.set(p.x, -p.y, 0);
    content.add(mesh);
    return { mesh, home: mesh.position.clone(), a: plan[i] };
  });

  /* centre and scale the finished crest so it is 2 units tall */
  const box = new THREE.Box3().setFromObject(content);
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const unit = 2 / size.y;
  content.scale.setScalar(unit);
  content.position.set(-mid.x * unit, -mid.y * unit, 0);

  /* camera that fits the content into the element */
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
  const contentW = size.x * unit * 1.04, contentH = 2.08;
  let baseDist = 6;
  function resize() {
    const w = Math.max(el.clientWidth, 1), h = Math.max(el.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vf = THREE.MathUtils.degToRad(camera.fov);
    const dH = contentH / 2 / Math.tan(vf / 2);
    const dW = contentW / 2 / (Math.tan(vf / 2) * camera.aspect);
    baseDist = Math.max(dH, dW) * 1.04;
    camera.updateProjectionMatrix();
    render(true);
  }

  /* ---------- animation state ---------- */
  let start = performance.now(), visible = true, running = false, finalPosed = false;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function pose(t) {
    for (const it of items) {
      const a = it.a, m = it.mesh;
      const k = THREE.MathUtils.clamp((t - a.t0) / a.dur, 0, 1);
      const e = ease[a.e](k), inv = 1 - e;
      m.position.set(it.home.x + (a.dx || 0) * inv, it.home.y - (a.dy || 0) * inv, (a.dz || 0) * inv);
      m.rotation.set((a.rx || 0) * inv, (a.ry || 0) * inv, (a.rz || 0) * inv);
      const s = a.s === undefined ? 1 : a.s + (1 - a.s) * Math.min(ease.out(k) * 1.0, 1);
      m.scale.setScalar(Math.max(s, .0001));
      m.visible = k > 0;
    }
  }

  function render(force) {
    const now = performance.now();
    const t = (now - start) / 1000;
    const intro = playIntro ? t : INTRO_END + 10;
    if (intro < INTRO_END || force || !finalPosed) { pose(intro); finalPosed = intro >= INTRO_END; }

    /* whole crest: turn in during the intro, then float */
    const settle = THREE.MathUtils.clamp(intro / INTRO_END, 0, 1);
    const turn = (1 - ease.inOut(settle)) * -.75;
    const idle = reduceMotion ? 0 : Math.max(0, intro - INTRO_END);
    mouse.x += (mouse.tx - mouse.x) * .06;
    mouse.y += (mouse.ty - mouse.y) * .06;
    const fade = THREE.MathUtils.clamp(idle / 1.5, 0, 1);
    crest.rotation.y = turn + fade * (Math.sin(idle * .55) * .16 + mouse.x * .32);
    crest.rotation.x = fade * (Math.sin(idle * .8) * .03 - mouse.y * .18);
    crest.position.y = fade * Math.sin(idle * .9) * .035;

    camera.position.set(0, 0, baseDist * (1 + (1 - ease.out(settle)) * .35));
    camera.lookAt(0, 0, 0);

    /* light sweep */
    const sw = (intro - SWEEP[0]) / (SWEEP[1] - SWEEP[0]);
    if (sw > 0 && sw < 1) {
      sweep.intensity = Math.sin(sw * Math.PI) * 9;
      sweep.position.set(THREE.MathUtils.lerp(-1.8, 1.8, ease.inOut(sw)), .6, 1.1);
    } else sweep.intensity = 0;

    renderer.render(scene, camera);
    if (playIntro && intro >= INTRO_END && !el.dataset.introDone) { el.dataset.introDone = "1"; store.set(); }
  }

  function loop() {
    if (!running) return;
    render();
    requestAnimationFrame(loop);
  }
  function play() {
    if (running || reduceMotion) return;
    running = true;
    requestAnimationFrame(loop);
  }
  const stop = () => { running = false; };

  el.replaceChildren(canvas);
  new ResizeObserver(resize).observe(el);
  resize();
  requestAnimationFrame(() => el.classList.add("is-ready"));

  if (follow && !reduceMotion && matchMedia("(pointer: fine)").matches) {
    addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect();
      mouse.tx = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / innerWidth * 2, -1, 1);
      mouse.ty = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / innerHeight * 2, -1, 1);
    }, { passive: true });
  }

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible && !document.hidden ? play() : stop(); }).observe(el);
  document.addEventListener("visibilitychange", () => (visible && !document.hidden ? play() : stop()));

  el.logo3d = {
    /* jump to a moment of the animation and hold it (used for testing and recording) */
    seek(t) { stop(); playIntro = true; finalPosed = false; start = performance.now() - t * 1000; render(true); },
    replay() {
      if (reduceMotion) return;
      playIntro = true;
      start = performance.now();
      delete el.dataset.introDone;
      finalPosed = false;
      pose(0);
      play();
    }
  };
  if (reduceMotion) render(true); else play();
}

function init(el) {
  if (el.dataset.logo3dInit) return;
  el.dataset.logo3dInit = "1";
  if (!hasWebGL()) { fallback(el); return; }
  /* wait until it is near the screen before downloading anything */
  const io = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    io.disconnect();
    mount(el).catch(err => { console.warn("NODIFS 3D logo:", err); fallback(el); });
  }, { rootMargin: "200px" });
  io.observe(el);
}

const scan = () => document.querySelectorAll("[data-logo3d]").forEach(init);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan); else scan();
window.NODIFSLogo3D = { scan };
