/* Resilience Rewired: Your data, Investing and the AI saving-plan walkthrough (Figma frames 12, 15, 16). */
(() => {
'use strict';
const CM = window.ChequeMate, RR = window.RR;
if (!CM || !RR) return;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { money, esc, runway, store } = CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r25 = v => Math.max(0, Math.round(v / 25) * 25);
const sgnMoney = v => (v < 0 ? '−' : '+') + money(Math.abs(v));
const firstName = () => { const n = CM.profile().name; return /^Customer \d+$/.test(n) ? '' : n.split(' ')[0]; };

/* ================= YOUR DATA ================= */
const RULESD = [
  { id: '50-30-20', name: '50/30/20', why: 'Half to needs, 30% to wants and 20% to savings. The best-known starting point.', p: { needs: .5, wants: .3, save: .2 } },
  { id: '70-20-10', name: '70/20/10', why: '70% to needs, 20% to wants and 10% to savings. A gentler start when needs take up most of your money.', p: { needs: .7, wants: .2, save: .1 } },
  { id: '60-20-20', name: '60/20/20', why: 'A version of 50/30/20 for expensive cities, where needs take up more room.', p: { needs: .6, wants: .2, save: .2 } },
  { id: '80-20', name: '80/20', why: 'Pay yourself first: move 20% to savings on payday and spend the rest without tracking.', p: { spend: .8, save: .2 } },
];
let ruleSel = null, jobs = null, jobsFor = null;
const actualsD = a => { const needs = Math.min(a.F, a.S), wants = Math.max(a.S - needs, 0); return { needs, wants, spend: a.S, save: a.I - a.S }; };
const needMore = (r, a) => Math.max(0, r.p.save * a.I - (a.I - a.S));
function jobDefaults(a) {
  const m = a.mo || [0, 0, 0, 0, 0, 0, 0], raw = [m[0], m[1], m[2], m[4], m[5], m[6]], tot = raw.reduce((s, x) => s + x, 0) || 1, k = a.S / tot;
  const [bills, ins, loan, cash, card, other] = raw.map(v => Math.round(v * k)), rent = Math.round(bills * .7);
  const sur = a.I - a.S;
  return { Rent: rent, 'Bills & utilities': bills - rent, Insurance: ins, 'Loan payment': loan, 'Everyday cash spending': cash, 'Card spending': card, 'Other transfers out': other,
    'Emergency fund': r25(Math.max(0, sur * .5)), Health: 0, Travel: 0 };
}
const GROUPS = [['Needs', ['Rent', 'Bills & utilities', 'Insurance', 'Loan payment']], ['Wants', ['Everyday cash spending', 'Card spending', 'Other transfers out']], ['Savings', ['Emergency fund', 'Health', 'Travel']]];
function histogram(el, a) {
  const all = CM.ids.map(id => { const x = CM.data[id]; return runway(x.B, x.I, x.S, { mult: .55 }).v; });
  const bins = Array(25).fill(0); all.forEach(v => bins[v === Infinity || v >= 24 ? 24 : Math.max(0, Math.floor(v))]++);
  const me = runway(a.B, a.I, a.S, { mult: .55 }).v, mb = me === Infinity || me >= 24 ? 24 : Math.max(0, Math.floor(me));
  const W = Math.max(320, el.clientWidth || 1156), H = 252, L = 40, R = 10, T = 30, B = 32, mx = Math.max(...bins), st = RR.niceStep(mx), top = Math.ceil(mx / st) * st;
  const bw = (W - L - R) / 25, X = i => L + bw * i, Y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rr-line)" stroke-dasharray="3 4"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--rr-sub)">${v}</text>`;
  const dark = RR.isDark();
  bins.forEach((c, i) => { const h = Math.max(2, (H - T - B) - (Y(c) - T)), x = X(i) + bw * .12, w = bw * .76, short = i < 6;
    g += `<rect x="${x}" y="${Y(c)}" width="${w}" height="${h}" rx="6" fill="${short ? (dark ? '#6E8FA8' : '#8FAAC0') : (dark ? '#C0D6EA' : '#11425D')}"${i === mb ? ` stroke="${dark ? '#DDFF55' : '#002233'}" stroke-width="2.5"` : ''}><title>${i === 24 ? '24+' : i}–${i + 1} months: ${c} customers</title></rect>`;
    if (i % 1 === 0) g += `<text x="${X(i) + bw / 2}" y="${H - B + 14}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">${i === 24 ? '24+' : i}</text>`; });
  const mxp = X(mb) + bw / 2, lab = `You · ${me === Infinity ? 'no shortfall' : me.toFixed(1) + ' months'}`, lw = lab.length * 6 + 20;
  g += `<line x1="${mxp}" x2="${mxp}" y1="${T - 6}" y2="${H - B}" stroke="var(--rr-ink)" stroke-dasharray="4 4" stroke-width="1.5"/><rect x="${clamp(mxp - lw / 2, 0, W - lw)}" y="${T - 28}" width="${lw}" height="22" rx="11" fill="#002233"/><text x="${clamp(mxp, lw / 2, W - lw / 2)}" y="${T - 13}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${lab}</text>`;
  g += `<text x="${(L + W) / 2}" y="${H - 2}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">Months your savings would last · each bar is a group of customers</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="How long savings last on EI across all customers; yours: ${lab}">${g}</svg>`;
  const shorter = all.filter(v => v < me).length / all.length;
  return { shorter, me };
}
function yearChart(el, a) {
  const n = Math.min(12, a.n), ins = a.in.slice(-n), outs = a.out.slice(-n), labels = (() => { let [y, m] = a.m0.split('-').map(Number); m -= 1; const L = []; for (let k = 0; k < a.n; k++) L.push(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(m + k) % 12]); return L.slice(-n); })();
  const W = Math.max(320, el.clientWidth || 1156), H = 215, L = 46, R = 8, T = 10, B = 24, mx = Math.max(...ins, ...outs, 1), st = RR.niceStep(mx), top = Math.ceil(mx / st) * st;
  const gw = (W - L - R) / n, Y = v => T + (H - T - B) * (1 - v / top), dark = RR.isDark();
  let g = '';
  for (let v = 0; v <= top; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rr-line)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--rr-sub)">${RR.kfmt(v)}</text>`;
  ins.forEach((v, i) => { const x = L + gw * i, w = gw * .32;
    g += `<rect x="${x + gw * .16}" y="${Y(v)}" width="${w}" height="${Y(0) - Y(v)}" rx="4" fill="${dark ? '#C0D6EA' : '#11425D'}"><title>${labels[i]} money in ${money(v)}</title></rect>`;
    g += `<rect x="${x + gw * .52}" y="${Y(outs[i])}" width="${w}" height="${Y(0) - Y(outs[i])}" rx="4" fill="${dark ? '#6E8FA8' : '#8FAAC0'}"><title>${labels[i]} money out ${money(outs[i])}</title></rect>`;
    g += `<text x="${x + gw / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">${labels[i]}</text>`; });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Money in and money out for the last ${n} months">${g}</svg>`;
}
function pctl(arr, v) { let c = 0; for (const x of arr) if (x < v) c++; return c / (arr.length || 1); }
function renderData() {
  const a = CM.acc(); if (!a) return; const nm = firstName();
  const ei = runway(a.B, a.I, a.S, { mult: .55 }), left = a.I - a.S;
  if (jobsFor !== a.id) { jobs = jobDefaults(a); jobsFor = a.id; ruleSel = null; }
  const act = actualsD(a), ranked = RULESD.map(r => ({ r, need: needMore(r, a) })).sort((x, y) => x.need - y.need || (y.r.p.needs || 0) - (x.r.p.needs || 0));
  if (!ruleSel) ruleSel = ranked[0].r.id;
  const rule = RULESD.find(r => r.id === ruleSel);
  const cols = { needs: '#11425D', wants: '#8FAAC0', spend: '#11425D', save: '#6E8FA8' }, lbl = { needs: 'Needs', wants: 'Wants', spend: 'Spending', save: 'Savings' };
  const keys = Object.keys(rule.p), goalV = k => rule.p[k] * a.I, todayV = k => Math.max(0, act[k]);
  const segBar = vals => { const tot = Math.max(a.I, vals.reduce((s, [, v]) => s + v, 0)) || 1; return `<div class="rr-stack">${vals.map(([k, v]) => v > 0 ? `<span style="width:${v / tot * 100}%;background:${cols[k]};color:${k === 'needs' || k === 'spend' ? '#fff' : '#002233'}">${v / tot > .06 ? Math.round(v / (a.I || 1) * 100) + '%' : ''}</span>` : '').join('')}</div>`; };
  const diffs = keys.map(k => { const d = todayV(k) - goalV(k); return [k, d]; });
  const saveShort = Math.max(0, goalV('save') - Math.max(0, act.save)), over = diffs.filter(([k, d]) => k !== 'save' && d > 0).sort((x, y) => y[1] - x[1])[0];
  const advice = saveShort <= 0 ? `You already save ${money(act.save)} a month, at or above the ${rule.name} goal. Point the extra at your emergency fund, then investing.`
    : over ? `To fit ${rule.name}, move ${money(Math.min(saveShort, over[1]))} a month from ${lbl[over[0]].toLowerCase()} into savings.${diffs.find(([k, d]) => k === 'needs' && d <= 0) ? ' Your needs are already under the goal.' : ''}`
    : `To fit ${rule.name}, you'd need ${money(saveShort)} more a month in savings. That has to come from money in, or from spending less overall.`;
  const sumG = names => names.reduce((s, n) => s + (+jobs[n] || 0), 0), needsT = sumG(GROUPS[0][1]), wantsT = sumG(GROUPS[1][1]), saveT = sumG(GROUPS[2][1]), toAssign = Math.round(a.I - needsT - wantsT - saveT);
  const allEi = CM.ids.map(id => CM.data[id]);
  const pIn = pctl(allEi.map(x => x.I), a.I), pB = pctl(allEi.map(x => x.B), a.B);

  $('#rrData').innerHTML = `
  <div class="rr-page-head"><h1>Your money</h1><p>Everything about you and your money in one place${nm ? ', ' + esc(nm) : ''}: your cushion, how you compare, and your savings plan.</p></div>
  <div class="rr-section-head" id="rr-about"><h2>About you</h2><p>Your money cushion, and how you compare with others.</p></div>
  <div class="rr-stats5">
    <div class="w"><small>Average money in</small><b>${money(a.I)}</b><span>Per month</span></div>
    <div class="lime"><small>Average money out</small><b>${money(a.S)}</b><span>Per month</span></div>
    <div class="lilac"><small>Your savings</small><b>${money(Math.max(a.B, 0))}</b><span>Chequing + Savings, last 6 months</span></div>
    <div class="blue"><small>If you lost your job</small><b>${ei.v === Infinity ? 'No shortfall' : ei.v.toFixed(1) + ' months'}</b><span>Your savings would last, with EI at 55%</span></div>
    <div class="w"><small>Left over each month</small><b>${left >= 0 ? '~' : '−'}${money(Math.abs(left))}</b><span>Money in minus money out</span></div>
  </div>
  <article class="rr-tile pad22" id="rr-compare"><div class="rr-tile-head"><h2>How you compare</h2><span class="note">If money in dropped to 55%: how many months savings would last</span></div>
    <div class="rr-chart" id="rrHist"></div>
    <div class="rr-legend"><span><i class="dot" style="background:#8FAAC0"></i>Runs out within 6 months</span><span><i class="dot" style="background:${RR.isDark() ? '#C0D6EA' : '#11425D'}"></i>Lasts 6+ months</span><span><i class="dot" style="background:transparent;box-shadow:inset 0 0 0 2px var(--rr-ink)"></i>You</span></div>
    <div class="rr-pctl"><div><span>Money in</span><span class="tr"><i style="width:${pIn * 100}%"></i></span><b>More than ${Math.round(pIn * 100)}% of customers</b></div><div><span>Savings</span><span class="tr"><i style="width:${pB * 100}%"></i></span><b>More than ${Math.round(pB * 100)}% of customers</b></div></div>
    <p class="rr-small" id="rrHistNote"></p>
  </article>
  <div class="rr-section-head" id="rr-plan"><h2>Your savings plan</h2><p>Where your money goes, which budget rule fits, and a plan for every dollar.</p></div>
  <article class="rr-tile pad22" id="rr-year"><div class="rr-tile-head"><h2>Your year in money</h2><div class="rr-legend"><span><i class="dot" style="background:${RR.isDark() ? '#C0D6EA' : '#11425D'}"></i>Money in</span><span><i class="dot" style="background:#8FAAC0"></i>Money out</span></div></div><div class="rr-chart" id="rrYear"></div></article>
  <div class="rr-rule-row" id="rr-rule">
    <article class="rr-card2">
      <div class="rr-tile-head"><h2 class="rr-serif">Budget rule</h2><span class="note">Starts from your typical month: ${money(a.I)} in</span></div>
      <div class="rr-seg" role="group" aria-label="Budget rule">${RULESD.map(r => `<button type="button" data-rule="${r.id}" aria-pressed="${r.id === ruleSel}">${r.name}</button>`).join('')}<button type="button" data-rule="jobs" aria-pressed="false">Give every dollar a job</button></div>
      <p class="rr-why">${esc(rule.why)}</p>
      <div class="rr-legend">${keys.map(k => `<span><i class="dot" style="background:${cols[k]}"></i>${lbl[k]}</span>`).join('')}</div>
      <div class="rr-kv lab"><span>${rule.name} goal</span><span class="rr-mut">${money(a.I)}</span></div>
      ${segBar(keys.map(k => [k, goalV(k)]))}
      <div class="rr-kv lab"><span>You today</span><span class="rr-mut">${money(a.S)} spent</span></div>
      ${segBar(keys.map(k => [k, todayV(k)]))}
      <table class="rr-tbl"><thead><tr><th>Bucket</th><th>Goal</th><th>Today</th><th>Difference</th></tr></thead><tbody>${diffs.map(([k, d]) => { const bad = k === 'save' ? d < 0 : d > 0; return `<tr><td><i class="dot" style="background:${cols[k]}"></i>${lbl[k]}</td><td>${money(goalV(k))}</td><td>${money(todayV(k))}</td><td class="${bad ? 'bad' : 'good'}">${sgnMoney(d)} ${k === 'save' ? (d < 0 ? 'short' : 'ahead') : (d > 0 ? 'over' : 'under')}</td></tr>`; }).join('')}</tbody></table>
      <div class="rr-tip">${esc(advice)}</div>
    </article>
    <article class="rr-card2">
      <h2 class="rr-serif">Which rule fits you best</h2>
      <p class="rr-hint">How much more you'd need to save each month to follow each rule.</p>
      <div class="rr-rules">${ranked.map((x, i) => `<button type="button" class="${i === 0 ? 'best' : ''}" data-rule="${x.r.id}"><span>${x.r.name}</span>${i === 0 ? '<span class="rr-pill lilac">Closest fit</span>' : ''}<span class="sp"></span><b>${money(x.need)}</b></button>`).join('')}</div>
      <div class="rr-note">${ranked[0].r.id === '50-30-20' ? 'You already fit 50/30/20, the best-known rule. Keep it steady.' : `Start with ${ranked[0].r.name}. Once saving ${money(ranked[0].r.p.save * a.I)} a month feels easy, try 50/30/20.`}</div>
    </article>
  </div>
  <article class="rr-card2" id="rr-jobs">
    <div class="rr-tile-head"><h2 class="rr-serif">Give every dollar a job</h2><span class="note">A zero-based budget. Starts from your typical month.</span></div>
    <div class="rr-jobs">
      <div class="rr-groups">${GROUPS.map(([g, names]) => `<div class="rr-group"><h3>${g}</h3>${names.map(n => `<label class="rr-cat"><span>${n}</span><span class="rr-amt"><span>$</span><input inputmode="numeric" data-job="${esc(n)}" value="${Math.round(jobs[n] || 0)}" aria-label="${esc(n)} per month"></span></label>`).join('')}</div>`).join('')}</div>
      <div class="rr-jsum">
        <div class="rr-assign"><span>Left to assign</span><b class="rr-serif ${toAssign < 0 ? 'neg' : ''}" id="rrAssign">${toAssign < 0 ? '−' : ''}${money(Math.abs(toAssign))}</b></div>
        <div class="rr-stack" id="rrJobBar">${[['needs', needsT], ['wants', wantsT], ['save', saveT]].map(([k, v]) => v > 0 ? `<span style="width:${v / Math.max(a.I, needsT + wantsT + saveT) * 100}%;background:${cols[k]};color:${k === 'needs' ? '#fff' : '#002233'}">${v / Math.max(a.I, 1) > .12 ? lbl[k] : ''}</span>` : '').join('')}</div>
        <div class="rr-legend" id="rrJobLeg"><span><i class="dot" style="background:#11425D"></i>Needs ${money(needsT)}</span><span><i class="dot" style="background:#8FAAC0"></i>Wants ${money(wantsT)}</span><span><i class="dot" style="background:#6E8FA8"></i>Savings ${money(saveT)}</span></div>
        <p class="rr-small">Aim for $0. A number below zero means the plan spends more than comes in. Your bank data shows household bills together, so they start split 70/30 between rent and bills.</p>
        <button class="rr-btn-o" type="button" id="rrJobReset">Reset to my typical month</button>
        <button class="rr-btn" type="button" id="rrJobAccts">Turn this into separate accounts</button>
        <p class="rr-small">Opens the AI saving plan walkthrough with these amounts filled in.</p>
      </div>
    </div>
  </article>`;
  const h = histogram($('#rrHist'), a);
  $('#rrHistNote').textContent = `Your savings would last longer than ${Math.round(h.shorter * 100)}% of the bank's ${CM.ids.length.toLocaleString('en-CA')} customers.`;
  yearChart($('#rrYear'), a);
  $$('#rrData [data-rule]').forEach(b => b.onclick = () => { if (b.dataset.rule === 'jobs') { RR.jumpTo('rr-jobs'); return; } ruleSel = b.dataset.rule; const y = scrollY; renderData(); scrollTo(0, y); });
  $$('#rrData [data-job]').forEach(inp => inp.oninput = () => { jobs[inp.dataset.job] = +String(inp.value).replace(/[^0-9.]/g, '') || 0; jobSummary(a); });
  $('#rrJobReset').onclick = () => { jobs = jobDefaults(a); const y = scrollY; renderData(); scrollTo(0, y); };
  $('#rrJobAccts').onclick = () => openWalk({ fromJobs: true });
}
function jobSummary(a) {
  const sum = n => n.reduce((s, x) => s + (+jobs[x] || 0), 0), N = sum(GROUPS[0][1]), Wn = sum(GROUPS[1][1]), S = sum(GROUPS[2][1]), left = Math.round(a.I - N - Wn - S), tot = Math.max(a.I, N + Wn + S) || 1;
  const el = $('#rrAssign'); el.textContent = (left < 0 ? '−' : '') + money(Math.abs(left)); el.classList.toggle('neg', left < 0);
  $('#rrJobBar').innerHTML = [['#11425D', N, 'Needs', '#fff'], ['#8FAAC0', Wn, 'Wants', '#002233'], ['#6E8FA8', S, 'Savings', '#002233']].map(([c, v, l, ink]) => v > 0 ? `<span style="width:${v / tot * 100}%;background:${c};color:${ink}">${v / Math.max(a.I, 1) > .12 ? l : ''}</span>` : '').join('');
  $('#rrJobLeg').innerHTML = `<span><i class="dot" style="background:#11425D"></i>Needs ${money(N)}</span><span><i class="dot" style="background:#8FAAC0"></i>Wants ${money(Wn)}</span><span><i class="dot" style="background:#6E8FA8"></i>Savings ${money(S)}</span>`;
}

/* ================= INVESTING ================= */
let inv = { mo: null, yrs: 15, r: 5 };
function renderInvest() {
  const a = CM.acc(); if (!a) return;
  const pf = CM.profile(), tm = +pf.target || 3, goal = tm * a.S, have = Math.max(a.B, 0), gp = goal > 0 ? clamp(have / goal, 0, 1) : 1;
  const loanBehind = a.loan && a.loan.status === 'D', loanRun = a.P > 0;
  const steps = [
    ['Starter cushion', `One month of spending (${money(a.S)}) in a savings account you can reach quickly.`, have >= a.S],
    [loanBehind ? 'Get your loan back on track' : 'Keep your loan on track', loanBehind ? `Your ${money(a.P)} monthly loan payment is behind. Catching up stops extra fees and interest.` : loanRun ? `Your ${money(a.P)} monthly loan payment is on time. Keep it that way before investing.` : 'No loan to catch up on. Nice.', !loanBehind],
    [`Full emergency fund, ${tm} months`, `${money(goal)} kept safe and easy to reach. You're ${Math.round(gp * 100)}% of the way there.`, have >= goal],
    ['TFSA', 'Your money grows tax-free, and you can take it out any time. Room comes back the year after you take money out.', false],
    ['RRSP', 'Most useful when you earn more, because it lowers your taxes now. You pay tax when you take money out.', false],
    ['Regular investment account', 'For extra money once your tax-free room is full.', false],
  ];
  let firstOpen = steps.findIndex(s => !s[2]);
  const state = i => steps[i][2] ? 'done' : i === firstOpen ? (i === 2 ? 'prog' : 'next') : i === firstOpen + 1 && firstOpen === 1 && steps[2][2] === false ? 'prog' : 'todo';
  const safetyDone = steps[0][2] && steps[1][2] && steps[2][2];
  const sur = a.I - a.S; if (inv.mo == null) inv.mo = r25(Math.max(100, sur > 0 ? sur * .3 : 100));
  const months = inv.yrs * 12, rm = Math.pow(1 + inv.r / 100, 1 / 12) - 1;
  const yearly = Array.from({ length: inv.yrs }, (_, y) => { const m = (y + 1) * 12, put = inv.mo * m, val = rm ? inv.mo * ((Math.pow(1 + rm, m) - 1) / rm) : put; return { put, growth: val - put }; });
  const last = yearly[yearly.length - 1] || { put: 0, growth: 0 };
  $('#rrInvest').innerHTML = `
  <div class="rr-page-head"><h1>Investing</h1><p>Where your money can go once your safety net is in place, in the order that usually makes sense in Canada. General information, not personal financial advice.</p></div>
  <div class="rr-rule-row inv">
    <article class="rr-card2" id="rr-order">
      <div class="rr-tile-head"><h2>The order to fill things</h2><span class="rr-pill lime">${safetyDone ? 'Ready to invest' : 'Build your safety net first'}</span></div>
      <div class="rr-order">${steps.map((s, i) => { const k = state(i); return `<div class="rr-ostep ${k}"><span class="n">${k === 'done' ? '✓' : i + 1}</span><div><h4>${esc(s[0])}</h4><p>${esc(s[1])}</p></div>${k === 'done' ? '<span class="rr-pill lilac">Done</span>' : k === 'next' ? '<span class="rr-pill rose">Next step</span>' : k === 'prog' ? '<span class="rr-pill lime">In progress</span>' : ''}</div>`; }).join('')}</div>
      <div class="rr-tip">${safetyDone ? `Your safety net is in place. Your plan sets aside ${money(CM.st.plan.save ?? 0)} a month; anything past that can go to a TFSA first.` : `Investing comes after steps 2 and 3. Your savings plan already sets aside ${money(CM.st.plan.save ?? r25(Math.max(0, sur * .5)))} a month for the emergency fund.`}</div>
    </article>
    <article class="rr-card2" id="rr-growth">
      <div class="rr-tile-head"><h2>Growth calculator</h2><span class="note">For after your emergency fund</span></div>
      <div class="rr-kv lab"><label for="rrInvMo">Each month</label><b>${money(inv.mo)}</b></div>
      <input class="rr-range" type="range" id="rrInvMo" min="0" max="3000" step="25" value="${inv.mo}" aria-valuetext="${money(inv.mo)} a month">
      <div class="rr-kv lab"><label for="rrInvYrs">Years</label><b>${inv.yrs}</b></div>
      <input class="rr-range" type="range" id="rrInvYrs" min="1" max="40" step="1" value="${inv.yrs}" aria-valuetext="${inv.yrs} years">
      <div class="rr-seg" role="group" aria-label="Expected return">${[[3, 'Careful · 3%'], [5, 'Balanced · 5%'], [7, 'Growth · 7%']].map(([r, l]) => `<button type="button" data-r="${r}" aria-pressed="${inv.r === r}">${l}</button>`).join('')}</div>
      <div class="rr-tot"><div><small>You put in</small><b>${money(last.put)}</b></div><div><small>Growth</small><b>${money(last.growth)}</b></div><div class="lilac"><small>Total</small><b>${money(last.put + last.growth)}</b></div></div>
      <div class="rr-legend"><span><i class="dot" style="background:${RR.isDark() ? '#C0D6EA' : '#11425D'}"></i>What you put in</span><span><i class="dot" style="background:#8FAAC0"></i>Growth</span></div>
      <div class="rr-chart" id="rrGrowth"></div>
    </article>
  </div>
  <div class="rr-types" id="rr-types">
    ${[['tfsa', 'TFSA', '$7,000', '2026 yearly limit', 'Grows tax-free, and you can take money out tax-free. Up to $109,000 of total room for someone 18+ and living in Canada since 2009.', '#C5C0C9'],
      ['rrsp', 'RRSP', '$33,810', '2026 maximum', "18% of last year's earned income, up to the maximum. Lowers your taxes now; you pay tax when you take money out.", '#DDFF55'],
      ['fhsa', 'FHSA', '$8,000', 'a year, $40,000 lifetime', 'For first-time home buyers. Lowers your taxes going in, and tax-free coming out for a qualifying home.', '#C0D6EA'],
      ['gic', 'Savings account or GIC', 'CDIC', 'protects eligible deposits up to $100,000', 'Where your emergency fund lives: safe, easy to reach, and still earning interest.', '#DAD5CF']]
      .map(([k, t, big, sub, d, c]) => `<article class="rr-card2 rr-type"><span class="circ" style="background:${c}"><img src="assets/rr/acct-${k}.svg" width="22" height="22" alt=""></span><h3 class="rr-serif">${t}</h3><b class="rr-serif">${big}</b><small>${sub}</small><p>${d}</p></article>`).join('')}
  </div>`;
  growthChart($('#rrGrowth'), yearly);
  const live = (id, fn) => { const el = $('#' + id); el.oninput = () => { fn(+el.value); renderInvest(); $('#' + id).focus(); }; };
  live('rrInvMo', v => inv.mo = v); live('rrInvYrs', v => inv.yrs = v);
  $$('#rrInvest [data-r]').forEach(b => b.onclick = () => { inv.r = +b.dataset.r; renderInvest(); });
  $$('#rrInvest .rr-range').forEach(RR.setP);
}
function growthChart(el, yearly) {
  const W = Math.max(300, el.clientWidth || 588), H = 190, L = 8, R = 8, T = 8, B = 20, n = yearly.length, mx = Math.max(...yearly.map(y => y.put + y.growth), 1);
  const bw = (W - L - R) / n, Y = v => T + (H - T - B) * (1 - v / (mx * 1.05)), dark = RR.isDark();
  let g = ''; for (let i = 1; i <= 4; i++) g += `<line x1="${L}" x2="${W - R}" y1="${T + (H - T - B) * i / 4}" y2="${T + (H - T - B) * i / 4}" stroke="var(--rr-line)" stroke-dasharray="3 4"/>`;
  yearly.forEach((y, i) => { const x = L + bw * i + bw * .14, w = bw * .72;
    g += `<rect x="${x}" y="${Y(y.put)}" width="${w}" height="${Y(0) - Y(y.put)}" fill="${dark ? '#C0D6EA' : '#11425D'}"/><rect x="${x}" y="${Y(y.put + y.growth)}" width="${w}" height="${Y(y.put) - Y(y.put + y.growth)}" fill="#8FAAC0" rx="2"><title>Year ${i + 1}: ${money(y.put + y.growth)}</title></rect>`;
    if (i % Math.max(1, Math.ceil(n / 5)) === 0) g += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle" font-size="10.5" fill="var(--rr-sub)">Yr ${i + 1}</text>`; });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Investment growth by year">${g}</svg>`;
}

/* ================= AI SAVING PLAN WALKTHROUGH ================= */
let W = null;
const AV = { Rent: '#DDFF55', 'Bills & utilities': '#C0D6EA', Health: '#C5C0C9', Travel: '#DDFF55', 'Emergency fund': '#6E8FA8' };
const SUBT = { Rent: 'Moves before rent is due', 'Bills & utilities': 'Hydro, phone, internet, insurance', Health: 'Prescriptions, dental, glasses', Travel: 'Trips and visits home', 'Emergency fund': 'Your existing Savings account' };
function walkInit(opts) {
  const a = CM.acc(), j = opts.fromJobs && jobs ? jobs : jobDefaults(a), sur = a.I - a.S;
  const accts = [['Rent', j.Rent], ['Bills & utilities', (j['Bills & utilities'] || 0) + (j.Insurance || 0)], ['Health', j.Health || r25(Math.max(50, a.S * .015))], ['Travel', j.Travel || r25(Math.max(25, a.S * .01))], ['Emergency fund', j['Emergency fund'] || CM.st.plan.save || r25(Math.max(0, sur * .5))]]
    .map(([n, v]) => ({ n, v: Math.round(v || 0), on: true }));
  W = { step: 1, accts, when: 'payday', day: 1, agree: true };
}
function nextPayday(when, day) {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth(), t = d.getDate(), lastDay = new Date(y, m + 1, 0).getDate();
  let nd; if (when === 'payday') nd = t < 15 ? new Date(y, m, 15) : t < lastDay ? new Date(y, m, lastDay) : new Date(y, m + 1, 15);
  else { const dd = when === 'first' ? 1 : day; nd = t < dd ? new Date(y, m, dd) : new Date(y, m + 1, dd); }
  return nd.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
function walkRender() {
  const a = CM.acc(), el = $('#rrWalk'), m = a.mo || [], nm = firstName(), sur = a.I - a.S, flex = Math.round(RR.flexible(a));
  const head = `<div class="rr-wh"><span class="sp"><img src="assets/rr/sparkle-white.svg" width="20" height="19" alt=""></span><b>AI saving plan</b><span class="sp2"></span><button class="rr-wx" type="button" id="rrWalkX" aria-label="Close walkthrough">✕</button></div>`;
  const on = W.accts.filter(x => x.on), total = on.reduce((s, x) => s + (+x.v || 0), 0), split = W.when === 'payday' ? 2 : 1;
  let body = '';
  if (W.step === 1) body = `<h2 class="rr-serif rr-wt">Here's your typical month</h2><p class="rr-ws">Based on your last 6 months in Chequing and Savings.</p>
    <div class="rr-w3"><div><small>Money in</small><b>${money(a.I)}</b></div><div><small>Money out</small><b>${money(a.S)}</b></div><div><small>Left over</small><b>${sur >= 0 ? '~' : '−'}${money(Math.abs(sur))}</b></div></div>
    <div class="rr-w2"><div><h4>Fixed costs</h4><p><span>Rent &amp; household bills</span><b>${money(a.H)}</b></p><p><span>Loan payment</span><b>${money(a.P)}</b></p><p><span>Insurance</span><b>${money(m[1] || 0)}</b></p></div>
      <div><h4>Flexible spending</h4><p><span>Cash withdrawals</span><b>${money(m[4] || 0)}</b></p><p><span>Other transfers out</span><b>${money(m[6] || 0)}</b></p><p><span>Card spending</span><b>${money(m[5] || 0)}</b></p></div></div>
    <div class="rr-wnote"><span class="sp"><img src="assets/rr/sparkle-white.svg" width="16" height="15" alt=""></span><p>${sur > 0 ? `Most months you have about ${money(sur)} left, and your bills come out of the same account you spend from. Separate accounts make it easy to see what's safe to spend.` : `Most months more goes out than comes in, by about ${money(-sur)}. Separate accounts for bills make it easier to see where to cut first.`}</p></div>
    <div class="rr-wf"><span class="sp2"></span><button class="rr-btn-o" type="button" data-step="2">Create new accounts</button><button class="rr-btn" type="button" data-step="2">Suggest accounts</button></div>`;
  else if (W.step === 2) body = `<h2 class="rr-serif rr-wt">Your suggested accounts</h2><p class="rr-ws">Each account gets its own job. Change any amount, or turn an account off.</p>
    <div class="rr-wl">${W.accts.map((x, i) => `<div class="rr-wa${x.on ? '' : ' off'}"><span class="av" style="background:${AV[x.n] || '#E6E2DC'}">${esc(x.n[0])}</span><div class="t"><b>${esc(x.n)}</b><span>${esc(SUBT[x.n] || 'Your own account')}</span></div><label class="rr-amt sm"><span>$</span><input inputmode="numeric" data-acct="${i}" value="${x.v}" aria-label="${esc(x.n)} per month"><em>/mo</em></label><button class="rr-toggle" type="button" role="switch" aria-checked="${x.on}" data-acctog="${i}" aria-label="${esc(x.n)} on or off"><img class="on" src="assets/rr/toggle-on.svg" width="40" height="22" alt=""><img class="off" src="assets/rr/toggle-off.svg" width="40" height="22" alt=""></button></div>`).join('')}
      <button class="rr-wadd" type="button" id="rrWAdd">+ Add another account</button></div>
    <div class="rr-kv lab"><span>Where your ${money(a.I)} goes each month</span><span class="rr-mut">${money(total)} set aside</span></div>
    <div class="rr-stack thin">${on.map(x => `<span style="width:${(+x.v || 0) / Math.max(a.I, total) * 100}%;background:${AV[x.n] === '#DDFF55' ? '#DDFF55' : x.n === 'Rent' ? '#11425D' : AV[x.n] || '#8FAAC0'}"></span>`).join('')}</div>
    <p class="rr-small">Stays in Chequing for everyday spending: ${money(Math.max(0, a.I - total))}/month</p>
    <div class="rr-wnote"><span class="sp"><img src="assets/rr/sparkle-white.svg" width="16" height="15" alt=""></span><p>${a.I - total >= flex ? `Suggested from your last 6 months. Your everyday spending stays about the same as now (${money(flex)}), so this shouldn't feel tight.` : `Heads up: this leaves ${money(Math.max(0, a.I - total))} for everyday spending, less than the ${money(flex)} you usually spend. Lower an amount or turn one off.`}</p></div>
    <div class="rr-wf"><button class="rr-btn2" type="button" data-step="1">Back</button><span class="sp2"></span><button class="rr-btn" type="button" data-step="3">Next: automate it</button></div>`;
  else if (W.step === 3) body = `<h2 class="rr-serif rr-wt">Automate it</h2><p class="rr-ws">Money moves on its own, so you don't have to remember.</p>
    <b class="rr-wq">When should money move?</b>
    <div class="rr-segw2" role="group" aria-label="When money moves">${[['payday', 'Every payday'], ['first', '1st of the month'], ['custom', 'Custom']].map(([k, l]) => `<button type="button" data-when="${k}" aria-pressed="${W.when === k}">${l}</button>`).join('')}</div>
    ${W.when === 'custom' ? `<label class="rr-kv lab" for="rrWDay">Day of the month <select id="rrWDay">${Array.from({ length: 28 }, (_, i) => `<option${i + 1 === W.day ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>` : `<p class="rr-small">${W.when === 'payday' ? 'Paid twice a month? Each amount is split in half: the 15th and the last day of each month.' : 'Everything moves once, on the 1st.'}</p>`}
    <div class="rr-wtab"><b>On each ${W.when === 'payday' ? 'payday' : 'transfer day'}, move:</b>${on.map(x => `<p><span>${esc(x.n)}${x.n === 'Emergency fund' ? ' (Savings)' : ''}</span><b>${money2((+x.v || 0) / split)}</b></p>`).join('')}<p class="tot"><span>Total each ${W.when === 'payday' ? 'payday' : 'time'}</span><b>${money2(total / split)}</b></p></div>
    <label class="rr-wchk"><input type="checkbox" id="rrWAgree"${W.agree ? ' checked' : ''}><span>Open ${on.filter(x => x.n !== 'Emergency fund').length} new accounts (${on.filter(x => x.n !== 'Emergency fund').map(x => x.n.split(' ')[0]).join(', ')}). I can pause, change or close them any time.</span></label>
    <div class="rr-wf"><button class="rr-btn2" type="button" data-step="2">Back</button><span class="sp2"></span><button class="rr-btn" type="button" id="rrWGo"${W.agree ? '' : ' disabled'}>Open accounts and start</button></div>`;
  else body = `<div class="rr-wdone"><span class="ck" aria-hidden="true">✓</span><h2 class="rr-serif">You're all set${nm ? ', ' + esc(nm) : ''}</h2><p>Your ${on.filter(x => x.n !== 'Emergency fund').length} new accounts are opening. The first ${money2(total / split)} moves on your next ${W.when === 'payday' ? 'payday' : 'transfer day'}, ${nextPayday(W.when, W.day)}. You can pause or change this any time.</p><button class="rr-btn" type="button" id="rrWDone">Back to dashboard</button></div>`;
  el.classList.toggle('done', W.step === 4);
  el.innerHTML = (W.step === 4 ? '' : head) + body;
  const x = $('#rrWalkX'); if (x) x.onclick = closeWalk;
  $$('#rrWalk [data-step]').forEach(b => b.onclick = () => { W.step = +b.dataset.step; walkRender(); });
  $$('#rrWalk [data-acct]').forEach(inp => inp.onchange = () => { W.accts[+inp.dataset.acct].v = +String(inp.value).replace(/[^0-9.]/g, '') || 0; walkRender(); });
  $$('#rrWalk [data-acctog]').forEach(b => b.onclick = () => { const i = +b.dataset.acctog; W.accts[i].on = !W.accts[i].on; walkRender(); });
  const add = $('#rrWAdd'); if (add) add.onclick = () => { W.accts.push({ n: 'New account ' + (W.accts.length - 4), v: 0, on: true }); walkRender(); };
  $$('#rrWalk [data-when]').forEach(b => b.onclick = () => { W.when = b.dataset.when; walkRender(); });
  const dsel = $('#rrWDay'); if (dsel) dsel.onchange = () => { W.day = +dsel.value; };
  const ag = $('#rrWAgree'); if (ag) ag.onchange = () => { W.agree = ag.checked; $('#rrWGo').disabled = !ag.checked; };
  const go = $('#rrWGo'); if (go) go.onclick = () => { store.set('cm.rr.plan', { id: a.id, when: W.when, accts: W.accts.filter(x => x.on), at: Date.now() }); W.step = 4; walkRender(); document.dispatchEvent(new CustomEvent('cm:plan', { detail: { id: a.id, ok: true, needM: 6, first: Infinity, last: Infinity } })); };
  const dn = $('#rrWDone'); if (dn) dn.onclick = () => { closeWalk(); CM.go('overview'); RR.toast('Saving plan started'); };
  const f = el.querySelector('button, input'); if (f && !el.contains(document.activeElement)) f.focus();
}
const money2 = v => Math.abs(v - Math.round(v)) > .001 ? '$' + v.toFixed(2) : money(v);
let wFocus = null;
function openWalk(opts = {}) { wFocus = document.activeElement; walkInit(opts); $('#rrWalkScrim').hidden = false; walkRender(); }
function closeWalk() { $('#rrWalkScrim').hidden = true; if (wFocus) wFocus.focus(); }

/* ================= wiring ================= */
RR.RENDER.yourdata = renderData;
RR.RENDER.investing = renderInvest;
document.addEventListener('click', e => { const b = e.target.closest('[data-rr-walk]'); if (b) openWalk(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#rrWalkScrim').hidden) closeWalk(); });
$('#rrWalkScrim').addEventListener('click', e => { if (e.target.id === 'rrWalkScrim') closeWalk(); });
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (CM.view === 'yourdata') renderData(); if (CM.view === 'investing') renderInvest(); }, 200); });
window.RR.openWalk = openWalk;
})();
