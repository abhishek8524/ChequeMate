/* ChequeMate live integration: renders backend (FastAPI → TigerData) results on Overview and Your data.
   Rules: every financial figure shown in live mode comes from an API response; the browser only formats it.
   A live failure shows an error state, never bundled numbers. Offline mode is labelled as bundled demo data. */
(() => {
'use strict';
const CM = window.ChequeMate, RR = window.RR, API = window.CMApi;
if (!CM || !RR || !API) return;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { esc, store } = CM;
const num = v => (v == null || v === '' ? NaN : Number(v)); // display/chart only
const fmt = v => { const n = num(v); return isFinite(n) ? (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; };
const fmt0 = v => { const n = num(v); return isFinite(n) ? (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-CA') : '—'; };
const pctTxt = v => { const n = num(v); return isFinite(n) ? (Math.round(n * 10) / 10) + '%' : '—'; };

/* ---------------- state ---------------- */
const L = { mode: 'checking', why: '', id: null, acct: {}, gen: 0, unbundled: false };
const POST_KEY = 'cm.rr.post', TARGET_KEY = 'cm.rr.target';
let post = store.get(POST_KEY, 0); // shown as a selected choice the user can change; never assumes income returns
let target = store.get(TARGET_KEY, 6);
let breathCut = store.get('cm.rr.cut', 500);

/* ---------------- banner ---------------- */
function banner() {
  let b = $('#rrLive');
  if (!b) { b = document.createElement('div'); b.id = 'rrLive'; b.className = 'rr-live'; b.setAttribute('role', 'status'); ($('header.toolbar') || $('#rrJump')).after(b); }
  const live = L.mode === 'live';
  root().setAttribute('data-src', live ? 'live' : 'offline');
  b.className = 'rr-live ' + (live ? 'ok' : L.mode === 'checking' ? 'wait' : 'off');
  b.innerHTML = live ? `<span class="dot"></span><b>Live data</b><span>Numbers come straight from your account records and are calculated fresh for every change you make.</span>`
    : L.mode === 'checking' ? `<span class="dot"></span><b>Connecting to your account records…</b>`
    : `<span class="dot"></span><b>Sample data</b><span>We couldn't reach your live account records, so you're seeing saved sample data. ${esc(L.why)}</span><button type="button" id="rrRetry">Retry live</button><button type="button" id="rrApiSet">API address</button>`;
  const r = $('#rrRetry'); if (r) r.onclick = () => { API.clearCache(); check(); };
  const s = $('#rrApiSet'); if (s) s.onclick = () => { const u = prompt('Server address', API.base); if (u) { API.setBase(u); check(); } };
}
const root = () => document.documentElement;

async function check() {
  L.mode = 'checking'; banner();
  try { await API.health(); L.mode = 'live'; L.why = ''; }
  catch (e) { L.mode = 'offline'; L.why = API.describe(e); }
  banner();
  if (L.mode === 'live') loadAccount(L.id || CM.st.id);
  const v = CM.view; if (RR.RENDER[v]) RR.RENDER[v]();
}

/* ---------------- account loading (stale-safe) ---------------- */
function loadAccount(id) {
  id = +id; if (!id) return;
  L.id = id; const gen = ++L.gen;
  const A = L.acct[id] || (L.acct[id] = {});
  const settle = (k, p) => p.then(v => { A[k] = { ok: true, v }; }, e => { A[k] = { ok: false, e }; }).then(() => { if (gen === L.gen && L.id === id) rerender(); });
  if (!A.metrics || !A.metrics.ok) { A.metrics = null; settle('metrics', API.account(id)); }
  if (!A.profile || !A.profile.ok) { A.profile = null; settle('profile', API.profile(id)); }
  if (!A.insights || !A.insights.ok) { A.insights = null; settle('insights', API.insights(id)); }
  if (!A.lookalikes || !A.lookalikes.ok) { A.lookalikes = null; settle('lookalikes', API.lookalikes(id)); }
  rerender();
}
let rrT;
function rerender() { clearTimeout(rrT); rrT = setTimeout(() => { const v = CM.view; if (L.mode === 'live' && RR.RENDER[v]) RR.RENDER[v](); }, 30); }
const A = () => L.acct[L.id] || {};
const M = () => { const m = A().metrics; return m && m.ok ? m.v : null; };

/* Gold stores some values with float residue (e.g. 2132.9750000000004); the API accepts at most 10 decimal
   places, so round the decimal STRING half-up to 10 places (exact string/BigInt arithmetic, no floats). */
function dec10(v) {
  let s = String(v).trim(); const neg = s.startsWith('-'); if (neg) s = s.slice(1);
  const [ip, fp = ''] = s.split('.'); if (fp.length <= 10) return (neg ? '-' : '') + s;
  const scaled = BigInt(ip + fp.slice(0, 10)) + (fp.charCodeAt(10) - 48 >= 5 ? 1n : 0n);
  const t = scaled.toString().padStart(11, '0');
  return (neg ? '-' : '') + t.slice(0, -10) + '.' + t.slice(-10);
}
/* ---------------- request bodies (never send I, S, F, H, B or P) ---------------- */
function scenario(extra = {}) {
  const s = RR.SIT(), m = M();
  const body = { account_id: L.id,
    income_retained_pct: s.job.on ? s.job.ei : 100,
    bills_increase_pct: s.bills.on ? s.bills.pct : 0,
    one_off_cost: s.repair.on ? (s.repair.amt == null ? dec10(m.S) : String(s.repair.amt)) : 0,
    extra_monthly_cost: s.monthly.on ? s.monthly.amt : 0 };
  return Object.assign(body, extra);
}
const sitText = () => { const s = RR.SIT(), m = M(); return [s.job.on && `job loss, ${s.job.ei}% of money in kept`, s.bills.on && `household bills +${s.bills.pct}%`, s.repair.on && `one-off cost ${fmt0(s.repair.amt == null ? m.S : s.repair.amt)}${s.repair.amt == null ? ' (one month of money out, S)' : ''}`, s.monthly.on && `new cost ${fmt0(s.monthly.amt)}/month`].filter(Boolean); };

/* ---------------- status helpers (API statuses, never Infinity) ---------------- */
function status(r) {
  if (!r) return ['wait', '…', 'Loading'];
  if (r.status === 'buffer_exhausted') return ['critical', '✕', 'Critical'];
  if (r.status === 'no_shortfall' || r.status === 'capped') return ['stable', '✓', 'Stable'];
  const v = r.runway_months; return v >= 6 ? ['stable', '✓', 'Stable'] : v >= 3 ? ['watch', '!', 'Watch'] : ['critical', '✕', 'Critical'];
}
const badge = r => { const [c, i, l] = status(r); return `<span class="rr-status ${c}"><i aria-hidden="true">${i}</i>${l}</span>`; };
const headline = r => r.status === 'buffer_exhausted' ? '0 months' : r.status === 'no_shortfall' ? 'No shortfall' : r.status === 'capped' ? '10+ years' : r.runway_display;
const statusLine = r => ({ buffer_exhausted: 'The surprise cost is bigger than your savings, so they run out right away.', no_shortfall: 'Money in still covers money out, so your savings never run down.', capped: 'Your savings would last more than 10 years.', shortfall: `Your savings last ${r.runway_display}, falling by ${fmt(r.monthly_shortfall)} each month.` })[r.status] || '';

/* ---------------- visual helpers (display only; values come from API responses) ---------------- */
const SIT_IC = {
  job: '<svg viewBox="0 0 24 24"><rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17"/></svg>',
  bills: '<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9 8h6M9 11.5h6M9 15h3.5"/></svg>',
  repair: '<svg viewBox="0 0 24 24"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.3-.7-.7-2.3z"/></svg>',
  monthly: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4M12 13v4M10 15h4"/></svg>',
};
function meter(r, mark, cap = 12) {
  if (!r) return '';
  const full = r.status === 'no_shortfall' || r.status === 'capped', v = full ? cap : Math.min(cap, r.runway_months), [c] = status(r);
  return `<div class="rr-meter ${c}" role="img" aria-label="Savings last ${esc(headline(r))}"><div class="tk"><i style="--w:${(v / cap * 100).toFixed(1)}%"></i>${mark && mark <= cap ? `<b class="mk" style="left:${mark / cap * 100}%"><span>Month ${mark}</span></b>` : ''}</div>
    <div class="sc">${[0, 3, 6, 9, 12].map(m => `<span style="left:${m / cap * 100}%">${m}${m === cap ? '+ mo' : ''}</span>`).join('')}</div></div>`;
}
function ring(score, size = 132) {
  const n = num(score), r = size / 2 - 10, C = 2 * Math.PI * r, p = isFinite(n) ? Math.max(0, Math.min(100, n)) / 100 : 0;
  return `<svg class="rr-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Score ${isFinite(n) ? esc(score) : 'unavailable'} out of 100">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" style="--c:${C.toFixed(1)};--o:${(C * (1 - p)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"><tspan class="n" data-count="${isFinite(n) ? n : ''}">${isFinite(n) ? esc(score) : '—'}</tspan></text></svg>`;
}
function spark(history) {
  const rows = (history || []).slice(-12); if (rows.length < 2) return '';
  const W = 240, H = 44, ins = rows.map(r => num(r.money_in)), outs = rows.map(r => num(r.money_out)), mx = Math.max(...ins, ...outs, 1);
  const pts = arr => arr.map((v, i) => `${(i / (arr.length - 1) * W).toFixed(1)},${(H - 3 - v / mx * (H - 6)).toFixed(1)}`).join(' ');
  return `<svg class="rr-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Money in and out, last ${rows.length} months"><polyline points="${pts(outs)}" class="out"/><polyline points="${pts(ins)}" class="in"/></svg>
    <div class="rr-spark-l"><span><i class="in"></i>Money in</span><span><i class="out"></i>Money out</span><span>last ${rows.length} months</span></div>`;
}
const reduceAnim = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root().getAttribute('data-motion') === 'reduce';
function countUp(scope) {
  if (!scope || reduceAnim()) return;
  $$('[data-count]', scope).forEach(el => {
    const to = Number(el.dataset.count); if (!isFinite(to) || el.dataset.done) return; el.dataset.done = 1;
    const final = el.textContent, dec = (final.split('.')[1] || '').replace(/\D/g, '').length, money = final.trim().startsWith('$') || final.includes('$');
    const t0 = performance.now(), dur = 700;
    const step = t => { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 3));
      el.textContent = k >= 1 ? final : (money ? (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-CA', { maximumFractionDigits: 0 }) : v.toFixed(dec)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
const cnt = v => `<span data-count="${num(v)}">${fmt0(v)}</span>`;
function flow(r) {
  const b = r.calculation_breakdown || {}, inc = num(b.income_after_exact), out = num(b.outflow_after_exact), sav = num(b.buffer_after_exact), gap = num(b.gap_exact), mx = Math.max(inc, out, 1);
  return `<div class="rr-flow">
    <div class="row"><span>Money in</span><span class="bar"><i class="in" style="--w:${(inc / mx * 100).toFixed(1)}%"></i></span><b>${fmt0(inc)}</b></div>
    <div class="row"><span>Money out</span><span class="bar"><i class="out" style="--w:${(out / mx * 100).toFixed(1)}%"></i></span><b>${fmt0(out)}</b></div>
    <div class="eq"><div><small>Savings to start</small><b>${fmt0(sav)}</b></div><span class="op">÷</span><div><small>${gap > 0 ? 'Falls each month' : 'Gap each month'}</small><b>${gap > 0 ? fmt0(gap) : 'None'}</b></div><span class="op">=</span><div class="res ${status(r)[0]}"><small>Savings last</small><b>${esc(headline(r))}</b></div></div>
    <details class="rr-exact"><summary>Show exact numbers</summary>${breakdown(r)}</details></div>`;
}

const loading = t => `<div class="rr-skel" role="status"><span class="spin" aria-hidden="true"></span>${esc(t || 'Loading live results…')}</div>`;
const errBox = (e, retry) => `<div class="rr-err-box" role="alert"><b>Live result unavailable</b><p>${esc(API.describe(e))}</p>${retry ? '<button type="button" class="rr-btn2" data-live-retry>Retry</button>' : ''}</div>`;
const prov = t => `<span class="rr-prov" title="${esc(t)}">${t.startsWith('Live') ? '● ' : '○ '}${esc(t)}</span>`;

/* ---------------- charts (coordinates only) ---------------- */
function projChart(el, startBal, rows, base0, baseRows, supportMonths, months = 12) {
  const after = [num(startBal), ...rows.slice(0, months).map(r => num(r.projected_balance))];
  const before = [num(base0), ...baseRows.slice(0, months).map(r => num(r.projected_balance))];
  const W = Math.max(300, el.clientWidth || 760), H = 218, Lp = 50, R = 12, T = 18, B = 26, n = months;
  const all = [...before, ...after, 0].filter(isFinite), lo = Math.min(...all), hi = Math.max(...all), st = RR.niceStep(hi - lo || 1), y0 = Math.floor(lo / st) * st, y1 = Math.ceil(hi / st) * st;
  const X = k => Lp + (W - Lp - R) * k / n, Y = v => T + (H - T - B) * (1 - (v - y0) / ((y1 - y0) || 1));
  const path = arr => arr.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const ink = RR.isDark() ? '#C0D6EA' : '#11425D';
  let g = `<rect x="${Lp}" y="${Y(0)}" width="${W - Lp - R}" height="${Math.max(0, Y(y0) - Y(0))}" fill="var(--rr-inner-2)"/>`;
  for (let v = y0; v <= y1 + 1e-6; v += st) g += `<line x1="${Lp}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? 'var(--rr-slate)' : 'var(--rr-line)'}"/><text x="${Lp - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--rr-sub)">${RR.kfmt(v)}</text>`;
  for (let k = 0; k <= n; k += 2) g += `<text x="${X(k)}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">${k}</text>`;
  if (supportMonths && supportMonths <= n) g += `<line x1="${X(supportMonths)}" x2="${X(supportMonths)}" y1="${T - 6}" y2="${H - B}" stroke="var(--rr-slate)" stroke-dasharray="3 4"/><text x="${X(supportMonths) + 6}" y="${H - B - 6}" font-size="10.5" fill="var(--rr-sub)">Month ${supportMonths}</text>`;
  g += `<path d="${path(before)}" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="${path(after)}" fill="none" stroke="${ink}" stroke-width="2.5" stroke-dasharray="7 6"/>`;
  if (after.length - 1 < n) { const k = after.length - 1; g += `<circle cx="${X(k)}" cy="${Y(after[k])}" r="5" fill="#fff" stroke="${ink}" stroke-width="2"/><text x="${X(k) + 8}" y="${Y(after[k]) - 8}" font-size="10.5" fill="var(--rr-ink)">savings run out</text>`; }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Projected savings: today (solid) and with your situations (dashed)">${g}</svg>`;
}

/* ================= OVERVIEW (live) ================= */
let ovGen = 0, adjustOpen = false, breakdownOpen = false;
function liveOverview() {
  const gen = ++ovGen, a = A(), m = M(), id = L.id;
  const tiles = ['#rrChequing', '#rrSavings', '#rrSummary', '#rrRunway', '#rrBreath', '#rrFinding', '#rrFund', '#rr-job', '#rr-steps'];
  if (!a.metrics) { tiles.forEach(t => { const el = $(t); if (el) el.innerHTML = loading(`Loading account ${id} from the database…`); }); return; }
  if (!a.metrics.ok) { tiles.forEach((t, i) => { const el = $(t); if (el) el.innerHTML = i === 0 ? errBox(a.metrics.e, true) : `<p class="rr-small">No live results for account ${esc(id)}.</p>`; }); bindRetry(); return; }
  const pr = a.profile && a.profile.ok ? a.profile.v.profile : null;
  const fact = (k, v, d) => `<div><small>${k}</small><b>${fmt0(v)}</b><span>${d}</span></div>`;
  $('#rrChequing').innerHTML = `<div class="rr-tile-head"><h2>Account ${esc(id)}</h2>${prov('Live account data')}</div>
    <div class="rr-bal"><small>Money in, typical month</small><strong>${cnt(m.I)}</strong></div>
    <div class="rr-pair"><div><small>Money out, typical month</small><b>${fmt0(m.S)}</b></div><div><small>Bills, insurance and loan</small><b>${fmt0(m.F)}</b></div></div>
    <div class="rr-line"><span>Household bills · Loan payment</span><b>${fmt0(m.H)} · ${fmt0(m.P)}</b></div>
    ${a.insights && a.insights.ok ? spark(a.insights.v.insights.history) : ''}
    <p class="rr-small">A typical month from your history. Bills and the loan payment are already part of money out.${pr ? ` ${esc([pr.district_name, pr.region].filter(Boolean).join(', '))}.` : a.profile && !a.profile.ok ? ' Profile unavailable.' : ''}</p>`;
  $('#rrSavings').innerHTML = `<div class="rr-tile-head"><h2>Your savings</h2>${prov('Live account data')}</div>
    <div class="rr-bal"><small>Average balance over the last 6 months</small><strong>${cnt(m.B)}</strong></div>
    ${num(m.B) < 0 ? '<p class="rr-small">Below zero: the account has averaged an overdraft lately.</p>' : ''}
    <div class="rr-line"><span>If you kept 55% of money in</span><b id="rrRefShock">${a.insights ? (a.insights.ok ? esc(headline(a.insights.v.score.reference_shock)) : 'unavailable') : '…'}</b></div>
    <p class="rr-small">How long your savings last if money in dropped to 55%. A what-if, not an EI eligibility estimate.</p>
    <div class="rr-btns"><button class="rr-btn2" type="button" data-go="yourdata">Score and history</button><button class="rr-btn2" type="button" data-go="saving">Plan your safety net</button></div>`;

  // Overview summary: score + reference shock, then the way into the journey
  const ins = a.insights;
  $('#rrSummary').innerHTML = !ins ? `<div class="rr-tile-head"><h2>Your resilience at a glance</h2></div>${loading('Loading score…')}`
    : !ins.ok ? `<div class="rr-tile-head"><h2>Your resilience at a glance</h2></div>${errBox(ins.e, true)}`
    : (() => { const sc = ins.v.score, ref = sc.reference_shock; return `<div class="rr-tile-head"><h2>Your resilience at a glance</h2>${badge(ref)}</div>
      <div class="rr-sum"><div class="rr-ringwrap">${sc.score == null ? `<b class="na">Incomplete</b><span>${esc(sc.available_points)} of ${esc(sc.available_maximum)} points</span>` : `${ring(sc.score)}<span>Experimental score</span>`}</div><div class="rr-sum-r">
      <p class="rr-big-answer">If you kept 55% of your money in, your savings would last <b>${esc(headline(ref))}</b>.</p>${meter(ref, 6)}</div></div>
      <p class="rr-hint">${esc(sc.label)} The 55% shock is hypothetical, not an EI eligibility estimate.</p>
      <div class="rr-btns"><a class="rr-btn" href="#situations">Test a situation →</a><a class="rr-btn2" href="#saving">Build your plan</a><a class="rr-btn2" href="#yourdata">Score details</a></div>`; })();

  // Looking ahead (constant shock + temporary-support projection)
  const s = RR.SIT();
  const chip = (k, label) => `<button class="rr-chip rr-sitcard" type="button" data-sit="${k}" aria-pressed="${s[k].on}"><span class="ic" aria-hidden="true">${SIT_IC[k]}</span><span class="rr-sitlb">${label}</span><span class="ck" aria-hidden="true">${s[k].on ? '✓' : '+'}</span></button>`;
  const postSel = `<div class="rr-post" role="group" aria-label="After the temporary support ends"><span>After month ${s.job.mo}, money in is:</span>${[[0, 'Nothing'], [s.job.ei, `Still ${s.job.ei}%`], [100, 'Back to normal']].map(([v, l]) => `<button type="button" data-post="${v}" aria-pressed="${post === v}">${l}</button>`).join('')}</div>`;
  $('#rrRunway').innerHTML = `<div class="rr-tile-head"><h2>Looking ahead with confidence</h2><div class="rr-btns" style="align-items:center;gap:10px"><b id="rrHead" style="font:700 18px var(--rr-font)">…</b><span id="rrBadge">${badge(null)}</span></div></div>
    <div class="rr-sits"><span>Situations:</span>${chip('job', `Job loss · keep ${s.job.ei}% for ${s.job.mo} mo`)}${chip('bills', `Bills up ${s.bills.pct}%`)}${chip('repair', s.repair.on ? `Surprise repair · ${fmt0(s.repair.amt == null ? m.S : s.repair.amt)}` : 'Surprise repair')}${chip('monthly', s.monthly.on ? `New monthly cost · ${fmt0(s.monthly.amt)}` : 'New monthly cost')}<button class="rr-adjust" type="button" id="rrAdjust" aria-expanded="${adjustOpen}">Adjust sizes</button></div>
    <div class="rr-adjust-panel" id="rrAdjustPanel"${adjustOpen ? '' : ' hidden'}>
      <div class="rr-field"><label for="rrEi">Money in kept (hypothetical) <output>${s.job.ei}%</output></label><input class="rr-range" type="range" id="rrEi" min="0" max="100" step="5" value="${s.job.ei}"></div>
      <div class="rr-field"><label for="rrEiMo">Temporary support lasts <output>${s.job.mo} months</output></label><input class="rr-range" type="range" id="rrEiMo" min="1" max="12" step="1" value="${s.job.mo}"></div>
      <div class="rr-field"><label for="rrBillsPct">Household bills up <output>${s.bills.pct}%</output></label><input class="rr-range" type="range" id="rrBillsPct" min="0" max="60" step="5" value="${s.bills.pct}"></div>
      <div class="rr-field"><label for="rrRepair">Surprise repair ($, blank = one month of S)</label><input type="number" id="rrRepair" min="0" step="50" value="${s.repair.amt == null ? '' : s.repair.amt}" placeholder="${esc(m.S)}"></div>
      <div class="rr-field"><label for="rrMonthly">New monthly cost ($)</label><input type="number" id="rrMonthly" min="0" step="25" value="${s.monthly.amt}"></div>
      <p class="rr-small" style="grid-column:1/-1">Bills can go up here, not down.</p>
    </div>
    ${s.job.on ? postSel : ''}
    <div id="rrMeter" class="rr-meter-host"></div>
    <div class="rr-chart" id="rrAheadChart">${loading()}</div>
    <div class="rr-tile-foot"><div class="rr-legend"><span><i></i>Today</span><span><i class="dash"></i>With your situations</span></div><b id="rrMsg"></b></div>
    <div class="rr-btns"><button class="rr-btn2" type="button" id="rrBreakBtn" aria-expanded="${breakdownOpen}">${breakdownOpen ? 'Hide' : 'Show'} how it works</button><button class="rr-btn2" type="button" id="rrExplainBtn">Explain this result</button>${prov('Live calculation')}</div>
    <div id="rrBreak"${breakdownOpen ? '' : ' hidden'}></div><div id="rrExplain" hidden></div>`;
  const sim = scenario(), base = { account_id: id };
  const supportBody = s.job.on ? (post == null ? null : Object.assign(scenario(), { support_months: s.job.mo, post_support_income_retained_pct: post })) : Object.assign(scenario(), { support_months: 1, post_support_income_retained_pct: sim.income_retained_pct });
  const baseSupport = { account_id: id, income_retained_pct: 100, support_months: 1, post_support_income_retained_pct: 100 };
  API.simulate(sim).then(r => { if (gen !== ovGen) return;
    $('#rrHead').textContent = headline(r); $('#rrBadge').innerHTML = badge(r);
    $('#rrMsg').textContent = statusLine(r);
    $('#rrBreak').innerHTML = flow(r);
    $('#rrMeter').innerHTML = meter(r, s.job.on ? s.job.mo : 6);
  }, e => { if (gen !== ovGen) return; $('#rrHead').textContent = '—'; $('#rrBadge').innerHTML = ''; $('#rrMsg').textContent = ''; $('#rrAheadChart').innerHTML = errBox(e, true); bindRetry(); });
  if (!supportBody) $('#rrAheadChart').innerHTML = `<div class="rr-note">Choose what happens to money in after month ${s.job.mo} to draw the chart.</div>`;
  else Promise.all([API.simulate(sim), API.support(supportBody), API.simulate(base), API.support(baseSupport)]).then(([r, sp, b0, bs]) => { if (gen !== ovGen) return;
    projChart($('#rrAheadChart'), r.buffer_left, sp.projection, b0.buffer_left, bs.projection, s.job.on ? s.job.mo : null);
    $('#rrAheadChart').insertAdjacentHTML('beforeend', `<p class="rr-small">${s.job.on ? `Chart: reduced money in for ${sp.support_months} months, then ${pctTxt(sp.post_support_income_retained_pct)} of normal. On that path your savings last ${sp.status === 'horizon_reached' ? 'past 10 years' : esc(sp.runway_months) + ' months'}.` : 'Chart: your situations held steady month after month.'} A what-if, not an EI eligibility estimate.</p>`);
  }, e => { if (gen !== ovGen) return; $('#rrAheadChart').innerHTML = errBox(e, true); bindRetry(); });

  // breathing room: hypothetical outflow reduction
  const smax = Math.max(1000, Math.ceil(num(m.S) / 250) * 250); breathCut = Math.min(breathCut, smax);
  $('#rrBreath').innerHTML = `<div class="rr-tile-head"><h3>Give yourself more breathing room</h3></div>
    <div class="rr-kv"><label for="rrCut">Cut money out by</label><b>${fmt0(breathCut)} / month</b></div>
    <input class="rr-range" type="range" id="rrCut" min="0" max="${smax}" step="25" value="${breathCut}">
    <div class="rr-res"><div class="nums" id="rrBreathNums">…</div></div>
    <p>A what-if. Your history doesn't show which spending is easy to cut.</p>`;
  Promise.all([API.simulate(sim), API.simulate(Object.assign(scenario(), { monthly_outflow_reduction: breathCut }))]).then(([r0, r1]) => { if (gen !== ovGen) return;
    $('#rrBreathNums').innerHTML = `<span class="from">${esc(headline(r0))}</span><span class="arr">→</span><span class="to">${esc(headline(r1))}</span>`; },
    e => { if (gen !== ovGen) return; $('#rrBreathNums').innerHTML = `<span class="rr-small">${esc(API.describe(e))}</span>`; });

  // finding (offline precomputed population analysis, labelled)
  const q = (CM.ins.quartiles || []).map(x => x.outIn6), mx = Math.max(...q, .01);
  $('#rrFinding').innerHTML = `<div class="rr-tile-head"><span class="rr-pill lime">Biggest finding</span>${prov('From our study of 4,500 customers')}</div>
    <h3>More money in doesn't mean more resilience.</h3>
    <div class="rr-minibars" role="img" aria-label="Share who run out within 6 months, lowest to highest money in">${q.map((v, i) => `<i class="${i === q.length - 1 ? 'hi' : ''}" style="height:${Math.max(10, v / mx * 100)}%"></i>`).join('')}</div>
    <p class="rr-small">Share who run out within 6 months if money in dropped to 55%, from lowest to highest earners.</p><a href="#paradox">See the finding →</a>`;

  // safety-net planner (/api/plan)
  $('#rrFund').innerHTML = `<div class="rr-tile-head"><h2>Your safety net</h2>${prov('Live calculation')}</div>
    <div class="rr-kv lab">How long should your savings last?</div>
    <div class="rr-seg" role="group" aria-label="Savings target">${[3, 6, 9, 12].map(t => `<button type="button" data-target="${t}" aria-pressed="${t === target}">${t} months</button>`).join('')}</div>
    <div id="rrPlanOut">${loading('Calculating the plan…')}</div>`;
  API.plan(Object.assign(scenario(), { target_months: target })).then(p => { if (gen !== ovGen) return;
    const brk = num(p.income_retention_break_even_pct);
    $('#rrPlanOut').innerHTML = `<div class="rr-stats3"><div><small>Extra savings needed</small><b data-count="${num(p.additional_savings_needed)}">${fmt(p.additional_savings_needed)}</b><span>on top of what you have</span></div><div><small>Total savings needed</small><b>${fmt0(p.required_buffer)}</b><span>${esc(p.target_months)} months of the gap</span></div><div><small>Gap each month</small><b>${fmt(p.monthly_shortfall_exact)}</b><span>with your situations</span></div></div>
      <div class="rr-cmp2"><div><div class="h"><small>Now</small><b>${esc(headline(p.current))}</b>${badge(p.current)}</div>${meter(p.current, num(p.target_months))}</div><div><div class="h"><small>With the extra savings</small><b>${esc(headline(p.with_target_savings))}</b>${badge(p.with_target_savings)}</div>${meter(p.with_target_savings, num(p.target_months))}</div></div>
      <div class="rr-tip"><b>To close the gap completely:</b> spend ${fmt(p.monthly_outflow_reduction_to_break_even)} less each month${isFinite(brk) && brk <= 100 ? `, or keep at least ${pctTxt(p.income_retention_break_even_pct)} of your normal money in` : isFinite(brk) ? '. Even your full normal money in would not cover it, because money out is higher' : ''}.</div>
      <p class="rr-small">Assumes money in and out stay the same each month.</p>`; countUp($('#rrPlanOut')); },
    e => { if (gen !== ovGen) return; $('#rrPlanOut').innerHTML = errBox(e, true); bindRetry(); });

  // resilience quest (/api/quest)
  $('#rr-job').innerHTML = `<div class="rr-tile-head"><h2>Ways to recover</h2>${prov('Live calculation')}</div><div id="rrQuestOut">${loading('Loading decision cards…')}</div>`;
  $('#rr-steps').innerHTML = `<div class="rr-tile-head"><h2>Recovery options side by side</h2><span class="note">How long your savings last with each option</span></div><div id="rrStepsOut">${loading()}</div>`;
  Promise.all([API.quest(Object.assign(scenario(), { target_months: target })), API.simulate(sim)]).then(([qz, r]) => { if (gen !== ovGen) return;
    const sc = x => x && x.score != null ? `${esc(x.score)}<small>/100</small>` : `<span class="na">Unavailable</span>`;
    const names = { target_safety_net: `Add the savings for a ${esc(qz.safety_net.target_months)}-month target`, reduce_outflow_ten_percent: 'Cut money out by 10%', restore_original_income: 'Money in returns to 100%' };
    $('#rrQuestOut').innerHTML = `<div class="rr-scores"><div><small>Your score today</small><b>${sc(qz.baseline_score)}</b></div><div><small>With your situations</small><b>${sc(qz.simulated_score)}</b></div><div><small>Change</small><b>${qz.score_change == null ? '<span class="na">Unavailable</span>' : (num(qz.score_change) > 0 ? '+' : '') + esc(qz.score_change)}</b></div></div>
      <p class="rr-small">${esc(qz.baseline_score.label)}</p>
      <div class="rr-steps">${qz.decision_cards.map((c, i) => `<div class="rr-step"><span class="n">${i + 1}</span><div><h4>${names[c.id] || esc(c.id)}</h4><p>${esc(statusLine(c.result))} Score ${c.score && c.score.score != null ? esc(c.score.score) : 'unavailable'}.</p></div><div class="g"><b>${esc(headline(c.result))}</b><span>${status(c.result)[2]}</span></div></div>`).join('')}</div>
      <h3 class="rr-h3">Things to try</h3><ul class="rr-missions">${qz.missions.map(x => `<li>${esc(x.text)} <span class="rr-pill lilac">What-if</span></li>`).join('')}</ul>
      <p class="rr-small">These are what-ifs to explore, not completed actions. Your progress isn't saved.</p>`;
    const rows = [['Your situations', r], ...qz.decision_cards.map(c => [names[c.id] || c.id, c.result])];
    const w = x => x.status === 'no_shortfall' || x.status === 'capped' ? 100 : Math.max(1, Math.min(100, x.runway_months / 12 * 100));
    $('#rrStepsOut').innerHTML = `<div class="rr-bars">${rows.map(([n, x]) => `<div class="rr-sbar"><span>${n}</span><span class="tr"><i class="${status(x)[0] === 'stable' ? 'ok' : 'short'}" style="width:${w(x)}%"></i></span><b>${esc(x.status === 'no_shortfall' ? 'No shortfall' : x.status === 'capped' ? '120+' : x.runway_display.replace(' months', ' mo'))}</b></div>`).join('')}</div>
      <p class="rr-small">Bars run to 12 months. A full bar means your savings never run out or last over a year.</p>`; },
    e => { if (gen !== ovGen) return; $('#rrQuestOut').innerHTML = errBox(e, true); $('#rrStepsOut').innerHTML = ''; bindRetry(); });

  bindOverview();
  countUp($('.content'));
}
function breakdown(r) {
  const b = r.calculation_breakdown || {}, sa = r.scenario_assumptions || {}, om = r.original_metrics || {};
  const row = (k, f, v) => `<tr><th scope="row">${k}</th><td><code>${f}</code></td><td>${v}</td></tr>`;
  return `<table class="rr-tbl rr-calc"><caption>How this was worked out</caption><tbody>
    ${row('Money in', `normal money in × ${esc(sa.income_retained_pct)}%`, `${fmt(b.income_after_exact)} <small>(${fmt(om.I)} × ${esc(sa.income_retained_pct)}%)</small>`)}
    ${row('Extra on bills', `household bills × ${esc(sa.bills_increase_pct)}%`, fmt(b.household_bill_increment))}
    ${row('Money out', 'normal money out + extra bills + new costs − cuts', `${fmt(b.outflow_after_exact)} <small>(normal ${fmt(om.S)})</small>`)}
    ${row('Savings to start', 'your savings + extra savings − surprise cost', `${fmt(b.buffer_after_exact)} <small>(savings ${fmt(om.B)}, surprise cost ${fmt(sa.one_off_cost)})</small>`)}
    ${row('Gap each month', 'money out − money in', fmt(b.gap_exact))}
    ${row('How long savings last', 'savings ÷ gap each month', `<b>${esc(headline(r))}</b>`)}
  </tbody></table>`;
}
function bindRetry() { $$('[data-live-retry]').forEach(b => b.onclick = () => { API.clearCache(); L.acct[L.id] = {}; loadAccount(L.id); }); }
function bindOverview() {
  const ov = $('.content'), SIT = RR.SIT();
  const save = () => store.set('cm.rr.sits', SIT);
  $$('[data-go]', ov).forEach(b => b.onclick = () => CM.go(b.dataset.go));
  $$('[data-jump]', ov).forEach(b => b.onclick = () => RR.jumpTo(b.dataset.jump));
  $$('[data-sit]', ov).forEach(b => b.onclick = () => { const k = b.dataset.sit; SIT[k].on = !SIT[k].on; save(); liveOverview(); });
  $$('[data-post]', ov).forEach(b => b.onclick = () => { post = +b.dataset.post; store.set(POST_KEY, post); liveOverview(); });
  $$('[data-target]', ov).forEach(b => b.onclick = () => { target = +b.dataset.target; store.set(TARGET_KEY, target); liveOverview(); });
  $('#rrAdjust').onclick = () => { adjustOpen = !adjustOpen; liveOverview(); };
  $('#rrBreakBtn').onclick = () => { breakdownOpen = !breakdownOpen; $('#rrBreak').hidden = !breakdownOpen; $('#rrBreakBtn').textContent = (breakdownOpen ? 'Hide' : 'Show') + ' how it works'; $('#rrBreakBtn').setAttribute('aria-expanded', breakdownOpen); };
  $('#rrExplainBtn').onclick = () => explainInto($('#rrExplain'));
  // sliders: debounced, then one request for the complete assumption set
  const deb = (id, fn, wait = 300) => { const el = $('#' + id); if (!el) return; el.oninput = () => { fn(el.type === 'number' ? (el.value === '' ? null : Math.max(0, +el.value || 0)) : +el.value); const o = el.parentElement.querySelector('output'); if (o) o.textContent = el.id === 'rrEiMo' ? el.value + ' months' : el.value + '%'; RR.setP(el); clearTimeout(deb.t); deb.t = setTimeout(() => { save(); const f = document.activeElement && document.activeElement.id; liveOverview(); if (f) { const e = document.getElementById(f); if (e) e.focus(); } }, wait); }; };
  deb('rrEi', v => { SIT.job.ei = v; SIT.job.on = true; }); deb('rrEiMo', v => { SIT.job.mo = v; SIT.job.on = true; });
  deb('rrBillsPct', v => { SIT.bills.pct = v; SIT.bills.on = true; }); deb('rrRepair', v => { SIT.repair.amt = v; SIT.repair.on = true; }, 500); deb('rrMonthly', v => { SIT.monthly.amt = v || 0; SIT.monthly.on = true; }, 500);
  deb('rrCut', v => { breathCut = v; store.set('cm.rr.cut', v); });
  $$('.rr-range', ov).forEach(RR.setP);
}
async function explainInto(el) {
  el.hidden = false; el.innerHTML = loading('Getting verified explanation cards…');
  try { const x = await API.explain(scenario()); el.innerHTML = explainHTML(x); }
  catch (e) { el.innerHTML = errBox(e, false); }
}
const explainHTML = x => `<div class="rr-explain"><div class="rr-tile-head"><h3>Why this result</h3>${prov('Checked explanation')}</div><ol>${x.cards.map(c => `<li>${esc(c.text)}</li>`).join('')}</ol><p class="rr-small">${esc(x.limitation)}</p></div>`;

/* ================= YOUR DATA (live sections) ================= */
const COMP = { shock_resilience: 'Shock resilience', cashflow_health: 'Cashflow health', income_stability: 'Income stability', recent_balance_stress: 'Recent negative-balance stress', recorded_debt_commitments: 'Recorded debt commitments' };
function liveData() {
  const a = A(), m = M(), id = L.id, host = $('#rrData');
  if (!a.metrics) { host.innerHTML = loading(`Loading account ${id}…`); return; }
  if (!a.metrics.ok) { host.innerHTML = errBox(a.metrics.e, true); bindRetry(); return; }
  // bundled sections describe CM.st.id; for a live-only account show live sections alone
  if (CM.data[id] && CM.st.id === id) origData();
  else host.innerHTML = `<div class="rr-page-head"><h1>Your money</h1><p>Account ${esc(id)}. Budget tools need bundled spending categories, which this account doesn't have.</p></div><div class="rr-section-head" id="rr-about"><h2>About you</h2></div><div class="rr-stats5"></div>`;
  // About-you stats from live metrics + reference shock
  const st = $('#rrData .rr-stats5');
  if (st) {
    const ins = a.insights && a.insights.ok ? a.insights.v : null, ref = ins ? ins.score.reference_shock : null;
    st.innerHTML = `<div class="w"><small>Money in</small><b>${fmt0(m.I)}</b><span>Typical month</span></div>
      <div class="lime"><small>Money out</small><b>${fmt0(m.S)}</b><span>Typical month</span></div>
      <div class="lilac"><small>Your savings</small><b>${fmt0(m.B)}</b><span>Average balance, last 6 months</span></div>
      <div class="blue"><small>Keep 55% of money in</small><b>${ref ? esc(headline(ref)) : a.insights ? 'Unavailable' : '…'}</b><span>How long savings last · a what-if</span></div>
      <div class="w"><small>Household bills</small><b>${fmt0(m.H)}</b><span>Typical month · loan payment ${fmt0(m.P)}</span></div>`;
    st.insertAdjacentHTML('beforebegin', `<p class="rr-small">${prov('Live account data')} Facts from your account. Anything you type in Settings is kept separately, and situations are what-ifs.</p>`);
    st.insertAdjacentHTML('afterend', `<div class="rr-row rr-row-2" id="rrLiveScoreRow"><article class="rr-tile pad22" id="rrScore">${loading('Loading score…')}</article><article class="rr-tile pad22" id="rrIns">${loading('Loading history insights…')}</article></div>
      <article class="rr-tile pad22" id="rrHistory">${loading('Loading monthly history…')}</article>
      <article class="rr-tile pad22" id="rrPeers">${loading('Loading look-alike accounts…')}</article>`);
  }
  // offline-only sections get labelled
  [['#rr-compare', 'From our study of 4,500 customers'], ['#rr-year', 'Replaced by live history below'], ['#rr-rule', 'Budget guide · sample spending categories'], ['#rr-jobs', 'Budget guide · sample spending categories']].forEach(([s, t]) => { const el = $(s); if (el) el.insertAdjacentHTML(s === '#rr-rule' ? 'beforebegin' : 'afterbegin', `<div style="margin:-4px 0 6px">${prov(t)}</div>`); });
  const yr = $('#rr-year'); if (yr) yr.hidden = true;
  if (a.insights && a.insights.ok) renderInsights(a.insights.v); else if (a.insights) ['#rrScore', '#rrIns', '#rrHistory'].forEach(s => { const el = $(s); if (el) el.innerHTML = errBox(a.insights.e, true); });
  if (a.lookalikes && a.lookalikes.ok) renderPeers(a.lookalikes.v); else if (a.lookalikes) { const el = $('#rrPeers'); if (el) el.innerHTML = errBox(a.lookalikes.e, true); }
  bindRetry();
}
function renderInsights(x) {
  const s = x.score, h = x.insights;
  const comps = Object.entries(s.components).map(([k, v]) => `<div class="rr-comp"><span>${COMP[k] || esc(k)}</span><span class="tr">${v == null ? '' : `<i style="width:${num(v) / 20 * 100}%"></i>`}</span><b>${v == null ? '<span class="na">Unavailable</span>' : esc(v) + '<small>/20</small>'}</b></div>`).join('');
  $('#rrScore').innerHTML = `<div class="rr-tile-head"><h2>Resilience score</h2><span class="rr-pill lilac">Experimental</span></div>
    <div class="rr-score-big">${s.score == null ? `<b class="na">Incomplete</b><span>${esc(s.available_points)} of ${esc(s.available_maximum)} points; some parts need more history</span>` : `<b>${esc(s.score)}</b><span>out of 100</span>`}</div>
    <p class="rr-label">${esc(s.label)}</p>${comps}<p class="rr-small">Loan payments are what you pay each month, not what you still owe. Parts without enough history are left out, not guessed.</p>`;
  const rec = { improving: ['✓', 'Improving'], worsening: ['!', 'Worsening'], unchanged: ['=', 'Unchanged'], insufficient_history: ['–', 'Not enough history'] }[h.recovery] || ['–', h.recovery];
  const cv = h.income_cv == null ? null : num(h.income_cv), cr = h.cashflow_creep;
  $('#rrIns').innerHTML = `<div class="rr-tile-head"><h2>What the history shows</h2>${prov('Live account history')}</div>
    ${!h.available ? '<p class="na">No monthly history is available for this account.</p>' : `<ul class="rr-facts">
    <li><b>Income stability</b><span>${cv == null ? 'Unavailable' : `Money in changes by about ±${Math.round(cv * 100)}% from month to month (over ${esc(h.months)} months).`}</span></li>
    <li><b>Timing trap: overdrawn in a good month</b><span>${h.timing_trap_months.length ? `${h.timing_trap_months.length} month${h.timing_trap_months.length > 1 ? 's' : ''} where money in covered money out, yet the balance still dipped below zero (e.g. ${esc(h.timing_trap_months.slice(-3).map(d => d.slice(0, 7)).join(', '))}). Bills may land before money arrives.` : 'No months where the balance dipped below zero despite positive cashflow.'}</span></li>
    <li><b>Overdraft trend</b><span><i aria-hidden="true">${rec[0]}</i> ${rec[1]}: days overdrawn in the last 3 months vs the 3 before. Past trend, not a promise.</span></li>
    <li><b>Spending creep</b><span>${cr ? `Median money in ${fmt0(cr.early_inflow)} → ${fmt0(cr.recent_inflow)}, money out ${fmt0(cr.early_outflow)} → ${fmt0(cr.recent_outflow)} (first 6 months vs last 6). ${cr.outflow_growth_exceeds_inflow_growth == null ? '' : cr.outflow_growth_exceeds_inflow_growth ? 'Money out grew faster than money in.' : 'Money out did not grow faster than money in.'} This can't tell which spending was necessary.` : 'Needs at least 12 months of history.'}</span></li>
    <li><b>Where cash goes</b><span>Not available: your monthly history doesn't show what cash withdrawals were spent on.</span></li></ul>`}`;
  histChart(h);
}
function histChart(h) {
  const el = $('#rrHistory'); if (!el) return;
  if (!h.available || !h.history.length) { el.innerHTML = '<div class="rr-tile-head"><h2>Monthly history</h2></div><p class="na">Unavailable for this account.</p>'; return; }
  const rows = h.history.slice(-24), W = Math.max(320, (el.clientWidth || 1160) - 44), H = 220, Lp = 50, R = 8, T = 10, B = 24;
  const mx = Math.max(...rows.flatMap(r => [num(r.money_in), num(r.money_out)]), 1), st = RR.niceStep(mx), top = Math.ceil(mx / st) * st, gw = (W - Lp - R) / rows.length, Y = v => T + (H - T - B) * (1 - v / top), dark = RR.isDark();
  let g = ''; for (let v = 0; v <= top; v += st) g += `<line x1="${Lp}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rr-line)"/><text x="${Lp - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--rr-sub)">${RR.kfmt(v)}</text>`;
  rows.forEach((r, i) => { const x = Lp + gw * i, w = gw * .34, neg = r.days_below_zero > 0;
    g += `<rect x="${x + gw * .14}" y="${Y(num(r.money_in))}" width="${w}" height="${Y(0) - Y(num(r.money_in))}" rx="3" fill="${dark ? '#C0D6EA' : '#11425D'}"><title>${r.month.slice(0, 7)} money in ${fmt(r.money_in)}</title></rect><rect x="${x + gw * .52}" y="${Y(num(r.money_out))}" width="${w}" height="${Y(0) - Y(num(r.money_out))}" rx="3" fill="#8FAAC0"><title>${r.month.slice(0, 7)} money out ${fmt(r.money_out)}</title></rect>`;
    if (neg) g += `<text x="${x + gw / 2}" y="${T + 8}" text-anchor="middle" font-size="10" fill="var(--rr-danger)">▾${r.days_below_zero}</text>`;
    if (i % Math.max(1, Math.ceil(rows.length / 12)) === 0) g += `<text x="${x + gw / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">${r.month.slice(2, 7)}</text>`; });
  el.innerHTML = `<div class="rr-tile-head"><h2>Monthly history</h2><div class="rr-legend"><span><i class="dot" style="background:${dark ? '#C0D6EA' : '#11425D'}"></i>Money in</span><span><i class="dot" style="background:#8FAAC0"></i>Money out</span><span style="color:var(--rr-danger)">▾ days overdrawn</span></div></div>
    <div class="rr-chart"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Monthly money in and money out, last ${rows.length} months">${g}</svg></div>
    <p class="rr-small">${prov('Live account history')} Last ${rows.length} of ${h.months} months.</p>`;
}
function renderPeers(x) {
  $('#rrPeers').innerHTML = `<div class="rr-tile-head"><h2>Customers like you</h2>${prov('Live comparison')}</div>
    <p class="rr-small">The five customers whose money in and savings are closest to yours. Similar numbers don't mean similar lives.</p>
    <table class="rr-tbl"><thead><tr><th>Customer</th><th>Money in</th><th>Savings</th><th>If money in dropped to 55%</th></tr></thead><tbody>${x.peers.map(p => `<tr><td><button type="button" class="rr-link strong" data-peer="${esc(p.metrics.account_id)}">${esc(p.metrics.account_id)}</button></td><td>${fmt0(p.metrics.I)}</td><td>${fmt0(p.metrics.B)}</td><td>${esc(headline(p.income_shock))}</td></tr>`).join('')}</tbody></table>`;
  $$('#rrPeers [data-peer]').forEach(b => b.onclick = () => openAccount(+b.dataset.peer));
}

/* ================= account switching ================= */
function openAccount(id) {
  if (CM.data[id]) { CM.setAccount(id); }
  else { L.unbundled = true; loadAccount(id); const g = $('#rrGreet'); if (g) g.textContent = `Account ${id}`; }
  if (L.mode === 'live') loadAccount(id);
}
document.addEventListener('submit', e => {
  if (e.target.id !== 'rrLookup' || L.mode !== 'live') return;
  e.preventDefault(); e.stopPropagation();
  const v = $('#rrAcct').value.replace(/\D/g, ''), er = $('#rrAcctErr');
  if (!v) { er.hidden = false; er.textContent = 'Type an account number.'; return; }
  er.hidden = false; er.textContent = `Looking up ${v}…`;
  API.account(+v).then(() => { er.hidden = true; openAccount(+v); RR.toast(`Showing account ${v} (live)`); },
    err => { er.hidden = false; er.textContent = API.describe(err); });
}, true);
document.addEventListener('cm:account', ev => { L.unbundled = false; if (L.mode === 'live') loadAccount(ev.detail.id); else L.id = ev.detail.id; });

/* ================= render routing ================= */
const origOverview = RR.RENDER.overview, origData = RR.RENDER.yourdata;
RR.RENDER.overview = () => L.mode === 'live' ? liveOverview() : (origOverview(), offlineTags());
RR.RENDER.yourdata = () => L.mode === 'live' ? liveData() : (origData(), offlineTags());
RR.RENDER.situations = RR.RENDER.saving = RR.RENDER.overview;
function offlineTags() {
  if (L.mode === 'live') return;
  ['#rrChequing', '#rrSummary', '#rrRunway', '#rrFund', '#rr-job', '#rr-steps', '#rr-about'].forEach(s => { const el = $(s); if (el && !el.querySelector('.rr-prov')) el.insertAdjacentHTML('afterbegin', `<div>${prov('Sample data')}</div>`); });
}

/* chat: coach context comes from live results when live (no browser-side figures) */
window.CMLive = {
  get mode() { return L.mode; },
  async explainToChat() { const x = await API.explain(scenario()); return x; },
  explainHTML,
  contextText() {
    if (L.mode !== 'live') return null;
    const a = A(), m = M(); if (!m) return null;
    const ins = a.insights && a.insights.ok ? a.insights.v : null;
    return [`Account ${L.id}. Live Gold metrics: I=${m.I} (median money in), S=${m.S} (median money out), F=${m.F}, H=${m.H}, B=${m.B}, P=${m.P}. F and P are already inside S.`,
      `Active hypothetical situations: ${sitText().join('; ') || 'none'}.`,
      ins ? `Experimental score: ${ins.score.score == null ? 'incomplete' : ins.score.score + '/100'}. Reference shock (55% of money in kept): ${ins.score.reference_shock.runway_display}.` : '',
      'Only quote figures given here. Say "money in" and "money out". Hypothetical income retention is not EI eligibility. Do not calculate new runways; tell the user to use the Looking ahead tile.'].filter(Boolean).join('\n');
  },
};

document.addEventListener('cm:view', () => { banner(); });
const boot = () => { L.id = CM.st.id; banner(); check(); };
if (CM.st.id) boot(); else document.addEventListener('cm:account', function once() { document.removeEventListener('cm:account', once); setTimeout(boot, 0); });
})();
