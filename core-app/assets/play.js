/* ChequeMate Play: Runway Run (a year of life, one month at a time), Who lasts longer? (the paradox as a quiz),
   and the 3D coin tower in the Shock lab. Uses the same engine and numbers as every other page. */
(() => {
'use strict';
const CM = window.ChequeMate, D3 = window.CM3D || {};
if (!CM) return;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { money, esc, runway, store } = CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Q = () => window.CMQuests || { sfx() {}, burst() {}, say() {} };
const emit = (n, d) => document.dispatchEvent(new CustomEvent('cm:' + n, { detail: Object.assign({ id: CM.st.id }, d) }));
const on = (n, f) => document.addEventListener('cm:' + n, e => { try { f(e.detail || {}); } catch (err) { console.error('[play]', err); } });
const reduce = CM.reduceMotion;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const r10 = v => Math.round(v / 10) * 10;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sgn = v => (v >= 0 ? '+' : '−') + money(Math.abs(v));
function tween(el, from, to, fmt, dur = 700) {
  if (!el) return; if (reduce) { el.textContent = fmt(to); return; }
  const t0 = performance.now(); const st = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st);
}

const IC = {
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2.4 1.6 3 3.6 3 5 1-.6 1.6-1.8 1.8-3 1.8 1.6 3.6 4.2 3.6 7.4 0 3.2-2.4 5.6-6 5.6z"/>',
  car: '<path d="M5 16.5V12l2-5h10l2 5v4.5M3.5 12h17M5 16.5h14v2H5z"/><circle cx="8" cy="14.5" r=".8"/><circle cx="16" cy="14.5" r=".8"/>',
  tooth: '<path d="M7 4c-2 0-3.5 1.6-3.5 4 0 3 1.5 4.5 2 7.5.4 2.6 1 4.5 2.3 4.5 1.6 0 1.4-4.5 4.2-4.5s2.6 4.5 4.2 4.5c1.3 0 1.9-1.9 2.3-4.5.5-3 2-4.5 2-7.5 0-2.4-1.5-4-3.5-4-1.8 0-2.8 1-5 1S8.8 4 7 4z"/>',
  paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="17" cy="10" r="1.8"/><circle cx="10" cy="6.5" r="1.8"/><circle cx="14" cy="6.5" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 5.5 0 1.6 1.2 2.5 2.6 2.5 1.3 0 1.9-.8 2.9-.8s1.6.8 2.9.8c1.4 0 2.6-.9 2.6-2.5 0-2-2.5-5.5-5.5-5.5z"/>',
  home: '<path d="M4 11.5 12 5l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  trend: '<path d="M4 17 10 11l4 4 6-7M15 8h5v5"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9 8h6M9 11.5h6M9 15h3.5"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 5 7 5 7 7s3 1.5 5 1.5zM12 8.5C14 5 17 5 17 7s-3 1.5-5 1.5z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8.3 20 18M8 15.7 20 6"/>',
  bolt: '<path d="M13 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>',
  phone: '<path d="M5 4h4l1.5 4.5-2.3 1.4a11 11 0 0 0 5.9 5.9l1.4-2.3L20 15v4a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7L20.5 12 12 20.5z"/><circle cx="8" cy="8" r="1.3"/>',
  cut: '<path d="M4 12h16M12 4v16" transform="rotate(45 12 12)"/><circle cx="12" cy="12" r="8.5"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const svg = k => `<svg viewBox="0 0 24 24">${IC[k] || IC.leaf}</svg>`;

/* ================= RUNWAY RUN ================= */
let R = null;
const disc = a => Math.max(a.S - a.F, 0);
const gigAmt = a => r10(clamp(.15 * a.I, 300, 900));
const sellAmt = a => r10(clamp(.2 * a.S, 300, 2500));
const EV = {
  layoff: { name: 'Laid off', tone: 'crit', ic: 'briefcase', text: a => `The job ends. EI pays 55% of income, ${money(a.I * .55)} a month, for 6 months.`, apply() { R.laid = true; R.eiLeft = 6; R.applied = false; } },
  rehire: { name: 'Hired!', tone: 'good', ic: 'star', text: a => `A new job starts this month. Full income of ${money(a.I)} is back.`, apply() { R.laid = false; R.eiLeft = 0; R.applied = false; } },
  furnace: { name: 'Furnace dies', tone: 'crit', ic: 'flame', cost: a => .6 * a.S, text: (a, v) => `A freezing morning and a repair bill of ${money(v)}.` },
  car: { name: 'Car repair', tone: 'warn', ic: 'car', cost: a => .35 * a.S, text: (a, v) => `Brakes and a timing belt, due now: ${money(v)}.` },
  dental: { name: 'Dentist', tone: 'warn', ic: 'tooth', cost: a => Math.max(.15 * a.S, 150), text: (a, v) => `A crown insurance won't fully cover: ${money(v)}.` },
  vet: { name: 'Sick pet', tone: 'warn', ic: 'paw', cost: a => Math.max(.12 * a.S, 150), text: (a, v) => `An emergency vet visit: ${money(v)}.` },
  rent: { name: 'Rent goes up', tone: 'warn', ic: 'home', once: 1, text: () => 'The new lease adds $300 to every month from now on.', apply() { R.extra += 300; } },
  rates: { name: 'Rates rise', tone: 'warn', ic: 'trend', once: 1, text: a => a.P > 0 ? `The loan resets higher: ${money(.12 * a.P)} more every month.` : `Hydro and heating go up: ${money(Math.max(.08 * a.H, 40))} more every month.`, apply() { R.extra += R.a.P > 0 ? .12 * R.a.P : Math.max(.08 * R.a.H, 40); } },
  cold: { name: 'Cold snap', tone: 'warn', ic: 'snow', cost: a => Math.max(.3 * a.H, 120), text: (a, v) => `Heating bills spike: ${money(v)} extra this month.` },
  bonus: { name: 'Bonus', tone: 'good', ic: 'star', gain: a => .25 * a.I, ok: () => !R.laid, text: (a, v) => `A performance bonus lands: ${sgn(v)}.` },
  refund: { name: 'Tax refund', tone: 'good', ic: 'receipt', once: 1, gain: a => Math.max(.12 * a.I, 200), text: (a, v) => `The CRA sends a refund: ${sgn(v)}.` },
  gift: { name: 'Family helps', tone: 'good', ic: 'gift', gain: () => 250, text: () => 'A birthday cheque from Grandma: +$250.' },
  quiet: { name: 'A quiet month', tone: 'info', ic: 'leaf', text: () => 'Nothing breaks. Nothing changes. Enjoy it.' },
};
const DECK = [['furnace', 2], ['car', 3], ['dental', 3], ['vet', 2], ['rent', 2], ['rates', 2], ['cold', 2], ['bonus', 2], ['refund', 2], ['gift', 2], ['quiet', 4]];
const ACT = {
  cut: { name: 'Tighten up', ic: 'scissors', text: a => `Pause subscriptions, skip takeout. Saves ${money(.2 * disc(a))} this month.`, ok: () => disc(R.a) > 0, run: () => .2 * disc(R.a) },
  gig: { name: 'Gig work', ic: 'bolt', text: a => `Weekend deliveries: ${sgn(gigAmt(a))}. Uses 1 energy.`, ok: () => R.energy > 0, run: () => { R.energy--; return gigAmt(R.a); } },
  defer: { name: 'Call the lender', ic: 'phone', text: a => `Pause the ${money(a.P)} loan payment for 3 months. Once a year.`, ok: () => R.a.P > 0 && !R.used.defer, run: () => { R.used.defer = 1; R.deferLeft = 3; return 0; } },
  sell: { name: 'Sell something', ic: 'tag', text: a => `List the old bike and the spare TV: ${sgn(sellAmt(a))}. Once a year.`, ok: () => !R.used.sell, run: () => { R.used.sell = 1; return sellAmt(R.a); } },
  shop: { name: 'Shop the bills', ic: 'cut', text: a => `Switch phone, internet and insurance: ${money(.1 * a.H)} less every month. Once.`, ok: () => R.a.H > 0 && !R.used.shop, run: () => { R.used.shop = 1; R.trim = .1 * R.a.H; return 0; } },
  apply: { name: 'Apply for jobs', ic: 'send', text: () => 'Send ten applications. Good odds of an offer next month.', ok: () => R.laid, run: () => { R.applied = true; return 0; } },
  rest: { name: 'Recharge', ic: 'moon', text: () => 'Take it easy this month. Gain 1 energy for gig work.', ok: () => R.energy < 3, run: () => { R.energy++; return 0; } },
};

function newRun() {
  const a = CM.acc(); if (!a) return;
  const ei = runway(a.B, a.I, a.S, { mult: .55 }).v;
  R = { a, m: 0, start: new Date().getMonth(), bal: a.B, B0: Math.max(a.B, 1), laid: false, eiLeft: 0, extra: 0, trim: 0, energy: 3, deferLeft: 0,
    used: {}, seen: {}, applied: false, layoffAt: 1 + Math.floor(Math.random() * 3), hist: [], phase: 'start', hard: ei !== Infinity && ei < 3, ev: null, hand: [], last: null };
  renderRun();
}
function draw() {
  if (R.m === R.layoffAt && !R.laid) return 'layoff';
  if (R.laid && R.applied && Math.random() < .5) return 'rehire';
  if (R.laid && R.m > R.layoffAt + 3 && Math.random() < .12) return 'rehire';
  if (!R.laid && R.m > R.layoffAt + 2 && Math.random() < .07) return 'layoff';
  const pool = DECK.filter(([k]) => k !== R.last && !(EV[k].once && R.seen[k]) && (!EV[k].ok || EV[k].ok()));
  let n = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of pool) { n -= w; if (n <= 0) return k; }
  return 'quiet';
}
function deal() {
  const avail = Object.keys(ACT).filter(k => ACT[k].ok());
  const hand = R.laid && avail.includes('apply') ? ['apply'] : [];
  shuffle(avail.filter(k => !hand.includes(k))).forEach(k => { if (hand.length < 3) hand.push(k); });
  return hand;
}
function startMonth() {
  const k = draw(), e = EV[k];
  R.seen[k] = 1; R.last = k;  if (R.laid && R.applied && k !== 'rehire') R.applied = false;
  const v = r10(e.cost ? e.cost(R.a) : e.gain ? e.gain(R.a) : 0);
  if (e.apply) e.apply();
  R.ev = { k, v }; R.hand = deal(); R.phase = 'pick';
  flipTo(eventHTML());
  Q().sfx(e.tone === 'crit' ? 'bad' : 'flip');
  if (k === 'layoff' && !R.saidLayoff) { R.saidLayoff = 1; Q().say('Ouch, a layoff. EI covers 55% for 6 months. Apply for jobs and keep gig energy for the hard months.', [], 6500); }
  renderRun(true);
}
function pick(k) {
  if (!R || R.phase !== 'pick') return;
  R.phase = 'resolve'; Q().sfx('tap');
  const a = R.a, e = EV[R.ev.k];
  const gain = ACT[k].run() || 0;
  const income = R.laid ? (R.eiLeft > 0 ? a.I * .55 : 0) : a.I;
  let spend = a.S + R.extra - R.trim; const deferred = R.deferLeft > 0; if (deferred) { spend -= a.P; R.deferLeft--; }
  const one = e.cost ? -R.ev.v : e.gain ? R.ev.v : 0;
  const delta = income - spend + one + gain, before = R.bal;
  if (R.laid && R.eiLeft > 0) R.eiLeft--;
  R.bal += delta;
  R.hist.push({ m: R.m, ev: R.ev.k, act: k, delta, bal: R.bal, income, spend, one, gain, deferred });
  R.m++;
  $$('#rrHand .rr-card').forEach(c => { c.disabled = true; c.classList.toggle('chosen', c.dataset.k === k); c.classList.toggle('dim', c.dataset.k !== k); });
  showDelta(delta); tween($('#rrBal'), before, R.bal, money);
  Q().sfx(delta >= 0 ? 'coin' : 'bad');
  const done = R.bal < 0 || R.m >= 12;
  setTimeout(() => { if (done) end(R.bal >= 0); else startMonth(); }, reduce ? 300 : 1350);
  setTimeout(() => renderBoard(), 250); renderLog();
}
function end(win) {
  R.phase = 'end';
  const survived = win ? 12 : R.m - 1;
  const clutch = win && R.bal < .1 * R.B0;
  R.result = { win, survived, clutch };
  Q().sfx(win ? 'win' : 'lose'); if (win) Q().burst(220);
  emit('run', { win, months: survived, hard: R.hard, clutch });
  Q().say(win ? `They made it through the year with ${money(R.bal)} left. ${R.hard ? "And that was hard mode." : 'Try a fragile customer from the Rescue list next.'}` : `Out of money in ${MON[(R.start + R.m - 1) % 12]}. Try saving gig energy for after EI ends, or play a different hand.`, [], 7000);
  renderRun();
}
function showDelta(d) {
  const el = $('#rrDelta'); if (!el) return;
  el.textContent = sgn(d); el.className = 'rr-delta ' + (d >= 0 ? 'up' : 'down'); void el.offsetWidth; el.classList.add('on');
}
function flipTo(html) {
  const f = $('#rrFlip'); if (!f) return;
  if (reduce) { $('#rrEvent').innerHTML = html; f.classList.add('show'); return; }
  f.classList.remove('show');
  setTimeout(() => { $('#rrEvent').innerHTML = html; f.classList.add('show'); }, 260);
}
function eventHTML() {
  if (!R.ev) return '';
  const e = EV[R.ev.k], a = R.a;
  const amt = e.cost ? `<span class="rr-amt down">−${money(R.ev.v)}</span>` : e.gain ? `<span class="rr-amt up">+${money(R.ev.v)}</span>` : e.apply && R.ev.k !== 'layoff' && R.ev.k !== 'rehire' ? '<span class="rr-amt warn">Every month</span>' : '';
  return `<div class="ev ${e.tone}"><span class="ev-m">Month ${R.m + 1} · ${MON[(R.start + R.m) % 12]}</span><span class="ev-ic">${svg(e.ic)}</span><strong>${e.name}</strong><p>${esc(e.text(a, R.ev.v))}</p>${amt}</div>`;
}
function renderBoard() {
  const b = $('#rrBoard'); if (!b || !R) return;
  b.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const h = R.hist[i]; let cls = (i % 2 ? 'dk' : 'lt'), inner = '';
    if (h) { cls += h.bal < 0 ? ' lost' : ' done'; inner = `<span class="sq-ic">${svg(h.bal < 0 ? 'x' : 'check')}</span><span class="sq-b">${money(h.bal)}</span>`; }
    else if (i === R.m && R.phase !== 'end' && R.phase !== 'start') cls += ' now';
    return `<div class="sq ${cls}" title="${MON[(R.start + i) % 12]}"><span class="sq-m">${MON[(R.start + i) % 12]}</span>${inner}</div>`;
  }).join('');
}
function renderStats() {
  const s = $('#rrStats'); if (!s || !R) return;
  const a = R.a, income = R.laid ? (R.eiLeft > 0 ? a.I * .55 : 0) : a.I, spend = a.S + R.extra - R.trim - (R.deferLeft > 0 ? a.P : 0);
  const job = R.laid ? (R.eiLeft > 0 ? `<span class="pill warn">On EI, ${R.eiLeft} mo left</span>` : '<span class="pill crit">No income</span>') : '<span class="pill good">Employed</span>';
  const w = clamp(R.bal / (R.B0 * 1.4), 0, 1) * 100, tone = R.bal < .25 * R.B0 ? 'crit' : R.bal < .6 * R.B0 ? 'warn' : 'good';
  s.innerHTML = `<div class="rr-balance"><span class="k">Balance</span><span class="v" id="rrBal">${money(R.bal)}</span><span class="rr-delta" id="rrDelta"></span>
      <div class="rr-bar"><i style="width:${w}%;background:var(--${tone})"></i><b style="left:${100 / 1.4}%" title="Starting buffer"></b></div></div>
    <div><span class="k">Income</span><span class="v sm">${money(income)}</span>${job}</div>
    <div><span class="k">Spending</span><span class="v sm">${money(spend)}</span>${R.deferLeft > 0 ? `<span class="pill info">Loan paused ${R.deferLeft} mo</span>` : R.extra ? `<span class="pill warn">+${money(R.extra)} new costs</span>` : '<span class="pill">Typical</span>'}</div>
    <div><span class="k">Energy</span><span class="pips">${[0, 1, 2].map(i => `<i class="${i < R.energy ? 'on' : ''}">${svg('bolt')}</i>`).join('')}</span>${R.hard ? '<span class="pill crit">Hard mode</span>' : '<span class="pill">For gig work</span>'}</div>`;
}
function renderHand() {
  const h = $('#rrHand'); if (!h || !R) return;
  if (R.phase === 'start') {
    const ei = runway(R.a.B, R.a.I, R.a.S, { mult: .55 });
    h.innerHTML = `<div class="rr-intro"><h2>Survive 12 months</h2><p>Each month life deals a card. You answer with one move from your hand. The balance starts at this customer's buffer, ${money(R.a.B)}. If it drops below $0, the run ends.</p>
      <p class="small ink2">A layoff will come early. On paper this customer lasts <b>${CM.rwText(ei)} months</b> on EI.${R.hard ? ' That makes this <b>hard mode</b>.' : ''}</p>
      <button class="btn primary" type="button" id="rrGo">Deal month 1</button></div>`;
    $('#rrGo').onclick = () => { Q().sfx('tap'); startMonth(); };
    return;
  }
  if (R.phase === 'end') { h.innerHTML = ''; return; }
  h.innerHTML = R.hand.map((k, i) => `<button type="button" class="rr-card" data-k="${k}" style="--i:${i}"><span class="rc-ic">${svg(ACT[k].ic)}</span><strong>${ACT[k].name}</strong><span class="rc-t">${esc(ACT[k].text(R.a))}</span><span class="rc-go">Play this card</span></button>`).join('');
  $$('#rrHand .rr-card').forEach(c => {
    c.onclick = () => pick(c.dataset.k);
    if (!reduce && !matchMedia('(hover: none)').matches) {
      c.onpointermove = e => { const r = c.getBoundingClientRect(); c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 14).toFixed(1) + 'deg'); c.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - .5) * 10).toFixed(1) + 'deg'); };
      c.onpointerleave = () => { c.style.setProperty('--ry', '0deg'); c.style.setProperty('--rx', '0deg'); };
    }
  });
}
function renderLog() {
  const l = $('#rrLog'); if (!l || !R) return;
  if (!R.hist.length) { l.innerHTML = '<p class="small muted">Nothing yet. Deal the first month.</p>'; return; }
  l.innerHTML = R.hist.slice().reverse().map(h => `<div class="lg ${h.delta >= 0 ? 'up' : 'down'}"><span class="lg-m">${MON[(R.start + h.m) % 12]}</span><div><b>${EV[h.ev].name}</b><span>${ACT[h.act].name}${h.deferred ? ', loan paused' : ''}</span></div><span class="lg-d">${sgn(h.delta)}</span></div>`).join('');
}
function renderOver() {
  const o = $('#rrOver'); if (!o || !R) return;
  if (R.phase !== 'end') { o.hidden = true; return; }
  const { win, survived, clutch } = R.result;
  const grade = win && R.bal >= R.B0 ? ['Checkmate', 'They ended the year with more than they started.', 'good'] : win ? ['Survived', clutch ? 'By a thread. Less than 10% of the buffer left.' : 'Bruised, but still standing in December.', 'good'] : survived >= 6 ? ['So close', `Made it ${survived} months before the money ran out.`, 'warn'] : ['Knocked out', `Out of money after ${survived} month${survived === 1 ? '' : 's'}.`, 'crit'];
  const worst = R.hist.slice().sort((x, y) => x.delta - y.delta)[0];
  o.hidden = false;
  o.innerHTML = `<div class="ro-in ${grade[2]}"><span class="ro-ic">${svg(win ? 'star' : 'x')}</span><h2>${grade[0]}</h2><p>${grade[1]}</p>
    <div class="ro-stats"><div><b>${survived}/12</b><span>Months survived</span></div><div><b>${money(R.bal)}</b><span>Final balance</span></div><div><b>+${Math.min(120, survived * 10)}</b><span>XP earned</span></div></div>
    ${worst ? `<p class="small ink2">Hardest month: ${MON[(R.start + worst.m) % 12]}, ${worst.income === 0 ? 'EI had run out and no paycheque came in' : worst.one < 0 ? EV[worst.ev].name.toLowerCase() : 'spending ran ahead of income'} (${sgn(worst.delta)}).</p>` : ''}
    <div class="ro-act"><button class="btn primary" type="button" id="rrAgain">Play again</button><button class="btn" type="button" id="rrNew">Random customer</button><button class="btn" type="button" id="rrPlan">Build their plan</button></div></div>`;
  $('#rrAgain').onclick = () => newRun();
  $('#rrNew').onclick = () => { const ids = CM.ids; CM.setAccount(ids[Math.floor(Math.random() * ids.length)]); };
  $('#rrPlan').onclick = () => CM.go('plan');
}
function renderRun(keepCard) {
  if (!R) return;
  renderBoard(); renderStats(); renderHand(); renderLog(); renderOver();
  if (!keepCard) {
    const f = $('#rrFlip');
    if (R.phase === 'start') { f.classList.remove('show'); }
    else if (R.ev) { $('#rrEvent').innerHTML = eventHTML(); f.classList.add('show'); }
  }
}

/* ================= WHO LASTS LONGER? ================= */
const QZ = { streak: 0, best: store.get('cm.quiz.best', 0), right: 0, total: 0, pair: null, picked: null };
const eiOf = a => { const v = runway(a.B, a.I, a.S, { mult: .55 }).v; return v === Infinity ? 120 : v; };
function newPair() {
  const D = CM.builtin, ids = Object.keys(D).map(Number);
  let best = null;
  for (let t = 0; t < 300; t++) {
    const x = ids[Math.floor(Math.random() * ids.length)], y = ids[Math.floor(Math.random() * ids.length)];
    if (x === y) continue;
    const rx = eiOf(D[x]), ry = eiOf(D[y]);
    if (rx >= 120 && ry >= 120) continue;
    if ((rx > 30 || ry > 30) && Math.random() < .85) continue;
    if (Math.abs(rx - ry) < 1.5 || D[x].I <= 0 || D[y].I <= 0) continue;
    const paradox = (D[x].I - D[y].I) * (rx - ry) < 0;
    best = [x, y];
    if (paradox || Math.random() < .3) break;
  }
  QZ.pair = (best || ids.slice(0, 2)).map(id => ({ id, a: Object.assign({ id }, D[id]), r: eiOf(D[id]) }));
  QZ.picked = null; renderQuiz();
}
function guess(i) {
  if (QZ.picked != null) return;
  QZ.picked = i; const win = QZ.pair[i].r >= QZ.pair[1 - i].r;
  QZ.total++; if (win) { QZ.right++; QZ.streak++; } else QZ.streak = 0;
  if (QZ.streak > QZ.best) { QZ.best = QZ.streak; store.set('cm.quiz.best', QZ.best); }
  Q().sfx(win ? 'coin' : 'bad'); if (win && QZ.streak && QZ.streak % 5 === 0) Q().burst(90);
  emit('quiz', { correct: win, streak: QZ.streak });
  renderQuiz();
}
function qcard(p, i) {
  const a = p.a, done = QZ.picked != null, winner = done && p.r >= QZ.pair[1 - i].r, chosen = QZ.picked === i;
  const rv = p.r >= 120 ? '120+' : p.r.toFixed(1), w = clamp(p.r / 24, 0, 1) * 100;
  return `<div class="qc${done ? ' done' : ''}${chosen ? ' chosen' : ''}${winner ? ' winner' : ''}">
    <div class="wcard neutral" data-tilt>
      <div class="wc-top"><span class="lg">Account ${a.id}</span><span class="wc-glass">${a.joint ? 'Joint' : 'Solo'}${a.age != null ? `, ${a.age}` : ''}</span></div>
      <div class="wc-mid"><small>Money in each month</small><strong>${money(a.I)}</strong></div>
      <div class="wc-bot"><div><div>Spends ${Math.round(a.S / a.I * 100)}% of it</div></div><div class="rw"><span>Buffer</span><b>${money(a.B)}</b></div></div>
      ${winner ? '<span class="qc-crown" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z"/></svg></span>' : ''}
    </div>
    ${done ? `<div class="qc-rev"><div class="qc-n"><span>${rv}</span> months on EI</div><div class="qc-bar"><i style="--w:${w}%;background:var(--${p.r >= 6 ? 'good' : p.r >= 3 ? 'warn' : 'crit'})"></i><b style="left:${6 / 24 * 100}%"></b></div></div>`
      : `<button class="btn primary qc-pick" type="button" data-i="${i}">This one lasts longer</button>`}
  </div>`;
}
function renderQuiz() {
  if (!QZ.pair) return newPair();
  $('#quizScore').innerHTML = `<div><b>${QZ.streak}</b><span>Streak</span></div><div><b>${QZ.best}</b><span>Best</span></div><div><b>${QZ.total ? Math.round(QZ.right / QZ.total * 100) + '%' : '—'}</b><span>Correct</span></div>`;
  $('#quizPair').innerHTML = qcard(QZ.pair[0], 0) + '<span class="qvs">vs</span>' + qcard(QZ.pair[1], 1);
  $$('#quizPair .qc-pick').forEach(b => b.onclick = () => guess(+b.dataset.i));
  $$('#quizPair [data-tilt]').forEach(el => {
    if (reduce || matchMedia('(hover: none)').matches) return;
    el.onpointermove = e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg'); el.style.setProperty('--gx', ((x + .5) * 100) + '%'); el.style.setProperty('--gy', ((y + .5) * 100) + '%'); el.classList.add('lit'); };
    el.onpointerleave = () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); el.classList.remove('lit'); };
  });
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#quizPair .qc-bar i').forEach(i => i.style.width = i.style.getPropertyValue('--w'))));
  const f = $('#quizFoot');
  if (QZ.picked == null) { f.innerHTML = '<p class="ink2">Hint: income tells you how much flows through an account. It does not tell you how long the buffer lasts.</p>'; return; }
  const [p, q] = QZ.pair, hi = p.a.I >= q.a.I ? p : q, lo = hi === p ? q : p, win = QZ.pair[QZ.picked].r >= QZ.pair[1 - QZ.picked].r;
  const para = hi.r < lo.r;
  const gap = x => Math.max(x.a.S - .55 * x.a.I, 0);
  f.innerHTML = `<div class="verdict ${win ? 'good' : 'crit'}"><svg viewBox="0 0 24 24">${IC[win ? 'check' : 'x']}</svg><div><strong>${win ? (QZ.streak >= 3 ? `Right. ${QZ.streak} in a row.` : 'Right.') : 'Not this time.'}</strong>
    <p>${para ? `The paradox again: account ${hi.id} brings in ${money(hi.a.I - lo.a.I)} more a month, but on EI it falls ${money(gap(hi))} short each month, so its buffer lasts ${hi.r.toFixed(1)} months against ${lo.r >= 120 ? '120+' : lo.r.toFixed(1)}.`
      : `Here the bigger paycheque also lasts longer: account ${hi.id}'s buffer covers its EI gap of ${money(gap(hi))} for ${hi.r >= 120 ? '120+' : hi.r.toFixed(1)} months.`}</p></div></div>
    <button class="btn primary" type="button" id="qzNext">Next pair</button>`;
  $('#qzNext').onclick = () => { Q().sfx('tap'); newPair(); };
}

/* ================= PLAY VIEW ================= */
function setTab(t) {
  store.set('cm.playTab', t);
  $$('#playTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t)));
  $('#playRun').hidden = t !== 'run'; $('#playQuiz').hidden = t !== 'quiz';
  if (t === 'quiz') renderQuiz(); else if (!R || R.a.id !== CM.st.id) newRun(); else renderRun();
}
let bound = false;
on('view', ({ view }) => {
  if (view !== 'play') return;
  if (!bound) { bound = true; $$('#playTabs button').forEach(b => b.onclick = () => { Q().sfx('tap'); setTab(b.dataset.t); }); }
  setTab(store.get('cm.playTab', 'run'));
});
on('account', () => { if (CM.view === 'play' || R) setTimeout(() => { newRun(); }, 0); });

/* ================= COIN TOWER (Shock lab) ================= */
let coins = null;
on('shock', d => {
  if (CM.view !== 'shock' && !$('#coin3d')?.offsetParent) return;
  const a = CM.acc(); if (!a) return;
  if (!coins && D3.mountCoins && $('#coin3d')) coins = D3.mountCoins($('#coin3d'));
  const r = runway(a.B, a.I, a.S, CM.shockParams(a, CM.st.shock)), need = d.need || 6;
  const inf = r.v === Infinity, n = inf ? 24 : Math.min(24, Math.floor(r.v));
  if (coins) coins.set(n, inf ? 0 : need);
  const t = $('#coinTitle'), x = $('#coinText'); if (!t) return;
  if (inf) { t.textContent = 'The tower never shrinks.'; x.textContent = 'Money in still covers spending after this shock, so the buffer is never drawn down. Every coin stays put.'; }
  else if (r.v === 0) { t.textContent = 'No coins left on day one.'; x.textContent = `The one-off cost is bigger than the whole buffer. All ${need} red coins are months nobody is paying for.`; }
  else if (r.v >= need) { t.textContent = `${r.v >= 24 ? '24+' : r.v.toFixed(1)} months covered. ${need} needed.`; x.textContent = `Each coin is one month of the ${money(r.gap)} monthly gap. The tower clears the ${need}-month mark with ${(r.v - need).toFixed(1)} months to spare.`; }
  else { t.textContent = `${r.v.toFixed(1)} months covered. ${need} needed.`; x.textContent = `Each coin pays for one month of the ${money(r.gap)} gap. The red ghosts are the ${Math.ceil(need - r.v)} months the buffer can't reach. Filling them takes about ${money(r.gap * need - r.left)}.`; }
});
})();
