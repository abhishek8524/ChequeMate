/* ChequeMate (iOS UI) live layer.
   The iOS pages answer instantly in the browser; this file asks the FastAPI backend (TigerData) the same
   question and shows the server's answer beside it, so every figure on Customer and Shock lab is checked live.
   It also applies twists linked from the landing page (?twist=ei|furnace|combo). */
(() => {
'use strict';
const CM = window.ChequeMate, API = window.CMApi;
if (!CM || !API) return;
const $ = (s, r = document) => r.querySelector(s);
const ios = () => document.documentElement.getAttribute('data-ui') !== 'rr';
const { esc, money } = CM;
const n = v => Number(v);

/* ---------- landing-page twist ---------- */
const D = window.CM_DEEP || {}, MAP = { ei: 'layoff', furnace: 'furnace', combo: 'combo', none: 'none' };
if (ios() && D.twist && MAP[D.twist]) CM.applyPreset(MAP[D.twist]);

/* ---------- helpers ---------- */
const months = r => r.status === 'buffer_exhausted' ? '0 months' : (r.status === 'no_shortfall' || r.status === 'capped') ? 'no shortfall' : `${r.runway_months} months`;
const same = (local, r) => {
  if (r.status === 'buffer_exhausted') return local.v === 0;
  if (r.status === 'no_shortfall' || r.status === 'capped') return local.v === Infinity || local.v >= 120;
  return Math.abs(local.v - n(r.runway_months)) < 0.05;
};
function strip(host, after, cls, html) {
  if (!host) return;
  let el = host.querySelector(':scope > .live-check');
  if (!el) { el = document.createElement('div'); el.setAttribute('role', 'status'); (after && after.parentNode === host ? after : host.firstElementChild).insertAdjacentElement('afterend', el); }
  el.className = 'live-check ' + cls; el.innerHTML = html;
}
const offline = e => `<span class="lc-dot"></span><div><b>Server not reachable</b><span>${esc(API.describe(e))} You're seeing the in-app calculation on saved sample data.</span></div>`;
const waiting = `<span class="lc-dot"></span><div><b>Checking with the live server…</b></div>`;
/* exact decimal string for k × S (k in ½, 1, 2) without floating-point drift */
function mulS(S, k) {
  const [i, f = ''] = String(S).split('.'), f10 = (f + '0000000000').slice(0, 10), big = BigInt(i + f10) * BigInt(Math.round(k * 2)) / 2n;
  const s = big.toString().padStart(11, '0'); return s.slice(0, -10) + '.' + s.slice(-10);
}

/* ---------- Customer: the six numbers ---------- */
let gC = 0;
function customer() {
  if (!ios() || CM.view !== 'customer') return;
  const a = CM.acc(); if (!a) return; const g = ++gC, host = $('section[data-view="customer"]'), head = host && host.querySelector('.head');
  strip(host, head, 'wait', waiting);
  API.account(a.id).then(m => {
    if (g !== gC) return;
    const keys = [['I', 'money in'], ['S', 'money out'], ['F', 'fixed costs'], ['H', 'household bills'], ['B', 'savings'], ['P', 'loan payment']];
    const off = keys.filter(([k]) => Math.abs(n(m[k]) - (a[k] || 0)) > 1);
    strip(host, head, off.length ? 'warn' : 'ok', `<span class="lc-dot"></span><div><b>${off.length ? 'Live records differ' : 'Matches your live account records'}</b><span>${keys.map(([k, l]) => `${l} ${money(n(m[k]))}`).join(' · ')}</span></div><em>TigerData · live</em>`);
  }, e => { if (g === gC) strip(host, head, 'off', offline(e)); });
}

/* ---------- Shock lab: the runway ---------- */
let gS = 0;
function shock() {
  if (!ios() || CM.view !== 'shock') return;
  const a = CM.acc(); if (!a) return; const sh = CM.st.shock, g = ++gS, host = $('#verdict') && $('#verdict').parentNode, anchor = $('#verdict');
  const local = CM.runway(a.B, a.I, a.S, CM.shockParams(a, sh));
  strip(host, anchor, 'wait', waiting);
  API.account(a.id).then(m => {
    const body = { account_id: a.id, income_retained_pct: String(sh.inc), bills_increase_pct: String(sh.bills), extra_monthly_cost: String(sh.extra),
      one_off_cost: sh.oneMult != null ? mulS(m.S, sh.oneMult) : String(sh.one || 0) };
    return API.simulate(body);
  }).then(r => {
    if (g !== gS) return;
    const ok = same(local, r), gap = n(r.calculation_breakdown && r.calculation_breakdown.gap_exact);
    strip(host, anchor, ok ? 'ok' : 'warn', `<span class="lc-dot"></span><div><b>${ok ? 'Server agrees' : 'Server answer differs. Trust this one'}: ${esc(months(r))}</b><span>${isFinite(gap) && gap > 0 ? `Savings fall by ${money(gap)} a month after the shock. ` : ''}Worked out on the server with exact decimals, from your live records.</span></div><em>/api/simulate</em>`);
  }, e => { if (g === gS) strip(host, anchor, 'off', offline(e)); });
}

document.addEventListener('cm:shock', () => setTimeout(shock, 0));
document.addEventListener('cm:view', e => { const v = e.detail && e.detail.view; setTimeout(() => { if (v === 'customer') customer(); if (v === 'shock') shock(); }, 0); });
document.addEventListener('cm:account', () => setTimeout(() => { customer(); shock(); }, 30));
})();
