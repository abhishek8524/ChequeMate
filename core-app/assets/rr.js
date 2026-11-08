/* Resilience Rewired: the design team's Figma prototype (palette v2) built on ChequeMate's engine.
   Shell (greeting header, sticky nav, jump-to, search, notifications, settings, AI chat, footer) and the Overview page.
   Numbers follow the developer notes exactly: I, F, S, B, H, P and the judges' runway formula. */
(() => {
'use strict';
const CM = window.ChequeMate;
if (!CM) return;
const root = document.documentElement;
const RRUI = () => root.getAttribute('data-ui') === 'rr';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { money, esc, runway, store } = CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r25 = v => Math.max(0, Math.round(v / 25) * 25);
const rwS = v => v === Infinity ? '120+' : v.toFixed(1);
const reduceMotion = () => CM.reduceMotion || root.getAttribute('data-motion') === 'reduce';

/* ---------------- personas (demo control, not shown to customers) ---------------- */
const PERSONAS = {
  maya: { id: 86402, name: 'Maya', blurb: '21 · Starting out', tab: 'saving', jump: 'rr-fund', sits: { repair: true }, milestone: 1000 },
  daniel: { id: 22768, name: 'Daniel', blurb: '43 · Capital-city resident', tab: 'yourdata', jump: 'rr-compare', sits: { job: true } },
  priya: { id: 83390, name: 'Priya', blurb: '44 · High-unemployment district', tab: 'saving', jump: 'rr-job', sits: { job: true, bills: true } },
  walter: { id: 34728, name: 'Walter', blurb: '73 · Retiree', tab: 'situations', jump: 'rr-ahead', sits: { repair: true, bills: true }, large: true, hideJob: true },
};
const personaFor = id => Object.entries(PERSONAS).find(([, p]) => p.id === +id);

/* ---------------- situations (all can be on at once) ---------------- */
const SIT0 = () => ({ job: { on: false, ei: 55, mo: 6 }, bills: { on: false, pct: 15 }, repair: { on: false, amt: null }, monthly: { on: false, amt: 300 } });
let SIT = Object.assign(SIT0(), store.get('cm.rr.sits', {}));
const saveSit = () => store.set('cm.rr.sits', SIT);
/* deep links from the landing page: ?account=<id>&twist=ei|furnace|combo|none */
const QP = new URLSearchParams(location.search), DEEP = { account: (QP.get('account') || '').replace(/\D/g, ''), twist: QP.get('twist') };
const TWISTS = { ei: { job: { on: true, ei: 55, mo: 6 } }, furnace: { repair: { on: true, amt: null } }, combo: { job: { on: true, ei: 55, mo: 6 }, bills: { on: true, pct: 15 } }, none: {} };
if (DEEP.twist && TWISTS[DEEP.twist]) { const b = SIT0(); SIT = Object.assign(b, JSON.parse(JSON.stringify(TWISTS[DEEP.twist]))); saveSit(); }
window.CM_DEEP = DEEP;
if (DEEP.account || DEEP.twist) { QP.delete('account'); QP.delete('twist'); history.replaceState(null, '', location.pathname + (QP.toString() ? '?' + QP : '') + location.hash); }
function syncShock() {
  const a = CM.acc(), s = CM.st.shock;
  s.inc = SIT.job.on ? SIT.job.ei : 100; s.ei = SIT.job.mo; s.bills = SIT.bills.on ? SIT.bills.pct : 0;
  s.oneMult = null; s.one = SIT.repair.on ? (SIT.repair.amt ?? Math.round(a.S)) : 0;
  s.extra = SIT.monthly.on ? SIT.monthly.amt : 0; s.after = 'back'; s.preset = 'custom';
}
const sitLabel = () => [SIT.job.on && 'laid off', SIT.bills.on && `bills up ${SIT.bills.pct}%`, SIT.repair.on && 'surprise repair', SIT.monthly.on && 'new monthly cost'].filter(Boolean);
function status(v) { return v === Infinity || v >= 6 ? ['stable', '✓', 'Stable'] : v >= 3 ? ['watch', '!', 'Watch'] : ['critical', '✕', 'Critical']; }
const statusHTML = v => { const [c, i, l] = status(v); return `<span class="rr-status ${c}"><i aria-hidden="true">${i}</i>${l}</span>`; };

/* ---------------- toast ---------------- */
let toastT;
function toast(msg) { const t = $('#rrToast'); t.innerHTML = `<i aria-hidden="true">✓</i>${esc(msg)}`; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ---------------- theme ---------------- */
const themePref = () => store.get('cm.theme', 'system');
const isDark = () => { const t = themePref(); return t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); };
function setTheme(t) { const b = $(`[data-theme-set="${t}"]`); if (b) b.click(); }
function themeUI() {
  const d = isDark(); root.setAttribute('data-rr-theme', d ? 'dark' : 'light');
  const b = $('#rrThemeBtn'); if (!b) return;
  b.setAttribute('aria-pressed', String(d)); b.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode');
  $('#rrThemeIco').src = d ? 'assets/rr/sun.svg' : 'assets/rr/moon.svg'; const si = $('#rrSettingsBtn img'); if (si) si.src = d ? 'assets/rr/settings-dark.svg' : 'assets/rr/settings.svg';
}
themeUI();

/* ---------------- greeting ---------------- */
const SUBS = ['Do something today your future self will thank you for.', 'What can you save today?', 'Planning your future, one dollar at a time.'];
function greet() {
  const h = new Date().getHours(), part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const p = CM.profile(), nm = /^Customer \d+$/.test(p.name) ? '' : ', ' + p.name.split(' ')[0];
  $('#rrGreet').textContent = `Good ${part}${nm}`;
  $('#rrTod').src = part === 'evening' ? 'assets/rr/moon.svg' : 'assets/rr/time-morning.svg';
  $('#rrTod').width = part === 'evening' ? 28 : 32;
  const day = Math.floor(Date.now() / 864e5); $('#rrSub').textContent = SUBS[day % SUBS.length];
  const inp = $('#rrAcct'); if (document.activeElement !== inp) inp.value = CM.st.id;
}

/* ---------------- nav + jump-to ---------------- */
const RRV = ['overview', 'situations', 'saving', 'investing', 'yourdata', 'paradox'];
const JUMPS = {
  overview: [['rr-accounts', 'Accounts'], ['rr-summary', 'Your resilience']],
  situations: [['rr-ahead', 'Looking ahead'], ['rr-breath', 'Breathing room']],
  saving: [['rr-fund', 'Safety net'], ['rr-steps', 'Recovery options']],
  yourdata: [['rr-about', 'About you'], ['rr-compare', 'How you compare'], ['rr-year', 'Your year in money'], ['rr-rule', 'Budget rule'], ['rr-jobs', 'Give every dollar a job']],
  investing: [['rr-order', 'The order to fill things'], ['rr-growth', 'Growth calculator'], ['rr-types', 'Account types']],
};
function navUI(v) {
  $$('#rrNav .rr-tab[data-v]').forEach(a => { if (a.dataset.v === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const extra = !RRV.includes(v);
  if (extra) $('#rrMoreBtn').setAttribute('aria-current', 'page'); else $('#rrMoreBtn').removeAttribute('aria-current');
  $$('#rrMenu a').forEach(a => { if (a.dataset.v === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const j = JUMPS[v] || [];
  $('#rrJump').innerHTML = j.length ? '<span>Jump to</span>' + j.map(([id, l]) => `<button type="button" data-jump="${id}">${l} <img class="rr-ico" src="assets/rr/arrow-down.svg" width="12" height="12" alt=""></button>`).join('') : '';
  $$('#rrJump [data-jump]').forEach(b => b.onclick = () => jumpTo(b.dataset.jump));
}
function jumpTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); }
function closeMenus(except) {
  if (except !== 'menu') { $('#rrMenu').hidden = true; $('#rrMoreBtn').setAttribute('aria-expanded', 'false'); }
  if (except !== 'notes') { $('#rrNotes').hidden = true; $('#rrBell').setAttribute('aria-expanded', 'false'); }
  if (except !== 'search') { $('#rrResults').hidden = true; $('#rrSearch').setAttribute('aria-expanded', 'false'); $('#rrSearchBox').classList.remove('open'); }
}

/* ---------------- search (/ shortcut, grouped, keyboard) ---------------- */
const PAGES = [['overview', 'Overview', 'Your accounts and resilience'], ['situations', 'Situations', 'Job loss, bills, repairs: test your runway'], ['saving', 'Saving plan', 'Safety-net savings and recovery options'], ['investing', 'Investing', 'Order to fill things, growth calculator'], ['yourdata', 'Your money', 'Score, history, compare, budget rule'],
  ['paradox', 'Findings', 'The paycheque paradox across 4,500 customers'], ['customer', 'Customer deep-dive', 'Score, money flow'], ['shock', 'Plan ahead', 'Situations and stress grid'], ['plan', 'Plan builder', 'Goal and backup plans'],
  ['budget', 'Budget rules', '50/30/20 and more'], ['coach', 'Rookie', 'Ask the 3D coach'], ['arena', 'Quests', 'Points and badges'], ['play', 'Play', 'Runway Run, quiz'], ['data', 'Upload your data', 'CSV portfolio'], ['resources', 'Resources', 'Official sources'], ['profile', 'Profile', 'Your details']];
const HELP = [['How do I apply for EI?', 'Apply the week your job ends, even before your record of employment arrives.'], ['What is my runway?', 'How many months your savings last if a situation hits.'],
  ['How much should my emergency fund be?', 'Three to six months of money out is a common target.'], ['TFSA or RRSP?', 'It depends on your tax rate now and later.'], ['Can my bank pause a loan payment?', 'Many lenders offer deferrals if you call before missing one.']];
let sel = -1, results = [];
function searchRun(q) {
  const a = CM.acc(), s = q.trim().toLowerCase(), box = $('#rrResults');
  results = [];
  if (!s) { box.hidden = true; return; }
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 2) CM.ids.filter(id => String(id).startsWith(digits)).slice(0, 5).forEach(id => results.push({ g: 'Accounts', t: `Account ${id}`, d: personaFor(id) ? PERSONAS[personaFor(id)[0]].name : 'Open this account', run: () => { CM.setAccount(id); greet(); } }));
  const pay = [['Household bills', a.mo?.[0]], ['Insurance', a.mo?.[1]], ['Loan payments', a.mo?.[2]], ['Bank fees', a.mo?.[3]], ['Cash withdrawals', a.mo?.[4]], ['Card spending', a.mo?.[5]], ['Transfers out', a.mo?.[6]]];
  pay.filter(([n, v]) => v > .5 && n.toLowerCase().includes(s)).forEach(([n, v]) => results.push({ g: 'Payments', t: n, d: `About ${money(v)} a month`, run: () => { CM.go('yourdata'); setTimeout(() => jumpTo('rr-year'), 80); } }));
  if (/pay|bill|spend|money out/.test(s)) pay.filter(([, v]) => v > .5).slice(0, 4).forEach(([n, v]) => { if (!results.find(r => r.t === n)) results.push({ g: 'Payments', t: n, d: `About ${money(v)} a month`, run: () => { CM.go('yourdata'); setTimeout(() => jumpTo('rr-year'), 80); } }); });
  PAGES.filter(([, t, d]) => (t + ' ' + d).toLowerCase().includes(s)).slice(0, 6).forEach(([v, t, d]) => results.push({ g: 'Pages and plans', t, d, run: () => CM.go(v) }));
  Object.entries(JUMPS).forEach(([v, list]) => list.filter(([, l]) => l.toLowerCase().includes(s)).forEach(([id, l]) => results.push({ g: 'Pages and plans', t: l, d: PAGES.find(p => p[0] === v)[1], run: () => { CM.go(v); setTimeout(() => jumpTo(id), 80); } })));
  HELP.filter(([t, d]) => (t + ' ' + d).toLowerCase().includes(s)).forEach(([t, d]) => results.push({ g: 'Help', t, d, run: () => { openChat(); ask(t); } }));
  if (!results.length) results.push({ g: 'Help', t: `Ask the money helper: "${q.trim()}"`, d: 'AI answers from your numbers', run: () => { openChat(); ask(q.trim()); } });
  sel = 0; let html = '', g0 = '';
  results.forEach((r, i) => { if (r.g !== g0) { html += `<h4>${r.g}</h4>`; g0 = r.g; } html += `<button type="button" role="option" data-i="${i}" class="${i === sel ? 'sel' : ''}" aria-selected="${i === sel}">${esc(r.t)}<span>${esc(r.d)}</span></button>`; });
  box.innerHTML = html; box.hidden = false; $('#rrSearch').setAttribute('aria-expanded', 'true');
  $$('#rrResults button').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(+b.dataset.i); });
}
function pick(i) { const r = results[i]; if (!r) return; $('#rrSearch').value = ''; closeMenus(); $('#rrSearch').blur(); r.run(); }
function moveSel(d) { if (!results.length) return; sel = (sel + d + results.length) % results.length; $$('#rrResults button').forEach((b, i) => { b.classList.toggle('sel', i === sel); b.setAttribute('aria-selected', String(i === sel)); if (i === sel) b.scrollIntoView({ block: 'nearest' }); }); }

/* ---------------- notifications ---------------- */
function notes() {
  const a = CM.acc(); syncShock(); const r = runway(a.B, a.I, a.S, CM.shockParams(a, CM.st.shock)), [, i, l] = status(r.v);
  const ch = chequing(a), bills = billsDue(a);
  const items = [[i, `<b>${l}:</b> with ${sitLabel().join(' and ') || 'no situation'}, your savings last ${r.v === Infinity ? 'with no shortfall' : rwS(r.v) + ' months'}.`],
    ['$', `<b>Bills due this month:</b> ${money(bills.total)} across ${bills.n} payment${bills.n === 1 ? '' : 's'}.`]];
  if (ch < 200) items.push(['!', '<b>Low balance:</b> Chequing is under $200.']);
  if (store.get('cm.rr.plan', null)) items.push(['✓', '<b>Saving plan:</b> your new accounts are set up. Money moves on payday.']);
  $('#rrNotes').innerHTML = items.map(([ic, t]) => `<div><span class="ic" aria-hidden="true">${ic}</span><span>${t}</span></div>`).join('');
}

/* ---------------- money helpers (sample-data presentation of one bank account) ---------------- */
const chequing = a => Math.max(0, Math.round(Math.min(Math.max(a.B, 0), a.S * .5)));
const savingsBal = a => Math.max(0, Math.round(Math.max(a.B, 0) - chequing(a)));
const flexible = a => (a.mo || [])[4] + (a.mo || [])[5] + (a.mo || [])[6] || Math.max(a.S - a.F, 0);
function billsDue(a) { const parts = [a.H, (a.mo || [])[1], a.P].filter(v => v > .5); return { total: a.F, n: parts.length }; }
const last4 = n => String(n).padStart(4, '0').slice(-4);

/* ---------------- SVG charts ---------------- */
function niceStep(range) { const raw = range / 3, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p; }
const kfmt = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1000 ? (Math.round(Math.abs(v) / 100) / 10).toString().replace(/\.0$/, '') + 'k' : Math.round(Math.abs(v)));
function aheadChart(el, before, after, eiMo, zero) {
  const W = Math.max(300, el.clientWidth || 760), H = 218, L = 46, R = 12, T = 18, B = 26, n = before.length - 1;
  const all = [...before, ...after, 0], lo = Math.min(...all), hi = Math.max(...all), st = niceStep(hi - lo || 1);
  const y0 = Math.floor(lo / st) * st, y1 = Math.ceil(hi / st) * st;
  const X = k => L + (W - L - R) * k / n, Y = v => T + (H - T - B) * (1 - (v - y0) / ((y1 - y0) || 1));
  const path = arr => arr.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  let g = `<rect x="${L}" y="${Y(0)}" width="${W - L - R}" height="${Math.max(0, Y(y0) - Y(0))}" fill="var(--rr-inner-2)" opacity=".9"/>`;
  for (let v = y0; v <= y1 + 1e-6; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? 'var(--rr-slate)' : 'var(--rr-line)'}" stroke-width="${v === 0 ? 1.2 : 1}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--rr-sub)">${kfmt(v)}</text>`;
  for (let k = 0; k <= n; k += 2) g += `<text x="${X(k)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">${k}</text>`;
  if (eiMo && eiMo <= n) g += `<line x1="${X(eiMo)}" x2="${X(eiMo)}" y1="${T - 6}" y2="${H - B}" stroke="var(--rr-slate)" stroke-dasharray="3 4"/><text x="${X(eiMo) + 6}" y="${H - B - 6}" font-size="10.5" fill="var(--rr-sub)">EI ends</text>`;
  const ink = isDark() ? '#C0D6EA' : '#11425D';
  g += `<path d="${path(before)}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
  g += `<path d="${path(after)}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-dasharray="7 6" stroke-linejoin="round" class="rr-draw"/>`;
  if (zero != null && zero <= n) {
    const zx = X(zero), zy = Y(0), lab = `Runs out · month ${zero.toFixed(1)}`, lw = lab.length * 5.6 + 20, lx = clamp(zx - lw / 2, L, W - R - lw);
    g += `<rect x="${lx}" y="${zy - 34}" width="${lw}" height="22" rx="11" fill="#11425D"/><text x="${lx + lw / 2}" y="${zy - 19}" text-anchor="middle" font-size="10.5" fill="#fff">${lab}</text><circle cx="${zx}" cy="${zy}" r="6" fill="#fff" stroke="${ink}" stroke-width="2"/>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Balance over the next ${n} months before and after the situations">${g}</svg>`;
}
function fundChart(el, have, save, goal, milestone) {
  const W = Math.max(300, el.clientWidth || 588), H = 170, L = 12, R = 42, T = 16, B = 22;
  const need = Math.max(0, goal - have), mtg = need === 0 ? 0 : save > 0 ? need / save : Infinity;
  const n = Math.min(36, Math.max(12, isFinite(mtg) ? Math.ceil(mtg / 2) * 2 + 2 : 12));
  const pts = Array.from({ length: n + 1 }, (_, k) => have + save * k), top = Math.max(goal, pts[n]) * 1.08 || 1, st = niceStep(top);
  const X = k => L + (W - L - R) * k / n, Y = v => T + (H - T - B) * (1 - v / (Math.ceil(top / st) * st));
  let g = '';
  for (let v = 0; v <= Math.ceil(top / st) * st + 1e-6; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rr-line)"/><text x="${W - R + 6}" y="${Y(v) + 4}" font-size="11" fill="var(--rr-muted)">${kfmt(v)}</text>`;
  const ink = isDark() ? '#C0D6EA' : '#11425D', line = pts.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  g += `<path d="${line} L${X(n)},${Y(0)} L${X(0)},${Y(0)} Z" fill="${ink}" opacity=".12"/><path d="${line}" fill="none" stroke="${ink}" stroke-width="2.5"/>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="${ink}" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  const gl = `Goal ${money(goal)}`, gw = gl.length * 6 + 18; g += `<rect x="${L + 6}" y="${Y(goal) - 26}" width="${gw}" height="20" rx="10" fill="#11425D"/><text x="${L + 6 + gw / 2}" y="${Y(goal) - 12}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${gl}</text>`;
  if (milestone && milestone < goal) g += `<line x1="${L}" x2="${W - R}" y1="${Y(milestone)}" y2="${Y(milestone)}" stroke="var(--rr-slate)" stroke-dasharray="2 4"/><text x="${W - R - 4}" y="${Y(milestone) - 5}" text-anchor="end" font-size="11" fill="var(--rr-muted)">First milestone ${money(milestone)}</text>`;
  const step = n <= 12 ? 2 : n <= 24 ? 4 : 6;
  for (let k = 0; k <= n; k += step) g += `<text x="${X(k)}" y="${H - 4}" text-anchor="middle" font-size="11" fill="var(--rr-muted)">${k === 0 ? 'Now' : 'M' + k}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Emergency fund growth toward the goal">${g}</svg>`;
}
function setP(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }

/* ================= OVERVIEW ================= */
let breathCut = store.get('cm.rr.cut', 500), adjustOpen = false;
function renderOverview() {
  const a = CM.acc(); if (!a) return; syncShock();
  const pf = CM.profile(), per = personaFor(a.id), dark = isDark();
  // Row 1: accounts
  const ch = chequing(a), sv = savingsBal(a), bills = billsDue(a), lastIn = a.in[a.n - 1], lastOut = a.out[a.n - 1];
  const tm = +pf.target || 3, goal = tm * a.S, have = Math.max(a.B, 0), gp = goal > 0 ? clamp(have / goal, 0, 1) : 1;
  $('#rrChequing').innerHTML = `<div class="rr-acct-head"><span class="ic lime"><img class="rr-ico" src="assets/rr/wallet.svg" width="20" height="18" alt=""></span><span class="nm"><b>Chequing</b><span>Everyday · •• ${last4(a.id)}</span></span><button class="more" type="button" aria-label="Chequing options" data-go="customer">•••</button></div>
    <div class="rr-bal"><small>Available balance</small><strong>${money(ch)}</strong></div>
    <div class="rr-pair"><div><small>In this month</small><b>${money(lastIn)}</b></div><div><small>Out this month</small><b>${money(lastOut)}</b></div></div>
    <div class="rr-line"><span>Bills due this month</span><b>${money(bills.total)} · ${bills.n} payment${bills.n === 1 ? '' : 's'}</b></div>
    <div class="rr-btns"><button class="rr-btn2" type="button" data-toast="Transfers aren't part of this demo yet">Transfer</button><button class="rr-btn2" type="button" data-go="customer">Details</button></div>`;
  $('#rrSavings').innerHTML = `<div class="rr-acct-head"><span class="ic lilac"><img class="rr-ico" src="assets/rr/${dark ? 'piggy-dark' : 'piggy'}.svg" width="18" height="15" alt=""></span><span class="nm"><b>Savings</b><span>Emergency fund · •• ${last4(a.id * 7 + 4403)}</span></span><button class="more" type="button" aria-label="Savings options" data-go="plan">•••</button></div>
    <div class="rr-bal"><small>Available balance</small><strong>${money(sv)}</strong></div>
    <div class="rr-goalbox"><div class="t"><span>Goal: ${tm} months of money out</span><b>${Math.round(gp * 100)}%</b></div><div class="rr-progress"><i style="width:${gp * 100}%"></i></div><p>${money(have)} of ${money(goal)} across both accounts</p></div>
    <div class="rr-btns"><button class="rr-btn2" type="button" data-jump="rr-fund">Add money</button><button class="rr-btn2" type="button" data-go="plan">Details</button></div>`;

  // Row 2: looking ahead
  const sh = CM.st.shock, P = CM.shockParams(a, sh), r = runway(a.B, a.I, a.S, P);
  const before = Array.from({ length: 13 }, (_, k) => a.B + (a.I - a.S) * k), pr = CM.projection(a, sh, 12);
  const hideJob = per && PERSONAS[per[0]].hideJob && !SIT.job.on && !store.get('cm.rr.showJob', false);
  const chip = (k, label) => `<button class="rr-chip" type="button" data-sit="${k}" aria-pressed="${SIT[k].on}"><b aria-hidden="true">${SIT[k].on ? '✓' : '+'}</b>${label}</button>`;
  let msg;
  if (r.v === 0) msg = "The one-off cost is more than your savings. You'd need help on day one.";
  else if (SIT.job.on) msg = r.v === Infinity ? 'No shortfall: money in still covers money out.' : r.v < SIT.job.mo ? `Money runs out ${(SIT.job.mo - r.v).toFixed(1)} months before EI ends.` : `Your savings outlast EI by ${r.v >= 120 ? 'years' : (r.v - SIT.job.mo).toFixed(1) + ' months'}.`;
  else msg = r.v === Infinity ? (sitLabel().length ? 'No shortfall with these situations.' : 'Turn on a situation to see how long your savings last.') : `Money runs out in month ${r.v.toFixed(1)}.`;
  $('#rrRunway').innerHTML = `<div class="rr-tile-head"><h2>Looking ahead with confidence</h2><div class="rr-btns" style="align-items:center;gap:10px"><b style="font:700 18px var(--rr-font)">${r.v === Infinity ? 'No shortfall' : rwS(r.v) + ' months'}</b>${statusHTML(r.v)}</div></div>
    <div class="rr-sits"><span>Situations:</span>${hideJob ? `<button class="rr-chip" type="button" id="rrShowJob"><b aria-hidden="true">+</b>Show job loss</button>` : chip('job', `Job loss · keep ${SIT.job.ei}% for ${SIT.job.mo} mo`)}${chip('bills', `Bills up ${SIT.bills.pct}%`)}${chip('repair', SIT.repair.on ? `Surprise repair · ${money(SIT.repair.amt ?? a.S)}` : 'Surprise repair')}${chip('monthly', SIT.monthly.on ? `New monthly cost · ${money(SIT.monthly.amt)}` : 'New monthly cost')}<button class="rr-adjust" type="button" id="rrAdjust" aria-expanded="${adjustOpen}" aria-controls="rrAdjustPanel">Adjust sizes</button></div>
    <div class="rr-adjust-panel" id="rrAdjustPanel"${adjustOpen ? '' : ' hidden'}>
      <div class="rr-field"><label for="rrEi">Money in kept (hypothetical) <output>${SIT.job.ei}%</output></label><input class="rr-range" type="range" id="rrEi" min="0" max="100" step="5" value="${SIT.job.ei}"></div>
      <div class="rr-field"><label for="rrEiMo">Temporary support lasts <output>${SIT.job.mo} months</output></label><input class="rr-range" type="range" id="rrEiMo" min="1" max="12" step="1" value="${SIT.job.mo}"></div>
      <div class="rr-field"><label for="rrBillsPct">Bills up <output>${SIT.bills.pct}%</output></label><input class="rr-range" type="range" id="rrBillsPct" min="0" max="60" step="5" value="${SIT.bills.pct}"></div>
      <div class="rr-field"><label for="rrRepair">Surprise repair ($)</label><input type="number" id="rrRepair" min="0" step="50" value="${Math.round(SIT.repair.amt ?? a.S)}"></div>
      <div class="rr-field"><label for="rrMonthly">New monthly cost ($)</label><input type="number" id="rrMonthly" min="0" step="25" value="${SIT.monthly.amt}"></div>
    </div>
    <div class="rr-chart" id="rrAheadChart"></div>
    <div class="rr-tile-foot"><div class="rr-legend"><span><i></i>Before</span><span><i class="dash"></i>After</span></div><b>${esc(msg)}</b></div>`;
  aheadChart($('#rrAheadChart'), before, pr.pts.slice(0, 13), SIT.job.on ? SIT.job.mo : null, pr.zero);

  // breathing room (survival slider)
  const flex = Math.max(0, Math.round(flexible(a))), smax = r25(Math.max(1000, flex, Math.max(r.gap, 0)));
  breathCut = clamp(breathCut, 0, smax);
  const gapAfter = r.gap - breathCut, nv = r.left <= 0 ? 0 : gapAfter <= 0 ? Infinity : Math.min(r.left / gapAfter, 120), ident = breathCut <= flex;
  $('#rrBreath').innerHTML = `<div class="rr-tile-head"><h3>Give yourself more breathing room</h3></div>
    <div class="rr-kv"><label for="rrCut">Cut money out by</label><b>${money(breathCut)} / month</b></div>
    <input class="rr-range" type="range" id="rrCut" min="0" max="${smax}" step="25" value="${breathCut}" aria-valuetext="${money(breathCut)} a month">
    <div class="rr-res"><div class="nums"><span class="from">${r.v === Infinity ? '120+' : rwS(r.v)}</span><span class="arr">→</span><span class="to">${nv === Infinity ? 'No shortfall' : rwS(nv) + ' months'}</span></div><button class="rr-btn rr-sqb" type="button" id="rrAddPlan">Add to plan</button></div>
    <p>${ident ? `Fits within your flexible spending (${money(flex)}/mo).` : `More than your flexible spending (${money(flex)}/mo), so this is a suggested cut.`}</p>`;

  // biggest finding (offline precomputed study)
  const q = (CM.ins.quartiles || []).map(x => x.outIn6), mx = Math.max(...q, .01);
  $('#rrFinding').innerHTML = `<div class="rr-tile-head"><span class="rr-pill lime">Biggest finding</span><span class="who">All ${CM.ids.length.toLocaleString('en-CA')} customers</span></div>
    <h3>More money in doesn't mean more resilience.</h3>
    <div class="rr-minibars" role="img" aria-label="Share who run out within 6 months of a layoff, lowest to highest money in: ${q.map(v => Math.round(v * 100) + '%').join(', ')}">${q.map((v, i) => `<i class="${i === q.length - 1 ? 'hi' : ''}" style="height:${Math.max(10, v / mx * 100)}%"></i>`).join('')}</div>
    <a href="#paradox">See the finding →</a>`;

  // Row 3: emergency fund
  const sur = a.I - a.S, disc = Math.max(a.S - a.F, 0);
  if (CM.st.plan.save == null) CM.st.plan.save = sur > 0 ? r25(sur * .5) : r25(.1 * disc);
  const save = CM.st.plan.save, need = Math.max(0, goal - have), mtg = need === 0 ? 0 : save > 0 ? need / save : Infinity;
  const pmax = Math.max(1000, Math.ceil(Math.max(a.I * .5, save) / 250) * 250);
  const sooner = (() => { if (!isFinite(mtg) || need === 0) return ''; const m2 = need / (save + 25), d = mtg - m2; return d >= 18 ? `${(d / 12).toFixed(1)} years` : `${Math.round(d)} month${Math.round(d) === 1 ? '' : 's'}`; })();
  const milestone = per && PERSONAS[per[0]].milestone;
  $('#rrFund').innerHTML = `<div class="rr-tile-head"><h2>Emergency fund</h2><span class="rr-pill lime">${need === 0 ? 'Goal reached' : `${Math.round(gp * 100)}% of the way there`}</span></div>
    <div class="rr-kv lab">Goal</div>
    <div class="rr-seg" role="group" aria-label="Emergency fund goal">${[3, 6, 9].map(m => `<button type="button" data-goal="${m}" aria-pressed="${m === tm}">${m} months</button>`).join('')}</div>
    <div class="rr-kv big"><label class="rr-kv lab" for="rrSave">Set aside each month</label><b>${money(save)}</b></div>
    <input class="rr-range" type="range" id="rrSave" min="0" max="${pmax}" step="25" value="${save}" aria-valuetext="${money(save)} a month">
    <p class="rr-hint">${sur > 0 ? `Money in is more than money out by about ${money(sur)} in a typical month. Half of that is ${money(r25(sur * .5))}.` : `Money out is more than money in by about ${money(-sur)} in a typical month, so this has to come from spending less.`}</p>
    <div class="rr-stats3"><div><small>Goal</small><b>${money(goal)}</b><span>${tm} months of spending</span></div><div><small>Saved now</small><b>${money(have)}</b><span>${a.S > 0 ? (have / a.S).toFixed(1) : '—'} months of spending</span></div><div><small>Still to save</small><b>${money(need)}</b><span>${need === 0 ? 'Done' : isFinite(mtg) ? `About ${Math.ceil(mtg)} months at ${money(save)}` : 'Pick a monthly amount'}</span></div></div>
    <div class="rr-chart" id="rrFundChart"></div>
    <div class="rr-tip">${need === 0 ? 'Your savings already cover the goal. Keep them somewhere safe and easy to reach, then look at Investing.' : milestone && have < milestone ? `First milestone: ${money(milestone)}. You're ${money(milestone - have)} away, about ${save > 0 ? Math.ceil((milestone - have) / save) : '—'} months at this pace.` : `You're ${Math.round(gp * 100)}% of the way there.${sooner ? ` Even $25 more a month gets you there ${sooner} sooner.` : ''}`}</div>`;
  fundChart($('#rrFundChart'), have, save, goal, milestone);

  // Row 3: if you lose your job (backup plan)
  const lv = CM.levers(a), list = lv.list, plsh = lv.sh, first = list[0].r, lastR = list[list.length - 1].r, needM = plsh.inc < 100 ? plsh.ei : 6;
  const ok = lastR.v === Infinity || lastR.v >= needM;
  const titleFor = l => l.key === 'cut' ? [`Spend ${CM.st.plan.cut}% less on everyday things`, `Card spending, cash and other transfers come to about ${money(disc)} a month. ${CM.st.plan.cut}% less frees up ${money(l.save)}.`]
    : l.key === 'loan' ? ['Ask to pause your loan payment', `Your bank may pause the ${money(a.P)} payment while you look for work.`]
    : l.key === 'bills' ? [`Trim household bills 10%`, `Shop around for phone, internet and insurance. That's about ${money(l.save)} a month.`]
    : ['Extra money from a side job', 'Part-time or gig work. EI lets you earn some money; check the rules first.'];
  const steps = (plsh.inc < 100 ? [`<div class="rr-step"><span class="n">1</span><div><h4>Apply for EI the week your job ends</h4><p>Apply even before your paperwork arrives. Waiting more than 4 weeks can cost you money.</p></div><div class="g"><b>${plsh.inc === 55 ? 'About half' : plsh.inc + '%'}</b><span>of your pay back</span></div></div>`] : [])
    .concat(list.slice(1).map((l, i) => { const [t, d] = titleFor(l), n = (plsh.inc < 100 ? 2 : 1) + i; return `<div class="rr-step"><span class="n">${n}</span><div><h4>${esc(t)}</h4><p>${esc(d)}</p></div><div class="g"><b>${rwS(list[i].r.v)} → ${rwS(l.r.v)} mo</b><span>+${money(l.save)} a month</span></div></div>`; }));
  $('#rr-job').innerHTML = `<div class="rr-tile-head"><h2>If you lose your job</h2><span class="note">${CM.isNoShock(CM.st.shock) ? 'No situation on, so this assumes a layoff with EI at 55%' : 'Using your situations: ' + sitLabel().join(' + ')}</span></div>
    <div class="rr-kv big"><label class="rr-kv lab" for="rrPCut">Spend less on everyday things by</label><b>${CM.st.plan.cut}%</b></div>
    <input class="rr-range" type="range" id="rrPCut" min="0" max="40" step="5" value="${CM.st.plan.cut}" aria-valuetext="${CM.st.plan.cut} percent">
    <div class="rr-kv big"><label class="rr-kv lab" for="rrPSide">Extra money from a side job</label><b>${money(CM.st.plan.side)}</b></div>
    <input class="rr-range" type="range" id="rrPSide" min="0" max="2000" step="50" value="${CM.st.plan.side}" aria-valuetext="${money(CM.st.plan.side)} a month">
    <div class="rr-steps">${steps.join('')}</div>
    <div class="rr-result${ok ? '' : ' bad'}"><i aria-hidden="true">${ok ? '✓' : '!'}</i><div><b>Your savings go from lasting ${first.v === Infinity ? 'with no shortfall' : rwS(first.v) + ' months'} to ${lastR.v === Infinity ? 'no shortfall' : rwS(lastR.v) + ' months'}</b><span>${ok ? `That carries you past month ${needM}${plsh.inc < 100 ? ', when EI ends' : ''}.` : `Still short of month ${needM}. About ${money(Math.max(0, lastR.gap * needM - lastR.left))} more would close it.`}</span></div></div>`;

  // after each step
  const labelFor = (l, i) => i === 0 ? 'Situation only' : l.key === 'cut' ? `+ spend ${CM.st.plan.cut}% less` : l.key === 'loan' ? '+ pause loan payment' : l.key === 'bills' ? '+ trim bills 10%' : '+ side job';
  $('#rr-steps').innerHTML = `<div class="rr-tile-head"><h2>How long your savings last after each step</h2><span class="note">Each bar adds one step on top of the last</span></div>
    <div class="rr-bars" id="rrBars" role="list">${list.map((l, i) => `<div class="rr-sbar" role="listitem"><span>${labelFor(l, i)}</span><span class="tr"><i class="${l.r.v === Infinity || l.r.v >= needM ? 'ok' : 'short'}" style="width:${l.r.v === Infinity ? 100 : clamp(l.r.v / 12 * 100, 1, 100)}%"></i></span><b>${rwS(l.r.v)} mo</b></div>`).join('')}</div>
    <p class="rr-small">Bars run to 12 months. Past the dashed line means your savings outlast ${plsh.inc < 100 ? 'EI' : 'six months'}.</p>`;
  requestAnimationFrame(() => { const bars = $('#rrBars'), tr = $('#rrBars .tr'); if (!bars || !tr) return; const x = tr.offsetLeft + tr.offsetWidth * needM / 12; bars.insertAdjacentHTML('beforeend', `<span class="ei" style="left:${x}px"><span>Month ${needM}${plsh.inc < 100 ? ': EI ends' : ''}</span></span>`); });

  bindOverview(a);
  $$('.rr-view .rr-range').forEach(setP);
  summary(a);
}
function summary(a) {
  const el = $('#rrSummary'); if (!el) return;
  const ei = runway(a.B, a.I, a.S, { mult: .55 }), [c, i, l] = status(ei.v);
  el.innerHTML = `<div class="rr-tile-head"><h2>Your resilience at a glance</h2><span class="rr-status ${c}"><i aria-hidden="true">${i}</i>${l}</span></div>
    <p class="rr-big-answer">If you kept 55% of your money in, your savings would last <b>${ei.v === Infinity ? 'with no shortfall' : rwS(ei.v) + ' months'}</b>.</p>
    <p class="rr-hint">A hypothetical reference shock, not an EI eligibility estimate. Test your own situation next.</p>
    <div class="rr-btns"><a class="rr-btn" href="#situations">Test a situation →</a><a class="rr-btn2" href="#saving">Build your plan</a><a class="rr-btn2" href="#yourdata">See your score</a></div>`;
}
function bindOverview(a) {
  const ov = $('.content');
  $$('[data-go]', ov).forEach(b => b.onclick = () => CM.go(b.dataset.go));
  $$('[data-toast]', ov).forEach(b => b.onclick = () => toast(b.dataset.toast));
  $$('[data-jump]', ov).forEach(b => b.onclick = () => jumpTo(b.dataset.jump));
  $$('[data-sit]', ov).forEach(b => b.onclick = () => { const k = b.dataset.sit; SIT[k].on = !SIT[k].on; saveSit(); renderOverview(); });
  const sj = $('#rrShowJob'); if (sj) sj.onclick = () => { store.set('cm.rr.showJob', true); renderOverview(); };
  $('#rrAdjust').onclick = () => { adjustOpen = !adjustOpen; renderOverview(); };
  const live = (id, fn) => { const el = $('#' + id); if (!el) return; el.oninput = () => { fn(el.type === 'number' ? Math.max(0, +el.value || 0) : +el.value); saveSit(); clearTimeout(live.t); live.t = setTimeout(() => { const f = document.activeElement && document.activeElement.id; renderOverview(); if (f) { const e = document.getElementById(f); if (e) e.focus(); } }, el.type === 'number' ? 450 : 0); }; };
  live('rrEi', v => { SIT.job.ei = v; SIT.job.on = true; }); live('rrEiMo', v => { SIT.job.mo = v; SIT.job.on = true; });
  live('rrBillsPct', v => { SIT.bills.pct = v; SIT.bills.on = true; }); live('rrRepair', v => { SIT.repair.amt = v; SIT.repair.on = true; }); live('rrMonthly', v => { SIT.monthly.amt = v; SIT.monthly.on = true; });
  const keep = (id, fn) => { const el = $('#' + id); if (!el) return; el.oninput = () => { fn(+el.value); renderOverview(); const e = $('#' + id); if (e) e.focus(); }; };
  keep('rrCut', v => { breathCut = v; store.set('cm.rr.cut', v); });
  keep('rrSave', v => { CM.st.plan.save = v; }); keep('rrPCut', v => { CM.st.plan.cut = v; }); keep('rrPSide', v => { CM.st.plan.side = v; });
  $$('[data-goal]', ov).forEach(b => b.onclick = () => { const p = CM.profile(); p.target = b.dataset.goal; store.set('cm.p.' + CM.st.id, p); renderOverview(); });
  $('#rrAddPlan').onclick = () => { const disc = Math.max(a.S - a.F, 0); if (disc > 0) CM.st.plan.cut = clamp(Math.round(breathCut / disc * 100 / 5) * 5, 0, 40); store.set('cm.rr.added', breathCut); toast(`Added to plan: cut ${money(breathCut)} a month`); renderOverview(); };
}

/* ================= AI CHAT (wired to the same coach: Gemini via server.py, offline fallback) ================= */
const TOPICS = ['Explain my scenario', "I can't log in", 'A payment is stuck', 'Explain my Savings plan', 'Talk to a person'];
const CANNED = {
  "I can't log in": "Sorry about that. Try resetting your password from the sign-in page, and check that two-step sign in is sending codes to the right phone. If you're locked out, tap \"Talk to a person\" and we'll verify you another way.",
  'A payment is stuck': 'Payments made after 8 pm usually show as pending until the next business day. If it has been more than two business days, tap "Talk to a person" with the date and amount ready.',
  'Talk to a person': 'You can reach a person by phone 24/7 for fraud or security issues, and 8 am to 8 pm for everything else. This demo doesn\'t connect to a real line.',
};
let waiting = false;
function chatRender() {
  const pf = CM.profile(), nm = /^Customer \d+$/.test(pf.name) ? 'there' : pf.name.split(' ')[0];
  const msgs = CM.st.chat.filter(m => !(m.role === 'model' && (m.src === 'Rookie' || m.src === 'ChequeMate Coach')));
  let h = `<div class="rr-msg"><p>Hi ${esc(nm)}! I'm your AI money helper. Tell me what's not working and I'll walk you through it.</p></div><div class="rr-topics">${TOPICS.map(t => `<button type="button">${esc(t)}</button>`).join('')}</div>`;
  h += msgs.map(m => m.role === 'user' ? `<div class="rr-msg me">${esc(m.text)}</div>` : m.typing ? '' : `<div class="rr-msg">${CM.mdLite(m.text)}${m.src ? `<div class="src">${esc(m.src)}</div>` : ''}</div>`).join('');
  if (waiting) h += '<img class="rr-typing" src="assets/rr/typing.svg" width="57" height="31" alt="Typing">';
  const box = $('#rrChatMsgs'); box.innerHTML = h; box.scrollTop = box.scrollHeight;
  $$('#rrChatMsgs .rr-topics button').forEach(b => b.onclick = () => ask(b.textContent));
}
async function ask(q) {
  q = (q || '').trim(); if (!q || waiting) return;
  if (q === 'Explain my scenario' && window.CMLive && window.CMLive.mode === 'live') {
    CM.st.chat.push({ role: 'user', text: q }); waiting = true; chatRender();
    try { const x = await window.CMLive.explainToChat(); CM.st.chat.push({ role: 'model', text: x.cards.map(c => '- ' + c.text).join('\n'), src: x.source === 'gemini_ordered_verified_cards' ? 'Checked explanation' : 'Checked explanation' }); }
    catch (e) { CM.st.chat.push({ role: 'model', text: window.CMApi.describe(e), src: 'Money helper', offline: true }); }
    finally { waiting = false; chatRender(); } return;
  }
  if (CANNED[q]) { CM.st.chat.push({ role: 'user', text: q }, { role: 'model', text: CANNED[q], src: 'Money helper' }); chatRender(); return; }
  if (!store.get('cm.rr.aidata', true)) { CM.st.chat.push({ role: 'user', text: q }, { role: 'model', text: 'Personal suggestions are off. Turn on "Use my data for suggestions" in Settings and I can answer from your numbers.', src: 'Money helper', offline: true }); chatRender(); return; }
  waiting = true; chatRender();
  try { await CM.send(q === 'Explain my Savings plan' ? 'Explain my emergency fund and backup plan in plain words' : q); } finally { waiting = false; chatRender(); }
}
function openChat() { const c = $('#rrChat'); c.hidden = false; $('#rrChatBtn').setAttribute('aria-expanded', 'true'); chatRender(); setTimeout(() => $('#rrChatIn').focus(), 50); }
function closeChat() { $('#rrChat').hidden = true; $('#rrChatBtn').setAttribute('aria-expanded', 'false'); $('#rrChatBtn').focus(); }

/* ================= SETTINGS ================= */
const NOTE_KEYS = [['low', 'Low balance alert', 'Tell me when Chequing goes under $200', true], ['bills', 'Bill reminders', '2 days before a bill comes out', true], ['plan', 'Saving plan updates', 'When money moves into your new accounts', true], ['tip', 'Weekly money tip', 'One short tip every Monday', false]];
const tog = (key, on) => `<button class="rr-toggle" type="button" role="switch" aria-checked="${on}" data-tog="${key}"><img class="on" src="assets/rr/toggle-on.svg" width="40" height="22" alt=""><img class="off" src="assets/rr/toggle-off.svg" width="40" height="22" alt=""></button>`;
function settingsRender() {
  const a = CM.acc(), pf = CM.profile(), t = themePref(), N = store.get('cm.rr.notes', {}), large = root.getAttribute('data-text') === 'large', motion = root.getAttribute('data-motion') === 'reduce';
  const per = personaFor(a.id);
  $('#rrSettings').innerHTML = `<div class="rr-settings-h"><h2 id="rrSettingsT">Settings</h2><button class="rr-x" type="button" id="rrSetClose" aria-label="Close settings">✕</button></div>
  <div class="rr-settings-b">
    <div class="rr-prof"><span class="av" aria-hidden="true">${esc((pf.name.match(/[A-Za-z]/) || ['C'])[0].toUpperCase())}</span><div class="t"><b>${esc(pf.name)}</b><span>Account ${a.id}</span></div><a href="#profile">Edit</a></div>
    <div class="rr-sec"><h3>Appearance</h3><div class="rr-card">
      <div class="rr-rowcol"><b>Theme</b><div class="rr-segw" role="group" aria-label="Theme">${[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match my device']].map(([k, l]) => `<button type="button" data-th="${k}" aria-pressed="${t === k}">${l}</button>`).join('')}</div></div>
      <button class="rr-rowx" type="button" id="rrTextSize"><span class="t"><b>Text size</b><span>Make words bigger across the site</span></span><span class="v">${large ? 'Large' : 'Standard'} ›</span></button>
      <div class="rr-rowx"><span class="t"><b>Reduce motion</b><span>Turn off moving charts and animations</span></span>${tog('motion', motion)}</div>
    </div></div>
    <div class="rr-sec"><h3>Notifications</h3><div class="rr-card">${NOTE_KEYS.map(([k, b, s, d]) => `<div class="rr-rowx"><span class="t"><b>${b}</b><span>${s}</span></span>${tog('n:' + k, N[k] ?? d)}</div>`).join('')}</div></div>
    <div class="rr-sec"><h3>AI helper</h3><div class="rr-card">
      <div class="rr-rowx"><span class="t"><b>Use my data for suggestions</b><span>Lets the AI look at your spending to give tips</span></span>${tog('aidata', store.get('cm.rr.aidata', true))}</div>
      <button class="rr-rowx" type="button" id="rrClearChat"><span class="t"><b>Chat history</b><span>${CM.st.chat.filter(m => m.role === 'user').length} messages this session. Select to clear.</span></span><span class="chev">›</span></button>
    </div></div>
    <div class="rr-sec"><h3>Privacy and security</h3><div class="rr-card">
      <button class="rr-rowx" type="button" data-demo><span class="t"><b>Change password</b></span><span class="chev">›</span></button>
      <button class="rr-rowx" type="button" data-demo><span class="t"><b>Two-step sign in</b></span><span class="v">On ›</span></button>
      <button class="rr-rowx" type="button" id="rrDownload"><span class="t"><b>Download my data</b></span><span class="chev">›</span></button>
    </div></div>
    <div class="rr-sec"><h3>Demo · sample customers</h3><div class="rr-card">${Object.entries(PERSONAS).map(([k, p]) => `<button class="rr-rowx" type="button" data-persona="${k}"><span class="t"><b>${p.name}</b><span>${p.blurb} · account ${p.id}</span></span><span class="v">${per && per[0] === k ? 'Showing' : 'Switch ›'}</span></button>`).join('')}</div></div>
    <div class="rr-sec"><h3>Extras</h3><div class="rr-card">
      <div class="rr-rowx"><span class="t"><b>Glass effects</b><span>Aurora background and frosted cards on the extra pages</span></span>${tog('glass', window.CMFX && window.CMFX.style === 'glass')}</div>
      <div class="rr-rowx"><span class="t"><b>Sound effects</b><span>Little sounds for points and badges</span></span>${tog('sfx', store.get('cm.sfx', true))}</div>
    </div></div>
    <button class="rr-signout" type="button" data-demo>Sign out</button>
  </div>`;
  $('#rrSetClose').onclick = closeSettings;
  $$('#rrSettings [data-th]').forEach(b => b.onclick = () => { setTheme(b.dataset.th); settingsRender(); });
  $('#rrTextSize').onclick = () => { const L = root.getAttribute('data-text') !== 'large'; root.setAttribute('data-text', L ? 'large' : 'standard'); store.set('cm.rr.text', L ? 'large' : 'standard'); settingsRender(); };
  $$('#rrSettings [data-tog]').forEach(b => b.onclick = () => {
    const k = b.dataset.tog, on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on));
    if (k === 'motion') { root.setAttribute('data-motion', on ? 'reduce' : 'full'); store.set('cm.rr.motion', on ? 'reduce' : 'full'); }
    else if (k === 'aidata') store.set('cm.rr.aidata', on);
    else if (k === 'glass') { if (window.CMFX) window.CMFX.applyStyle(on ? 'glass' : 'solid'); }
    else if (k === 'sfx') { const s = $('#sfxBtn'); if (s && store.get('cm.sfx', true) !== on) s.click(); }
    else if (k.startsWith('n:')) { const N2 = store.get('cm.rr.notes', {}); N2[k.slice(2)] = on; store.set('cm.rr.notes', N2); }
  });
  $('#rrClearChat').onclick = () => { CM.st.chat.length = 0; settingsRender(); toast('Chat history cleared'); };
  $('#rrDownload').onclick = () => { const blob = new Blob([JSON.stringify(Object.assign({ account: a.id }, a), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = `account-${a.id}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 500); };
  $$('#rrSettings [data-demo]').forEach(b => b.onclick = () => toast('Not part of this demo'));
  $$('#rrSettings [data-persona]').forEach(b => b.onclick = () => { closeSettings(); applyPersona(b.dataset.persona); });
  $$('#rrSettings a[href^="#"]').forEach(x => x.addEventListener('click', closeSettings));
}
let lastFocus = null;
function openSettings() { lastFocus = document.activeElement; settingsRender(); $('#rrSettingsScrim').hidden = false; $('#rrSetClose').focus(); }
function closeSettings() { $('#rrSettingsScrim').hidden = true; if (lastFocus) lastFocus.focus(); }

/* ================= personas ================= */
function applyPersona(k) {
  const p = PERSONAS[k]; if (!p || !CM.data[p.id]) return;
  const pf = Object.assign({}, CM.profile(p.id)); if (/^Customer \d+$/.test(pf.name)) { pf.name = p.name; store.set('cm.p.' + p.id, pf); }
  SIT = SIT0(); Object.keys(p.sits).forEach(s => SIT[s].on = true); saveSit();
  root.setAttribute('data-text', p.large ? 'large' : 'standard'); store.set('cm.rr.text', p.large ? 'large' : 'standard');
  store.set('cm.rr.showJob', false); store.set('cm.rr.persona', k);
  CM.setAccount(p.id, true);
  if (CM.view === p.tab) CM.go(p.tab); else location.hash = p.tab;
  setTimeout(() => jumpTo(p.jump), 350);
  toast(`Showing ${p.name}, ${p.blurb.toLowerCase()} (sample data)`);
}

/* ================= wiring ================= */
let booted = false;
function boot() {
  if (booted) return; booted = true;
  root.setAttribute('data-text', store.get('cm.rr.text', 'standard')); root.setAttribute('data-motion', store.get('cm.rr.motion', 'full'));
  if (DEEP.account || DEEP.twist) store.set('cm.rr.seen', true);
  else if (RRUI() && !store.get('cm.rr.seen', false)) { store.set('cm.rr.seen', true); setTimeout(() => applyPersona('priya'), 0); }
  if (DEEP.account) setTimeout(() => { if (CM.setAccount(DEEP.account)) { greet(); toast(`Showing account ${DEEP.account}`); } else toast(`No account ${DEEP.account}. Showing the last account instead.`); }, 0);
  $('#rrLookup').onsubmit = e => { e.preventDefault(); const v = $('#rrAcct').value.replace(/\D/g, ''), er = $('#rrAcctErr'); if (CM.setAccount(v)) { er.hidden = true; greet(); toast(`Showing account ${v}`); } else { er.hidden = false; er.textContent = v ? `No account ${v}. IDs run ${CM.ids[0]}–${CM.ids[CM.ids.length - 1]}.` : 'Type an account number.'; } };
  $('#rrAcct').oninput = () => { $('#rrAcctErr').hidden = true; };
  $('#rrAcct').onblur = () => { setTimeout(() => { $('#rrAcctErr').hidden = true; }, 150); };
  $('#rrShuffle').onclick = () => { const b = $('#rrShuffle'), ids = CM.ids, id = ids[Math.floor(Math.random() * ids.length)]; b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); if (CM.setAccount(id)) { greet(); toast(`Showing customer ${id}`); } };
  $('#rrSettingsBtn').onclick = openSettings;
  $('#rrSettingsScrim').onclick = e => { if (e.target.id === 'rrSettingsScrim') closeSettings(); };
  $('#rrThemeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');
  $('#rrMoreBtn').onclick = e => { e.stopPropagation(); const m = $('#rrMenu'), open = m.hidden; closeMenus('menu'); m.hidden = !open; $('#rrMoreBtn').setAttribute('aria-expanded', String(open)); if (open) $('#rrMenu a').focus(); };
  $('#rrMenu').addEventListener('click', () => closeMenus());
  $('#rrBell').onclick = e => { e.stopPropagation(); const n = $('#rrNotes'), open = n.hidden; closeMenus('notes'); if (open) notes(); n.hidden = !open; $('#rrBell').setAttribute('aria-expanded', String(open)); $('#rrBellDot').hidden = true; };
  const si = $('#rrSearch');
  si.oninput = () => searchRun(si.value);
  si.onfocus = () => { closeMenus('search'); if (si.value) searchRun(si.value); };
  si.onkeydown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); } else if (e.key === 'Enter') { e.preventDefault(); pick(sel); } else if (e.key === 'Escape') { si.value = ''; closeMenus(); si.blur(); } };
  $('#rrSearchBox').addEventListener('click', () => { if (matchMedia('(max-width: 820px)').matches) { $('#rrSearchBox').classList.add('open'); si.focus(); } });
  document.addEventListener('click', e => { if (!e.target.closest('.rr-more, .rr-bellwrap, .rr-search')) closeMenus(); });
  document.addEventListener('keydown', e => {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (e.key === '/' && !typing) { e.preventDefault(); si.focus(); }
    if (e.key === 'Escape') { if (!$('#rrSettingsScrim').hidden) closeSettings(); else if (!$('#rrChat').hidden) closeChat(); else closeMenus(); }
  });
  $('#rrChatBtn').onclick = () => { if ($('#rrChat').hidden) openChat(); else closeChat(); };
  $('#rrChatClose').onclick = closeChat;
  $('#rrChatForm').onsubmit = e => { e.preventDefault(); const i = $('#rrChatIn'), q = i.value; i.value = ''; ask(q); };
  $$('[data-rr-chat]').forEach(b => b.onclick = () => openChat());
  $('#rrMaybe').onclick = () => { $('#rrAiOffer').style.opacity = .55; toast("No problem. It's here when you're ready."); };
  $('#rrTipBtn').onclick = () => { const N = store.get('cm.rr.notes', {}); N.tip = true; store.set('cm.rr.notes', N); toast("You'll get one money tip every Monday"); };
  $('#rrCookies').onclick = () => toast('This demo only uses your browser storage, no cookies');
  // sticky nav shadow
  const nav = $('#rrNav'); const onScroll = () => nav.classList.toggle('stuck', nav.getBoundingClientRect().top <= 16.5 && scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (CM.view === 'overview') renderOverview(); }, 200); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { themeUI(); if (CM.view === 'overview') renderOverview(); });
}
const RENDER = { overview: renderOverview, situations: renderOverview, saving: renderOverview };
window.RR = { RENDER, jumpTo, toast, status, statusHTML, setP, niceStep, kfmt, isDark, SIT: () => SIT, syncShock, openChat, ask, personaFor, PERSONAS, chequing, savingsBal, flexible };
document.addEventListener('cm:view', e => { boot(); const v = e.detail.view; greet(); navUI(v); themeUI(); closeMenus(); if (RENDER[v]) RENDER[v](); });
document.addEventListener('cm:account', () => { if (!booted) return; greet(); const v = CM.view; setTimeout(() => { if (RENDER[v]) RENDER[v](); }, 0); });
document.addEventListener('cm:theme', () => { themeUI(); const v = CM.view; if (RENDER[v]) RENDER[v](); if (!$('#rrSettingsScrim').hidden) settingsRender(); });
document.addEventListener('cm:answer', () => { if (!$('#rrChat').hidden) chatRender(); });
})();
