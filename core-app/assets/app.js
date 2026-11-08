/* ChequeMate — financial resilience engine (static, no backend).
   Runway math follows the Tangerine track judges' definitions exactly. */
(() => {
'use strict';

/* ---------------- utilities ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const CAD = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const money = v => (v == null || !isFinite(v)) ? '—' : CAD.format(Math.round(v)).replace(/\s?CA/, '');
const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r25 = v => Math.max(0, Math.round(v / 25) * 25);
const median = arr => { const a = [...arr].sort((x, y) => x - y); const n = a.length; if (!n) return 0; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
const mean = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FONT = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'Archivo, sans-serif';
const V = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const alpha = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
  x: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
};
const emit = (n, d = {}) => { try { document.dispatchEvent(new CustomEvent('cm:' + n, { detail: Object.assign({ id: st.id }, d) })); } catch (e) { /* listener error */ } };
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400); }
function tween(el, to, fmt, dur = 800) {
  if (!el) return;
  if (reduceMotion || !isFinite(to)) { el.textContent = fmt(to); return; }
  const from = 0, t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function setRangeFill(input) { const p = (input.value - input.min) / (input.max - input.min) * 100; input.style.setProperty('--p', p + '%'); }

/* ---------------- the engine ---------------- */
/** Judges' runway: buffer_left = B - one_off; gap = spending_after - income_after. */
function runway(B, I, S, o = {}) {
  const one = o.oneOff || 0, mult = o.mult ?? 1, extra = o.extra || 0;
  const left = B - one, gap = S + extra - I * mult;
  if (left <= 0) return { v: 0, left, gap, kind: 'zero' };
  if (gap <= 0) return { v: Infinity, left, gap, kind: 'none' };
  const v = Math.min(left / gap, 120);
  return { v: Math.round(v * 10) / 10, left, gap, kind: v >= 120 ? 'cap' : 'ok' };
}
const rwText = r => r.v === Infinity ? '120+' : r.v.toFixed(1);
const rwLong = r => r.v === Infinity ? 'no shortfall (120+ months)' : `${r.v.toFixed(1)} months`;
const status = v => v < 3 ? 'crit' : v < 6 ? 'warn' : 'good';

/* ---------------- state ---------------- */
let DATA = window.CM_ACCOUNTS || {};
const BUILTIN = DATA;
const INS = window.CM_INSIGHTS || {};
let SRC = { kind: 'builtin', label: 'Tangerine track sample' };
let IDS = [], POP = null;
const st = {
  id: null,
  shock: { inc: 100, ei: 6, bills: 0, extra: 0, one: 0, oneMult: null, after: 'back', preset: 'none' },
  plan: { save: null, cut: 20, side: 0 },
  budget: { inc: null, rule: '50-30-20', zb: null },
  invest: { mo: null, yrs: 15, r: null },
  chat: [],
};
const charts = {};
const SHOCKS = [
  { id: 'none', name: 'No shock', desc: 'Life as usual. The baseline.', set: {}, c: 'var(--gray)', ic: '<path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>' },
  { id: 'layoff', name: 'Laid off, EI at 55%', desc: 'EI pays 55% of usual income for 6 months.', set: { inc: 55, ei: 6 }, c: 'var(--accent)', ic: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17"/>' },
  { id: 'furnace', name: 'Furnace dies', desc: 'Repair costs a full month of typical spending.', set: { oneMult: 1 }, c: 'var(--warn)', ic: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2.4 1.6 3 3.6 3 5 1-.6 1.6-1.8 1.8-3 1.8 1.6 3.6 4.2 3.6 7.4 0 3.2-2.4 5.6-6 5.6z"/>' },
  { id: 'combo', name: 'Layoff and bills up 15%', desc: 'EI at 55% and household bills rise 15% the same month.', set: { inc: 55, ei: 6, bills: 15 }, c: 'var(--pink)', ic: '<path d="M13 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>' },
  { id: 'rent', name: 'Rent goes up $300', desc: 'A new lease adds $300 to every month.', set: { extra: 300 }, c: 'var(--indigo)', ic: '<path d="M12 19V5M6 11l6-6 6 6"/>' },
  { id: 'zero', name: 'No income at all', desc: 'Job gone and no EI. The hardest case.', set: { inc: 0, ei: 6 }, c: 'var(--crit)', ic: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>' },
  { id: 'storm', name: 'Perfect storm', desc: 'Layoff at 55%, bills up 15% and a one-month repair.', set: { inc: 55, ei: 6, bills: 15, oneMult: 1 }, c: 'var(--purple)', ic: '<path d="M7 16a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 16"/><path d="m12.5 13-2 4h3l-2 4"/>' },
];
function acc(id = st.id) { const a = DATA[id]; if (!a) return null; return Object.assign({ id: +id }, a); }
function profile(id = st.id) {
  const a = DATA[id] || {};
  const d = { name: `Customer ${id}`, prov: 'ON', house: a.joint ? 2 : 1, home: 'rent', goal: 'fund', risk: '5', target: '3', job: 'steady', notes: '' };
  return Object.assign(d, store.get('cm.p.' + id, {}));
}
function shockParams(a, sh = st.shock) {
  const one = sh.oneMult != null ? sh.oneMult * a.S : sh.one;
  return { mult: sh.inc / 100, extra: (sh.bills / 100) * a.H + sh.extra, oneOff: one };
}
const isNoShock = sh => sh.inc === 100 && sh.bills === 0 && sh.extra === 0 && (sh.oneMult == null ? sh.one === 0 : sh.oneMult === 0);
function shockLabel(sh = st.shock, a = acc()) {
  if (isNoShock(sh)) return 'no shock';
  const p = [];
  if (sh.inc < 100) p.push(sh.inc === 0 ? 'income stops' : `income drops to ${sh.inc}%${sh.inc === 55 ? ' (EI)' : ''} for ${sh.ei} months`);
  if (sh.bills) p.push(`household bills ${sh.bills > 0 ? 'up' : 'down'} ${Math.abs(sh.bills)}%`);
  if (sh.extra) p.push(`${money(sh.extra)} a month in new costs`);
  const one = sh.oneMult != null ? sh.oneMult * a.S : sh.one;
  if (one) p.push(`a one-off cost of ${money(one)}`);
  return p.join(', ');
}

/* ---------------- dataset prep ---------------- */
function prepDataset() {
  IDS = Object.keys(DATA).map(Number).sort((x, y) => x - y);
  const ei = [], base = [];
  for (const id of IDS) { const a = DATA[id]; ei.push(runway(a.B, a.I, a.S, { mult: .55 }).v); base.push(runway(a.B, a.I, a.S)); }
  const sorted = [...ei].sort((x, y) => x - y);
  // seasonality from monthly series
  const sin = Array(12).fill(0), sout = Array(12).fill(0), cnt = Array(12).fill(0); let tin = 0, tout = 0, tc = 0;
  for (const id of IDS) {
    const a = DATA[id]; let [y, m] = a.m0.split('-').map(Number); m -= 1;
    for (let k = 0; k < a.n; k++) { const mi = (m + k) % 12; sin[mi] += a.in[k]; sout[mi] += a.out[k]; cnt[mi]++; tin += a.in[k]; tout += a.out[k]; tc++; }
  }
  const season = { in: sin.map((s, i) => cnt[i] ? (s / cnt[i]) / (tin / tc) : 0), out: sout.map((s, i) => cnt[i] ? (s / cnt[i]) / (tout / tc) : 0) };
  POP = { ei, eiSorted: sorted, base, season, n: IDS.length };
}
function eiPercentile(v) { // share of customers with shorter layoff runway
  const a = POP.eiSorted; let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] < v) lo = mid + 1; else hi = mid; } return lo / a.length;
}
function monthLabels(a) { let [y, m] = a.m0.split('-').map(Number); m -= 1; const out = []; for (let k = 0; k < a.n; k++) { const mi = (m + k) % 12, yy = y + Math.floor((m + k) / 12); out.push(`${MONTHS[mi]} ${String(yy).slice(2)}`); } return out; }

/* ---------------- charts ---------------- */
function merge(t, s) { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && !(s[k] instanceof Function)) { t[k] = merge(t[k] || {}, s[k]); } else t[k] = s[k]; } return t; }
function baseOpts(extra = {}) {
  const ink = V('--ink'), ink2 = V('--ink-2'), muted = V('--muted'), line = V('--line'), elev = V('--elev');
  return merge({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: reduceMotion ? 0 : 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 6 } },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: elev, titleColor: ink, bodyColor: ink2, borderColor: line, borderWidth: 1, padding: 12, cornerRadius: 12, boxWidth: 8, boxHeight: 8, boxPadding: 5, usePointStyle: true, caretSize: 0,
        titleFont: { family: FONT, weight: '600', size: 13 }, bodyFont: { family: FONT, size: 12.5 } },
    },
    scales: {
      x: { grid: { display: false }, border: { color: line }, ticks: { color: muted, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkipPadding: 22, padding: 6 } },
      y: { position: 'right', grid: { color: line, drawTicks: false }, border: { display: false, dash: [3, 4] }, ticks: { color: muted, font: { family: FONT, size: 11 }, padding: 10, maxTicksLimit: 6 } },
    },
  }, extra);
}
function areaFill(col, top = .26) { return c => { const { ctx, chartArea } = c.chart; if (!chartArea) return alpha(col, top / 2); const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); g.addColorStop(0, alpha(col, top)); g.addColorStop(1, alpha(col, 0)); return g; }; }
function chart(id, cfg) {
  const el = document.getElementById(id); if (!el || !window.Chart) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el.getContext('2d'), cfg);
}
const shadePlugin = { id: 'shade', beforeDatasetsDraw(c, _a, o) {
  if (!o || o.from == null) return; const { ctx, chartArea: ca, scales: { x } } = c;
  const step = x.getPixelForValue(1) - x.getPixelForValue(0); const x0 = Math.max(ca.left, x.getPixelForValue(o.from) - step / 2);
  ctx.save(); ctx.fillStyle = o.color; ctx.fillRect(x0, ca.top, ca.right - x0, ca.bottom - ca.top);
  if (o.label) { ctx.fillStyle = o.ink; ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(o.label, ca.right - 6, ca.top + 14); }
  ctx.restore(); } };
const moneyTick = v => Math.abs(v) >= 1000 ? (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v) / 1000) + 'k' : money(v);

/* ---------------- runway strip (signature) ---------------- */
function strip(r, o = {}) {
  const max = o.max || 24, v = r.v, inf = v === Infinity, over = inf || v > max;
  const w = over ? 100 : (v / max) * 100;
  const s = o.fill || (inf ? 'good' : status(v));
  const ticks = [0, 6, 12, 18, 24, 36, 48].filter(t => t <= max);
  const marks = (o.marks || []).filter(m => m.at > 0 && m.at <= max).map(m => `<div class="strip-mark${m.cls ? ' ' + m.cls : ''}" style="left:${m.at / max * 100}%"><span>${esc(m.label)}</span></div>`).join('');
  return `<div class="strip${o.compact ? ' compact' : ''}">
    <div class="strip-top">
      <div class="strip-big"><span class="n" data-to="${inf ? 'inf' : v}">${inf ? '120+' : '0.0'}</span><span class="u">${inf ? 'months, no shortfall' : 'months'}</span></div>
      ${o.pill ? `<span class="pill ${o.pill[0]}">${esc(o.pill[1])}</span>` : ''}
    </div>
    <div class="strip-track" style="--tick:${100 / max}%"><div class="strip-fill${v === 0 ? ' zero' : ''}" data-w="${w}" style="--fill-c:var(--${s})"></div>${marks}</div>
    <div class="strip-scale">${ticks.map(t => `<span style="left:${t / max * 100}%">${t}${t === max ? (over && !inf ? '+' : '') + ' mo' : ''}</span>`).join('')}</div>
    ${o.note ? `<p class="strip-note">${o.note}</p>` : ''}
  </div>`;
}
function ringsSVG(items, size = 188) {
  const sw = size * .118, gap = size * .018, c = size / 2;
  let h = `<svg class="rings" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(items.map(i => i.label).join(', '))}">`;
  items.forEach((it, i) => {
    const r = c - sw / 2 - i * (sw + gap), C = 2 * Math.PI * r, p = clamp(it.p || 0, 0, 2);
    h += `<circle cx="${c}" cy="${c}" r="${r}" style="stroke:${it.color};opacity:.2" stroke-width="${sw}"/>`;
    h += `<circle class="arc" cx="${c}" cy="${c}" r="${r}" transform="rotate(-90 ${c} ${c})" style="stroke:${it.color}" stroke-width="${sw}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - Math.min(p, 1))}"/>`;
    if (p > 1) h += `<circle class="arc" cx="${c}" cy="${c}" r="${r}" transform="rotate(-90 ${c} ${c})" style="stroke:${it.color};filter:drop-shadow(0 0 3px rgba(0,0,0,.35))" stroke-width="${sw}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - Math.min(p - 1, .999))}"/>`;
  });
  return h + '</svg>';
}
function animateRings(root) { $$('.rings .arc', root).forEach(a => { requestAnimationFrame(() => requestAnimationFrame(() => a.style.strokeDashoffset = a.dataset.off)); }); }
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 19h8M9.2 16.6h5.6l-.8-5h-4zM9.6 11.6C8.2 10.8 7.8 9.2 8.7 8c.8-1 2.3-1.3 3.3-.4.9-.9 2.4-.6 3.3.4.9 1.2.5 2.8-.9 3.6"/></svg>';
function tone(v) { return v === Infinity || v >= 6 ? 'good' : v >= 3 ? 'warn' : 'crit'; }
function walletCard(o) {
  return `<div class="wcard ${o.tone}" data-tilt>
    <div class="wc-top"><span class="lg">${LOGO}ChequeMate</span><span class="wc-glass">${esc(o.badge)}</span></div>
    <div class="wc-mid"><small>${esc(o.midLabel)}</small><strong>${o.mid}</strong></div>
    <div class="wc-bot"><div><div>${esc(o.name)}</div><div class="no">•••• ${String(o.id).slice(-4)}</div></div><div class="rw"><span>${esc(o.rwLabel)}</span><b>${o.rw}</b></div></div>
  </div>`;
}
function bindTilt(root) {
  if (reduceMotion || matchMedia('(hover: none)').matches) return;
  $$('[data-tilt]', root).forEach(el => {
    el.onpointermove = e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg'); el.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%'); el.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%'); el.classList.add('lit'); };
    el.onpointerleave = () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); el.classList.remove('lit'); };
  });
}
function animateStrips(root) {
  $$('.strip-fill', root).forEach(f => { f.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = f.dataset.w + '%'; })); });
  $$('.strip-big .n', root).forEach(n => { const t = n.dataset.to; if (t === 'inf') return; tween(n, +t, x => x.toFixed(1), 900); });
}

/* ---------------- shell: account bar, router, theme ---------------- */
function initials(p, id) {
  if (!p.name || /^Customer \d+$/.test(p.name)) return '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4"/><path d="M4 21c1.3-4.2 4.4-6.2 8-6.2s6.7 2 8 6.2z"/></svg>';
  return esc(p.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());
}
function micrHTML(a) {
  const p = profile(a.id);
  const ei = runway(a.B, a.I, a.S, { mult: .55 });
  const chips = [];
  if (a.age != null) chips.push(`<span class="chip">${a.age} yrs${a.sex ? ', ' + (a.sex === 'F' ? 'woman' : 'man') : ''}</span>`);
  if (a.region) chips.push(`<span class="chip">${esc(a.region[0].toUpperCase() + a.region.slice(1))}</span>`);
  if (a.joint) chips.push('<span class="chip">Joint</span>');
  if (a.card) chips.push(`<span class="chip">${a.card[0].toUpperCase() + a.card.slice(1)} card</span>`);
  if (a.loan) { const L = { A: ['good', 'Loan repaid'], B: ['crit', 'Loan defaulted'], C: ['info', 'Loan on track'], D: ['crit', 'Loan in arrears'] }[a.loan.status]; chips.push(`<span class="pill ${L[0]}">${L[1]}</span>`); }
  chips.push(`<span class="pill ${tone(ei.v)}">Layoff runway ${rwText(ei)} mo</span>`);
  return `<span class="avatar">${initials(p, a.id)}</span>
    <div class="micr-who"><strong>${esc(p.name)}</strong><span>Account ${a.id}${SRC.kind === 'upload' ? ', uploaded' : a.opened ? ', since ' + esc(a.opened.slice(0, 4)) : ''}</span></div>
    <div class="micr-chips">${chips.join('')}</div>`;
}
function renderMicr() { const a = acc(); if (!a) return; const h = micrHTML(a); $$('[data-micr]').forEach(el => el.innerHTML = h); const p = profile(a.id); $('#tbAcct').innerHTML = `<span class="avatar sm">${initials(p, a.id)}</span><span>${esc(p.name)}</span>`; }

const TITLES = { paradox: 'The paradox', customer: 'Customer', shock: 'Shock lab', plan: 'Plan', budget: 'Budget', invest: 'Investing', coach: 'Coach', data: 'Your data', resources: 'Resources', profile: 'Profile', arena: 'Quests', play: 'Play' };
function openSheet() { $('#sheet').hidden = false; $('#sheetBg').hidden = false; }
function closeSheet() { const s = $('#sheet'); if (s) { s.hidden = true; $('#sheetBg').hidden = true; } }
const VIEWS = ['paradox', 'customer', 'shock', 'plan', 'budget', 'invest', 'coach', 'data', 'resources', 'profile', 'arena', 'play'];
const RENDER = {};
let currentView = null;
function route() {
  let v = location.hash.slice(1); if (!VIEWS.includes(v)) v = 'paradox';
  currentView = v;
  $$('.view').forEach(s => s.hidden = s.dataset.view !== v);
  $$('#nav a, #tabbar a').forEach(a => { if (a.getAttribute('href') === '#' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#moreBtn').toggleAttribute('aria-current', ['invest', 'coach', 'data', 'resources', 'profile', 'arena', 'play'].includes(v));
  $('#tbTitle').textContent = TITLES[v]; document.title = TITLES[v] + ' – ChequeMate';
  closeSheet();
  renderMicr();
  RENDER[v] && RENDER[v]();
  emit('view', { view: v });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function go(v) { if (location.hash === '#' + v) route(); else location.hash = v; }

function setAccount(id, quiet) {
  id = +id; if (!DATA[id]) return false;
  const changed = st.id !== id;
  st.id = id; store.set('cm.last.' + SRC.kind, id);
  $('#acctInput').value = id; $('#acctInput').removeAttribute('aria-invalid'); $('#acctErr').hidden = true;
  if (changed) { st.plan.save = null; st.budget.inc = null; st.budget.zb = null; st.invest.mo = null; st.invest.r = null; st.chat = []; }
  if (changed) emit('account');
  if (!quiet) { renderMicr(); RENDER[currentView] && RENDER[currentView](); }
  return true;
}

function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
  $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === (t || 'system'))));
  store.set('cm.theme', t || 'system');
  emit('theme', { theme: t || 'system' });
  drawGuilloche();
  if (currentView) RENDER[currentView] && RENDER[currentView]();
}

/* ---------------- guilloché (cheque security print) ---------------- */
function drawGuilloche() {
  const c = $('#guilloche'); if (!c) return; const hero = $('#hero'); if (!hero || hero.offsetParent === null) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1); const w = hero.clientWidth, h = hero.clientHeight;
  c.width = w * dpr; c.height = h * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const col = V('--accent');
  const rosette = (cx, cy, R, r, d, turns, a) => {
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2 * turns; t += 0.01) {
      const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = alpha(col, a); ctx.lineWidth = 0.7; ctx.stroke();
  };
  const R = Math.min(260, w * .32);
  rosette(w - R * 0.55, R * 0.65, R, R * 0.29, R * 0.42, 14, .16);
  rosette(w - R * 0.55, R * 0.65, R * 0.72, R * 0.17, R * 0.33, 12, .12);
  // wave band along the bottom, like the security line on a cheque
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 3) { const y = h - 26 - k * 4 + Math.sin(x / 26 + k * .55) * 7 + Math.sin(x / 71) * 4; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.strokeStyle = alpha(col, .1); ctx.lineWidth = .7; ctx.stroke();
  }
}

/* ================= VIEW: PARADOX ================= */
RENDER.paradox = () => {
  const q = INS.quartiles || [];
  const pair = (INS.pair || []).filter(id => BUILTIN[id]);
  $('#pair').innerHTML = pair.map(id => {
    const a = Object.assign({ id }, BUILTIN[id]); const r = runway(a.B, a.I, a.S, { mult: .55 }); const t = r.v >= 6 ? 'good' : 'crit';
    return `<div class="pair-col">
      ${walletCard({ tone: t, badge: r.v >= 6 ? 'Outlasts EI' : 'Out before EI ends', midLabel: 'Money in each month', mid: money(a.I), name: `Account ${id}`, id, rwLabel: 'Lasts on EI', rw: rwText(r) + ' mo' })}
      ${strip(r, { max: 24, compact: true, fill: r.v >= 6 ? 'good' : 'crit', marks: [{ at: 6, label: 'EI ends' }] })}
      <div class="pair-cap"><span class="small ink2">Spends ${pct(a.S / a.I)} of it. Buffer ${money(a.B)}.</span><button class="btn sm" type="button" data-open="${id}">Run the layoff</button></div>
    </div>`;
  }).join('');
  animateStrips($('#pair')); bindTilt($('#pair'));
  $$('#pair [data-open]').forEach(b => b.onclick = () => openWithShock(+b.dataset.open, 'layoff'));

  const labels = ['Lowest quarter', 'Second quarter', 'Third quarter', 'Highest quarter'];
  $('#quartBars').innerHTML = q.map((x, i) => `<div class="bar-row"><div class="lab">${labels[i]}<small>${money(x.I)} a month</small></div>
    <div class="track"><div class="fill" data-w="${x.outIn6 * 100}" style="--c:var(--${i === 3 ? 'crit' : 's1'})"></div></div><div class="val">${pct(x.outIn6)}</div></div>`).join('');
  $('#quartNote').textContent = q.length ? `Customers in the highest income quarter are ${Math.round(q[3].outIn6 / q[0].outIn6)}× as likely to run out within 6 months as the lowest.` : '';
  animBars('#quartBars');
  $('#whyTable').innerHTML = `<thead><tr><th>Income quarter</th><th class="r">Typical income</th><th class="r">Spends</th><th class="r">Buffer lasts</th></tr></thead><tbody>${q.map((x, i) =>
    `<tr${i === 3 ? ' class="best"' : ''}><td>${labels[i]}</td><td class="r">${money(x.I)}</td><td class="r">${pct(x.spendRatio)}</td><td class="r">${x.bufferMonths.toFixed(1)} mo</td></tr>`).join('')}</tbody>`;

  // scatter
  const s1 = V('--s1'), crit = V('--crit');
  const pts = (INS.scatter || []).map(([id, I, ei]) => ({ x: I, y: Math.min(ei, 36), id, raw: ei }));
  chart('scatter', { type: 'scatter', data: { datasets: [
    { data: pts, backgroundColor: alpha(s1, .5), borderColor: V('--surface'), borderWidth: 1, pointRadius: 4, pointHoverRadius: 7 },
    { type: 'line', data: [{ x: 0, y: 6 }, { x: 45000, y: 6 }], borderColor: crit, borderWidth: 2, borderDash: [6, 5], pointRadius: 0, pointHoverRadius: 0 },
  ] }, options: baseOpts({
    interaction: { mode: 'nearest', intersect: true },
    plugins: { tooltip: { filter: i => i.datasetIndex === 0, callbacks: { title: i => `Account ${i[0].raw.id}`, label: i => `${money(i.raw.x)} a month, ${i.raw.raw >= 120 ? 'no shortfall' : i.raw.raw.toFixed(1) + ' months'}` } } },
    scales: { x: { type: 'linear', min: 0, max: 45000, ticks: { callback: moneyTick }, title: { display: true, text: 'Typical money in per month', color: V('--muted'), font: { family: FONT, size: 11 } } },
      y: { min: 0, max: 36, ticks: { stepSize: 6, callback: v => v === 36 ? '36+' : v }, title: { display: true, text: 'Months of runway after layoff', color: V('--muted'), font: { family: FONT, size: 11 } } } },
    onClick: (_e, els) => { const el = els.find(x => x.datasetIndex === 0); if (el) openWithShock(pts[el.index].id, 'layoff'); },
  }) });

  // findings
  const out6 = POP && SRC.kind === 'builtin' ? POP.ei.filter(v => v < 6).length / POP.n : null;
  const jd = INS.jointDefault || { joint: [0, 0], solo: [0, 0] };
  const se = INS.season || { out: [] };
  const F = [
    [`${Math.round((INS.fragileDefault || 0) / (INS.sturdyDefault || 1))}×`, `Borrowers whose layoff runway is under 6 months defaulted at ${pct(INS.fragileDefault || 0, 1)}, against ${pct(INS.sturdyDefault || 0, 1)} for everyone else.`],
    [`${jd.joint[0]} of ${jd.joint[1]}`, `Joint accounts with a loan that defaulted. Single-owner accounts: ${jd.solo[0]} of ${jd.solo[1]} (${pct(jd.solo[0] / (jd.solo[1] || 1), 1)}).`],
    [`+${Math.round(((se.out[0] || 1) - 1) * 100)}%`, `January spending against an average month, across every account. June runs +${Math.round(((se.out[5] || 1) - 1) * 100)}%. A buffer has to survive the winter bills.`],
    [`${q[3] ? pct(q[3].spendRatio) : ''}`, `Share of income the highest-income quarter spends. The lowest quarter spends ${q[0] ? pct(q[0].spendRatio) : ''}, which is what keeps them afloat.`],
    [`${INS.defaults || 76} of ${INS.defaults || 76}`, 'Defaulted loans whose account dipped below zero first. No repaid or on-track loan ever did. A negative day is the earliest warning sign in the data.'],
    [out6 != null ? pct(out6) : '35%', 'Of all 4,500 customers would run out of money within 6 months of a layoff on EI.'],
  ];
  const FH = [['Fragile borrowers', 'var(--crit-t)', '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'],
    ['Joint accounts', 'var(--good-t)', '<circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5M14.5 14.6c2.4-.3 4.6.9 5.5 3.9"/>'],
    ['Seasonality', 'var(--warn-t)', '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>'],
    ['Big spenders', 'var(--accent-t)', '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.5"/>'],
    ['Early warning', 'var(--crit-t)', '<path d="M4 6 12 18l3.5-5.5L20 6"/><path d="M3 18h18"/>'],
    ['Whole bank', 'var(--indigo)', '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>']];
  $('#findings').innerHTML = F.map(([b, t], i) => `<div class="finding" style="--fc:${FH[i][1]}"><span class="fh"><svg viewBox="0 0 24 24">${FH[i][2]}</svg>${FH[i][0]}</span><span class="big">${b}</span><p>${t}</p></div>`).join('');

  const au = INS.auc || {};
  const rows = [['Income', au.income, 's2'], ['Layoff runway', au.runway, 's1'], ['Loan payment as share of income', au.paymentShare, 's1'], ['How much income swings', au.volatility, 's1']];
  $('#aucBars').innerHTML = rows.map(([l, v, c]) => `<div class="bar-row"><div class="lab">${l}</div><div class="track"><div class="fill" data-w="${(v - .5) / .5 * 100}" style="--c:var(--${c})"></div></div><div class="val">${(v || 0).toFixed(2)}</div></div>`).join('') +
    '<p class="note">Bars start at coin flip (0.5) and end at perfect (1.0).</p>';
  animBars('#aucBars');
  requestAnimationFrame(drawGuilloche);
};
function animBars(sel) { $$(sel + ' .fill').forEach(f => { f.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => f.style.width = clamp(+f.dataset.w, 0, 100) + '%')); }); }
function openWithShock(id, preset) { if (DATA !== BUILTIN) useBuiltin(true); setAccount(id, true); applyPreset(preset); go('shock'); }

/* ================= VIEW: CUSTOMER ================= */
RENDER.customer = () => {
  const a = acc(); if (!a) return;
  const base = runway(a.B, a.I, a.S);
  const pf = profile(), ei0 = runway(a.B, a.I, a.S, { mult: .55 }), tm = +pf.target || 3;
  const bm0 = a.S > 0 ? a.B / a.S : 0, sr0 = a.I > 0 ? (a.I - a.S) / a.I : 0;
  $('#wcard').innerHTML = walletCard({ tone: tone(ei0.v), badge: ei0.v >= 6 ? 'Resilient' : ei0.v >= 3 ? 'Tight' : 'Fragile', midLabel: 'Savings buffer', mid: money(a.B), name: pf.name, id: a.id, rwLabel: 'Layoff runway', rw: rwText(ei0) + ' mo' });
  bindTilt($('#wcard'));
  $('#rings').innerHTML = `<div class="rings-wrap">${ringsSVG([
      { p: ei0.v === Infinity ? 2 : ei0.v / 6, color: 'var(--ring1)', label: 'Runway' },
      { p: bm0 / tm, color: 'var(--ring2)', label: 'Safety net' },
      { p: Math.max(sr0, 0) / .2, color: 'var(--ring3)', label: 'Saving' }])}
    <div class="ring-legend">
      <div><span class="t" style="color:var(--ring1)">Runway on EI</span><span class="v">${rwText(ei0)}<small>/6 MO</small></span><span class="s">Months the buffer lasts at 55% income</span></div>
      <div><span class="t" style="color:var(--ring2)">Safety net</span><span class="v">${bm0.toFixed(1)}<small>/${tm} MO</small></span><span class="s">Buffer in months of spending</span></div>
      <div><span class="t" style="color:var(--ring3)">Saving</span><span class="v">${Math.round(Math.max(sr0, 0) * 100)}<small>/20%</small></span><span class="s">Share of income left each month</span></div>
    </div></div>`;
  animateRings($('#rings'));
  $('#ledger').innerHTML = [
    ['I', 'Money in', money(a.I), 'Typical month'],
    ['F', 'Fixed costs', money(a.F), 'Bills, insurance, loan'],
    ['S', 'Spending', money(a.S), `${a.I > 0 ? pct(a.S / a.I) : '—'} of money in`],
    ['B', 'Buffer', money(a.B), 'Avg balance, last 6 months'],
    ['', 'Runway today', base.v === Infinity ? 'No shortfall' : rwText(base) + ' mo', base.v === Infinity ? 'Money in covers spending' : 'Already spending more than comes in'],
  ].map(([k, l, v, s]) => `<div><span class="k">${k ? `<b>${k}</b>` : ''}${l}</span><span class="v" title="${esc(v)}">${v}</span><span class="s">${s}</span></div>`).join('');

  const ei = runway(a.B, a.I, a.S, { mult: .55 });
  const p = eiPercentile(ei.v);
  $('#rwSub').textContent = 'EI pays 55% of usual income';
  $('#custStrip').innerHTML = strip(ei, { max: 24, fill: ei.v >= 6 ? 'good' : 'crit', marks: [{ at: 6, label: 'EI ends at 6 mo' }],
    pill: ei.v === Infinity || ei.v >= 6 ? ['good', 'Makes it through EI'] : ['crit', 'Runs out before EI ends'],
    note: `Lasts longer than ${pct(p)} of the bank's customers. Monthly gap on EI: ${money(Math.max(ei.gap, 0))}.` });
  const z = runway(a.B, a.I, a.S, { mult: 0 }), c = runway(a.B, a.I, a.S, { mult: .55, extra: .15 * a.H });
  $('#custStrips2').innerHTML = `<div class="grid"><h3>No income at all</h3>${strip(z, { max: 24, compact: true })}</div><div class="grid"><h3>Layoff and bills up 15%</h3>${strip(c, { max: 24, compact: true })}</div>`;
  animateStrips($('[data-view="customer"]'));

  // insights
  const ins = [];
  const sr = a.I > 0 ? a.S / a.I : 1;
  ins.push([sr > .95 ? 'crit' : sr > .85 ? 'warn' : 'good', sr > .85 ? 'alert' : 'check', `Spends <b>${pct(sr)}</b> of what comes in. The bank's median customer spends 92%.`]);
  const bm = a.S > 0 ? a.B / a.S : Infinity;
  ins.push([bm < 1 ? 'crit' : bm < 3 ? 'warn' : 'good', bm < 3 ? 'alert' : 'check', `Buffer covers <b>${isFinite(bm) ? bm.toFixed(1) : '∞'} months</b> of typical spending.`]);
  const cv = a.in.length > 2 ? Math.sqrt(mean(a.in.map(x => (x - mean(a.in)) ** 2))) / (mean(a.in) || 1) : 0;
  ins.push(cv > .5 ? ['warn', 'alert', `Income swings a lot: about <b>±${pct(cv)}</b> month to month. Defaulters' income swings ~3× more than repayers'.`] : ['good', 'check', `Income is steady: about <b>±${pct(cv)}</b> month to month.`]);
  if (a.P > 0) { const ps = a.P / (a.I || 1); ins.push([ps > .2 ? 'warn' : 'info', 'info', `Loan payment of <b>${money(a.P)}</b> a month is ${pct(ps)} of income${ps > .2 ? ', above the 16% typical for borrowers who repay' : ''}.`]); }
  if (a.neg > 0) ins.push(['crit', 'x', `Balance closed below zero on <b>${a.neg} days</b>. Every defaulted loan in this bank showed this first.`]);
  if (a.mi) { const tot = a.mi.reduce((s, x) => s + x, 0) || 1; if (a.mi[2] / tot > .3) ins.push(['good', 'check', 'Mostly <b>pension</b> income, the steadiest group in the data.']); else if (a.mi[0] / tot > .6) ins.push(['info', 'info', `<b>${pct(a.mi[0] / tot)}</b> of money in arrives as cash deposits.`]); }
  const jan = (() => { let [y, m] = a.m0.split('-').map(Number); m -= 1; const j = []; for (let k = 0; k < a.n; k++) if ((m + k) % 12 === 0) j.push(a.out[k]); return j.length ? mean(j) / (mean(a.out) || 1) : 0; })();
  if (jan > 1.2) ins.push(['info', 'up', `January spending runs <b>${pct(jan - 1)}</b> above this account's average month.`]);
  if (a.joint) ins.push(['good', 'check', 'Joint account. None of the 145 joint accounts with loans defaulted.']);
  $('#custInsights').innerHTML = ins.slice(0, 7).map(([s, i, t]) => `<div class="insight ${s}">${ICON[i]}<div>${t}</div></div>`).join('');

  // flow chart
  const L = monthLabels(a), s1 = V('--s1'), s2 = V('--s2');
  chart('flowChart', { type: 'line', data: { labels: L, datasets: [
    { label: 'Money in', data: a.in, borderColor: s1, backgroundColor: s1, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: .35 },
    { label: 'Money out', data: a.out, borderColor: s2, backgroundColor: s2, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: .35 },
  ] }, options: baseOpts({ scales: { y: { ticks: { callback: moneyTick } } }, plugins: { tooltip: { callbacks: { label: i => ` ${i.dataset.label}: ${money(i.raw)}` } } } }) });
  chart('balChart', { type: 'line', data: { labels: L, datasets: [
    { label: 'Average balance', data: a.bal, borderColor: s1, backgroundColor: areaFill(s1), fill: 'origin', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: .35 },
  ] }, plugins: [shadePlugin], options: baseOpts({ scales: { y: { ticks: { callback: moneyTick } } },
    plugins: { shade: { from: Math.max(0, a.n - 6), color: alpha(V('--accent'), .1), label: `Buffer ${money(a.B)}`, ink: V('--ink-2') }, tooltip: { callbacks: { label: i => ` ${money(i.raw)}` } } } }) });

  const names = ['Household bills', 'Insurance', 'Loan payments', 'Bank fees', 'Cash withdrawals', 'Card spending', 'Other transfers out'];
  const outs = (a.mo || []).map((v, i) => [names[i], v]).filter(x => x[1] > 0.5).sort((x, y) => y[1] - x[1]);
  const mx = Math.max(...outs.map(x => x[1]), 1), tot = outs.reduce((s, x) => s + x[1], 0) || 1;
  $('#outBars').innerHTML = outs.map(([n, v]) => `<div class="bar-row"><div class="lab">${n}<small>${pct(v / tot)}</small></div><div class="track"><div class="fill" data-w="${v / mx * 100}" style="--c:var(--s1)"></div></div><div class="val">${money(v)}</div></div>`).join('') || '<p class="muted small">No spending recorded.</p>';
  animBars('#outBars');
};

/* ================= VIEW: SHOCK LAB ================= */
function applyPreset(id) {
  const p = SHOCKS.find(s => s.id === id) || SHOCKS[0];
  st.shock = Object.assign({ inc: 100, ei: 6, bills: 0, extra: 0, one: 0, oneMult: null, after: st.shock.after || 'back', preset: p.id }, p.set);
}
function projection(a, sh, n = 24) {
  const P = shockParams(a, sh); let bal = a.B - P.oneOff, base = a.B; const pts = [bal], bp = [base];
  for (let k = 1; k <= n; k++) {
    const shocked = sh.inc < 100 && k > sh.ei;
    const income = shocked ? (sh.after === 'back' ? a.I : 0) : a.I * P.mult;
    bal += income - (a.S + P.extra); base += a.I - a.S; pts.push(bal); bp.push(base);
  }
  let zero = null; for (let k = 1; k < pts.length; k++) if (pts[k] < 0 && pts[k - 1] >= 0) { zero = k - 1 + pts[k - 1] / (pts[k - 1] - pts[k]); break; }
  if (pts[0] < 0) zero = 0;
  return { pts, bp, zero };
}
RENDER.shock = () => {
  const a = acc(); if (!a) return; const sh = st.shock;
  $('#twists').innerHTML = SHOCKS.map(s => `<button type="button" class="twist" data-p="${s.id}" aria-pressed="${sh.preset === s.id}"><span class="ic" style="--c:${s.c}"><svg viewBox="0 0 24 24">${s.ic}</svg></span><strong>${s.name}</strong><span class="d">${s.desc}</span></button>`).join('');
  $$('#twists .twist').forEach(b => b.onclick = () => { applyPreset(b.dataset.p); RENDER.shock(); });
  const P = shockParams(a, sh), r = runway(a.B, a.I, a.S, P);
  // sliders
  const set = (id, v, out) => { const el = $(id); el.value = v; setRangeFill(el); $(out[0]).textContent = out[1]; };
  $('#sOne').max = Math.max(40000, Math.ceil(a.S * 2 / 1000) * 1000);
  set('#sInc', sh.inc, ['#oInc', sh.inc + '%' + (sh.inc === 55 ? ' (EI)' : '')]);
  set('#sEi', sh.ei, ['#oEi', sh.ei + (sh.ei === 1 ? ' month' : ' months')]);
  set('#sBills', sh.bills, ['#oBills', (sh.bills > 0 ? '+' : '') + sh.bills + '%' + (a.H ? ` (${sh.bills >= 0 ? '+' : '-'}${money(Math.abs(sh.bills / 100 * a.H))})` : '')]);
  set('#sExtra', sh.extra, ['#oExtra', money(sh.extra)]);
  set('#sOne', Math.round(P.oneOff), ['#oOne', money(P.oneOff)]);
  $('#sEi').disabled = sh.inc >= 100;
  $$('#afterSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === sh.after)));
  $$('#oneQuick button').forEach(b => b.setAttribute('aria-pressed', String(sh.oneMult != null && +b.dataset.m === sh.oneMult)));

  const incomeShock = sh.inc < 100;
  const marks = incomeShock ? [{ at: sh.ei, label: `EI ends at ${sh.ei} mo` }] : [];
  let pill = r.v === Infinity ? ['good', 'No monthly shortfall'] : r.v === 0 ? ['crit', 'Buffer gone'] : [status(r.v), r.v < 3 ? 'Critical' : r.v < 6 ? 'Tight' : 'Holds up'];
  if (incomeShock && r.v !== Infinity) pill = r.v >= sh.ei ? ['good', 'Makes it through EI'] : ['crit', 'Runs out before EI ends'];
  $('#shockStrip').innerHTML = `<div class="panel-head"><h2>Runway</h2><p>${esc(shockLabel(sh, a)) || 'no shock'}</p></div>` + strip(r, { max: 24, marks, pill, fill: incomeShock && r.v !== 0 ? (r.v >= sh.ei ? 'good' : 'crit') : undefined });
  animateStrips($('#shockStrip'));

  // verdict
  let v;
  if (isNoShock(sh)) v = ['good', ICON.info, 'No shock applied', `Pick a twist card above or move a slider. Today this customer ${r.v === Infinity ? 'brings in more than they spend' : `is short ${money(r.gap)} a month already`}.`];
  else if (r.v === 0) v = ['crit', ICON.x, "The buffer can't cover it", `The one-off cost is ${money(-r.left)} more than the buffer. They'd need credit or help on day one.`];
  else if (incomeShock) {
    if (r.v === Infinity) v = ['good', ICON.check, 'Yes, they make it', `Even at ${sh.inc}% income there's no monthly shortfall. Buffer stays at ${money(r.left)}.`];
    else if (r.v >= sh.ei) v = ['good', ICON.check, `Yes, they make it through ${sh.ei} months of EI`, `${money(r.left - r.gap * sh.ei)} of buffer is left when EI ends. The buffer lasts ${r.v.toFixed(1)} months in total.`];
    else v = ['crit', ICON.alert, `No. Money runs out in month ${Math.ceil(r.v)}`, `That's ${(sh.ei - r.v).toFixed(1)} months before EI ends. Getting through all ${sh.ei} months takes ${money(r.gap * sh.ei - r.left)} more. The Plan page shows how to close it.`];
  } else if (r.v === Infinity) v = ['good', ICON.check, 'They absorb it', `${money(r.left)} of buffer is left and money in still covers spending.`];
  else v = [status(r.v), r.v < 6 ? ICON.alert : ICON.check, `The buffer lasts ${r.v.toFixed(1)} months`, `Spending now runs ${money(r.gap)} a month above income.`];
  $('#verdict').innerHTML = `<div class="verdict ${v[0]}">${v[1]}<div><strong>${v[2]}</strong><p>${v[3]}</p></div></div>`;

  const extraTxt = [sh.bills ? `${sh.bills}% × H` : '', sh.extra ? money(sh.extra) : ''].filter(Boolean).join(' + ');
  const rows = [
    ['Buffer', 'B', money(a.B)],
    ['One-off cost', sh.oneMult != null ? `${sh.oneMult} × S` : 'set by slider', money(P.oneOff)],
    ['Buffer left', 'B − one-off', money(r.left)],
    ['Income after shock', `I × ${sh.inc}%`, `${money(a.I * P.mult)}<small>${money(a.I)} × ${(P.mult).toFixed(2)}</small>`],
    ['Spending after shock', 'S' + (extraTxt ? ' + ' + extraTxt : ''), `${money(a.S + P.extra)}<small>${money(a.S)}${P.extra ? ' + ' + money(P.extra) : ''}</small>`],
    ['Monthly gap', 'spending − income', money(r.gap)],
  ];
  $('#formula').innerHTML = rows.map(([k, e, v]) => `<div class="f-k">${k}</div><div class="f-e">${e}</div><div class="f-v">${v}</div>`).join('') +
    `<div class="f-k total">Runway</div><div class="f-e total">${r.kind === 'zero' ? 'buffer left ≤ 0' : r.kind === 'none' ? 'gap ≤ 0' : 'buffer left ÷ gap, max 120'}</div><div class="f-v total">${r.kind === 'zero' ? '0 months' : r.kind === 'none' ? 'No shortfall (120+)' : r.v.toFixed(1) + ' months'}</div>`;

  // projection
  const pr = projection(a, sh, 24), s1 = V('--s1'), crit = V('--crit'), muted = V('--muted'), ink = V('--ink');
  $('#projSub').textContent = incomeShock ? `EI for ${sh.ei} months, then ${sh.after === 'back' ? 'back at full pay' : 'no income'}` + (pr.zero != null ? `. Hits zero around month ${pr.zero.toFixed(1)}.` : '. Never hits zero in 24 months.')
    : (pr.zero != null ? `Hits zero around month ${pr.zero.toFixed(1)}.` : 'Never hits zero in 24 months.');
  chart('projChart', { type: 'line', data: { labels: pr.pts.map((_, i) => i === 0 ? 'Now' : 'M' + i), datasets: [
    { label: 'With the shock', data: pr.pts.map(Math.round), borderColor: s1, backgroundColor: areaFill(s1, .2), fill: 'origin', borderWidth: 3, pointRadius: 0, pointHoverRadius: 4, tension: 0,
      segment: { borderColor: c => c.p1.parsed.y < 0 ? crit : s1 } },
    { label: 'No shock', data: pr.bp.map(Math.round), borderColor: muted, borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, pointHoverRadius: 3 },
  ] }, plugins: [shadePlugin], options: baseOpts({
    scales: { y: { ticks: { callback: moneyTick }, grid: { color: c => c.tick.value === 0 ? ink : V('--line'), lineWidth: c => c.tick.value === 0 ? 1.5 : 1 } } },
    plugins: { shade: incomeShock ? { from: sh.ei + 1, color: alpha(V('--ink'), .04), label: sh.after === 'back' ? 'Back at work' : 'EI over', ink: V('--muted') } : {},
      tooltip: { callbacks: { label: i => ` ${i.dataset.label}: ${money(i.raw)}` } } } }) });

  // stress grid
  const incs = [100, 85, 70, 55, 40, 25, 0], bills = [0, 10, 15, 25, 40];
  const cls = v => v === Infinity || v >= 12 ? 'c4' : v >= 6 ? 'c3' : v >= 3 ? 'c2' : v >= 1 ? 'c1' : 'c0';
  $('#heat').style.setProperty('--cols', incs.length);
  $('#heat').innerHTML = `<div class="heat-row"><div class="hd rl">Bills ↓ Income →</div>${incs.map(i => `<div class="hd">${i}%</div>`).join('')}</div>` +
    bills.map(b => `<div class="heat-row"><div class="hd rl">+${b}%</div>${incs.map(i => {
      const rr = runway(a.B, a.I, a.S, { mult: i / 100, extra: b / 100 * a.H + sh.extra, oneOff: P.oneOff });
      const cur = i === sh.inc && b === sh.bills;
      return `<button type="button" class="cell ${cls(rr.v)}${cur ? ' cur' : ''}" data-i="${i}" data-b="${b}" title="Income ${i}%, bills +${b}%: ${rwLong(rr)}">${rr.v === Infinity ? '120+' : rr.v.toFixed(1)}</button>`;
    }).join('')}</div>`).join('');
  $$('#heat .cell').forEach(c => c.onclick = () => { st.shock.inc = +c.dataset.i; st.shock.bills = +c.dataset.b; st.shock.preset = 'custom'; RENDER.shock(); });
  emit('shock', { preset: sh.preset, v: r.v, need: incomeShock ? sh.ei : 6, none: isNoShock(sh) });
};
function bindShock() {
  const upd = fn => e => { fn(+e.target.value); st.shock.preset = 'custom'; RENDER.shock(); };
  $('#sInc').oninput = upd(v => st.shock.inc = v);
  $('#sEi').oninput = upd(v => st.shock.ei = v);
  $('#sBills').oninput = upd(v => st.shock.bills = v);
  $('#sExtra').oninput = upd(v => st.shock.extra = v);
  $('#sOne').oninput = upd(v => { st.shock.one = v; st.shock.oneMult = null; });
  $$('#oneQuick button').forEach(b => b.onclick = () => { st.shock.oneMult = +b.dataset.m; st.shock.preset = 'custom'; RENDER.shock(); });
  $$('#afterSeg button').forEach(b => b.onclick = () => { st.shock.after = b.dataset.v; RENDER.shock(); });
  $('#shockReset').onclick = () => { applyPreset('none'); RENDER.shock(); };
}

/* ================= VIEW: PLAN ================= */
function planShock() { return isNoShock(st.shock) ? Object.assign({}, st.shock, { inc: 55, ei: 6, preset: 'layoff' }) : st.shock; }
function levers(a) {
  const sh = planShock(), P = shockParams(a, sh), disc = Math.max(a.S - a.F, 0);
  const out = []; let extra = P.extra, mult = P.mult, side = 0;
  const calc = () => runway(a.B, a.I, a.S, { mult, extra: extra - side, oneOff: P.oneOff }); // side income offsets spending
  out.push({ key: 'shock', name: 'The shock as set', r: calc(), desc: shockLabel(sh, a) });
  const cut = st.plan.cut / 100 * disc; extra -= cut;
  out.push({ key: 'cut', name: `Cut everyday spending ${st.plan.cut}%`, r: calc(), save: cut, desc: `Cash withdrawals, card spending and other transfers come to about ${money(disc)} a month. Trimming ${st.plan.cut}% frees ${money(cut)}.` });
  if (a.P > 0) { extra -= a.P; out.push({ key: 'loan', name: 'Ask the lender to pause the loan', r: calc(), save: a.P, desc: `Call before a payment is missed. A 3-to-6-month deferral removes ${money(a.P)} a month while EI runs.` }); }
  const billNow = a.H * (1 + sh.bills / 100);
  if (billNow > 0) { const t = .1 * billNow; extra -= t; out.push({ key: 'bills', name: 'Trim household bills 10%', r: calc(), save: t, desc: `Shop phone, internet and insurance. On ${money(billNow)} of bills that's ${money(t)} a month.` }); }
  if (st.plan.side > 0) { side = st.plan.side; out.push({ key: 'side', name: `Side income of ${money(side)}`, r: calc(), save: side, desc: 'Part-time or gig work. EI lets you earn some income; check the rules before you start.' }); }
  return { sh, list: out };
}
RENDER.plan = () => {
  const a = acc(); if (!a) return; const pf = profile();
  const months = +pf.target || 3; const target = months * a.S; const have = Math.max(a.B, 0); const need = Math.max(0, target - have);
  const surplus = a.I - a.S, disc = Math.max(a.S - a.F, 0);
  if (st.plan.save == null) st.plan.save = surplus > 0 ? r25(surplus * .5) : r25(.1 * disc);
  const smax = Math.max(1000, Math.ceil(Math.max(a.I * .5, st.plan.save) / 250) * 250);
  const ps = $('#pSave'); ps.max = smax; ps.value = st.plan.save; setRangeFill(ps); $('#oSave').textContent = money(st.plan.save);
  $('#saveHint').textContent = surplus > 0 ? `Money in beats spending by ${money(surplus)} in a typical month. Half of that is ${money(r25(surplus * .5))}.`
    : `Spending already matches income, so this has to come from cuts. Trimming everyday spending 10% frees ${money(.1 * disc)}.`;
  $$('#goalSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === months)));
  const mtg = need === 0 ? 0 : st.plan.save > 0 ? need / st.plan.save : Infinity;
  $('#goalPill').innerHTML = need === 0 ? '<span class="pill good">Goal reached</span>' : mtg <= 12 ? `<span class="pill info">${Math.ceil(mtg)} months away</span>` : `<span class="pill warn">${isFinite(mtg) ? Math.ceil(mtg) + ' months away' : 'Needs a monthly amount'}</span>`;
  $('#goalLedger').innerHTML = [['Target', money(target), `${months} months of spending`], ['Saved now', money(have), `${a.S > 0 ? (have / a.S).toFixed(1) : '—'} months`], ['Still to save', money(need), need ? (isFinite(mtg) ? `${Math.ceil(mtg)} months at this pace` : 'Set an amount') : 'Done']]
    .map(([k, v, s]) => `<div><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('');
  const N = Math.min(60, Math.max(12, isFinite(mtg) ? Math.ceil(mtg) + 3 : 24));
  const fund = Array.from({ length: N + 1 }, (_, k) => have + st.plan.save * k);
  const s1 = V('--s1'), good = V('--good');
  chart('goalChart', { type: 'line', data: { labels: fund.map((_, k) => k === 0 ? 'Now' : 'M' + k), datasets: [
    { label: 'Emergency fund', data: fund.map(Math.round), borderColor: s1, backgroundColor: areaFill(s1, .22), fill: 'origin', borderWidth: 3, pointRadius: 0, pointHoverRadius: 4 },
    { label: 'Target', data: fund.map(() => Math.round(target)), borderColor: good, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 0 },
  ] }, options: baseOpts({ scales: { y: { min: 0, ticks: { callback: moneyTick } } }, plugins: { tooltip: { callbacks: { label: i => ` ${i.dataset.label}: ${money(i.raw)}` } } } }) });
  $('#goalText').innerHTML = need === 0
    ? `<strong>The buffer already covers ${months} months.</strong> Keep it in a high-interest savings account or GIC, and send new savings to the next step on the Investing page.`
    : isFinite(mtg) ? `<strong>Set aside ${money(st.plan.save)} a month and the fund reaches ${months} months of spending in ${Math.ceil(mtg)} months.</strong> Automate it on payday so it happens before spending does.`
    : `<strong>Choose a monthly amount to see the timeline.</strong> Even ${money(r25(Math.max(50, .05 * a.I)))} a month gets it moving.`;

  // backup plan
  const pc = $('#pCut'); pc.value = st.plan.cut; setRangeFill(pc); $('#oCut').textContent = st.plan.cut + '%';
  const sd = $('#pSide'); sd.value = st.plan.side; setRangeFill(sd); $('#oSide').textContent = money(st.plan.side);
  const { sh, list } = levers(a);
  $('#backupSub').textContent = isNoShock(st.shock) ? 'No shock is set, so this assumes a layoff with EI at 55%.' : 'Using the shock from the Shock lab.';
  const eiStep = sh.inc < 100 ? `<div class="step"><span class="no"></span><div><h3>Apply for EI the week the job ends</h3><p>Apply even before the record of employment arrives. Waiting more than 4 weeks after the last day of work can cost benefits.</p></div><div class="gain">${sh.inc}%<small>of income back</small></div></div>` : '';
  $('#backupSteps').innerHTML = eiStep + list.slice(1).map((l, i) => {
    const prev = list[i].r, now = l.r; const gain = now.v === Infinity ? 'No gap left' : `${rwText(prev)} → ${rwText(now)} mo`;
    return `<div class="step"><span class="no"></span><div><h3>${esc(l.name)}</h3><p>${esc(l.desc)}</p></div><div class="gain">${gain}<small>${money(l.save)} a month</small></div></div>`;
  }).join('');
  const first = list[0].r, last = list[list.length - 1].r;
  const needM = sh.inc < 100 ? sh.ei : 6;
  const ok = last.v === Infinity || last.v >= needM;
  $('#backupResult').innerHTML = `<div class="verdict ${ok ? 'good' : 'crit'}">${ok ? ICON.check : ICON.alert}<div><strong>Runway goes from ${rwLong(first)} to ${rwLong(last)}</strong><p>${ok ? `That carries them past the ${needM}-month mark${sh.inc < 100 ? ' when EI ends' : ''}.` : `Still short of ${needM} months. They'd need ${money(Math.max(0, last.gap * needM - last.left))} more, from a larger cut, side income or family support.`}</p></div></div>`;
  const mx = 24;
  $('#leverBars').innerHTML = list.map((l, i) => `<div class="bar-row"><div class="lab">${i === 0 ? 'Shock only' : '+ ' + esc(l.name.replace(/^(Cut|Ask|Trim|Side)/, m => m.toLowerCase()))}</div>
    <div class="track"><div class="fill" data-w="${l.r.v === Infinity ? 100 : Math.min(100, l.r.v / mx * 100)}" style="--c:var(--${l.r.v === Infinity ? 'good' : status(l.r.v)})"></div>${needM <= mx ? `<div class="base" style="left:${needM / mx * 100}%"></div>` : ''}</div>
    <div class="val">${rwText(l.r)}</div></div>`).join('') + `<p class="note">Dashed line: ${needM} months${sh.inc < 100 ? ', when EI ends' : ''}. Bars run to 24 months; longer runways fill the bar.</p>`;
  $$('#leverBars .bar-row').forEach(r => r.style.gridTemplateColumns = 'minmax(120px, 260px) minmax(0, 1fr) 56px');
  animBars('#leverBars');
  emit('plan', { ok, need, needM, mtg, first: first.v, last: last.v });
};
function bindPlan() {
  $('#pSave').oninput = e => { st.plan.save = +e.target.value; RENDER.plan(); };
  $('#pCut').oninput = e => { st.plan.cut = +e.target.value; RENDER.plan(); };
  $('#pSide').oninput = e => { st.plan.side = +e.target.value; RENDER.plan(); };
  $$('#goalSeg button').forEach(b => b.onclick = () => { const p = profile(); p.target = b.dataset.v; store.set('cm.p.' + st.id, p); RENDER.plan(); });
}

/* ================= VIEW: BUDGET ================= */
const RULES = [
  { id: '50-30-20', name: '50/30/20', why: 'Half to needs, 30% to wants and 20% to savings. The best-known starting point.', parts: [['Needs', .5, 'needs'], ['Wants', .3, 'wants'], ['Savings', .2, 'save']] },
  { id: '70-20-10', name: '70/20/10', why: 'Everyday living takes 70%, savings 20%, and 10% goes to paying down debt or giving.', parts: [['Living', .7, 'living'], ['Savings', .2, 'save'], ['Debt or giving', .1, 'debt']] },
  { id: '60-20-20', name: '60/20/20', why: 'A version of 50/30/20 for expensive cities like Toronto, where needs take more room.', parts: [['Needs', .6, 'needs'], ['Wants', .2, 'wants'], ['Savings', .2, 'save']] },
  { id: '80-20', name: '80/20', why: 'Pay yourself first. Move 20% to savings on payday and spend the rest without tracking.', parts: [['Spending', .8, 'spend'], ['Savings', .2, 'save']] },
  { id: '30-30-30-10', name: '30/30/30/10', why: 'Housing, other needs, goals and fun each get a fixed slice.', parts: [['Housing', .3, 'housing'], ['Other needs', .3, 'otherNeeds'], ['Goals', .3, 'save'], ['Fun', .1, 'wants']] },
  { id: 'zero', name: 'Zero-based', why: 'Every dollar gets a job until nothing is left to assign. Build it in the panel below.', parts: null },
];
function actuals(a, inc) {
  const needs = Math.min(a.F, a.S), wants = Math.max(a.S - needs, 0), save = inc - a.S;
  return { needs, wants, save, living: a.S - Math.min(a.P, a.S), debt: Math.min(a.P, a.S), spend: a.S, housing: Math.min(a.H, needs), otherNeeds: Math.max(needs - a.H, 0) };
}
function ruleGap(rule, act, inc) { return rule.parts.reduce((s, [, f, k]) => s + Math.abs(act[k] - f * inc), 0) / 2; }
RENDER.budget = () => {
  const a = acc(); if (!a) return;
  if (st.budget.inc == null) st.budget.inc = Math.round(a.I);
  const inc = st.budget.inc; const bi = $('#bInc'); if (document.activeElement !== bi) bi.value = inc.toLocaleString('en-CA');
  $('#ruleSeg').innerHTML = RULES.map(r => `<button type="button" data-r="${r.id}" aria-pressed="${st.budget.rule === r.id}">${r.name}</button>`).join('');
  $$('#ruleSeg button').forEach(b => b.onclick = () => { st.budget.rule = b.dataset.r; RENDER.budget(); if (b.dataset.r === 'zero') $('#zbPanel').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); });
  const rule = RULES.find(r => r.id === st.budget.rule), act = actuals(a, inc);
  $('#ruleWhy').textContent = rule.why;
  const cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  if (rule.parts && inc > 0) {
    const tgt = rule.parts.map(([n, f, k], i) => ({ n, v: f * inc, c: cols[i], k }));
    const today = rule.parts.map(([n, , k], i) => ({ n, v: act[k], c: cols[i], k }));
    const bar = (parts, total) => parts.map(p => p.v > 0 ? `<div style="flex:${p.v} 1 0;background:${p.c}" title="${esc(p.n)}: ${money(p.v)}">${p.v / total > .09 ? pct(p.v / total) : ''}</div>` : '').join('');
    const over = Math.max(0, -act.save);
    $('#ruleCompare').innerHTML = `<div class="legend">${rule.parts.map(([n], i) => `<span><i style="background:${cols[i]}"></i>${n}</span>`).join('')}${over ? '<span><i style="background:var(--crit)"></i>Overspending</span>' : ''}</div>
      <div class="split"><div class="split-lab"><span>${rule.name} target</span><span>${money(inc)}</span></div><div class="split-bar">${bar(tgt, inc)}</div></div>
      <div class="split"><div class="split-lab"><span>This customer today</span><span>${money(a.S)} spent${over ? `, ${money(over)} over` : ''}</span></div><div class="split-bar">${bar(today.filter(p => p.v > 0), Math.max(inc, a.S))}${over ? `<div class="over" style="flex:${over} 1 0" title="Spending above income: ${money(over)}"></div>` : ''}</div></div>
      <div class="table-wrap"><table class="cmp"><thead><tr><th>Bucket</th><th class="r">Target</th><th class="r">Today</th><th class="r">Difference</th></tr></thead><tbody>${tgt.map((t, i) => {
        const d = today[i].v - t.v; return `<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${t.c};margin-right:8px"></i>${t.n}</td><td class="r">${money(t.v)}</td><td class="r">${money(today[i].v)}</td><td class="r" style="color:var(--${Math.abs(d) < inc * .03 ? 'muted' : (t.k === 'save' ? (d < 0 ? 'crit-t' : 'good-t') : (d > 0 ? 'crit-t' : 'good-t'))})">${d > 0 ? '+' : ''}${money(d)}</td></tr>`; }).join('')}</tbody></table></div>`;
    const saveIdx = rule.parts.findIndex(p => p[2] === 'save'); const saveShort = tgt[saveIdx].v - today[saveIdx].v;
    const worst = tgt.map((t, i) => ({ n: t.n, d: today[i].v - t.v, k: t.k })).filter(x => x.k !== 'save').sort((x, y) => y.d - x.d)[0];
    $('#ruleAdvice').innerHTML = saveShort <= 0 ? `<strong>Already saving ${money(act.save)} a month, ${money(-saveShort)} above the ${rule.name} target.</strong> Point the extra at the emergency fund until it covers ${profile().target} months, then at investing.`
      : `<strong>To fit ${rule.name}, move ${money(saveShort)} a month into savings.</strong> ${worst && worst.d > 0 ? `The biggest overrun is ${worst.n.toLowerCase()}, ${money(worst.d)} above target.` : 'Spending buckets are within target; the gap comes from income.'}`;
  } else if (rule.parts) { $('#ruleCompare').innerHTML = '<p class="muted">Enter a monthly income above $0.</p>'; $('#ruleAdvice').innerHTML = ''; }
  else { $('#ruleCompare').innerHTML = '<p class="ink2">The zero-based planner is below. Every row starts at this account\'s monthly average.</p>'; $('#ruleAdvice').innerHTML = `<strong>Left to assign: ${money(zbLeft(a))}.</strong> Give it to the emergency fund first.`; }

  const scored = RULES.filter(r => r.parts).map(r => ({ r, g: ruleGap(r, act, inc) })).sort((x, y) => x.g - y.g);
  $('#ruleTable').innerHTML = `<thead><tr><th>Rule</th><th class="r">Money to move each month</th></tr></thead><tbody>${scored.map((s, i) =>
    `<tr${i === 0 ? ' class="best"' : ''}><td>${s.r.name}${i === 0 ? ' <span class="pill info" style="margin-left:6px">Closest fit</span>' : ''}</td><td class="r">${money(s.g)}</td></tr>`).join('')}</tbody>`;
  renderZB(a);
  emit('budget', { rule: st.budget.rule, best: scored[0] && scored[0].r.id });
};
const ZB_NAMES = ['Household bills', 'Insurance', 'Loan payment', 'Everyday cash spending', 'Card spending', 'Transfers out', 'Bank fees', 'Emergency fund', 'Investing'];
function zbDefaults(a) { const m = a.mo || [0, 0, 0, 0, 0, 0, 0]; const raw = [m[0], m[1], m[2], m[4], m[5], m[6], m[3]]; const tot = raw.reduce((s, x) => s + x, 0) || 1; const k = a.S / tot; // scale averages to the typical (median) month
  return [...raw.map(v => Math.round(v * k)), 0, 0]; }
function zbLeft(a) { if (!st.budget.zb) st.budget.zb = zbDefaults(a); return (st.budget.inc ?? a.I) - st.budget.zb.reduce((s, x) => s + (+x || 0), 0); }
function renderZB(a) {
  if (!st.budget.zb) st.budget.zb = zbDefaults(a);
  const rows = $('#zbRows');
  if (!rows.dataset.for || rows.dataset.for !== String(st.id) + ':' + st.budget.zbv) {
    rows.dataset.for = String(st.id) + ':' + st.budget.zbv;
    rows.innerHTML = ZB_NAMES.map((n, i) => `<div class="zb-row"><label for="zb${i}">${n}</label><div class="money-in"><input class="input" id="zb${i}" inputmode="decimal" value="${st.budget.zb[i]}"></div></div>`).join('');
    $$('#zbRows input').forEach((inp, i) => inp.oninput = () => { st.budget.zb[i] = +String(inp.value).replace(/[^0-9.]/g, '') || 0; zbSummary(a); });
  }
  zbSummary(a);
}
function zbSummary(a) {
  const left = zbLeft(a); const el = $('#zbLeft'); el.textContent = money(left);
  el.style.color = Math.abs(left) < 1 ? 'var(--good-t)' : left < 0 ? 'var(--crit-t)' : 'var(--ink)';
  const cols = ['var(--s1)', 'var(--s1)', 'var(--s4)', 'var(--s2)', 'var(--s2)', 'var(--s2)', 'var(--muted)', 'var(--s3)', 'var(--s3)'];
  $('#zbBar').innerHTML = st.budget.zb.map((v, i) => v > 0 ? `<div style="flex:${v} 1 0;background:${cols[i]}" title="${ZB_NAMES[i]}: ${money(v)}"></div>` : '').join('') + (left > 0 ? `<div style="flex:${left} 1 0;background:var(--surface-2)" title="Unassigned ${money(left)}"></div>` : '');
  if (st.budget.rule === 'zero') $('#ruleAdvice').innerHTML = `<strong>Left to assign: ${money(left)}.</strong> ${left > 0 ? 'Give it to the emergency fund first.' : left < 0 ? 'The plan spends more than comes in. Trim a spending row.' : 'Every dollar has a job.'}`;
  emit('zb', { left, rule: st.budget.rule });
}
function bindBudget() {
  $('#bInc').oninput = e => { const v = +String(e.target.value).replace(/[^0-9.]/g, ''); st.budget.inc = isFinite(v) ? v : 0; RENDER.budget(); };
  $('#bInc').onblur = e => { e.target.value = (st.budget.inc || 0).toLocaleString('en-CA'); };
  $('#zbReset').onclick = () => { st.budget.zb = null; st.budget.zbv = (st.budget.zbv || 0) + 1; renderZB(acc()); };
}

/* ================= VIEW: INVEST ================= */
RENDER.invest = () => {
  const a = acc(); if (!a) return; const pf = profile();
  const months = +pf.target || 3, bm = a.S > 0 ? a.B / a.S : 99;
  const debtOk = a.P === 0 && a.neg === 0;
  const homeGoal = pf.goal === 'home';
  const L = [
    ['Starter cushion', `One month of spending (${money(a.S)}) in a high-interest savings account.`, bm >= 1],
    ['Get debt under control', a.P > 0 ? `Keep the ${money(a.P)} loan payment current. Pay down anything above about 7% interest before investing.` : (a.neg > 0 ? 'The account has gone below zero. Clear overdrafts first; they cost more than investments earn.' : 'No running loan or overdraft in the data.'), debtOk],
    [`Full emergency fund, ${months} months`, `${money(months * a.S)} kept safe and reachable. A GIC ladder works for the part you won't need fast.`, bm >= months],
    [homeGoal ? 'FHSA for the first home' : 'TFSA', homeGoal ? 'Up to $8,000 a year, deductible like an RRSP and tax-free on the way out for a first home.' : 'Growth and withdrawals are tax-free. Room comes back the year after you take money out.', false],
    [homeGoal ? 'TFSA' : 'RRSP', homeGoal ? 'Tax-free growth for everything else.' : 'Most useful at higher incomes, where the deduction is worth more. Withdrawals are taxed.', false],
    ['Non-registered account', 'Once the tax-sheltered room is full.', false],
  ];
  const here = L.findIndex(x => !x[2]);
  $('#ladder').innerHTML = L.map((x, i) => `<div class="step ${x[2] ? 'done' : i === here ? 'here' : ''}"><span class="no"></span><div><h3>${x[0]}</h3><p>${x[1]}</p></div><div class="gain">${x[2] ? '<span class="pill good">Done</span>' : i === here ? '<span class="pill info">Next step</span>' : ''}</div></div>`).join('');
  $('#ladderPill').innerHTML = `<span class="pill ${here <= 2 ? 'warn' : 'good'}">${here <= 2 ? 'Safety first' : 'Ready to invest'}</span>`;

  const surplus = a.I - a.S;
  if (st.invest.mo == null) st.invest.mo = surplus > 0 ? r25(surplus * .3) : 50;
  if (st.invest.r == null) st.invest.r = +pf.risk || 5;
  const im = $('#iMo'); im.max = Math.max(3000, Math.ceil(st.invest.mo / 500) * 500); im.value = st.invest.mo; setRangeFill(im); $('#oMo').textContent = money(st.invest.mo);
  const iy = $('#iYrs'); iy.value = st.invest.yrs; setRangeFill(iy); $('#oYrs').textContent = st.invest.yrs + ' years';
  $$('#mixSeg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.r === st.invest.r)));
  const r = st.invest.r / 100 / 12; let bal = 0; const yrs = [], cont = [], grow = [];
  for (let m = 1; m <= st.invest.yrs * 12; m++) { bal = bal * (1 + r) + st.invest.mo; if (m % 12 === 0) { yrs.push('Yr ' + m / 12); cont.push(Math.round(st.invest.mo * m)); grow.push(Math.round(bal - st.invest.mo * m)); } }
  const totC = st.invest.mo * st.invest.yrs * 12;
  $('#growLedger').innerHTML = [['Put in', money(totC)], ['Growth', money(bal - totC)], ['Total', money(bal)]].map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
  const s1 = V('--s1'), s3 = V('--s3');
  chart('growChart', { type: 'bar', data: { labels: yrs, datasets: [
    { label: 'What you put in', data: cont, backgroundColor: s1, borderRadius: 5, borderSkipped: false, barPercentage: .72 },
    { label: 'Growth', data: grow, backgroundColor: s3, borderRadius: 5, borderSkipped: false, barPercentage: .72 },
  ] }, options: baseOpts({ scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: moneyTick } } }, plugins: { tooltip: { callbacks: { label: i => ` ${i.dataset.label}: ${money(i.raw)}` } } } }) });

  $('#acctCards').innerHTML = [
    ['TFSA', '$7,000', '2026 contribution limit', 'Tax-free growth and withdrawals. Up to $109,000 of total room for someone who has been 18+ and resident since 2009.'],
    ['RRSP', '$33,810', '2026 maximum', '18% of last year\'s earned income up to the maximum. Contributions cut taxable income now; withdrawals are taxed later.'],
    ['FHSA', '$8,000', 'a year, $40,000 lifetime', 'For first-time home buyers. Deductible going in and tax-free coming out for a qualifying home.'],
    ['HISA or GIC', 'CDIC', 'covers eligible deposits to $100,000', 'Where the emergency fund lives. Safe, reachable and still earning interest.'],
  ].map(([n, l, t, p], i) => `<div class="acct-card"><span class="sf" style="--c:${['var(--good)', 'var(--accent)', 'var(--purple)', 'var(--warn)'][i]}"><svg viewBox="0 0 24 24">${['<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z"/>', '<path d="M4 17 10 11l4 4 6-7M15 8h5v5"/>', '<path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>', '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10.5h17"/>'][i]}</svg></span><strong>${n}</strong><span class="lim">${l}</span><span class="tag">${t}</span><p>${p}</p></div>`).join('');
};
function bindInvest() {
  $('#iMo').oninput = e => { st.invest.mo = +e.target.value; RENDER.invest(); };
  $('#iYrs').oninput = e => { st.invest.yrs = +e.target.value; RENDER.invest(); };
  $$('#mixSeg button').forEach(b => b.onclick = () => { st.invest.r = +b.dataset.r; RENDER.invest(); });
}

/* ================= VIEW: COACH ================= */
function aiCfg() { const c = Object.assign({ key: '', model: 'gemini-2.5-flash' }, store.get('cm.ai', {})); if (c.model === 'gemini-flash-latest') c.model = 'gemini-2.5-flash'; return c; }
function contextText() {
  const a = acc(), pf = profile(), sh = st.shock, P = shockParams(a, sh), r = runway(a.B, a.I, a.S, P);
  const ei = runway(a.B, a.I, a.S, { mult: .55 }), base = runway(a.B, a.I, a.S);
  const { list } = levers(a); const act = actuals(a, a.I);
  const goalM = +pf.target || 3;
  return [
    `Customer: account ${a.id}, shown as "${pf.name}". ${a.age != null ? `Age ${a.age}, ${a.sex === 'F' ? 'woman' : 'man'}. ` : ''}${a.joint ? 'Joint account. ' : ''}Province ${pf.prov}. Household of ${pf.house}. Housing: ${pf.home}. Main goal: ${pf.goal}. Risk comfort: ${({ 3: 'cautious', 5: 'balanced', 7: 'growth' })[pf.risk]}. Job: ${pf.job}.${pf.notes ? ' Notes: ' + pf.notes : ''}`,
    `Typical month (medians): money in I=${money(a.I)}, spending S=${money(a.S)}, fixed costs F=${money(a.F)} (household bills, insurance, loan payments), household bills H=${money(a.H)}. Buffer B=${money(a.B)} (mean of average daily balance over last 6 months). Running loan payment P=${money(a.P)}.${a.loan ? ` Loan status ${a.loan.status} (${({ A: 'repaid', B: 'defaulted', C: 'running OK', D: 'running, in arrears' })[a.loan.status]}).` : ''} Days below zero: ${a.neg}.`,
    `Runway rule: buffer_left = B - one_off; gap = spending_after - income_after; runway = buffer_left / gap (0 if buffer_left<=0, "no shortfall" if gap<=0, max 120).`,
    `Baseline runway: ${rwLong(base)}. Layoff with EI 55%: ${rwLong(ei)}, longer than ${pct(eiPercentile(ei.v))} of the bank's customers.`,
    `Current shock: ${shockLabel(sh, a)}. Income after ${money(a.I * P.mult)}, spending after ${money(a.S + P.extra)}, buffer left ${money(r.left)}, gap ${money(r.gap)}, runway ${rwLong(r)}.${sh.inc < 100 ? ` EI lasts ${sh.ei} months; ${r.v >= sh.ei ? 'they make it through' : 'they run out before it ends'}.` : ''}`,
    `Backup plan, applied in this order. Each runway figure INCLUDES every step before it (they stack; they are not separate options): ${list.map((l, i) => `${i === 0 ? 'start' : 'then + ' + l.name} → ${rwLong(l.r)}${l.save ? ` (frees ${money(l.save)}/month on its own)` : ''}`).join('; ')}.`,
    (() => { const goal = goalM * a.S, have = Math.max(a.B, 0), left = Math.max(0, goal - have), sur = a.I - a.S;
      const save = st.plan.save ?? (sur > 0 ? r25(sur * .5) : r25(.1 * Math.max(a.S - a.F, 0)));
      return `Emergency fund: goal ${goalM} months of spending = ${money(goal)}. The buffer already counts toward it: already saved ${money(have)}, still to save ${money(left)}. Monthly surplus (money in minus spending) is ${money(sur)}. Planned saving ${money(save)}/month${st.plan.save == null ? ' (default: half the surplus)' : ''}, so the goal is ${left === 0 ? 'already reached' : save > 0 ? `about ${Math.ceil(left / save)} months away` : 'not moving until they save something'}.`; })(),
    `Budget today: needs ${money(act.needs)}, wants ${money(act.wants)}, savings ${money(act.save)} on income ${money(a.I)}.`,
    `Bank-wide facts: high-income customers spend ~96% of income vs 69% for low-income, so they run out faster on EI (68% vs 4% within 6 months). Runway predicts real defaults better than income (AUC 0.72 vs 0.62). Joint accounts: 0 of 145 loans defaulted. January spending is ~45% above an average month.`,
  ].join('\n');
}
const SYS = `You are ChequeMate Coach, a financial resilience coach inside a Canadian bank's tool. You explain one customer's numbers to a bank employee or the customer.
Rules: Use only the numbers in the context; if you calculate, show the short arithmetic. Amounts are Canadian dollars. Be concise: under 170 words, plain language, short paragraphs or up to 5 bullets, bold the key number once. Give concrete next steps tied to their numbers. Mention official resources (EI on canada.ca, FCAC, Credit Counselling Canada) when relevant. Never recommend specific stocks or funds.
Refer to the customer by their name or as "they"; don't restate their age, sex or province unless the question is about them. Answer the question asked first, in the first sentence, then support it. Backup-plan runways stack: never present a later step's runway as if that step worked alone. Don't add disclaimers about being an advisor unless asked for specific investment picks.`;
function mdLite(t) {
  const lines = esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>').split('\n');
  let html = '', list = null;
  for (const raw of lines) { const l = raw.trim();
    const ul = l.match(/^[-*•]\s+(.*)/), ol = l.match(/^\d+[.)]\s+(.*)/);
    if (ul || ol) { const tag = ul ? 'ul' : 'ol'; if (list !== tag) { if (list) html += `</${list}>`; html += `<${tag}>`; list = tag; } html += `<li>${(ul || ol)[1]}</li>`; continue; }
    if (list) { html += `</${list}>`; list = null; }
    if (l) html += `<p>${l.replace(/^#+\s*/, '')}</p>`;
  }
  if (list) html += `</${list}>`; return html;
}
function offlineAnswer(q) {
  const a = acc(), sh = st.shock, P = shockParams(a, sh), r = runway(a.B, a.I, a.S, P), ei = runway(a.B, a.I, a.S, { mult: .55 });
  const { list } = levers(a); const last = list[list.length - 1]; const pf = profile(); const s = q.toLowerCase();
  const surplus = a.I - a.S, act = actuals(a, a.I);
  if (/cut|trim|spend less|reduce/.test(s)) return `Start with what moves runway most:\n${list.slice(1).map(l => `- **${l.name}**: frees ${money(l.save)} a month, runway ${rwLong(l.r)}`).join('\n')}\nEveryday cash spending is the biggest lever here because it's about ${money(Math.max(a.S - a.F, 0))} a month.`;
  if (/90|plan|week/.test(s)) return `**90-day plan for ${pf.name}**\n1. Week 1: set up an automatic transfer of ${money(st.plan.save ?? r25(Math.max(surplus * .5, 50)))} on payday into a high-interest savings account.\n2. Weeks 2–4: trim everyday spending ${st.plan.cut}% (about ${money(st.plan.cut / 100 * Math.max(a.S - a.F, 0))} a month) and shop phone, internet and insurance.\n3. Month 2: ${a.P > 0 ? `ask the lender what deferral options exist on the ${money(a.P)} loan, before anything goes wrong` : 'build the buffer toward one month of spending'}.\n4. Month 3: check progress. Target is ${money((+pf.target || 3) * a.S)} (${pf.target || 3} months).\nIf a layoff hits, apply for EI the same week.`;
  if (/budget|rule|50/.test(s)) { const sc = RULES.filter(x => x.parts).map(x => ({ x, g: ruleGap(x, act, a.I) })).sort((p, q2) => p.g - q2.g)[0]; return `Today: needs ${money(act.needs)}, wants ${money(act.wants)}, savings ${money(act.save)} on ${money(a.I)} a month.\nThe closest fit is **${sc.x.name}**, needing ${money(sc.g)} a month moved. ${act.save < .2 * a.I ? `Savings are ${pct(Math.max(act.save, 0) / (a.I || 1))} of income; 20% would be ${money(.2 * a.I)}.` : 'Savings already clear 20%.'}`; }
  if (/invest|tfsa|rrsp|fhsa|next dollar/.test(s)) { const bm = a.S ? a.B / a.S : 0; return bm < (+pf.target || 3) ? `The buffer covers **${bm.toFixed(1)} months** of spending, under the ${pf.target || 3}-month target. The next dollar goes to the emergency fund in a high-interest savings account. After that: TFSA ($7,000 room for 2026)${pf.goal === 'home' ? ', or an FHSA for a first home' : ''}.` : `The emergency fund is covered (${bm.toFixed(1)} months). Next dollar: ${pf.goal === 'home' ? 'FHSA, up to $8,000 a year' : 'TFSA, $7,000 of new room in 2026'}. A ${({ 3: 'cautious', 5: 'balanced', 7: 'growth' })[pf.risk]} mix fits the profile.`; }
  if (/make it|survive|shock|twist/.test(s) && !isNoShock(sh)) return `Shock: ${shockLabel(sh, a)}.\nBuffer left ${money(r.left)}, monthly gap ${money(r.gap)}, so runway is **${rwLong(r)}**.${sh.inc < 100 ? (r.v >= sh.ei ? ` That's past the ${sh.ei}-month EI period.` : ` That's short of the ${sh.ei}-month EI period by ${(sh.ei - r.v).toFixed(1)} months.`) : ''}\nWith the backup plan, runway becomes ${rwLong(last.r)}.`;
  return `${pf.name} brings in about **${money(a.I)}** a month and spends ${money(a.S)} (${pct(a.S / (a.I || 1))}). The buffer is ${money(a.B)}.\nIf laid off with EI at 55%, the gap is ${money(Math.max(ei.gap, 0))} a month, so the buffer lasts **${rwLong(ei)}**. ${ei.v < 6 ? 'That runs out before 6 months of EI end.' : 'That outlasts a 6-month EI period.'}\nThe fastest fix is ${a.S > a.F ? `trimming everyday spending, which is ${money(a.S - a.F)} a month` : 'building the buffer with a monthly transfer'}.`;
}
/* Built-in server proxy (server.py): the key lives on the server, never in the browser. */
let SERVER_AI = null; // null = unknown, false = none, { model } = available
async function serverAI() {
  if (SERVER_AI !== null) return SERVER_AI;
  if (location.protocol === 'file:') return (SERVER_AI = false);
  try { const r = await fetch('api/gemini/status', { cache: 'no-store' }); const j = r.ok ? await r.json() : {}; SERVER_AI = j.ok ? { model: j.model } : false; }
  catch (e) { SERVER_AI = false; }
  return SERVER_AI;
}
async function askGemini(q) {
  // Prefer the site's server (shared key, retries busy models). A personal key is only used when there is no server.
  const cfg = aiCfg(); const srv = await serverAI();
  if (!srv && !cfg.key) throw new Error('nokey');
  // Gemini needs strictly alternating turns that start with the user, so drop the greeting and any failed turns.
  const hist = st.chat.filter(m => !m.typing && m.text && !m.offline);
  const turns = [];
  for (const m of hist.slice(0, -1).slice(-10)) {
    const role = m.role === 'user' ? 'user' : 'model';
    if (!turns.length && role !== 'user') continue;
    if (turns.length && turns[turns.length - 1].role === role) turns[turns.length - 1].parts[0].text += '\n\n' + m.text;
    else turns.push({ role, parts: [{ text: m.text }] });
  }
  if (turns.length && turns[turns.length - 1].role === 'user') turns.pop();
  turns.push({ role: 'user', parts: [{ text: q }] });
  const flash = m => /flash/.test(m);
  const body = m => ({ systemInstruction: { parts: [{ text: SYS + '\n\nCONTEXT\n' + contextText() }] }, contents: turns,
    generationConfig: Object.assign({ temperature: .5, maxOutputTokens: 1500 }, flash(m) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) });
  let j = {}, used = '';
  if (srv) {
    const res = await fetch('api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ model: srv.model }, body(srv.model))) });
    j = await res.json().catch(() => ({})); used = j.servedBy || srv.model;
    if (!res.ok) throw new Error(j.error?.message || `HTTP ${res.status}`);
  } else {
    const models = [...new Set([cfg.model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite'])];
    for (const m of models) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body(m)) });
      j = await res.json().catch(() => ({})); used = m;
      if (res.ok) break;
      if (![429, 500, 503].includes(res.status)) throw new Error(j.error?.message || `HTTP ${res.status}`);
      if (m === models[models.length - 1]) throw new Error(j.error?.message || `HTTP ${res.status}`);
    }
  }
  const cand = j.candidates?.[0] || {};
  let t = (cand.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!t) throw new Error(cand.finishReason === 'SAFETY' ? 'Gemini declined to answer that one' : 'Empty answer');
  if (cand.finishReason === 'MAX_TOKENS') t += '…';
  askGemini.via = `Gemini (${used})`;
  return t;
}
function renderMsgs() {
  const box = $('#msgs');
  box.innerHTML = st.chat.map(m => m.role === 'user' ? `<div class="msg user">${esc(m.text)}</div>` : `<div class="msg-row"><span class="mate-av" aria-hidden="true"></span><div class="msg bot${m.typing ? ' typing' : ''}">${m.typing ? '<span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>' : mdLite(m.text)}${m.src ? `<div class="src">${esc(m.src)}</div>` : ''}</div></div>`).join('');
  box.scrollTop = box.scrollHeight;
}
async function send(q) {
  q = q.trim(); if (!q) return;
  emit('ask', { q });
  st.chat.push({ role: 'user', text: q }); const pending = { role: 'model', typing: true, text: '' }; st.chat.push(pending); renderMsgs();
  try { pending.text = await askGemini(q); pending.src = askGemini.via; }
  catch (e) {
    console.warn('[coach] Gemini failed:', e.message);
    pending.text = offlineAnswer(q); pending.offline = true;
    pending.src = e.message === 'nokey' ? 'Built-in coach. Start the site with server.py, or add a Gemini key in Profile, for open-ended answers.'
      : /fetch|network|Failed/i.test(e.message) ? "Built-in coach. Gemini couldn't be reached from here. Check the connection and ask again."
      : `Built-in coach, because Gemini said: ${e.message}`;
  }
  pending.typing = false; renderMsgs();
  renderChips(q);
  emit('answer', { text: pending.text });
}

/* ---------- suggested questions, built from this customer's numbers ---------- */
const asked = () => new Set(st.chat.filter(m => m.role === 'user').map(m => m.text));
function promptGroups() {
  const a = acc(), pf = profile(), ei = runway(a.B, a.I, a.S, { mult: .55 }), sh = st.shock;
  const sr = a.I > 0 ? (a.I - a.S) / a.I : 0, bm = a.S > 0 ? a.B / a.S : 0, tgt = +pf.target || 3;
  const g = {
    Understand: ["Explain this customer's runway in plain words",
      ei.v === Infinity ? 'Why would a layoff not hurt them much?' : `Why does the buffer only last ${rwText(ei)} months on EI?`,
      `Why do they spend ${pct(a.S / (a.I || 1))} of what comes in?`,
      'How do they compare with the rest of the bank?',
      a.neg > 0 ? `Why do ${a.neg} days below zero matter?` : 'What is the earliest warning sign to watch for?'],
    Shocks: [isNoShock(sh) ? 'Would they survive a layoff on EI?' : 'Do they make it through the current shock?',
      'What happens if the furnace dies next month?',
      'What if they lose their income completely?',
      'What if rent goes up $300 a month?',
      'Which shock would hurt them the most?'],
    Plan: ['What should they cut first?',
      ei.v !== Infinity && ei.v < 6 ? 'How do they get past 6 months of EI?' : 'How can they make their runway even longer?',
      a.P > 0 ? `Should they ask to pause the ${money(a.P)} loan payment?` : 'Which bills are worth shopping around?',
      bm < tgt ? `How long until they have a ${tgt}-month emergency fund?` : 'Their fund is built. What comes next?',
      'Write a 90-day plan'],
    Budget: ['Which budget rule fits them?',
      sr < .2 ? 'How can they get to saving 20% of income?' : 'They already save a lot. Is it enough?',
      'Build them a zero-based budget',
      'Where is their money going each month?',
      'How should they handle January spending?'],
    Invest: ['Where should their next dollar go?',
      pf.goal === 'home' ? 'Should they open an FHSA for a first home?' : 'TFSA or RRSP for them?',
      `What could ${money(r25(Math.max(100, .1 * a.I)))} a month grow into?`,
      'Should they invest before the emergency fund is done?',
      'How much risk fits their situation?'],
  };
  return g;
}
const FOLLOW = [
  [/cut|trim|spend less|reduce|wants/i, ['How much runway does that buy them?', 'Which cut is easiest to keep up?', 'Write that as a weekly checklist']],
  [/runway|buffer|last/i, ['What would double their runway?', 'How do they compare with the rest of the bank?', 'What should they do first this week?']],
  [/plan|90|week|checklist/i, ['What should they do on day one?', 'What could knock this plan off course?', 'Turn this into a message to the customer']],
  [/shock|layoff|furnace|income|rent|survive|EI/i, ['How do they close the gap?', 'Should they apply for EI right away?', 'What if EI runs out before they find work?']],
  [/budget|rule|50|zero/i, ['Show the numbers for that rule', 'What is the one change that fits it best?', 'How do they stick to it?']],
  [/invest|tfsa|rrsp|fhsa|dollar|grow|risk/i, ['How much should go to investing each month?', 'What is the difference between a TFSA and an RRSP?', 'What should they avoid?']],
  [/fund|emergency|save|saving/i, ['Where should the emergency fund be kept?', 'How do they automate it?', 'What if they need to dip into it?']],
];
function renderChips(lastQ) {
  const el = $('#chips'); if (!el || !acc()) return;
  const done = asked(), g = promptGroups();
  let list = [];
  if (lastQ) { const f = FOLLOW.find(([re]) => re.test(lastQ)); if (f) list.push(...f[1]); }
  const firsts = Object.values(g).map(x => x[0]);
  list.push(...firsts, ...Object.values(g).flat());
  list = [...new Set(list)].filter(q => !done.has(q)).slice(0, 4);
  el.innerHTML = (lastQ ? '<span class="chips-k">Ask next</span>' : '<span class="chips-k">Suggested</span>') + list.map(q => `<button type="button">${esc(q)}</button>`).join('');
  $$('#chips button').forEach(b => b.onclick = () => send(b.textContent));
}
let promptTab = 'Understand';
function renderPrompts() {
  const g = promptGroups(), done = asked();
  $('#promptTabs').innerHTML = Object.keys(g).map(k => `<button type="button" data-k="${k}" aria-pressed="${k === promptTab}">${k}</button>`).join('');
  $$('#promptTabs button').forEach(b => b.onclick = () => { promptTab = b.dataset.k; renderPrompts(); });
  $('#prompts').innerHTML = g[promptTab].map(q => `<button type="button"${done.has(q) ? ' class="asked"' : ''}>${esc(q)}</button>`).join('');
  $$('#prompts button').forEach(b => b.onclick = () => { send(b.textContent); setTimeout(renderPrompts, 0); });
}
RENDER.coach = () => {
  const a = acc(); if (!a) return; const pf = profile();
  if (!st.chat.length) st.chat.push({ role: 'model', text: `Hi. I'm looking at **${pf.name}** (account ${a.id}). Ask me what their numbers mean, whether they survive a shock, or what to do next.`, src: 'ChequeMate Coach' });
  renderMsgs();
  renderPrompts();
  const lastUser = [...st.chat].reverse().find(m => m.role === 'user');
  renderChips(lastUser && lastUser.text);
  const c = aiCfg();
  $('#coachStatus').textContent = 'Checking for Gemini…';
  serverAI().then(s => { $('#coachStatus').textContent = s ? `Gemini is on (${s.model}), connected through this site's server. The account, profile and current shock are sent with each question.`
    : c.key ? `Using your own Gemini key from Profile. Model: ${c.model}. The account, profile and current shock are sent with each question.`
    : 'No Gemini key yet, so the built-in coach answers. It uses the same numbers as every page.'; });
};
function bindCoach() {
  $('#composer').onsubmit = e => { e.preventDefault(); const t = $('#ask'); const q = t.value; t.value = ''; send(q); };
  $('#ask').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); } };
}

/* ================= VIEW: DATA ================= */
RENDER.data = () => {
  const n = IDS.length; if (!n) return;
  const accs = IDS.map(id => DATA[id]);
  const out6 = POP.ei.filter(v => v < 6).length / n;
  $('#dataStatus').innerHTML = SRC.kind === 'upload'
    ? `<div class="verdict good">${ICON.check}<div><strong>Using ${esc(SRC.label)}</strong><p>${n.toLocaleString()} accounts loaded. Every page now reads from this file. <button class="btn ghost" type="button" id="backBuiltin">Switch back to the Tangerine sample</button></p></div></div>`
    : `<div class="callout">Showing the <strong>Tangerine track sample</strong>: ${n.toLocaleString()} accounts, 2020 to 2025. Upload a file to analyse your own.</div>`;
  const bb = $('#backBuiltin'); if (bb) bb.onclick = () => useBuiltin();
  $('#portLedger').innerHTML = [
    ['Accounts', n.toLocaleString(), SRC.kind === 'upload' ? 'From your file' : 'Tangerine sample'],
    ['Median money in', money(median(accs.map(x => x.I))), 'Per month'],
    ['Median buffer', money(median(accs.map(x => x.B))), 'Avg balance, last 6 months'],
    ['Out within 6 months', pct(out6), 'If laid off on EI at 55%'],
    ['Short today', POP.base.filter(r => r.v !== Infinity).length.toLocaleString(), 'Median spending above income'],
  ].map(([k, v, s]) => `<div><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('');
  const bins = Array(25).fill(0); POP.ei.forEach(v => bins[v === Infinity || v >= 24 ? 24 : Math.floor(v)]++);
  const crit = V('--crit'), warn = V('--warn'), s1 = V('--s1');
  chart('histChart', { type: 'bar', data: { labels: bins.map((_, i) => i === 24 ? '24+' : String(i)), datasets: [{ label: 'Accounts', data: bins,
    backgroundColor: bins.map((_, i) => i < 3 ? crit : i < 6 ? warn : s1), borderRadius: 5, borderSkipped: 'start', barPercentage: .8, categoryPercentage: .9 }] },
    options: baseOpts({ interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { title: i => i[0].label === '24+' ? '24 months or more' : `${i[0].label} to ${+i[0].label + 1} months`, label: i => ` ${i.raw.toLocaleString()} accounts` } } },
      scales: { x: { title: { display: true, text: 'Months of runway', color: V('--muted'), font: { family: FONT, size: 11 } } } } }) });
  const all = IDS.map((id, k) => [id, POP.ei[k]]); const noBuf = all.filter(x => x[1] === 0).length;
  const frag = all.filter(x => x[1] > 0).sort((x, y) => x[1] - y[1]).slice(0, 8);
  $('#fragileSub').textContent = noBuf ? `Shortest layoff runway. ${noBuf} more have no buffer at all.` : 'Shortest layoff runway';
  $('#fragileList').innerHTML = frag.map(([id, v]) => { const x = DATA[id]; return `<button type="button" data-id="${id}"><span class="avatar sm">${String(id).slice(-2)}</span><span>${id}</span><span class="muted">${money(x.I)} in, ${money(x.B)} buffer</span><span class="pill ${status(v)}">${v.toFixed(1)} mo</span></button>`; }).join('');
  $$('#fragileList button').forEach(b => b.onclick = () => { setAccount(+b.dataset.id, true); go('customer'); });
  const se = POP.season;
  chart('seasonChart', { type: 'bar', data: { labels: MONTHS, datasets: [
    { label: 'Money in', data: se.in.map(x => +x.toFixed(2)), backgroundColor: V('--s1'), borderRadius: 5, borderSkipped: false, barPercentage: .82, categoryPercentage: .66 },
    { label: 'Money out', data: se.out.map(x => +x.toFixed(2)), backgroundColor: V('--s2'), borderRadius: 5, borderSkipped: false, barPercentage: .82, categoryPercentage: .66 },
  ] }, options: baseOpts({ scales: { y: { min: 0, ticks: { callback: v => v.toFixed(1) }, grid: { color: c => c.tick.value === 1 ? V('--ink-2') : V('--line') } } }, plugins: { tooltip: { callbacks: { label: i => ` ${i.dataset.label}: ${i.raw.toFixed(2)}× average` } } } }) });
  const top = se.out.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 2);
  $('#seasonNote').textContent = `Spending peaks in ${MONTHS[top[0][1]]} (${pct(top[0][0] - 1)} above average) and ${MONTHS[top[1][1]]} (${pct(top[1][0] - 1)}). Money in peaks in ${MONTHS[se.in.indexOf(Math.max(...se.in))]}.`;
};
function useBuiltin(quiet) {
  DATA = BUILTIN; SRC = { kind: 'builtin', label: 'Tangerine track sample' }; prepDataset();
  $('#srcLabel').textContent = 'Data: Tangerine track sample, 4,500 accounts';
  setAccount(store.get('cm.last.builtin', 28754) in DATA ? store.get('cm.last.builtin', 28754) : 28754, true);
  if (!quiet) { toast('Switched back to the Tangerine sample'); route(); }
}
function parseCSV(file) { return new Promise((res, rej) => Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: r => res(r), error: rej })); }
async function handleFiles(files) {
  if (!window.Papa) { toast('CSV reader failed to load. Check the connection and reload.'); return; }
  const status = $('#dataStatus'); status.innerHTML = `<div class="callout">Reading ${files.length} file${files.length > 1 ? 's' : ''}…</div>`;
  let monthly = null, loans = null, names = [];
  for (const f of files) {
    try {
      const r = await parseCSV(f); const cols = r.meta.fields || [];
      if (cols.includes('money_in') && cols.includes('month')) { monthly = r.data; names.push(f.name); }
      else if (cols.includes('monthly_payment') && cols.includes('loan_start')) { loans = r.data; names.push(f.name); }
      else { status.innerHTML = `<div class="verdict crit">${ICON.alert}<div><strong>${esc(f.name)} isn't a format ChequeMate reads</strong><p>Expected monthly_summary.csv (with month, money_in, money_out, avg_daily_balance) or loans.csv (with loan_start, monthly_payment).</p></div></div>`; return; }
    } catch (e) { status.innerHTML = `<div class="verdict crit">${ICON.alert}<div><strong>Couldn't read ${esc(f.name)}</strong><p>${esc(e.message || e)}</p></div></div>`; return; }
  }
  if (!monthly) { status.innerHTML = `<div class="verdict warn">${ICON.alert}<div><strong>Add a monthly_summary.csv</strong><p>Loans alone don't give income, spending or a buffer. Drop both files together.</p></div></div>`; return; }
  const need = ['account_id', 'month', 'money_in', 'money_out', 'avg_daily_balance', 'household_bills'];
  const miss = need.filter(c => !(c in monthly[0]));
  if (miss.length) { status.innerHTML = `<div class="verdict crit">${ICON.alert}<div><strong>Missing columns: ${miss.join(', ')}</strong><p>Use the monthly_summary.csv layout from the track data.</p></div></div>`; return; }
  const out = buildFromRows(monthly, loans);
  const n = Object.keys(out).length; if (!n) { status.innerHTML = `<div class="verdict crit">${ICON.alert}<div><strong>No accounts found in the file</strong><p>Check that account_id and month have values.</p></div></div>`; return; }
  DATA = out; SRC = { kind: 'upload', label: names.join(' + ') }; prepDataset(); emit('upload', { n: Object.keys(out).length });
  $('#srcLabel').textContent = `Data: ${names.join(' + ')}, ${n.toLocaleString()} accounts`;
  setAccount(IDS[0], true); toast(`Loaded ${n.toLocaleString()} accounts`); route();
}
function buildFromRows(rows, loanRows) {
  const by = new Map();
  for (const r of rows) { if (r.account_id == null || !r.month) continue; const k = +r.account_id; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const loanMap = new Map(); (loanRows || []).forEach(l => { if (l.account_id != null) loanMap.set(+l.account_id, l); });
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (+v || 0);
  const out = {};
  for (const [id, list] of by) {
    list.sort((x, y) => String(x.month).localeCompare(String(y.month)));
    const col = c => list.map(r => num(r[c]));
    const mi = col('money_in'), mo = col('money_out'), hb = col('household_bills'), ins = col('insurance'), lp = col('loan_payments'), bal = col('avg_daily_balance');
    let P = 0, loan; const l = loanMap.get(id);
    if (l) { const [y, m] = String(l.loan_start).split('-').map(Number); const running = (y * 12 + m - 1 + num(l.duration_months)) > 2025 * 12 + 11; P = running ? num(l.monthly_payment) : 0;
      loan = { amt: num(l.amount), dur: num(l.duration_months), pay: num(l.monthly_payment), start: l.loan_start, status: l.status || 'C', running, def: num(l.defaulted) }; }
    const meanOf = c => mean(col(c));
    out[id] = { I: median(mi), S: median(mo), H: median(hb), F: median(list.map((_, i) => hb[i] + ins[i] + lp[i])), B: mean(bal.slice(-6)), P,
      m0: String(list[0].month).slice(0, 7), n: list.length, in: mi.map(Math.round), out: mo.map(Math.round), bal: bal.map(Math.round), bills: hb.map(Math.round),
      neg: col('days_below_zero').reduce((s, x) => s + x, 0),
      mi: ['cash_deposits', 'transfers_in', 'pension_in', 'interest_in'].map(meanOf),
      mo: ['household_bills', 'insurance', 'loan_payments', 'bank_fees', 'cash_withdrawals_genuine', 'card_withdrawals', 'transfers_out_other'].map(meanOf),
      age: null, sex: null, joint: false, card: null, dist: null, region: null, opened: String(list[0].month), loan };
  }
  return out;
}
function bindData() {
  const drop = $('#drop'), fi = $('#fileIn');
  fi.onchange = () => { if (fi.files.length) handleFiles([...fi.files]); fi.value = ''; };
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) handleFiles(f); });
}

/* ================= VIEW: RESOURCES ================= */
const RES = [
  ['If the job goes', [
    ['EI regular benefits', 'Who qualifies, how to apply, and how long benefits last.', 'https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit.html'],
    ['How much EI pays', '55% of average insurable earnings, up to $729 a week in 2026.', 'https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html'],
    ['2026 maximum insurable earnings', 'The EI earnings ceiling for 2026: $68,900.', 'https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-employers/premium-reduction-program/2026-maximum-insurable-earnings.html'],
  ]],
  ['Budgeting and debt help', [
    ['Financial Consumer Agency of Canada', 'Free, independent tools for budgeting, debt and banking.', 'https://www.canada.ca/en/financial-consumer-agency.html'],
    ['Credit Counselling Canada', 'Non-profit credit counsellors when payments get hard.', 'https://creditcounsellingcanada.ca/'],
    ['211 Ontario', 'Local help with housing, food and income support.', 'https://211ontario.ca/'],
  ]],
  ['Saving and investing', [
    ['TFSA (CRA)', 'Contribution room, withdrawals and the 2026 limit.', 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account.html'],
    ['RRSP and related plans (CRA)', 'Deduction limits and how withdrawals are taxed.', 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans.html'],
    ['FHSA (CRA)', 'First Home Savings Account rules.', 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html'],
    ['CDIC deposit insurance', 'What is protected and up to how much.', 'https://www.cdic.ca/'],
  ]],
  ['Data for sizing shocks', [
    ['Consumer Price Index', 'Statistics Canada table 18-10-0004-01.', 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401'],
    ['CMHC average rents by city', 'Statistics Canada table 34-10-0133-01.', 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301'],
    ['Labour Force Survey', 'Unemployment, table 14-10-0287-01.', 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701'],
    ['Average weekly earnings', 'Table 14-10-0223-01.', 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410022301'],
  ]],
  ['About the data', [
    ['PKDD\'99 Financial dataset', 'Real anonymized bank data from the CTU Prague Relational Dataset Repository, relabelled to CAD for the Tangerine track.', 'https://relational.fel.cvut.cz/dataset/Financial'],
    ['TFSA limit holds at $7,000 for 2026', 'Investment Executive, on the CRA announcement.', 'https://www.investmentexecutive.com/news/tfsa-dollar-limit-to-hold-steady-in-2026'],
  ]],
];
RENDER.resources = () => {
  $('#resGrid').innerHTML = RES.map(([g, items]) => `<div class="res-group"><h2>${g}</h2><div class="list">${items.map(([t, d, u]) =>
    `<a class="res" href="${u}" target="_blank" rel="noopener"><strong>${t}</strong><span>${d}</span><span class="host">${new URL(u).hostname.replace('www.', '').replace('www150.', '')}</span></a>`).join('')}</div></div>`).join('');
};

/* ================= VIEW: PROFILE ================= */
const PROVS = [['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'], ['NL', 'Newfoundland and Labrador'], ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'], ['QC', 'Quebec'], ['SK', 'Saskatchewan'], ['YT', 'Yukon']];
const PF_FIELDS = { pfName: 'name', pfProv: 'prov', pfHouse: 'house', pfHome: 'home', pfGoal: 'goal', pfRisk: 'risk', pfTarget: 'target', pfJob: 'job', pfNotes: 'notes' };
RENDER.profile = () => {
  const a = acc(); if (!a) return; const p = profile();
  if (!$('#pfProv').options.length) $('#pfProv').innerHTML = PROVS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
  for (const [id, k] of Object.entries(PF_FIELDS)) $('#' + id).value = p[k];
  const c = aiCfg(); $('#aiKey').value = c.key ? '••••••••' + c.key.slice(-4) : ''; $('#aiModel').value = c.model;
  const facts = [];
  if (a.age != null) facts.push(['info', 'info', `${a.age} years old, ${a.sex === 'F' ? 'woman' : 'man'}.`]);
  if (a.dist) facts.push(['info', 'info', `Branch district: ${esc(a.dist)} (${esc(a.region)}). Average salary there: ${money(a.dsal)} a month.`]);
  facts.push(['info', 'info', `Account opened ${esc(a.opened)}. ${a.n} months of history${a.freq ? ', ' + esc(a.freq) : ''}.`]);
  facts.push([a.card ? 'good' : 'info', a.card ? 'check' : 'info', a.card ? `Holds a ${a.card} card.` : 'No card on the account. Borrowers without a card defaulted at 13.9%.']);
  if (a.joint) facts.push(['good', 'check', 'Joint account with an authorized user.']);
  if (a.loan) facts.push([a.loan.def ? 'crit' : 'info', a.loan.def ? 'x' : 'info', `Loan of ${money(a.loan.amt)} over ${a.loan.dur} months from ${esc(a.loan.start)}, ${money(a.loan.pay)} a month. ${({ A: 'Repaid.', B: 'Defaulted.', C: 'Running, on track.', D: 'Running, in arrears.' })[a.loan.status]}`]);
  $('#profFacts').innerHTML = facts.map(([s, i, t]) => `<div class="insight ${s}">${ICON[i]}<div>${t}</div></div>`).join('');
};
function bindProfile() {
  $('#profForm').onsubmit = e => { e.preventDefault(); const p = profile(); for (const [id, k] of Object.entries(PF_FIELDS)) p[k] = $('#' + id).value.trim(); if (!p.name) p.name = `Customer ${st.id}`; p.house = clamp(+p.house || 1, 1, 12);
    store.set('cm.p.' + st.id, p); st.invest.r = null; renderMicr(); toast('Profile saved'); emit('profile'); };
  $('#pfClear').onclick = () => { store.del('cm.p.' + st.id); RENDER.profile(); renderMicr(); toast('Profile reset'); };
  $('#aiForm').onsubmit = e => { e.preventDefault(); const c = aiCfg(); const k = $('#aiKey').value.trim(); if (k && !k.startsWith('••')) c.key = k; c.model = $('#aiModel').value.trim() || 'gemini-flash-latest'; store.set('cm.ai', c); RENDER.profile(); $('#aiMsg').textContent = 'Saved.'; toast('Gemini settings saved'); };
  $('#aiClear').onclick = () => { store.del('cm.ai'); RENDER.profile(); $('#aiMsg').textContent = 'Key removed.'; };
  $('#aiTest').onclick = async () => {
    const m = $('#aiMsg'); const k = $('#aiKey').value.trim(); if (k && !k.startsWith('••')) { const c = aiCfg(); c.key = k; c.model = $('#aiModel').value.trim() || c.model; store.set('cm.ai', c); }
    m.textContent = 'Testing…'; m.style.color = '';
    try { const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiCfg().model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': aiCfg().key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ready' }] }] }) });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error?.message || 'HTTP ' + res.status);
      m.textContent = 'Connected. Gemini answered.'; m.style.color = 'var(--good-t)';
    } catch (e) { m.style.color = 'var(--crit-t)'; m.textContent = /fetch|Failed|network/i.test(e.message) ? "Couldn't reach Gemini from this page. Previews block outside calls; run the site locally or on GitHub Pages." : 'Gemini said: ' + e.message; }
  };
}

/* ---------------- boot ---------------- */
function boot() {
  if (!IDS.length && !Object.keys(DATA).length) { $('#loading').textContent = 'The data file did not load. Check that data/accounts.js sits next to index.html.'; return; }
  prepDataset();
  $('#loading').remove();
  bindShock(); bindPlan(); bindBudget(); bindInvest(); bindCoach(); bindData(); bindProfile();
  $('#acctForm').onsubmit = e => {
    e.preventDefault(); const v = $('#acctInput').value.replace(/\D/g, '');
    if (!setAccount(v)) { $('#acctInput').setAttribute('aria-invalid', 'true'); const er = $('#acctErr'); er.hidden = false; er.textContent = v ? `No account ${v} in this data. IDs run from ${IDS[0]} to ${IDS[IDS.length - 1]}.` : 'Type an account number.'; }
    else if (currentView === 'paradox' || currentView === 'data' || currentView === 'resources') go('customer');
  };
  $('#acctRandom').onclick = () => { setAccount(IDS[Math.floor(Math.random() * IDS.length)]); if (['paradox', 'data', 'resources'].includes(currentView)) go('customer'); };
  $$('[data-theme-set]').forEach(b => b.onclick = () => applyTheme(b.dataset.themeSet));
  $('#moreBtn').onclick = openSheet; $('#sheetBg').onclick = closeSheet; addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  $('#acctInput').addEventListener('input', () => { $('#acctErr').hidden = true; $('#acctInput').removeAttribute('aria-invalid'); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (store.get('cm.theme', 'system') === 'system') applyTheme('system'); });
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawGuilloche, 150); });
  const t = store.get('cm.theme', 'system'); if (t !== 'system') document.documentElement.setAttribute('data-theme', t);
  $$('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === t)));
  if (window.Chart) { Chart.defaults.font.family = FONT; }
  const last = store.get('cm.last.builtin', 28754);
  setAccount(DATA[last] ? last : (DATA[28754] ? 28754 : IDS[0]), true);
  addEventListener('hashchange', route);
  route();
}
// expose engine for testing in the console
window.ChequeMate = { runway, get data() { return DATA; }, get builtin() { return BUILTIN; }, get ids() { return IDS; }, get src() { return SRC; }, get view() { return currentView; },
  st, acc, profile, shockParams, SHOCKS, money, pct, esc, toast, go, setAccount, applyPreset, rwText, rwLong, status, tone, eiPercentile, levers, isNoShock, ICON, reduceMotion, store };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
