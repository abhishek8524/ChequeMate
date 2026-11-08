/* ChequeMate landing: findings from assets/study.json (built by scripts/study.py) and the 3D account field. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const APP = 'index.html';
const money = v => '$' + Math.round(v).toLocaleString('en-CA');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- theme ---------- */
$('#themeBtn').onclick = () => {
  const r = document.documentElement, d = r.getAttribute('data-theme') !== 'dark';
  r.setAttribute('data-theme', d ? 'dark' : 'light');
  try { localStorage.setItem('cm.theme', JSON.stringify(d ? 'dark' : 'light')); } catch (e) { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent('cm:theme'));
};

/* ---------- open the engine ---------- */
const openApp = (id, twist) => { const q = new URLSearchParams(); if (id) q.set('account', id); if (twist && twist !== 'none') q.set('twist', twist); location.href = `${APP}?${q}#${twist && twist !== 'none' ? 'shock' : 'customer'}`; };
const validId = v => /^\d{1,9}$/.test(String(v).trim());
$('#heroForm').onsubmit = e => { e.preventDefault(); const v = $('#heroAcct').value.trim(); if (!validId(v)) { $('#heroAcct').setAttribute('aria-invalid', 'true'); $('#heroAcct').focus(); return; } openApp(v); };
$('#tryForm').onsubmit = e => {
  e.preventDefault(); const v = $('#tryAcct').value.trim(), err = $('#tryErr');
  if (!validId(v)) { err.hidden = false; err.textContent = 'Enter an account number, digits only.'; $('#tryAcct').focus(); return; }
  err.hidden = true; openApp(v, (new FormData(e.target)).get('tw'));
};
let IDS = null;
$('#heroRandom').onclick = async () => {
  try { if (!IDS) { await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'data/accounts.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); IDS = Object.keys(window.CM_ACCOUNTS || {}); }
    if (IDS.length) { const b = $('#heroRandom svg'); if (b && b.animate) b.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 500, easing: 'ease-out' }); $('#heroAcct').value = IDS[Math.floor(Math.random() * IDS.length)]; $('#heroAcct').removeAttribute('aria-invalid'); return; }
  } catch (e) { /* fall through */ }
  $('#heroAcct').value = ['28754', '35412', '83390', '56034', '26404'][Math.floor(Math.random() * 5)];
};

/* ---------- tooltip ---------- */
const tip = $('#tip');
function hover(el, html) {
  const show = e => { tip.innerHTML = html; tip.hidden = false; const r = el.getBoundingClientRect(), x = e && e.clientX != null ? e.clientX : r.left + r.width / 2, y = e && e.clientY != null ? e.clientY : r.top;
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, x + 12) + 'px'; tip.style.top = Math.max(8, y - tip.offsetHeight - 10) + 'px'; };
  el.addEventListener('pointermove', show); el.addEventListener('focus', () => show()); el.addEventListener('pointerleave', () => tip.hidden = true); el.addEventListener('blur', () => tip.hidden = true);
}

/* ---------- charts ---------- */
function cols(el, items, { max = 100, fmt = v => v + '%', table } = {}) {
  el.innerHTML = `<div class="cols">${items.map((d, i) => `<div class="col${d.alt ? ' alt' : ''}${d.hot ? ' hot' : ''}" tabindex="0" style="--h:${(d.v / max * 100).toFixed(1)}%" data-i="${i}"><span class="v">${esc(fmt(d.v))}</span><span class="bar"></span></div>`).join('')}</div>
    <div class="xl">${items.map(d => `<span>${d.x}</span>`).join('')}</div>${d3legend(items)}${table ? tbl(table) : ''}`;
  $$('.col', el).forEach((c, i) => hover(c, items[i].tip));
}
const d3legend = items => items.legend ? `<div class="legend">${items.legend}</div>` : '';
const tbl = ([head, rows]) => `<details class="tbl"><summary>Show as a table</summary><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;

function render(S) {
  const q = S.quintiles, fifth = ['Lowest', 'Second', 'Middle', 'Fourth', 'Highest'];
  const short6 = Math.round(100 - S.ei_make6);
  const set = (k, v) => $$(`[data-stat="${k}"]`).forEach(e => e.textContent = v);
  set('short6', short6 + '%'); set('q5', Math.round(q[4].ei_short6) + '%'); set('q1', Math.round(q[0].ei_short6) + '%');
  set('gap1', money(q[0].med_gap_ei)); set('gap5', money(q[4].med_gap_ei));
  const d = S.default_by_ei; set('dratio', (d['<3'][1] / d['6+'][1]).toFixed(1) + '×');
  set('mid', Math.round(S.ei_hist[2].pct) + '%');

  cols($('#chQuint'), q.map((r, i) => ({ v: r.ei_short6, x: `<b>${fifth[i]}</b>${money(r.I_lo)}–${money(r.I_hi)}`,
    tip: `<b>${r.ei_short6}% run out before month 6</b>${fifth[i]} income fifth, ${money(r.I_lo)}–${money(r.I_hi)} a month in.<br>Typical savings ${money(r.med_B)} · gap on EI ${money(r.med_gap_ei)}/mo` })),
    { table: [['Income fifth', 'Money in / month', 'Typical savings', 'Gap on EI', 'Run out < 6 mo'], q.map((r, i) => [fifth[i], `${money(r.I_lo)}–${money(r.I_hi)}`, money(r.med_B), money(r.med_gap_ei), r.ei_short6 + '%'])] });

  const db = [['<3', 'Under 3 months'], ['3-6', '3 to 6 months'], ['6+', '6+ months']];
  cols($('#chDefault'), db.map(([k, l]) => ({ v: d[k][1], x: `<b>${l}</b>${d[k][0]} loans`, tip: `<b>${d[k][1]}% defaulted</b>${d[k][0]} borrowers whose savings would last ${l.toLowerCase()} on EI` })),
    { max: 30, table: [['Runway on EI', 'Loans', 'Defaulted'], db.map(([k, l]) => [l, d[k][0], d[k][1] + '%'])] });

  const hist = S.ei_hist.map(h => ({ ...h, label: h.b === '12+' ? '12+ mo' : h.b.replace('-', '–') + ' mo' }));
  const hItems = hist.map((h, i) => ({ v: h.pct, alt: i > 2, hot: i <= 2, x: `<b>${h.label}</b>`, tip: `<b>${h.pct}% of customers</b>Savings last ${h.label} if money in drops to 55%` }));
  hItems.legend = '<span><i class="hot"></i>Runs out before month 6</span><span><i class="alt"></i>Lasts 6 months or more</span>';
  cols($('#chHist'), hItems, { max: 45, table: [['Savings last', 'Share of customers'], hist.map(h => [h.label, h.pct + '%'])] });

  const reg = S.regions, rmax = Math.max(...reg.map(r => r.ei_short6));
  $('#chRegion').innerHTML = `<div class="hbars">${reg.map(r => `<div class="hrow${r.region === 'Prague' ? ' hl' : ''}" tabindex="0"><span>${esc(r.region[0].toUpperCase() + r.region.slice(1))}<small>unemployment ${r.unemp}%</small></span><span class="track"><span class="bar" style="--w:${(r.ei_short6 / rmax * 100).toFixed(1)}%"></span></span><b>${r.ei_short6}%</b></div>`).join('')}</div>
    <p class="note">Share who run out before month 6 on EI. Unemployment is the 2023 district average.</p>`;
  $$('#chRegion .hrow').forEach((row, i) => hover(row, `<b>${reg[i].ei_short6}% fall short</b>${esc(reg[i].region)} · ${reg[i].n} accounts · unemployment ${reg[i].unemp}%`));

  const t = S.twists;
  $('#twResults').innerHTML = [
    [`${t.ei55_make6}%`, 'make it to month 6', 'Laid off, EI at 55%', '#007AFF', '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/>'],
    [`${t.furnace_zero}%`, 'wiped out on day one', 'Furnace costs a month of spending', '#FF9500', '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2 1.4 3 3.2 3.2 5 1-.6 1.7-1.6 2-3 1.6 1.6 3.2 4 3.2 7.2 0 3.4-2.4 5.8-6 5.8z"/>'],
    [`${t.combo_make6}%`, 'make it to month 6', 'EI and bills up 15% together', '#FF2D55', '<path d="M13 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>'],
  ].map(([v, s, l, c, ic]) => `<li><span class="ic" style="--c:${c}"><svg viewBox="0 0 24 24">${ic}</svg></span><b>${v}<span>${s}</span></b><small>${l}</small></li>`).join('');

  // charts animate when they scroll into view
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .3 });
  $$('.chart').forEach(c => io.observe(c));
  field(S.field);
}

/* ---------- reveal + count ---------- */
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); rio.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px -40px 0px' });
$$('.w, .move, .formula, .card, .fieldcard, .try-in').forEach(el => { el.classList.add('rv'); rio.observe(el); });
if (!reduce) $$('.facts [data-count]').forEach(el => {
  const to = +el.dataset.count; if (!to) return; const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-CA'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
});

/* ---------- 3D field: one column per real account ---------- */
function field(values) {
  const T = window.THREE, box = $('#fieldBox'), stage = $('.field-stage'), cv = $('#fieldCanvas');
  let gl = false; try { gl = !!(T && (cv.getContext('webgl2') || cv.getContext('webgl'))); } catch (e) { gl = false; }
  if (!gl) { stage.insertAdjacentHTML('beforeend', '<p class="nogl">This view needs WebGL. The findings below show the same data.</p>'); return; }
  const N = values.length, ROWS = 50, COLS = Math.ceil(N / ROWS), HMAX = 9, CAP = 12.5, h = v => .12 + v / CAP * HMAX, line6 = h(6);
  // columns run lowest -> highest income; within a column, the shortest runways sit at the front
  const cells = [];
  for (let c = 0; c < COLS; c++) values.slice(c * ROWS, (c + 1) * ROWS).map((v, k) => ({ v, rank: c * ROWS + k })).sort((a, b) => a.v - b.v).forEach((o, r) => cells.push({ ...o, c, r }));
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputEncoding = T.sRGBEncoding;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 1, 600);
  const group = new T.Group(); scene.add(group);
  scene.add(new T.HemisphereLight(0xffffff, 0x1a1a2e, .95));
  const sun = new T.DirectionalLight(0xffffff, .9); sun.position.set(-40, 80, 60); scene.add(sun);
  const geo = new T.BoxGeometry(.78, 1, .78); geo.translate(0, .5, 0);
  const mesh = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: .5, metalness: .05 }), cells.length);
  const red = new T.Color('#FF453A').convertSRGBToLinear(), orange = new T.Color('#FF9F0A').convertSRGBToLinear(), lo = new T.Color('#0A84FF').convertSRGBToLinear(), hi = new T.Color('#64D2FF').convertSRGBToLinear(), col = new T.Color();
  const ox = (COLS - 1) / 2, oz = (ROWS - 1) / 2, m = new T.Matrix4();
  cells.forEach((o, i) => { if (o.v < 3) col.copy(red); else if (o.v < 6) col.copy(orange); else col.copy(lo).lerp(hi, Math.min(1, (o.v - 6) / 6.5)); mesh.setColorAt(i, col); });
  group.add(mesh);
  const place = k => { cells.forEach((o, i) => { const d = Math.max(0, Math.min(1, k * 1.6 - o.c / COLS * .6)), e = 1 - Math.pow(1 - d, 3);
    m.makeScale(1, Math.max(.001, h(o.v) * e), 1); m.setPosition(o.c - ox, 0, oz - o.r); mesh.setMatrixAt(i, m); }); mesh.instanceMatrix.needsUpdate = true; };
  // 6-month plane
  const plane = new T.Mesh(new T.PlaneGeometry(COLS + 2, ROWS + 2), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .06, side: T.DoubleSide, depthWrite: false }));
  plane.rotation.x = -Math.PI / 2; plane.position.y = line6; group.add(plane);
  const edge = new T.LineSegments(new T.EdgesGeometry(plane.geometry), new T.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .6 }));
  edge.rotation.x = -Math.PI / 2; edge.position.y = line6; group.add(edge);
  const floor = new T.Mesh(new T.PlaneGeometry(COLS + 6, ROWS + 6), new T.MeshBasicMaterial({ color: 0x15151F, transparent: true, opacity: .8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; group.add(floor);

  let W = 0, H = 0, px = 0, py = 0, tx = 0, ty = 0, t0 = performance.now(), running = false, visible = true, intro = reduce ? 1 : 0;
  const lineTag = $('#fieldLine'), tipEl = $('#fieldTip'), anchor = new T.Vector3();
  function size() { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; renderer.setSize(W, H, false); cam.aspect = W / H;
    const narrow = W / H < 1.1; cam.fov = narrow ? 44 : 30; cam.updateProjectionMatrix(); }
  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    if (intro < 1) { intro = Math.min(1, t / 2.2); place(intro); }
    px += (tx - px) * .06; py += (ty - py) * .06;
    const a = (reduce ? 0 : Math.sin(t * .12) * .18) + px * .35 - .5;
    cam.position.set(Math.sin(a) * 120, 62 + py * 14, Math.cos(a) * 120); cam.lookAt(0, 2.5, 0);
    renderer.render(scene, cam);
    anchor.set(-ox - 1, line6, oz + 1).project(cam);
    lineTag.hidden = false; lineTag.style.left = Math.max(lineTag.offsetWidth + 10, (anchor.x + 1) / 2 * W - 6) + 'px'; lineTag.style.top = ((1 - anchor.y) / 2 * H) + 'px';
    requestAnimationFrame(frame);
  }
  const start = () => { if (running || !visible || document.hidden) return; running = true; requestAnimationFrame(frame); };
  const stop = () => { running = false; };
  size(); if (intro >= 1) place(1); else place(0);
  new ResizeObserver(() => { size(); if (!running) renderer.render(scene, cam); }).observe(stage);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(box);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  // hover: which account is this?
  const ray = new T.Raycaster(), ndc = new T.Vector2(); let pending = null;
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    tx = x / r.width * 2 - 1; ty = y / r.height * 2 - 1;
    if (pending) return; pending = requestAnimationFrame(() => { pending = null;
      ndc.set(x / r.width * 2 - 1, -(y / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObject(mesh)[0];
      if (!hit) { tipEl.hidden = true; return; }
      const o = cells[hit.instanceId], top = Math.max(1, Math.round(100 - o.rank / N * 100));
      tipEl.innerHTML = `<b>${o.v >= 12.5 ? '12+ months' : o.v + ' months'}</b>${o.v < 3 ? 'In trouble fast' : o.v < 6 ? 'Out before EI ends' : 'Makes it through EI'} · savings on EI at 55%<br>Income: ${top <= 50 ? 'top ' + top : 'bottom ' + (101 - top)}% of customers`;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.hidden = false; });
  });
  cv.addEventListener('pointerleave', () => { tipEl.hidden = true; tx = 0; ty = 0; });
  start();
}

const D3 = window.CM3D;
if (D3) {
  const lazy = (el, fn) => { if (!el) return; const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); try { fn(el); } catch (e) { /* 3D is decoration */ } } }, { rootMargin: '200px' }); io.observe(el); };
  lazy($('#chess3d'), el => D3.mountHero(el));
  lazy($('#mate3d'), el => { const m = D3.mountMate(el); if (m && m.setMood) m.setMood('info'); $('#tryForm').addEventListener('change', () => { if (m && m.celebrate) m.celebrate(); }); });
}
fetch('assets/study.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(render).catch(() => {
  $$('.chart').forEach(c => c.innerHTML = '<p class="note">Findings data could not be loaded. Run <code>python3 scripts/study.py &lt;data-dir&gt;</code>.</p>');
});
})();
