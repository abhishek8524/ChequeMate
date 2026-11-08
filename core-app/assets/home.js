/* ChequeMate landing: hero king -> account -> score -> dashboard. Every number comes from the FastAPI backend. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = window.CMApi, D3 = window.CM3D;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v == null || v === '' ? NaN : Number(v));
const money = v => { const n = num(v); return isFinite(n) ? (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-CA') : '—'; };
const dec10 = s => { const [i, f = ''] = String(s).split('.'); return f.length > 10 ? i + '.' + f.slice(0, 10) : String(s); };
const S = { id: null, acct: null, ins: null, prof: null, gen: 0, sim: null };

/* ================= 1 · hero: fan of cheques and cash ================= */
const LEAF = '<svg viewBox="0 0 24 24"><path d="M12 2l1.6 4.2 2.6-1.4-.7 4.6 3.6-2.2-.8 3.4 3.2.9-3.6 3.2.9 2.3-4.7-.6.2 4.6h-3l.2-4.6-4.7.6.9-2.3-3.6-3.2 3.2-.9-.8-3.4 3.6 2.2-.7-4.6 2.6 1.4z"/></svg>';
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7z"/></svg>';
const cheque = (i, amt) => `<div class="note cheque"><span class="bk">ChequeMate Bank</span><span class="no">No. 00${i}</span><div class="pay">Pay to the order of</div><span class="amt">$${amt}</span><span class="sig"></span><span class="micr">:0${i}48: 77310: ${i}2</span></div>`;
const bill = (cls, cur, val, seal) => `<div class="note bill ${cls}"><span class="cur">${cur}</span><span class="seal">${seal}</span><span class="val">${val}</span></div>`;
const fan = $('#fan');
const notes = [cheque(1, '1,250.00'), cheque(2, '480.75'), cheque(3, '3,100.00'), cheque(4, '96.20'), cheque(5, '2,040.00'), cheque(6, '725.00'),
  bill('c20', 'CANADA · CAD', 20, LEAF), bill('usd', 'USA · USD', 100, STAR), bill('c50', 'CANADA · CAD', 50, LEAF), bill('usd', 'USA · USD', 20, STAR), bill('c100', 'CANADA · CAD', 100, LEAF), bill('c10', 'CANADA · CAD', 10, LEAF)];
fan.innerHTML = notes.join('');
function layoutFan() {
  const w = $('.hero-art').getBoundingClientRect().width, R1 = w * .30, R2 = w * .41;
  $$('.note', fan).forEach((n, i) => {
    const left = i < 6, k = left ? i : i - 6, a = left ? -100 + k * 15 : 25 + k * 15, r = k % 2 ? R2 : R1;
    n.style.setProperty('--a', a + 'deg'); n.style.setProperty('--r', r + 'px'); n.style.setProperty('--d', (left ? 5 - k : k) * 70 + 'ms'); n.style.zIndex = k % 2 ? 1 : 2;
  });
}
layoutFan();
let fanReady = false;
setTimeout(() => { fan.style.setProperty('--spread', 1); setTimeout(() => { fanReady = true; fan.classList.add('live'); onScroll(); }, 1500); }, reduce ? 0 : 350);

/* ================= the King: squash, jump, dock ================= */
const slot = $('#kingSlot'), fly = $('#kingFly'), dock = $('#kingDock'), hero = $('#top');
const K = D3 && D3.mountKing ? D3.mountKing($('#kingCanvas'), { cam: [0, 1.25, 6.6], look: [0, 1.0, 0], fov: 26, hopH: .28 }) : null;
let docked = false;
function sizeKing() { const s = slot.getBoundingClientRect().width; fly.style.width = fly.style.height = s + 'px'; }
function placeKing() {
  const sr = slot.getBoundingClientRect(), size = sr.width, H = hero.offsetHeight;
  const p = clamp(scrollY / (H * .72));
  if (K) K.squash(p < .16 ? p / .16 : 0);               // squeeze like jelly, then the spring lets go
  const t = reduce ? (p > .5 ? 1 : 0) : ease(clamp((p - .16) / .84));
  const dr = dock.getBoundingClientRect(), D = dock.offsetWidth, cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
  const se = (D * 1.32) / size;
  const x = lerp(sr.left, cx - size * se / 2, t), y = lerp(sr.top, cy - size * se * .56, t) - Math.sin(Math.PI * t) * Math.min(240, innerHeight * .28);
  fly.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${lerp(1, se, t).toFixed(4)})`;
  const now = t >= .999;
  if (now !== docked) { docked = now; dock.classList.toggle('on', docked); fly.classList.toggle('docked', docked); }
  if (fanReady) fan.style.setProperty('--spread', (1 - clamp(t * 1.6)).toFixed(3));
}
// a little hop every 10-15 seconds once he's in the corner
(function hopLoop() {
  setTimeout(() => {
    if (docked && $('#chat').hidden && K) { K.hop(); dock.classList.add('say'); setTimeout(() => dock.classList.remove('say'), 2600); }
    hopLoop();
  }, 10000 + Math.random() * 5000);
})();

/* ================= navigation ================= */
const nav = $('#nav');
let raf = 0;
function onScroll() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; placeKing(); nav.classList.toggle('dark', scrollY < hero.offsetHeight - 80); }); }
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { sizeKing(); layoutFan(); onScroll(); });
sizeKing(); onScroll();
const secIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$('.nav nav a[data-sec]').forEach(a => a.classList.toggle('on', a.dataset.sec === e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
['account', 'score', 'dash'].forEach(id => secIO.observe($('#' + id)));
$('#burger').onclick = () => { const n = $('#navLinks'), o = !n.classList.contains('open'); n.classList.toggle('open', o); $('#burger').setAttribute('aria-expanded', String(o)); };
$$('#navLinks a').forEach(a => a.addEventListener('click', () => { $('#navLinks').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); }));
const appLink = (v) => `index.html${S.id ? '?account=' + S.id : ''}#${v}`;
function syncAppLinks() { $$('a[data-app]').forEach(a => a.href = appLink(a.dataset.app)); $('#navApp').href = appLink('customer'); }

/* ================= tooltips for every "i" ================= */
const tip = $('#tip');
function showTip(el) { tip.innerHTML = `<b>${esc(el.dataset.t)}</b>${esc(el.dataset.tip)}`; tip.hidden = false; const r = el.getBoundingClientRect(); const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px'; tip.style.top = (r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10) + 'px'; }
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
document.addEventListener('mouseout', e => { if (e.target.closest('[data-tip]')) tip.hidden = true; });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
document.addEventListener('focusout', e => { if (e.target.closest('[data-tip]')) tip.hidden = true; });
document.addEventListener('click', e => { const el = e.target.closest('.info'); if (el) { e.preventDefault(); e.stopPropagation(); if (tip.hidden) showTip(el); else tip.hidden = true; } else tip.hidden = true; }, true);
const info = (t, d) => `<button type="button" class="info" data-t="${esc(t)}" data-tip="${esc(d)}" aria-label="What is ${esc(t)}?">i</button>`;

/* ================= 2 · account ================= */
let IDS = [];
fetch('assets/ids.json').then(r => r.json()).then(a => IDS = a).catch(() => {});
const msg = (cls, t) => { const m = $('#acctMsg'); m.className = 'msg ' + cls; m.textContent = t; };
$('#randomBtn').onclick = () => {
  const b = $('#randomBtn'); b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
  const pool = IDS.length ? IDS : [28754, 35412, 83390, 56034, 26404, 86402, 22768];
  $('#acct').value = pool[Math.floor(Math.random() * pool.length)]; $('#acct').removeAttribute('aria-invalid');
  msg('', `Account ${$('#acct').value} picked. Tap Get insights.`);
};
$('#acct').oninput = () => { $('#acct').value = $('#acct').value.replace(/\D/g, '').slice(0, 9); $('#acct').removeAttribute('aria-invalid'); };
$('#acctForm').onsubmit = e => { e.preventDefault(); const v = $('#acct').value.trim(); if (!/^\d+$/.test(v)) { $('#acct').setAttribute('aria-invalid', 'true'); msg('err', 'Type an account number, or tap Random account no.'); $('#acct').focus(); return; } load(+v); };

async function load(id) {
  const g = ++S.gen; msg('wait', 'Looking up the account…');
  try {
    const [acct, ins, prof] = await Promise.all([API.account(id), API.insights(id), API.profile(id).catch(() => null)]);
    if (g !== S.gen) return;
    Object.assign(S, { id, acct, ins, prof, sim: null });
    const p = prof && prof.profile, where = p && p.region ? ` in ${p.region.replace(/\b\w/g, c => c.toUpperCase())}` : '';
    msg('ok', `Found it: a customer${where} with ${ins.insights && ins.insights.months || 'several'} months of history.`);
    syncAppLinks(); resetScore(); renderDash();
    setTimeout(() => $('#score').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }), 700);
  } catch (err) { if (g === S.gen) msg('err', API.describe(err)); }
}

/* ================= 3 · resilience score ================= */
const PARTS = [
  ['shock_resilience', 'Shock resilience', 'How long savings would last if money in dropped to 55%, like on EI. More months earn more points.'],
  ['cashflow_health', 'Cashflow health', 'Whether money in covers money out in a typical month.'],
  ['income_stability', 'Income stability', 'How steady money in is from month to month. Big swings lower the score.'],
  ['recent_balance_stress', 'Balance stress', 'How often the balance dipped below zero recently. Fewer days earn more points.'],
  ['recorded_debt_commitments', 'Debt load', 'How big the monthly loan payment is compared with money in.'],
];
function resetScore() {
  const btn = $('#calcBtn'); $('#scoreFor').textContent = `Ready for account ${S.id}. One tap and we'll work it out from their records.`;
  $('#metrics').hidden = true; $('#metrics').innerHTML = '';
  $('#teaser').hidden = false;
  if (btn.classList.contains('moved')) { $('#teaserCta').prepend(btn); btn.classList.remove('moved'); btn.lastChild.textContent = 'Calculate resilience score'; }
}
$('#calcBtn').onclick = () => {
  const btn = $('#calcBtn');
  if (!S.id) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); $('#scoreFor').textContent = 'Pick an account first. Taking you there…'; setTimeout(() => { $('#account').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); $('#acct').focus({ preventScroll: true }); }, 650); return; }
  if (!btn.classList.contains('moved')) {             // FLIP: the button slides over to the left, under the question
    const a = btn.getBoundingClientRect(); $('#btnLeft').append(btn); btn.classList.add('moved'); btn.lastChild.textContent = 'Recalculate'; $('#teaser').hidden = true;
    const b = btn.getBoundingClientRect();
    if (!reduce && btn.animate) btn.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  renderMetrics();
};
function renderMetrics() {
  const sc = S.ins.score || {}, comps = sc.components || {}, ref = sc.reference_shock || {}, v = num(sc.score), m = $('#metrics');
  const C = 2 * Math.PI * 60, tier = !isFinite(v) ? ['Incomplete', 'Some parts of the history are missing.'] : v >= 70 ? ['Strong', 'This customer can absorb most everyday shocks.'] : v >= 40 ? ['Holding on', 'Fine day to day, but a big shock would hurt.'] : ['At risk', 'A shock would hit hard and fast.'];
  m.innerHTML = `<div class="m-top"><div class="ring-big"><svg viewBox="0 0 150 150" aria-hidden="true"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2BD9A0"/><stop offset="1" stop-color="#0FA37F"/></linearGradient></defs>
      <circle cx="75" cy="75" r="60" class="bg" fill="none"/><circle cx="75" cy="75" r="60" class="fg" fill="none" stroke-linecap="round" transform="rotate(-90 75 75)" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${C.toFixed(1)}" data-off="${(C * (1 - clamp((v || 0) / 100))).toFixed(1)}"/></svg>
      <b><span data-count="${isFinite(v) ? v : ''}">${isFinite(v) ? '0' : '—'}</span><small>out of 100</small></b></div>
    <div><h3>${tier[0]}</h3><p>${tier[1]} The score adds up five parts, 20 points each. ${info('Resilience score', 'An experimental, educational indicator of how well this customer could absorb a money shock. It is not a credit score.')}</p></div></div>
    <div class="parts">${PARTS.map(([k, n, d], i) => { const pts = num(comps[k]), r = isFinite(pts) ? pts / 20 : 0, c = r >= .66 ? '#12A150' : r >= .33 ? '#E08600' : '#E5383B', c2 = 2 * Math.PI * 14;
      return `<div class="part"><svg class="mini" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14" class="bg" fill="none"/><circle cx="18" cy="18" r="14" class="fg" fill="none" stroke-linecap="round" transform="rotate(-90 18 18)" style="--c:${c};--d:${i * 90}ms;stroke-dasharray:${c2.toFixed(1)};stroke-dashoffset:${c2.toFixed(1)}" data-off="${(c2 * (1 - clamp(r))).toFixed(1)}"/></svg>
        <span class="nm">${n} ${info(n, d)}</span><span class="val">${isFinite(pts) ? pts.toFixed(1) : '—'}<small> / 20</small></span></div>`; }).join('')}</div>
    ${ref.runway_display ? `<div class="refline">If money in dropped to 55% (like EI), savings would last <b>${esc(ref.runway_display)}</b>${num(ref.monthly_shortfall) > 0 ? `, falling by <b>${money(ref.monthly_shortfall)}</b> a month` : ''}.</div>` : ''}
    <button class="askai" type="button" id="askWhy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.7L4 19.5l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/></svg>Ask our AI coach to explain why</button>`;
  m.hidden = false; m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
  requestAnimationFrame(() => requestAnimationFrame(() => { $$('.fg[data-off]', m).forEach(c => c.style.strokeDashoffset = c.dataset.off); countUp(m); }));
  $('#askWhy').onclick = () => openChat(`Why does account ${S.id} have a resilience score of ${isFinite(v) ? v.toFixed(0) : 'this'}? Which part drags it down most, and what would help?`);
}
function countUp(root) { $$('[data-count]', root).forEach(el => { const to = num(el.dataset.count); if (!isFinite(to)) return; if (reduce) { el.textContent = to.toFixed(0); return; } const t0 = performance.now(); const st = n => { const k = Math.min(1, (n - t0) / 1100); el.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(0); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }); }

/* ================= 4 · dashboard ================= */
const IC = {
  in: '<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', out: '<path d="M12 14V3M7.5 7.5 12 3l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  fixed: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>', bills: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9 8h6M9 11.5h6M9 15h3.5"/>',
  save: '<path d="M19 10.5c0-3-3-5.5-7-5.5-4.4 0-7.5 2.6-7.5 6 0 1.8.9 3.3 2.3 4.4L6 19h3l.7-1.6c.7.2 1.5.3 2.3.3s1.6-.1 2.3-.3L15 19h3l-.5-3c.9-.6 1.6-1.4 2-2.3H21v-3h-2z"/>', loan: '<rect x="3.5" y="6" width="17" height="12" rx="2.5"/><path d="M3.5 10h17M7 14.5h4"/>',
  job: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/>', fire: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2 1.4 3 3.2 3.2 5 1-.6 1.7-1.6 2-3 1.6 1.6 3.2 4 3.2 7.2 0 3.4-2.4 5.8-6 5.8z"/>',
  bolt: '<path d="M13 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>', shield: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>', people: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14.5 15.2c.8-.5 1.6-.7 2.5-.7 2 0 3.6 1.2 4 4"/>',
  wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>', pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
function rwText(r) { if (!r) return '—'; if (r.status === 'buffer_exhausted') return '0 months'; if (r.status === 'no_shortfall') return 'Never runs out'; if (r.status === 'capped') return '10+ years'; return `${r.runway_months} months`; }
function rwTone(r) { if (!r) return ['warn', '']; if (r.status === 'buffer_exhausted') return ['crit', 'Savings gone on day one']; if (r.status === 'no_shortfall' || r.status === 'capped') return ['good', 'Money in still covers money out'];
  const m = num(r.runway_months); return m < 3 ? ['crit', 'Runs out fast'] : m < 6 ? ['warn', 'Runs out before month 6'] : ['good', 'Lasts 6 months or more']; }
const W = { inc: 100, bills: 0, one: 0, oneS: false, extra: 0 };

function renderDash() {
  const a = S.acct, ins = S.ins.insights || {}, p = S.prof && S.prof.profile;
  $('#dashSub').textContent = `Account ${S.id}${p && p.district_name ? ' · ' + p.district_name : ''} · ${ins.months || '?'} months of history. Everything here is live from their records.`;
  const tiles = [
    ['in', '#007AFF', 'Money in', a.I, 'A typical month, the median of their history.', 'The middle value of all the money that came in each month.'],
    ['out', '#FF9500', 'Money out', a.S, 'A typical month of spending, bills included.', 'The middle value of all the money that went out each month.'],
    ['fixed', '#AF52DE', 'Fixed costs', a.F, 'Bills, insurance and loan, the costs that don\'t move.', 'Household bills + insurance + loan payments in a typical month.'],
    ['bills', '#FF2D55', 'Household bills', a.H, 'Rent and utilities, what a bill shock changes.', 'The typical monthly amount paid for household bills.'],
    ['save', '#34C759', 'Savings buffer', a.B, 'The cushion: average balance over the last 6 months.', 'Mean of the average daily balance over the last six months.'],
    ['loan', '#5856D6', 'Loan payment', a.P, num(a.P) > 0 ? 'Paid every month while the loan runs.' : 'No loan still running.', 'The monthly payment on a loan that was still running at the end of the data.'],
  ];
  const hist = (ins.history || []).slice(-24);
  $('#dashBody').className = ''; $('#dashBody').innerHTML = `
    <div class="tiles">${tiles.map(([ic, c, k, v, s, d], i) => `<div class="tile" style="--c:${c};--d:${i * 60}ms"><span class="ic">${svg(ic)}</span><span class="k">${k} ${info(k, d)}</span><span class="v">${num(v) > 0 || k !== 'Loan payment' ? money(v) : 'None'}</span><span class="s">${s}</span></div>`).join('')}</div>

    <div class="card whatif-card"><h3>What if…? ${info('What-if lab', 'Change the assumptions and see how long the savings last. Results are worked out on the server from this customer\'s records.')}</h3>
      <p class="why">Drag any slider or tap a chip. Savings are recalculated every time you change something.</p>
      <div class="whatif">
        <div class="ctrls">
          <div class="chips" role="group" aria-label="Quick shocks"><button class="chip" type="button" data-q="job">Lose job (EI 55%)</button><button class="chip" type="button" data-q="furnace">Furnace dies</button><button class="chip" type="button" data-q="bills">Bills up 15%</button><button class="chip" type="button" data-q="none">Reset</button></div>
          <div class="ctl"><label for="wInc">Money in kept <output id="oInc"></output></label><input type="range" id="wInc" min="0" max="100" step="5"><span class="hint">55% is roughly what EI pays after a layoff.</span></div>
          <div class="ctl"><label for="wBills">Household bills change <output id="oBills"></output></label><input type="range" id="wBills" min="0" max="60" step="5"><span class="hint">A rent or utility increase, as a share of household bills.</span></div>
          <div class="ctl"><label for="wOne">One-off cost <output id="oOne"></output></label><input type="range" id="wOne" min="0" max="${Math.max(40000, Math.ceil(num(a.S) * 2 / 1000) * 1000)}" step="250"><span class="hint">A repair or emergency paid from savings on day one.</span></div>
          <div class="ctl"><label for="wExtra">New monthly cost <output id="oExtra"></output></label><input type="range" id="wExtra" min="0" max="2500" step="50"><span class="hint">A new car payment, childcare or a rent hike.</span></div>
        </div>
        <div class="result" aria-live="polite">
          <span class="step" style="margin:0">Savings would last</span>
          <div class="res-big"><b id="rMonths">…</b><span id="rUnit"></span></div>
          <div><span class="badge" id="rBadge"></span></div>
          <div class="blocks" id="rBlocks" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--d:${i * 22}ms"></i>`).join('')}</div>
          <div class="blocks-scale" aria-hidden="true"><span>0</span><span>6</span><span>12</span><span>18</span><span>24+ months</span></div>
          <p class="why" id="rWhy" style="margin:4px 0 0"></p>
          <div class="chart-box"><canvas id="projChart" aria-label="Projected savings month by month"></canvas></div>
          <p class="why" style="margin:0">The line shows the savings balance month by month under these assumptions. Below zero means the money has run out.</p>
        </div>
      </div>
    </div>

    <div class="charts">
      <div class="card"><h3>Money in vs money out ${info('Money in vs money out', 'Monthly totals from the account history.')}</h3><p class="why">Blue bars are money in, orange bars below the line are money out. The dark line is what was left over each month.</p><div class="chart-box tall"><canvas id="flowChart" aria-label="Money in and out by month"></canvas></div></div>
      <div class="card"><h3>Savings over time ${info('Savings over time', 'The average daily balance each month.')}</h3><p class="why">The account's average balance each month. The shaded last 6 months set the savings buffer we use.</p><div class="chart-box tall"><canvas id="balChart" aria-label="Average balance by month"></canvas></div></div>
    </div>

    <div><h3 style="font:800 24px var(--font);margin:6px 0 4px">Flip a card</h3><p class="why" style="margin:0 0 14px;opacity:.65">Hover or tap a card to see the answer for this customer.</p>
      <div class="flips" id="flips">${FLIPS.map((f, i) => `<button type="button" class="flip" style="--c:${f.c}" aria-pressed="false" data-i="${i}"><span class="fi"><span class="fr"><span class="ic">${svg(f.ic)}</span><b>${f.t}</b><small>${f.s}</small></span><span class="bk"><span class="lbl">${f.t}</span><span class="big" id="fv${i}">…</span><p id="fp${i}">Working it out…</p></span></span></button>`).join('')}</div></div>

    <div class="deep"><a href="${appLink('customer')}">You <span>›</span></a><a href="${appLink('shock')}">Emergency fund <span>›</span></a><a href="${appLink('plan')}">Saving plan <span>›</span></a><a href="${appLink('paradox')}">About <span>›</span></a></div>`;
  $$('#flips .flip').forEach(b => b.onclick = () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
  bindWhatIf(); drawHistory(hist); fillFlips();
}

/* what-if lab */
function bindWhatIf() {
  Object.assign(W, { inc: 100, bills: 0, one: 0, oneS: false, extra: 0 });
  const set = () => {
    const r = (id, v, out) => { const el = $('#' + id); el.value = v; el.style.setProperty('--p', ((v - el.min) / (el.max - el.min) * 100) + '%'); $('#' + out[0]).textContent = out[1]; };
    r('wInc', W.inc, ['oInc', W.inc + '%' + (W.inc === 55 ? ' (EI)' : '')]); r('wBills', W.bills, ['oBills', '+' + W.bills + '%']);
    r('wOne', W.oneS ? Math.round(num(S.acct.S)) : W.one, ['oOne', W.oneS ? money(S.acct.S) + ' (1 month)' : money(W.one)]); r('wExtra', W.extra, ['oExtra', money(W.extra)]);
    const q = W.inc === 55 && !W.bills && !W.one && !W.oneS && !W.extra ? 'job' : W.oneS && W.inc === 100 && !W.bills && !W.extra ? 'furnace' : W.bills === 15 && W.inc === 100 && !W.one && !W.oneS && !W.extra ? 'bills' : W.inc === 100 && !W.bills && !W.one && !W.oneS && !W.extra ? 'none' : '';
    $$('.chip[data-q]').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.q === q)));
  };
  const on = (id, fn) => $('#' + id).oninput = e => { fn(+e.target.value); set(); simulate(); };
  on('wInc', v => W.inc = v); on('wBills', v => W.bills = v); on('wOne', v => { W.one = v; W.oneS = false; }); on('wExtra', v => W.extra = v);
  $$('.chip[data-q]').forEach(c => c.onclick = () => {
    Object.assign(W, { inc: 100, bills: 0, one: 0, oneS: false, extra: 0 });
    if (c.dataset.q === 'job') W.inc = 55; if (c.dataset.q === 'furnace') W.oneS = true; if (c.dataset.q === 'bills') W.bills = 15;
    set(); simulate();
  });
  set(); simulate();
}
let simT = 0, simG = 0;
function body() { return { account_id: S.id, income_retained_pct: String(W.inc), bills_increase_pct: String(W.bills), one_off_cost: W.oneS ? dec10(S.acct.S) : String(W.one), extra_monthly_cost: String(W.extra) }; }
function simulate() {
  clearTimeout(simT); simT = setTimeout(async () => {
    const g = ++simG, b = body();
    try {
      const r = await API.simulate(b); if (g !== simG) return; S.sim = r;
      const [tone, label] = rwTone(r), txt = rwText(r), m = txt.match(/^([\d.]+) (months)$/);
      $('#rMonths').textContent = m ? m[1] : txt; $('#rUnit').textContent = m ? 'months' : '';
      $('#rBadge').className = 'badge ' + tone; $('#rBadge').textContent = label;
      const v = r.status === 'buffer_exhausted' ? 0 : (r.status === 'no_shortfall' || r.status === 'capped') ? 24 : Math.min(24, num(r.runway_months)), col = tone === 'good' ? '#12A150' : tone === 'warn' ? '#E08600' : '#E5383B';
      const bl = $('#rBlocks'); bl.classList.remove('go'); $$('i', bl).forEach((c, i) => { c.style.setProperty('--f', clamp(v - i).toFixed(2)); c.style.setProperty('--bc', col); }); requestAnimationFrame(() => requestAnimationFrame(() => bl.classList.add('go')));
      const gap = num(r.monthly_shortfall);
      $('#rWhy').textContent = r.status === 'buffer_exhausted' ? 'The one-off cost is bigger than the savings, so the money is gone on day one.' : gap > 0 ? `Money out would beat money in by ${money(gap)} a month, so savings of ${money(r.buffer_left)} shrink every month.` : 'Money in still covers money out, so the savings never run down.';
      const sp = await API.support(Object.assign({}, b, { support_months: 12, post_support_income_retained_pct: b.income_retained_pct })); if (g !== simG) return;
      drawProjection((sp.projection || []).slice(0, 24));
    } catch (e) { if (g === simG) { $('#rMonths').textContent = '—'; $('#rWhy').textContent = API.describe(e); } }
  }, 180);
}

/* charts */
const charts = {};
function chart(id, cfg) { const el = document.getElementById(id); if (!el || !window.Chart) return; if (charts[id]) charts[id].destroy(); charts[id] = new Chart(el.getContext('2d'), cfg); }
if (window.Chart) { Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Samsung Sharp Sans", "SamsungOne", "Samsung Sans", system-ui, Roboto, "Segoe UI", "Helvetica Neue", Arial, sans-serif'; Chart.defaults.color = '#6E6A86'; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const lab = m => { const d = new Date(m); return MON[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2); };
const kTick = v => (Math.abs(v) >= 1000 ? '$' + Math.round(Math.abs(v) / 1000) + 'k' : '$' + Math.abs(v));
const opts = extra => Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: reduce ? 0 : 800, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1D1B2E', padding: 10, cornerRadius: 10, usePointStyle: true } },
  scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 18 } }, y: { position: 'right', grid: { color: 'rgba(29,27,46,.07)' }, border: { display: false }, ticks: { callback: kTick, maxTicksLimit: 6 } } } }, extra || {});
function grad(col, down) { return c => { const { ctx, chartArea } = c.chart; if (!chartArea) return col; const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); g.addColorStop(down ? 1 : 0, col); g.addColorStop(.5, col + '99'); return g; }; }
function drawHistory(h) {
  const L = h.map(r => lab(r.month)), ins = h.map(r => num(r.money_in)), outs = h.map(r => num(r.money_out)), net = ins.map((v, i) => v - outs[i]), bal = h.map(r => num(r.avg_daily_balance));
  chart('flowChart', { data: { labels: L, datasets: [
    { type: 'bar', label: 'Money in', data: ins, backgroundColor: grad('#007AFF'), borderRadius: 6, borderSkipped: false, stack: 'f', order: 2, maxBarThickness: 22 },
    { type: 'bar', label: 'Money out', data: outs.map(v => -v), backgroundColor: grad('#FF9500', true), borderRadius: 6, borderSkipped: false, stack: 'f', order: 2, maxBarThickness: 22 },
    { type: 'line', label: 'Left over', data: net, borderColor: '#1D1B2E', borderWidth: 2, tension: .35, order: 1, pointRadius: 3, pointBackgroundColor: net.map(v => v >= 0 ? '#12A150' : '#E5383B'), pointBorderColor: '#fff' },
  ] }, options: opts({ scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 18 } }, y: { stacked: true, position: 'right', grid: { color: 'rgba(29,27,46,.07)' }, border: { display: false }, ticks: { callback: kTick, maxTicksLimit: 6 } } },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1D1B2E', padding: 10, cornerRadius: 10, callbacks: { label: i => ` ${i.dataset.label}: ${money(Math.abs(i.raw))}` } } } }) });
  const shade = { id: 'shade', beforeDatasetsDraw(c) { const { ctx, chartArea: ca, scales: { x } } = c; if (bal.length < 7) return; const x0 = x.getPixelForValue(bal.length - 6) - (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2; ctx.save(); ctx.fillStyle = 'rgba(52,199,89,.10)'; ctx.fillRect(x0, ca.top, ca.right - x0, ca.bottom - ca.top); ctx.fillStyle = '#0B7A3B'; ctx.font = '600 11px -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('Buffer ' + money(S.acct.B), ca.right - 6, ca.top + 14); ctx.restore(); } };
  chart('balChart', { type: 'line', data: { labels: L, datasets: [{ label: 'Average balance', data: bal, borderColor: '#34C759', borderWidth: 2.5, tension: .35, pointRadius: 0, pointHoverRadius: 5, fill: 'origin',
    backgroundColor: c => { const { ctx, chartArea } = c.chart; if (!chartArea) return 'rgba(52,199,89,.2)'; const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); g.addColorStop(0, 'rgba(52,199,89,.32)'); g.addColorStop(1, 'rgba(52,199,89,0)'); return g; } }] },
    plugins: [shade], options: opts({ plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1D1B2E', padding: 10, cornerRadius: 10, callbacks: { label: i => ' ' + money(i.raw) } } } }) });
}
function drawProjection(p) {
  const L = ['Now', ...p.map(r => 'M' + r.month)], start = num(S.sim && S.sim.buffer_left), vals = [start, ...p.map(r => num(r.projected_balance))];
  chart('projChart', { type: 'line', data: { labels: L, datasets: [{ label: 'Savings', data: vals, borderColor: '#5B4CF0', borderWidth: 2.5, tension: .3, pointRadius: 0, pointHoverRadius: 5, fill: 'origin',
    segment: { borderColor: c => c.p1.parsed.y < 0 ? '#E5383B' : '#5B4CF0' },
    backgroundColor: c => { const { ctx, chartArea } = c.chart; if (!chartArea) return 'rgba(91,76,240,.15)'; const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom); g.addColorStop(0, 'rgba(91,76,240,.28)'); g.addColorStop(1, 'rgba(91,76,240,0)'); return g; } }] },
    options: opts({ plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1D1B2E', padding: 10, cornerRadius: 10, callbacks: { label: i => ' Savings ' + money(i.raw) } } } }) });
}

/* flip cards: each answer comes from the backend */
const FLIPS = [
  { t: 'Laid off tomorrow', s: 'EI pays 55% of income', ic: 'job', c: '#007AFF' },
  { t: 'The furnace dies', s: 'A repair costing a month of spending', ic: 'fire', c: '#FF9500' },
  { t: 'Bills go up 15%', s: 'Rent and utilities climb', ic: 'bills', c: '#FF2D55' },
  { t: 'Perfect storm', s: 'Layoff and bills up together', ic: 'bolt', c: '#AF52DE' },
  { t: 'Safety net goal', s: 'Enough to last 6 months on EI', ic: 'shield', c: '#34C759' },
  { t: 'Customers like you', s: 'Five most similar accounts', ic: 'people', c: '#30B0C7' },
  { t: 'Income swings', s: 'How steady money in is', ic: 'wave', c: '#5856D6' },
  { t: 'Where they bank', s: 'Branch and standing orders', ic: 'pin', c: '#FF6B3D' },
];
async function fillFlips() {
  const id = S.id, base = { account_id: id }, put = (i, big, p) => { if (S.id !== id) return; $('#fv' + i).textContent = big; $('#fp' + i).textContent = p; };
  const run = async (i, b, why) => { try { const r = await API.simulate(Object.assign({}, base, b)); put(i, rwText(r), why(r)); } catch (e) { put(i, '—', API.describe(e)); } };
  const fall = r => num(r.monthly_shortfall) > 0 ? `Savings would fall by ${money(r.monthly_shortfall)} a month.` : 'Money in still covers money out.';
  run(0, { income_retained_pct: '55' }, r => `How long savings last on EI. ${fall(r)}`);
  run(1, { one_off_cost: dec10(S.acct.S) }, r => r.status === 'buffer_exhausted' ? 'The repair wipes out the savings on day one.' : `After paying ${money(S.acct.S)} for the repair. ${fall(r)}`);
  run(2, { bills_increase_pct: '15' }, r => `Household bills up ${money(num(S.acct.H) * .15)} a month. ${fall(r)}`);
  run(3, { income_retained_pct: '55', bills_increase_pct: '15' }, r => `EI at 55% and bills up 15% in the same month. ${fall(r)}`);
  API.plan(Object.assign({}, base, { income_retained_pct: '55', target_months: 6 })).then(p => { const n = num(p.additional_savings_needed); put(4, n > 0 ? '+' + money(n) : 'Covered', n > 0 ? `More savings needed to last 6 months on EI. That's ${money(p.required_buffer)} in total.` : 'Their savings already last 6 months on EI.'); }, e => put(4, '—', API.describe(e)));
  API.lookalikes(id).then(d => { const ps = d.peers || [], short = ps.filter(x => { const r = x.income_shock || {}; return r.status === 'buffer_exhausted' || (r.status === 'shortfall' && num(r.runway_months) < 6); }).length;
    put(5, `${short} of ${ps.length}`, `similar customers would run out within 6 months on EI. Similar numbers, different lives.`); }, e => put(5, '—', API.describe(e)));
  const cv = num(S.ins.insights && S.ins.insights.income_cv); put(6, isFinite(cv) ? '±' + Math.round(cv * 100) + '%' : '—', isFinite(cv) ? (cv > .5 ? 'Money in jumps around a lot from month to month, which makes planning harder.' : 'Money in is fairly steady month to month.') : 'Not enough history to tell.');
  const p = S.prof && S.prof.profile; put(7, p && p.district_name ? p.district_name : '—', p ? `${(p.region || '').replace(/\b\w/g, c => c.toUpperCase())}. ${p.standing_order_count || 0} standing orders worth ${money(p.standing_order_total)} a month.` : 'Branch details unavailable.');
}

/* ================= AI coach chat ================= */
const chatEl = $('#chat'), msgs = $('#msgs'), hist = [];
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
function bubble(cls, html) { const d = document.createElement('div'); d.className = 'bub ' + cls; d.innerHTML = html; msgs.append(d); msgs.scrollTop = msgs.scrollHeight; return d; }
function openChat(q) {
  chatEl.hidden = false; dock.setAttribute('aria-expanded', 'true');
  if (!msgs.children.length) bubble('ai', S.id ? `Hi! I'm <b>Mate</b>, your AI money coach. I'm looking at account <b>${S.id}</b>. Ask me anything about it.` : `Hi! I'm <b>Mate</b>, your AI money coach. Pick an account first and I'll explain its numbers.`);
  $('#sugg').innerHTML = ['Why is the score what it is?', 'Would they survive a layoff?', 'How do they build a safety net?', 'What is the biggest risk?'].map(s => `<button type="button">${s}</button>`).join('');
  $$('#sugg button').forEach(b => b.onclick = () => ask(b.textContent));
  if (q) ask(q); else $('#chatIn').focus();
}
function closeChat() { chatEl.hidden = true; dock.setAttribute('aria-expanded', 'false'); }
dock.onclick = () => chatEl.hidden ? openChat() : closeChat();
$('#chatClose').onclick = closeChat;
$('#chatForm').onsubmit = e => { e.preventDefault(); const q = $('#chatIn').value.trim(); if (q) { $('#chatIn').value = ''; ask(q); } };
function context() {
  if (!S.id) return 'No account is selected yet.';
  const a = S.acct, sc = S.ins.score || {}, c = sc.components || {}, ref = sc.reference_shock || {};
  return `Account ${S.id}. Typical money in ${money(a.I)}/month, money out ${money(a.S)}/month, fixed costs ${money(a.F)}, household bills ${money(a.H)}, savings buffer ${money(a.B)}, loan payment ${money(a.P)}.
Resilience score ${sc.score}/100 (experimental): shock resilience ${c.shock_resilience}/20, cashflow health ${c.cashflow_health}/20, income stability ${c.income_stability}/20, balance stress ${c.recent_balance_stress}/20, debt load ${c.recorded_debt_commitments}/20.
If money in drops to 55% (EI), savings last ${ref.runway_display || 'unknown'}${num(ref.monthly_shortfall) > 0 ? `, falling ${money(ref.monthly_shortfall)}/month` : ''}.` +
  (S.sim ? `\nCurrent what-if (money in ${W.inc}%, bills +${W.bills}%, one-off ${W.oneS ? money(a.S) : money(W.one)}, new monthly cost ${money(W.extra)}): savings last ${rwText(S.sim)}.` : '');
}
function fallback() {
  if (!S.id) return 'Pick an account in Step 1 and I can explain its numbers.';
  const sc = S.ins.score || {}, c = sc.components || {}, weakest = PARTS.map(([k, n]) => [n, num(c[k])]).filter(x => isFinite(x[1])).sort((x, y) => x[1] - y[1])[0], ref = sc.reference_shock || {};
  return `I can't reach the AI right now, so here are the facts. The score is **${num(sc.score).toFixed(0)}/100**. The weakest part is **${weakest ? weakest[0] : 'unknown'}** (${weakest ? weakest[1].toFixed(1) : '?'}/20). On EI at 55%, savings would last **${ref.runway_display || 'unknown'}**.`;
}
async function ask(q) {
  bubble('me', esc(q)); hist.push({ role: 'user', parts: [{ text: q }] });
  const t = bubble('ai typing', 'Thinking…');
  const sys = `You are Mate, ChequeMate's friendly AI money coach (a cheerful little chess piece). Explain one bank customer's numbers in plain, warm language for a non-expert.
Use only the numbers below; never invent figures. Keep answers under 110 words. Use **bold** for key numbers. Point to one practical next step. This is education, not financial advice.
${context()}`;
  try {
    const r = await fetch('api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: hist.slice(-8), generationConfig: { temperature: .4, maxOutputTokens: 400 } }) });
    const j = await r.json(); const text = j && j.candidates && j.candidates[0] && j.candidates[0].content && (j.candidates[0].content.parts || []).map(p => p.text || '').join('').trim();
    if (!r.ok || !text) throw new Error('no answer');
    t.className = 'bub ai'; t.innerHTML = md(text); hist.push({ role: 'model', parts: [{ text }] });
  } catch (e) { const f = fallback(); t.className = 'bub ai'; t.innerHTML = md(f); hist.push({ role: 'model', parts: [{ text: f }] }); }
  msgs.scrollTop = msgs.scrollHeight;
}

/* reveal on scroll */
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); rio.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px -60px 0px' });
$$('.acct, .explain, .score-grid .q, .dash-h').forEach(el => { el.classList.add('rv'); rio.observe(el); });

/* arriving with ?account=… fills everything */
const qa = new URLSearchParams(location.search).get('account');
if (qa && /^\d+$/.test(qa)) { $('#acct').value = qa; load(+qa); }

/* ===== account box: tick appears when the number looks complete ===== */
(function () { const f = $('#ckField'), i = $('#acct'); if (!f || !i) return; const upd = () => f.classList.toggle('filled', /^\d{3,}$/.test(i.value)); i.addEventListener('input', upd); $('#randomBtn').addEventListener('click', () => setTimeout(upd, 0)); upd(); })();

/* ===== footer: rising sparks + click burst on the Datasparks logo ===== */
(function () {
  const host = $('#dsSparks'); if (!host) return; const cols = ['#FFD36B', '#FF5E62', '#7C5CFF', '#2BD9A0', '#5CC8FF'];
  for (let k = 0; k < 26; k++) { const i = document.createElement('i'); i.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--s:${(3 + Math.random() * 5).toFixed(1)}px;--c:${cols[k % cols.length]};--d:${(Math.random() * 6).toFixed(2)}s;--t:${(4 + Math.random() * 5).toFixed(2)}s;--dx:${((Math.random() - .5) * 120).toFixed(0)}px`; host.append(i); }
  const logo = $('#dsLogo'); if (!logo) return;
  logo.addEventListener('click', () => {
    if (reduce || !logo.animate) return;
    for (let k = 0; k < 18; k++) { const d = document.createElement('span'); d.className = 'dsburst'; d.style.background = cols[k % cols.length]; d.style.boxShadow = `0 0 10px ${cols[k % cols.length]}`; logo.append(d);
      const a = k / 18 * Math.PI * 2 + Math.random() * .3, r = 60 + Math.random() * 70; d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => d.remove(); }
    logo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(20deg)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.2,1.5,.3,1)' });
  });
})();
})();
