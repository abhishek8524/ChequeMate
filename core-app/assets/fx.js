/* ChequeMate FX: Glass design mode.
   - An animated aurora / mesh-gradient background (one tiny WebGL shader, rendered at low resolution and stretched).
   - Liquid-glass refraction on floating chrome (Chromium only: SVG displacement maps through backdrop-filter).
   - A cursor spotlight on cards.
   Everything is optional: "Solid" style or reduced motion turns the moving parts off. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
const isDark = () => { const t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- style switch (Glass / Solid) ---------------- */
let style = store.get('cm.style', 'solid');
function applyStyle(s) {
  style = s === 'solid' ? 'solid' : 'glass';
  root.setAttribute('data-style', style); store.set('cm.style', style);
  $$('[data-style-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.styleSet === style)));
  if (style === 'glass') { startBg(); liquid.refresh(); } else { stopBg(); liquid.clear(); }
}

/* ---------------- aurora background ---------------- */
const FRAG = `
precision highp float;
uniform float t; uniform vec2 res; uniform float dark;
uniform vec3 bg, c0, c1, c2, c3, c4;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
float blob(vec2 w, vec2 c, float r){ return smoothstep(r, 0.0, length(w - c)); }
void main(){
  float asp = res.x / res.y;
  vec2 p = vec2(vUv.x * asp, vUv.y);
  float s = t * 0.035;
  vec2 q = vec2(fbm(p * 1.4 + s), fbm(p * 1.4 - s + 7.3));
  vec2 w = p + (q - 0.5) * 0.55;
  vec3 col = bg;
  float k = dark > 0.5 ? 0.62 : 0.78;
  col = mix(col, c0, blob(w, vec2((0.18 + 0.10 * sin(s * 2.1)) * asp, 0.86 + 0.06 * cos(s * 1.7)), 0.85) * k);
  col = mix(col, c1, blob(w, vec2((0.82 + 0.08 * cos(s * 1.6)) * asp, 0.80 + 0.08 * sin(s * 2.4)), 0.75) * k);
  col = mix(col, c2, blob(w, vec2((0.55 + 0.20 * sin(s * 1.2)) * asp, 0.30 + 0.10 * cos(s * 1.9)), 0.70) * k * 0.85);
  col = mix(col, c3, blob(w, vec2((0.10 + 0.08 * cos(s * 1.4)) * asp, 0.18 + 0.08 * sin(s * 1.1)), 0.55) * k * 0.8);
  col = mix(col, c4, blob(w, vec2((0.92 + 0.05 * sin(s * 2.7)) * asp, 0.12 + 0.06 * cos(s * 2.2)), 0.50) * k * 0.7);
  // soft ribbon of light
  float band = smoothstep(0.08, 0.0, abs(w.y - 0.55 - 0.12 * sin(w.x * 2.2 + s * 3.0)));
  col += band * (dark > 0.5 ? 0.05 : 0.07);
  col += (h(vUv * res + fract(t)) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`;
let bg = null;
function palette() {
  const d = isDark();
  return d
    ? { bg: '#050508', c: ['#0A3DFF', '#6E2BD9', '#00A3A3', '#B0127A', '#0F6BD6'], dark: 1 }
    : { bg: '#EEF0F7', c: ['#8EC5FF', '#C9B6FF', '#9FF0E4', '#FFC2D6', '#FFE3A3'], dark: 0 };
}
function startBg() {
  if (bg || !window.THREE) { if (bg) { bg.cv.hidden = false; bg.run = true; } return; }
  const T = window.THREE;
  let r;
  try { r = new T.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' }); } catch (e) { return; }
  const cv = r.domElement; cv.className = 'fx-bg'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv);
  r.setPixelRatio(1);
  const sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = { t: { value: 0 }, res: { value: new T.Vector2(1, 1) }, dark: { value: 0 }, bg: { value: new T.Color() }, c0: { value: new T.Color() }, c1: { value: new T.Color() }, c2: { value: new T.Color() }, c3: { value: new T.Color() }, c4: { value: new T.Color() } };
  const mat = new T.ShaderMaterial({ uniforms: U, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG, depthTest: false, depthWrite: false });
  sc.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
  const tint = () => { const p = palette(); U.dark.value = p.dark; U.bg.value.set(p.bg); ['c0', 'c1', 'c2', 'c3', 'c4'].forEach((k, i) => U[k].value.set(p.c[i])); };
  const size = () => { const s = .32, w = Math.max(64, Math.round(innerWidth * s)), h = Math.max(64, Math.round(innerHeight * s)); r.setSize(w, h, false); U.res.value.set(w, h); };
  tint(); size();
  addEventListener('resize', size);
  document.addEventListener('cm:theme', () => { tint(); if (reduce) r.render(sc, cam); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { tint(); if (reduce) r.render(sc, cam); });
  bg = { r, cv, run: true };
  const t0 = performance.now(); let last = 0;
  const loop = now => {
    requestAnimationFrame(loop);
    if (!bg.run || document.hidden) return;
    if (now - last < 1000 / 24) return; last = now; // 24 fps is plenty for a slow aurora
    U.t.value = reduce ? 20 : (now - t0) / 1000; r.render(sc, cam);
  };
  r.render(sc, cam);
  if (!reduce) requestAnimationFrame(loop);
}
function stopBg() { if (bg) { bg.run = false; bg.cv.hidden = true; } }

/* ---------------- liquid glass (Chromium) ---------------- */
const liquid = (() => {
  const ok = /Chrome\/\d+/.test(navigator.userAgent) && !reduce;
  const SEL = '.toolbar, .tabbar, .mate-dock, .mate-bubble, .tb-xp, .achv-in, .play-tabs, .seg.theme-switch, .seg.style-switch, .chips button, .h3-cap';
  let svg = null, n = 0; const known = new Map();
  function host() { if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'; document.body.appendChild(svg); } return svg; }
  function map(w, h, rad) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
    const e = Math.max(6, Math.min(22, Math.min(w, h) / 2.4)), hw = w / 2, hh = h / 2, R = Math.min(rad, hw, hh);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const px = i + .5 - hw, py = j + .5 - hh, qx = Math.abs(px) - (hw - R), qy = Math.abs(py) - (hh - R);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), sd = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - R;
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = qx / l * Math.sign(px); ny = qy / l * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
      const s = sd < 0 ? Math.pow(clamp(1 + sd / e, 0, 1), 2) : 0;
      const k = (j * w + i) * 4; d[k] = 128 - nx * s * 127; d[k + 1] = 128 - ny * s * 127; d[k + 2] = 128; d[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c.toDataURL();
  }
  function apply(el) {
    const r = el.getBoundingClientRect(); const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 8 || h < 8 || w * h > 600000) return;
    let k = known.get(el);
    if (k && k.w === w && k.h === h) return;
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    if (!k) { k = { id: 'cm-lg-' + (++n) }; known.set(el, k); }
    k.w = w; k.h = h;
    let f = host().querySelector('#' + k.id);
    if (!f) { f = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); f.id = k.id; host().appendChild(f); }
    f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', w); f.setAttribute('height', h);
    f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('primitiveUnits', 'userSpaceOnUse'); f.setAttribute('color-interpolation-filters', 'sRGB');
    const sc = Math.min(36, Math.max(10, Math.min(w, h) * .55));
    f.innerHTML = `<feImage href="${map(w, h, rad)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G"/>`;
    el.style.setProperty('--lg', `url(#${k.id})`);
    el.classList.add('cm-lg');
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(es => es.forEach(e => { if (style === 'glass') apply(e.target); })) : null;
  function refresh() {
    if (!ok || style !== 'glass') return;
    root.classList.add('lg-ok');
    for (const [el, k] of known) if (!el.isConnected) { known.delete(el); if (ro) ro.unobserve(el); const f = svg && svg.querySelector('#' + k.id); if (f) f.remove(); }
    $$(SEL).forEach(el => { if (!known.has(el) && ro) ro.observe(el); apply(el); });
  }
  function clear() { root.classList.remove('lg-ok'); }
  return { ok, refresh, clear };
})();

/* ---------------- cursor spotlight ---------------- */
const SPOT = '.panel, .finding, .ledger > div, .rr-card, .acct-card, .rr-stats > div, .boss-bar, .micr';
addEventListener('pointermove', e => {
  if (style !== 'glass') return;
  const el = e.target.closest && e.target.closest(SPOT); if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
}, { passive: true });

/* ---------------- boot ---------------- */
function boot() {
  $$('[data-style-set]').forEach(b => b.onclick = () => applyStyle(b.dataset.styleSet));
  applyStyle(style);
  // new floating elements appear over time (chips, bubbles, cards): pick them up
  let pend = false;
  new MutationObserver(() => { if (pend || style !== 'glass' || !liquid.ok) return; pend = true; requestAnimationFrame(() => { pend = false; liquid.refresh(); }); })
    .observe(document.body, { childList: true, subtree: true });
}
root.setAttribute('data-style', style);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
window.CMFX = { applyStyle, get style() { return style; } };
})();
