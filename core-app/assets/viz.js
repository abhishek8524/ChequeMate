/* ChequeMate special graphs: a money-flow Sankey (income sources -> account -> where it goes)
   and the 3D runway terrain for Plan ahead stress grid. */
(() => {
'use strict';
const CM = window.ChequeMate, D3 = window.CM3D || {};
if (!CM) return;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { money, esc, runway, store } = CM;
const on = (n, f) => document.addEventListener('cm:' + n, e => { try { f(e.detail || {}); } catch (err) { console.error('[viz]', err); } });
const reduce = CM.reduceMotion;

/* ================= SANKEY ================= */
const IN = [['Cash deposits', '--s1'], ['Transfers in', '--teal'], ['Pension', '--mint'], ['Interest', '--indigo']];
const OUT = [['Household bills', '--warn'], ['Insurance', '--purple'], ['Loan payments', '--pink'], ['Bank fees', '--gray'], ['Cash withdrawals', '--s2'], ['Card spending', '--crit'], ['Transfers out', '--indigo']];
function sankey() {
  const el = $('#sankey'), a = CM.acc(); if (!el || !a || !el.offsetParent) return;
  const W = Math.max(320, el.clientWidth), small = W < 620, H = small ? 360 : 380;
  const ins = (a.mi || []).map((v, i) => ({ k: IN[i][0], c: IN[i][1], v: Math.max(0, v || 0) })).filter(x => x.v > .5);
  const outs = (a.mo || []).map((v, i) => ({ k: OUT[i][0], c: OUT[i][1], v: Math.max(0, v || 0) })).filter(x => x.v > .5);
  const tin = ins.reduce((s, x) => s + x.v, 0), tout = outs.reduce((s, x) => s + x.v, 0);
  if (!tin && !tout) { el.innerHTML = '<p class="muted small">No transactions to show.</p>'; return; }
  if (tin > tout) outs.push({ k: 'Kept in the account', c: '--good', v: tin - tout, save: 1 });
  else if (tout > tin) ins.push({ k: 'Drawn from the buffer', c: '--crit', v: tout - tin, draw: 1 });
  const total = Math.max(tin, tout);
  const nw = 14, padY = 10, top = 8, bottom = 8, avail = H - top - bottom;
  const lx = small ? 8 : 168, mx = W / 2 - nw / 2, rx = small ? W - 8 - nw : W - 176 - nw;
  const col = (list, x) => { const gaps = padY * (list.length - 1), k = (avail - gaps) / total; let y = top + (avail - (list.reduce((s, n) => s + n.v * k, 0) + gaps)) / 2; return list.map(n => { const h = Math.max(2, n.v * k); const o = Object.assign(n, { x, y, h }); y += h + padY; return o; }); };
  const L = col(ins, lx), R = col(outs, rx), kk = avail / total, mh = total * kk, my = top + (avail - mh) / 2;
  const link = (x0, y0, x1, y1, h) => { const c = (x0 + x1) / 2; return `M${x0},${y0} C${c},${y0} ${c},${y1} ${x1},${y1} L${x1},${y1 + h} C${c},${y1 + h} ${c},${y0 + h} ${x0},${y0 + h} Z`; };
  let defs = '', paths = '', yM = my, yM2 = my;
  L.forEach((n, i) => { const h = n.v * kk; defs += `<linearGradient id="skl${i}" x1="0" x2="1"><stop offset="0" style="stop-color:var(${n.c})"/><stop offset="1" style="stop-color:var(--accent)"/></linearGradient>`;
    paths += `<path class="sk-link" data-t="${esc(n.k)}: ${money(n.v)} a month (${Math.round(n.v / total * 100)}%)" d="${link(n.x + nw, n.y, mx, yM, h)}" fill="url(#skl${i})" style="--d:${i * 60}ms"/>`; yM += h; });
  R.forEach((n, i) => { const h = n.v * kk; defs += `<linearGradient id="skr${i}" x1="0" x2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(${n.c})"/></linearGradient>`;
    paths += `<path class="sk-link${n.save ? ' save' : ''}" data-t="${esc(n.k)}: ${money(n.v)} a month (${Math.round(n.v / total * 100)}%)" d="${link(mx + nw, yM2, n.x, n.y, h)}" fill="url(#skr${i})" style="--d:${300 + i * 60}ms"/>`; yM2 += h; });
  const node = (n, side) => `<rect class="sk-node" x="${n.x}" y="${n.y}" width="${nw}" height="${n.h}" rx="4" style="fill:var(${n.c})"/>` + (small ? '' :
    `<text class="sk-lab" x="${side === 'l' ? n.x - 10 : n.x + nw + 10}" y="${n.y + n.h / 2}" text-anchor="${side === 'l' ? 'end' : 'start'}" dominant-baseline="middle"><tspan class="sk-k">${esc(n.k)}</tspan><tspan class="sk-v" x="${side === 'l' ? n.x - 10 : n.x + nw + 10}" dy="16">${money(n.v)}</tspan></text>`);
  const mid = `<rect class="sk-node mid" x="${mx}" y="${my}" width="${nw}" height="${mh}" rx="5"/><text class="sk-lab mid" x="${mx + nw / 2}" y="${my - 2 > 14 ? my - 6 : my + mh + 16}" text-anchor="middle"><tspan class="sk-k">Account ${a.id}</tspan></text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs><g class="sk-links${reduce ? '' : ' anim'}">${paths}</g>${L.map(n => node(n, 'l')).join('')}${mid}${R.map(n => node(n, 'r')).join('')}</svg><div class="sk-tip" hidden></div>
    ${small ? `<div class="sk-legend">${[...L, ...R].map(n => `<span><i style="background:var(${n.c})"></i>${esc(n.k)} <b>${money(n.v)}</b></span>`).join('')}</div>` : ''}`;
  const tip = $('.sk-tip', el);
  $$('.sk-link', el).forEach(p => {
    p.onpointerenter = () => { el.classList.add('focus'); p.classList.add('on'); tip.hidden = false; tip.textContent = p.dataset.t; };
    p.onpointermove = e => { const r = el.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top - 8) + 'px'; };
    p.onpointerleave = () => { el.classList.remove('focus'); p.classList.remove('on'); tip.hidden = true; };
  });
  const sr = tin > 0 ? (tin - tout) / tin : 0;
  $('#sankeySub').textContent = tin >= tout ? `Average month: ${money(tin)} in, ${money(tout)} out. ${Math.round(sr * 100)}% stays in the account.` : `Average month: ${money(tout)} out against ${money(tin)} in. The ${money(tout - tin)} gap comes out of the buffer.`;
}
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (CM.view === 'customer') sankey(); }, 200); });

/* ================= 3D TERRAIN ================= */
const INCS = [100, 85, 70, 55, 40, 25, 0], BILLS = [0, 10, 15, 25, 40];
let terr = null, mode = store.get('cm.heatMode', 'grid');
function terrainData() {
  const a = CM.acc(), sh = CM.st.shock, P = CM.shockParams(a, sh);
  return { rows: BILLS, cols: INCS, vals: BILLS.map(b => INCS.map(i => runway(a.B, a.I, a.S, { mult: i / 100, extra: b / 100 * a.H + sh.extra, oneOff: P.oneOff }).v)), cur: [BILLS.indexOf(sh.bills), INCS.indexOf(sh.inc)] };
}
function setMode(m) {
  mode = D3.ok ? m : 'grid'; store.set('cm.heatMode', mode);
  $$('#heatMode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
  $('#heatGrid').hidden = mode !== 'grid'; $('#terrain').hidden = mode !== '3d';
  $('#heatHint').textContent = mode === '3d' ? 'Taller is safer: each bar is months of runway. Drag to orbit, hover to read, select a bar to load that scenario.' : 'Months of runway for every mix of income cut and bill increase. Select a cell to load it.';
  if (mode === '3d') {
    if (!terr && D3.mountTerrain) terr = D3.mountTerrain($('#terrain'), (i, j) => { const s = CM.st.shock; s.inc = INCS[j]; s.bills = BILLS[i]; s.preset = 'custom'; CM.go('shock'); });
    if (terr) terr.set(terrainData());
  }
}
let bound = false;
on('shock', () => {
  if (!bound && $('#heatMode')) { bound = true; $$('#heatMode button').forEach(b => b.onclick = () => setMode(b.dataset.m)); if (!D3.ok) $('#heatMode').hidden = true; setMode(mode); }
  else if (mode === '3d' && terr) terr.set(terrainData());
});

on('view', ({ view }) => { if (view === 'customer') requestAnimationFrame(sankey); });
on('account', () => setTimeout(() => { if (CM.view === 'customer') sankey(); }, 0));
on('theme', () => { if (CM.view === 'customer') sankey(); });
})();
