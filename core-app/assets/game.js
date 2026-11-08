/* ChequeMate Quests: XP, chess ranks, badges, missions, resilience score, and Mate the coach.
   Listens to cm:* events from app.js. Progress lives in this browser only. */
(() => {
'use strict';
const CM = window.ChequeMate, D3 = window.CM3D || { ok: false };
if (!CM) return;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const { money, pct, esc, store, runway } = CM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduce = CM.reduceMotion;
const on = (n, f) => document.addEventListener('cm:' + n, e => { try { init(); f(e.detail || {}); } catch (err) { console.error('[quests]', err); } });
const V = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------------- ranks, badges, missions ---------------- */
const RANKS = [
  { id: 'pawn', name: 'Pawn', xp: 0, pal: 'accent', line: 'Every grandmaster starts as a pawn. Explore a customer to earn your first XP.' },
  { id: 'knight', name: 'Knight', xp: 100, pal: 'mint', line: 'You can jump over problems now. Try every shock card.' },
  { id: 'bishop', name: 'Bishop', xp: 250, pal: 'purple', line: 'You see the long diagonals. Build plans that outlast EI.' },
  { id: 'rook', name: 'Rook', xp: 450, pal: 'warn', line: 'Solid as a castle wall. Close a few cases.' },
  { id: 'queen', name: 'Queen', xp: 700, pal: 'crit', line: 'Every move is open to you. One rank left.' },
  { id: 'king', name: 'King', xp: 1000, pal: 'gold', line: 'Checkmate. Nothing knocks you over.' },
];
const GLYPH = { pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚' };
const B = (id, name, desc, xp, c, ic) => ({ id, name, desc, xp, c, ic });
const BADGES = [
  B('open', 'Opening move', 'Open ChequeMate for the first time.', 10, 'accent', '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  B('tour', 'Grand tour', 'Visit every page.', 40, 'teal', '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  B('paradox', 'Paradox proven', 'Open both accounts from the paradox headline.', 30, 'indigo', '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>'),
  B('case10', 'Case load', 'Open 10 different customers.', 30, 'accent', '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
  B('case50', 'Branch manager', 'Open 50 different customers.', 60, 'indigo', '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>'),
  B('fortress', 'Fortress found', 'Open a customer who scores 90 or more.', 25, 'good', '<path d="M4 20V9h3V6h2v3h2V6h2v3h2V6h2v3h3v11zM10 20v-4a2 2 0 0 1 4 0v4"/>'),
  B('rescue', 'First responder', 'Open a customer who scores under 15.', 25, 'crit', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="m6 6 3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18"/>'),
  B('stress', 'Stress tester', 'Try all six shock cards.', 40, 'warn', '<path d="M13 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>'),
  B('storm', 'Weathered the storm', 'Find a customer who survives the Perfect storm.', 40, 'purple', '<path d="M3 12a9 9 0 0 1 18 0zM12 12v6a2 2 0 0 0 4 0"/>'),
  B('comeback', 'Comeback plan', 'Turn a shock they would lose into one they survive.', 50, 'good', '<path d="M4 17 10 11l4 4 6-7M15 8h5v5"/>'),
  B('rules', 'Rule of thumb', 'Try all six budget rules.', 30, 'purple', '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'),
  B('fit', 'Perfect fit', "Pick a customer's closest-fit budget rule.", 20, 'accent', '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
  B('zero', 'Every dollar has a job', 'Balance a zero-based budget with money going to savings.', 40, 'mint', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9"/>'),
  B('ask1', 'First question', 'Ask Mate a question.', 15, 'good', '<path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.7L4 19.5l1.2-3.6A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z"/>'),
  B('ask10', 'Deep thinker', 'Ask Mate 10 questions.', 40, 'yellow', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  B('kyc', 'Know your customer', 'Save a customer profile.', 20, 'gray', '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 15.5c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h4M14.5 13.5h3"/>'),
  B('byod', 'Bring your own data', 'Upload a monthly_summary.csv.', 40, 'teal', '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>'),
  B('case', 'Case closed', 'Finish every mission for one customer.', 80, 'good', '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M9 13.5l2 2 4-4"/>'),
  B('night', 'Night shift', 'Switch to dark mode.', 10, 'indigo', '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  B('streak3', 'On a roll', 'Come back three days in a row.', 40, 'warn', '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2.4 1.6 3 3.6 3 5 1-.6 1.6-1.8 1.8-3 1.8 1.6 3.6 4.2 3.6 7.4 0 3.2-2.4 5.6-6 5.6z"/>'),
  B('survivor', 'Survivor', 'Get a customer through all 12 months of Runway Run.', 50, 'good', '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  B('underdog', 'Underdog', 'Win Runway Run with a customer whose layoff runway is under 3 months.', 60, 'crit', '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.4 3.6-9.4 2.4 1.6 3 3.6 3 5 1-.6 1.6-1.8 1.8-3 1.8 1.6 3.6 4.2 3.6 7.4 0 3.2-2.4 5.6-6 5.6z"/>'),
  B('clutch', 'Clutch', 'Win Runway Run with less than 10% of the starting buffer left.', 40, 'warn', '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3h5M12 3v2.5"/>'),
  B('reader', 'Runway reader', 'Get 5 right in a row in Who lasts longer?', 30, 'teal', '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  B('oracle', 'Oracle', 'Get 10 right in a row in Who lasts longer?', 60, 'purple', '<circle cx="12" cy="11" r="7"/><path d="M8 21h8M9.5 18h5M9 9.5a3.5 3.5 0 0 1 3-2"/>'),
  B('king', 'Checkmate', 'Reach the rank of King.', 0, 'yellow', '<path d="M4 18h16M5 15 3.5 7l5 4L12 5l3.5 6 5-4L19 15z"/>'),
];
const BADGE = Object.fromEntries(BADGES.map(b => [b.id, b]));
const MISSIONS = [
  { id: 'layoff', name: 'Run the layoff', desc: 'Apply the "Laid off, EI at 55%" card in the Shock lab.', go: 'shock', preset: 'layoff' },
  { id: 'stress', name: 'Stress test three ways', desc: 'Try three different shock cards on this customer.', go: 'shock' },
  { id: 'rescue', name: 'Write the rescue plan', desc: 'On the Plan page, stack moves until runway clears the EI period.', go: 'plan' },
  { id: 'fit', name: 'Find the right budget', desc: 'Select the rule marked "Closest fit" on the Budget page.', go: 'budget' },
  { id: 'ask', name: 'Ask Mate', desc: 'Ask the coach anything about this customer.', go: 'coach' },
  { id: 'kyc', name: 'Fill in the profile', desc: "Save the details the bank's data can't know.", go: 'profile' },
];
const SHOCK_IDS = CM.SHOCKS.filter(s => s.id !== 'none').map(s => s.id);
const ALL_VIEWS = ['paradox', 'customer', 'shock', 'plan', 'budget', 'invest', 'coach', 'data', 'resources', 'profile', 'arena', 'play'];

/* ---------------- state ---------------- */
const KEY = 'cm.game';
const fresh = () => ({ xp: 0, badges: {}, views: [], accts: [], presets: [], rules: [], asked: 0, m: {}, plans: [], kyc: [], last: '', streak: 0 });
let G = Object.assign(fresh(), store.get(KEY, {}));
const save = () => store.set(KEY, G);
const rankIdx = xp => { let i = 0; RANKS.forEach((r, k) => { if (xp >= r.xp) i = k; }); return i; };
let IMG = {};

/* ---------------- resilience score (0-100) ---------------- */
function scoreOf(a) {
  if (!a) return { score: 0, parts: [] };
  const ei = runway(a.B, a.I, a.S, { mult: .55 }).v;
  const r = ei === Infinity ? 1 : clamp(ei, 0, 12) / 12;
  const bm = a.S > 0 ? clamp(a.B / a.S, 0, 6) / 6 : 1;
  const sr = a.I > 0 ? clamp((a.I - a.S) / a.I, 0, .25) / .25 : 0;
  const ng = a.neg > 0 ? clamp(1 - a.neg / 20, 0, 1) : 1;
  const parts = [
    { k: 'Runway on EI', max: 45, v: r, tip: 'Cut spending or add side income on the Plan page to stretch the runway.', go: 'plan' },
    { k: 'Safety net', max: 25, v: bm, tip: 'Grow the buffer toward 6 months of spending with a payday transfer.', go: 'plan' },
    { k: 'Saving rate', max: 20, v: sr, tip: 'Keep 25% of income each month. The Budget page shows where it can come from.', go: 'budget' },
    { k: 'Never overdrawn', max: 10, v: ng, tip: 'Days below zero are the earliest warning sign in the data. Keep a small floor in the account.', go: 'customer' },
  ].map(p => Object.assign(p, { pts: Math.round(p.v * p.max) }));
  return { score: parts.reduce((s, p) => s + p.pts, 0), parts };
}
const TIERS = [[85, 'Fortress', 'good'], [65, 'Strong', 'good'], [45, 'Steady', 'info'], [25, 'Tight', 'warn'], [0, 'Fragile', 'crit']];
const tierOf = s => { const t = TIERS.find(([m]) => s >= m); return { name: t[1], tone: t[2] }; };
let SC = null, SCsrc = null;
function scores() {
  const d = CM.data; if (SC && SCsrc === d) return SC;
  const list = CM.ids.map(id => { const a = d[id]; return { id, s: scoreOf(Object.assign({ id }, a)).score, ei: runway(a.B, a.I, a.S, { mult: .55 }).v }; });
  SC = { list, sorted: list.map(x => x.s).sort((a, b) => a - b), by: Object.fromEntries(list.map(x => [x.id, x.s])) }; SCsrc = d; return SC;
}
function beats(s) { const a = scores().sorted; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < s) lo = m + 1; else hi = m; } return lo / (a.length || 1); }

/* ---------------- piece icons ---------------- */
function pieceImg(id, cls = '') {
  return IMG[id] ? `<img class="pc ${cls}" src="${IMG[id]}" alt="" draggable="false">` : `<span class="pc glyph ${cls}" aria-hidden="true">${GLYPH[id] || GLYPH.pawn}︎</span>`;
}

/* ---------------- sound (synthesised, no files) ---------------- */
let sfxOn = store.get('cm.sfx', true), AC = null;
function ac() { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); } if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, at, dur, type = 'sine', vol = .07, to) {
  const a = ac(); if (!a) return; const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .03);
}
function sfx(n) {
  if (!sfxOn) return;
  try {
    switch (n) {
      case 'xp': tone(988, 0, .1, 'sine', .05); tone(1480, .06, .14, 'sine', .05); break;
      case 'badge': [659, 784, 988, 1319].forEach((f, i) => tone(f, i * .07, .28, 'triangle', .06)); break;
      case 'promote': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .45, 'triangle', .07)); tone(1568, .5, .7, 'sine', .04); break;
      case 'coin': tone(1319, 0, .07, 'square', .025); tone(1976, .05, .16, 'square', .025); break;
      case 'bad': tone(392, 0, .22, 'sawtooth', .035, 196); break;
      case 'flip': tone(520, 0, .06, 'triangle', .04, 900); break;
      case 'tap': tone(760, 0, .035, 'sine', .03); break;
      case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * .1, .32, 'triangle', .07)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, i * .16, .34, 'triangle', .06)); break;
    }
  } catch (e) { /* audio optional */ }
}
function sfxRender() { const b = $('#sfxBtn'); if (b) { b.setAttribute('aria-pressed', String(sfxOn)); b.title = sfxOn ? 'Sound on' : 'Sound off'; } }

/* ---------------- Mate's voice (Web Speech, optional) ---------------- */
let voiceOn = store.get('cm.voice', false);
function voiceRender() { const b = $('#voiceBtn'); if (!b) return; if (!('speechSynthesis' in window)) { b.hidden = true; return; } b.setAttribute('aria-pressed', String(voiceOn)); b.textContent = `Read answers aloud: ${voiceOn ? 'on' : 'off'}`; }
function speak(text) {
  if (!voiceOn || !('speechSynthesis' in window)) return false;
  const clean = String(text).replace(/\*\*|[*#_`>]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\$(\d)/g, '$1 dollars ').slice(0, 900);
  const u = new SpeechSynthesisUtterance(clean); u.rate = 1.04; u.pitch = 1.18;
  const vs = speechSynthesis.getVoices(); const v = vs.find(x => /en-CA/i.test(x.lang)) || vs.find(x => /Samantha|Google US English|Aria|Jenny/i.test(x.name)) || vs.find(x => /^en/i.test(x.lang)); if (v) u.voice = v;
  u.onstart = () => mates.forEach(m => m.talk(60000)); u.onend = u.onerror = () => mates.forEach(m => m.talk(0));
  speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
}

/* ---------------- XP, badges, missions ---------------- */
let popSum = 0, popT;
function addXP(n, why) {
  if (!n) return;
  const before = rankIdx(G.xp); G.xp += n; save();
  popSum += n; clearTimeout(popT);
  const pop = $('#xpPop'); pop.textContent = `+${popSum} XP`; pop.classList.remove('on'); void pop.offsetWidth; pop.classList.add('on');
  popT = setTimeout(() => { popSum = 0; }, 1400);
  sfx('xp');
  const hud = $('#tbXp'); if (hud) { hud.classList.remove('bump'); void hud.offsetWidth; hud.classList.add('bump'); }
  const after = rankIdx(G.xp);
  hudRender();
  if (after > before) promote(after);
}
function unlock(id) {
  if (G.badges[id] || !BADGE[id]) return false;
  G.badges[id] = Date.now(); save();
  const b = BADGE[id];
  queueCard({ icon: `<span class="bdg-ic" style="--bc:var(--${b.c})"><svg viewBox="0 0 24 24">${b.ic}</svg></span>`, kicker: 'Badge unlocked', title: b.name, sub: b.desc, xp: b.xp });
  addXP(b.xp, b.name);
  burst(60); sfx('badge'); mates.forEach(m => m.celebrate());
  if (CM.view === 'arena') renderArena();
  return true;
}
function promote(i) {
  const r = RANKS[i];
  queueCard({ icon: pieceImg(r.id, 'lg'), kicker: 'Promoted', title: `You're now a ${r.name}`, sub: r.line, xp: 0, big: true });
  burst(170); sfx('promote'); mates.forEach(m => m.celebrate());
  if (rank3d) rank3d.set(r.id, r.pal);
  if (r.id === 'king') setTimeout(() => unlock('king'), 600);
  say(`Promotion! You're a ${r.name} now. ${r.line}`, [['See my rank', () => CM.go('arena')]], 6500);
}
function mission(id, key) {
  if (!id) return;
  const m = G.m[id] || (G.m[id] = {}); if (m[key]) return;
  m[key] = Date.now(); save();
  const ms = MISSIONS.find(x => x.id === key);
  addXP(20, ms.name);
  CM.toast(`Mission done: ${ms.name}`);
  if (MISSIONS.every(x => m[x.id])) { unlock('case'); }
  if (CM.view === 'arena') renderArena();
}

/* ---------------- achievement cards (Dynamic Island style) ---------------- */
const cardQ = []; let cardBusy = false;
function queueCard(c) { cardQ.push(c); if (!cardBusy) nextCard(); }
function nextCard() {
  const el = $('#achv'); const c = cardQ.shift(); if (!c) { cardBusy = false; return; }
  cardBusy = true;
  el.innerHTML = `<div class="achv-in${c.big ? ' big' : ''}">${c.icon}<div class="achv-t"><span class="k">${esc(c.kicker)}</span><strong>${esc(c.title)}</strong><span class="s">${esc(c.sub)}</span></div>${c.xp ? `<span class="achv-xp">+${c.xp}</span>` : ''}</div>`;
  el.classList.add('on');
  setTimeout(() => { el.classList.remove('on'); setTimeout(nextCard, 450); }, c.big ? 4200 : 3200);
}

/* ---------------- confetti ---------------- */
let confRAF = null; const bits = [];
function burst(n = 120) {
  if (reduce) return;
  const c = $('#confetti'); if (!c) return; const ctx = c.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['--ring1', '--ring2', '--ring3', '--accent', '--yellow', '--purple', '--mint'].map(V);
  for (let i = 0; i < n; i++) bits.push({ x: innerWidth / 2 + (Math.random() - .5) * 160, y: 70, vx: (Math.random() - .5) * 15, vy: Math.random() * -9 - 3, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .35, w: 6 + Math.random() * 6, h: 4 + Math.random() * 8, c: cols[i % cols.length], life: 0, round: Math.random() < .3 });
  c.style.display = 'block';
  if (confRAF) return;
  const step = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.vy += .32; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life++;
      if (b.y > innerHeight + 30 || b.life > 260) { bits.splice(i, 1); continue; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.globalAlpha = Math.min(1, (260 - b.life) / 60);
      if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.w / 2.4, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.life / 7)));
      ctx.restore();
    }
    if (bits.length) confRAF = requestAnimationFrame(step); else { confRAF = null; c.style.display = 'none'; }
  };
  confRAF = requestAnimationFrame(step);
}

/* ---------------- HUD: toolbar pill + sidebar player card ---------------- */
function hudRender() {
  const i = rankIdx(G.xp), r = RANKS[i], nx = RANKS[i + 1];
  const p = nx ? (G.xp - r.xp) / (nx.xp - r.xp) : 1;
  const tb = $('#tbXp'); if (tb) tb.innerHTML = `${pieceImg(r.id, 'sm')}<span class="tbx-t"><b>${r.name}</b><span>${G.xp} XP</span></span><span class="tbx-ring" style="--p:${(p * 100).toFixed(1)}"></span>`;
  const sp = $('#sidePlayer'); if (sp) sp.innerHTML = `${pieceImg(r.id, 'md')}<span class="spl-t"><b>${r.name}</b><span>${nx ? `${nx.xp - G.xp} XP to ${nx.name}` : 'Top rank reached'}</span><span class="spl-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span></span>`;
}

/* ---------------- Mate: floating dock, bubble, coach page ---------------- */
const mates = []; let mateSmall = null, mateBig = null;
let sayT;
function say(text, actions = [], ms = 8000) {
  const b = $('#mateBubble'); if (!b) return;
  $('#mateText').innerHTML = text;
  $('#mateAct').innerHTML = actions.map(([l], i) => `<button type="button" class="btn sm${i === 0 ? ' primary' : ''}" data-i="${i}">${esc(l)}</button>`).join('');
  $$('#mateAct button').forEach(btn => btn.onclick = () => { hideSay(); actions[+btn.dataset.i][1](); });
  b.hidden = false; requestAnimationFrame(() => b.classList.add('on'));
  mates.forEach(m => m.talk(Math.min(2600, 600 + text.length * 18)));
  clearTimeout(sayT); if (ms) sayT = setTimeout(hideSay, ms);
}
function hideSay() { const b = $('#mateBubble'); if (!b) return; b.classList.remove('on'); setTimeout(() => { if (!b.classList.contains('on')) b.hidden = true; }, 250); }
function moodFor(a) { if (!a) return 'good'; const v = runway(a.B, a.I, a.S, { mult: .55 }).v; return v === Infinity || v >= 6 ? 'good' : v >= 3 ? 'warn' : 'crit'; }
function setMoods() { const m = moodFor(CM.acc()); mates.forEach(x => x.setMood(m)); }
function weakest(a) { const s = scoreOf(a); return s.parts.slice().sort((x, y) => (y.max - y.pts) - (x.max - x.pts))[0]; }
function tipFor(v) {
  const a = CM.acc(); if (!a) return null;
  const pf = CM.profile(), ei = runway(a.B, a.I, a.S, { mult: .55 }), s = scoreOf(a), t = tierOf(s.score), w = weakest(a);
  const nm = `<b>${esc(pf.name)}</b>`;
  switch (v) {
    case 'paradox': return ['Big paycheques run out first. Select any dot on the chart to open that customer and test it yourself.', [['Open a random customer', () => $('#acctRandom').click()]]];
    case 'customer': return [`${nm} scores <b>${s.score}/100</b>, which is ${t.name.toLowerCase()}. ${ei.v === Infinity ? "A layoff wouldn't open a monthly gap." : `On EI the buffer lasts <b>${CM.rwText(ei)} months</b>${ei.v < 6 ? ', short of the 6 months EI pays' : ''}.`} Biggest gain: ${w.k.charAt(0).toLowerCase() + w.k.slice(1)}.`, [['Stress test it', () => CM.go('shock')], ['See missions', () => CM.go('arena')]]];
    case 'shock': { const won = bossResults(a).filter(x => x.ok).length; return [`Each card is a boss. ${nm} survives <b>${won} of ${SHOCK_IDS.length}</b>. The Perfect storm is the hardest one.`, [['Fight the Perfect storm', () => { CM.applyPreset('storm'); CM.go('shock'); }]]]; }
    case 'plan': return ['Stack moves until the bar crosses the dashed EI line. Each step shows how many months it buys.', []];
    case 'budget': return ['Pick the rule marked <b>Closest fit</b> to finish a mission. Zero-based is the expert mode.', []];
    case 'invest': return ['Emergency fund first, then TFSA. Slide the calculator to see what a small monthly amount grows into.', []];
    case 'data': return ['Drop your own monthly_summary.csv and I\'ll score every account right here in your browser.', []];
    case 'resources': return ['These are the official sources behind every number. EI is the one to bookmark.', []];
    case 'profile': return [`Saving ${nm}'s profile finishes a mission and makes my advice sharper.`, []];
    case 'arena': { const m = G.m[CM.st.id] || {}; const left = MISSIONS.filter(x => !m[x.id]); return [left.length ? `${left.length} mission${left.length > 1 ? 's' : ''} left for ${nm}. Next: <b>${left[0].name.toLowerCase()}</b>.` : `Every mission is done for ${nm}. Open someone from the Rescue list.`, left.length ? [['Go', () => CM.go(left[0].go)]] : []]; }
    default: return null;
  }
}
const seenTip = new Set();
function mountMates() {
  if (!mateSmall && $('#mateSmall')) { mateSmall = D3.mountMate ? D3.mountMate($('#mateSmall'), { cam: [0, 1.0, 4.3], look: [0, .78, 0], fov: 27 }) : null; if (mateSmall) mates.push(mateSmall); }
  $('#mateDock').onclick = () => { const b = $('#mateBubble'); if (!b.hidden && b.classList.contains('on')) { hideSay(); return; } const t = tipFor(CM.view); if (t) say(t[0], t[1]); mateSmall && mateSmall.celebrate(); };
  $('#mateClose').onclick = hideSay;
  setMoods();
}
function mountBig() {
  if (mateBig || !$('#mateBig') || !D3.mountMate) return;
  mateBig = D3.mountMate($('#mateBig'), { cam: [0, 1.05, 4.0], look: [0, .82, 0], fov: 28 }); mates.push(mateBig); setMoods();
}

/* ---------------- customer: resilience score panel ---------------- */
function renderScore() {
  const el = $('#scorePanel'); const a = CM.acc(); if (!el || !a) return;
  const s = scoreOf(a), t = tierOf(s.score), b = beats(s.score), w = weakest(a);
  const R = 74, arc = Math.PI * R;
  el.innerHTML = `<div class="panel score-panel">
    <div class="gauge-wrap">
      <svg class="gauge" viewBox="0 0 180 104" role="img" aria-label="Resilience score ${s.score} out of 100">
        <defs><linearGradient id="gGrad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--crit)"/><stop offset=".45" stop-color="var(--warn)"/><stop offset="1" stop-color="var(--good)"/></linearGradient></defs>
        <path d="M16 92a${R} ${R} 0 0 1 148 0" class="g-track"/>
        <path d="M16 92a${R} ${R} 0 0 1 148 0" class="g-arc" stroke="url(#gGrad)" style="stroke-dasharray:${arc};stroke-dashoffset:${arc}" data-off="${arc * (1 - s.score / 100)}"/>
      </svg>
      <div class="g-num"><span class="n" data-to="${s.score}">0</span><span class="u">/100</span></div>
    </div>
    <div class="score-main">
      <span class="eyebrow">Resilience score</span>
      <div class="score-tier"><span class="pill ${t.tone}">${t.name}</span>${pieceImg(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][Math.min(5, Math.floor(s.score / 17))], 'sm')}</div>
      <p>Scores higher than <b>${pct(b)}</b> of the bank's customers. It blends runway on EI, safety net, saving rate and overdraft history.</p>
      <p class="score-tip"><b>Biggest gain:</b> ${esc(w.tip)} <a href="#${w.go}">Open ${esc(w.go === 'plan' ? 'Plan' : w.go === 'budget' ? 'Budget' : 'details')}</a></p>
    </div>
    <div class="score-parts">${s.parts.map(p => `<div class="sp-row"><span class="sp-k">${p.k}</span><span class="sp-track"><i data-w="${p.pts / p.max * 100}" style="--c:var(--${p.v >= .66 ? 'good' : p.v >= .33 ? 'warn' : 'crit'})"></i></span><span class="sp-v">${p.pts}<small>/${p.max}</small></span></div>`).join('')}</div>
  </div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const g = $('.g-arc', el); if (g) g.style.strokeDashoffset = g.dataset.off;
    $$('.sp-track i', el).forEach(i => i.style.width = i.dataset.w + '%');
  }));
  const n = $('.g-num .n', el); const to = s.score;
  if (reduce) n.textContent = to; else { const t0 = performance.now(); const st = now => { const k = Math.min(1, (now - t0) / 1100); n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }
}

/* ---------------- shock lab: boss rush ---------------- */
function bossResults(a) {
  return CM.SHOCKS.filter(s => s.id !== 'none').map(s => {
    const sh = Object.assign({ inc: 100, ei: 6, bills: 0, extra: 0, one: 0, oneMult: null, after: 'back' }, s.set);
    const r = runway(a.B, a.I, a.S, CM.shockParams(a, sh)), need = sh.inc < 100 ? sh.ei : 6;
    return { id: s.id, name: s.name, r, ok: r.v === Infinity || r.v >= need };
  });
}
function decorateShock() {
  const a = CM.acc(); if (!a || !$('#twists')) return;
  const res = bossResults(a);
  res.forEach(x => { const card = $(`#twists .twist[data-p="${x.id}"]`); if (card && !$('.boss', card)) card.insertAdjacentHTML('beforeend', `<span class="boss ${x.ok ? 'won' : 'lost'}">${x.ok ? 'Survives' : x.r.v === 0 ? 'Out on day one' : `Out in month ${Math.max(1, Math.ceil(x.r.v))}`}</span>`); });
  const won = res.filter(x => x.ok).length;
  $('#bossBar').innerHTML = `<div class="bb-l"><span class="bb-k">Boss rush</span><strong>Survives ${won} of ${res.length} scenarios</strong></div><div class="bb-pips">${res.map(x => `<span class="pip ${x.ok ? 'won' : 'lost'}" title="${esc(x.name)}: ${x.ok ? 'survives' : 'runs out'}"></span>`).join('')}</div>`;
}

/* ---------------- arena ---------------- */
let rank3d = null;
function renderArena() {
  const i = rankIdx(G.xp), r = RANKS[i], nx = RANKS[i + 1];
  if (!rank3d && $('#rankStage')) rank3d = D3.mountRank ? D3.mountRank($('#rankStage'), r.id, r.pal) : null;
  else if (rank3d) rank3d.set(r.id, r.pal);
  $('#rankName').textContent = r.name; $('#rankLine').textContent = r.line;
  const p = nx ? (G.xp - r.xp) / (nx.xp - r.xp) : 1;
  $('#xpFill').style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => $('#xpFill').style.width = (p * 100).toFixed(1) + '%'));
  $('#xpBarWrap').setAttribute('aria-valuenow', Math.round(p * 100));
  $('#xpNow').textContent = `${G.xp} XP`; $('#xpNext').textContent = nx ? `${nx.xp - G.xp} XP to ${nx.name}` : 'Top rank';
  const nb = Object.keys(G.badges).length;
  $('#rankStats').innerHTML = [['Badges', `${nb}/${BADGES.length}`], ['Customers opened', G.accts.length], ['Questions asked', G.asked], ['Day streak', G.streak]]
    .map(([k, v]) => `<div><span class="v">${v}</span><span class="k">${k}</span></div>`).join('');

  const id = CM.st.id, m = G.m[id] || {}, done = MISSIONS.filter(x => m[x.id]).length;
  $('#missionPill').innerHTML = `<span class="pill ${done === MISSIONS.length ? 'good' : 'info'}">${done} of ${MISSIONS.length} done</span>`;
  $('#missions').innerHTML = MISSIONS.map(x => `<div class="mission${m[x.id] ? ' done' : ''}"><span class="ms-check">${m[x.id] ? '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</span><div><h3>${x.name}</h3><p>${x.desc}</p></div>${m[x.id] ? '<span class="ms-xp">+20</span>' : `<button class="btn sm" type="button" data-go="${x.go}" data-preset="${x.preset || ''}">Go</button>`}</div>`).join('');
  $$('#missions [data-go]').forEach(b => b.onclick = () => { if (b.dataset.preset) CM.applyPreset(b.dataset.preset); CM.go(b.dataset.go); });

  $('#rankLadder').innerHTML = RANKS.map((x, k) => `<div class="rung ${k < i ? 'past' : k === i ? 'now' : 'next'}">${pieceImg(x.id, 'md')}<div><strong>${x.name}</strong><span>${x.xp} XP</span></div>${k < i ? '<span class="pill good">Earned</span>' : k === i ? '<span class="pill info">You are here</span>' : ''}</div>`).join('');

  $('#badgeSub').textContent = `${nb} of ${BADGES.length} unlocked`;
  $('#badges').innerHTML = BADGES.map(b => { const got = G.badges[b.id]; return `<div class="badge${got ? ' got' : ''}" title="${esc(b.desc)}"><span class="bdg-ic" style="--bc:var(--${b.c})"><svg viewBox="0 0 24 24">${got ? b.ic : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>'}</svg></span><strong>${b.name}</strong><span>${b.desc}</span>${b.xp ? `<em>+${b.xp} XP</em>` : ''}</div>`; }).join('');

  const sc = scores(), sorted = sc.list.slice().sort((x, y) => y.s - x.s || x.id - y.id);
  const row = (x, k) => { const t = tierOf(x.s); return `<button type="button" data-id="${x.id}"><span class="lb-n">${k + 1}</span><span class="lb-id">Account ${x.id}</span><span class="lb-bar"><i style="width:${x.s}%;background:var(--${t.tone === 'info' ? 'accent' : t.tone})"></i></span><span class="pill ${t.tone}">${x.s}</span></button>`; };
  $('#lbTop').innerHTML = sorted.slice(0, 8).map(row).join('');
  $('#lbLow').innerHTML = sc.list.slice().sort((x, y) => x.s - y.s || x.ei - y.ei).slice(0, 8).map(row).join('');
  $$('#lbTop button, #lbLow button').forEach(b => b.onclick = () => { CM.setAccount(+b.dataset.id, true); CM.go('customer'); });

  $('#xpRules').innerHTML = [['New page visited', 10], ['New customer opened', 5], ['New shock card tried', 15], ['New budget rule tried', 5], ['Rescue plan that clears EI', 25], ['Question for Mate', 5], ['Mission completed', 20], ['Daily check-in', 20]]
    .map(([k, v]) => `<div><span>${k}</span><b>+${v}</b></div>`).join('');
  $('#gameReset').onclick = () => { if (!confirm('Reset your XP, badges and missions? This only affects this browser.')) return; G = fresh(); save(); hudRender(); renderArena(); CM.toast('Progress reset'); };
}

/* ---------------- init + event wiring ---------------- */
let ready = false;
function init() {
  if (ready) return; ready = true;
  // daily streak
  const d = new Date(), today = d.toISOString().slice(0, 10), y = new Date(d - 864e5).toISOString().slice(0, 10);
  if (G.last !== today) { G.streak = G.last === y ? G.streak + 1 : 1; const first = !G.last; G.last = today; save(); if (!first) setTimeout(() => addXP(20, 'Daily check-in'), 1200); }
  hudRender(); mountMates(); sfxRender(); voiceRender();
  const sb = $('#sfxBtn'); if (sb) sb.onclick = () => { sfxOn = !sfxOn; store.set('cm.sfx', sfxOn); sfxRender(); if (sfxOn) sfx('xp'); };
  const vb = $('#voiceBtn'); if (vb) vb.onclick = () => { voiceOn = !voiceOn; store.set('cm.voice', voiceOn); voiceRender(); if (voiceOn) speak("Hi, I'm Mate. I'll read my answers out loud."); else if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  const snap = () => { IMG = D3.snapshot ? D3.snapshot([...RANKS.map(r => ({ kind: r.id, pal: r.pal })), { kind: 'mate', key: 'mate' }]) : {}; if (IMG.mate) document.documentElement.style.setProperty('--mate-img', `url(${IMG.mate})`); hudRender(); if (CM.view === 'arena') renderArena(); if (CM.view === 'customer') renderScore(); };
  (window.requestIdleCallback || (f => setTimeout(f, 300)))(snap);
  setTimeout(() => unlock('open'), 900);
  if (G.streak >= 3) setTimeout(() => unlock('streak3'), 1600);
}

let hero = null;
on('view', ({ view }) => {
  if (!G.views.includes(view)) { G.views.push(view); save(); if (G.views.length > 1) addXP(10, 'New page'); }
  if (ALL_VIEWS.every(v => G.views.includes(v))) unlock('tour');
  document.body.dataset.view = view;
  if (view === 'paradox' && !hero && $('#hero3d') && D3.mountHero) hero = D3.mountHero($('#hero3d'));
  if (view === 'customer') renderScore();
  if (view === 'coach') { mountBig(); }
  if (view === 'arena') renderArena();
  setMoods();
  hideSay();
  if (!seenTip.has(view) && view !== 'coach') { seenTip.add(view); const t = tipFor(view); if (t) setTimeout(() => { if (CM.view === view) say(t[0], t[1], 7000); }, 900); }
});
on('account', ({ id }) => {
  if (id != null && CM.src.kind === 'builtin' && !G.accts.includes(id)) {
    G.accts.push(id); save(); if (G.accts.length > 1) addXP(5, 'New customer');
    if (G.accts.length >= 10) unlock('case10'); if (G.accts.length >= 50) unlock('case50');
    const pair = (window.CM_INSIGHTS || {}).pair || []; if (pair.length && pair.every(p => G.accts.includes(p))) unlock('paradox');
  }
  const s = scoreOf(CM.acc(id)).score; if (s >= 90) unlock('fortress'); if (s < 15) unlock('rescue');
  setMoods();
  setTimeout(() => { if (CM.view === 'customer') renderScore(); if (CM.view === 'arena') renderArena(); }, 0);
});
on('shock', d => {
  decorateShock();
  if (d.none || !SHOCK_IDS.includes(d.preset)) return;
  if (!G.presets.includes(d.preset)) { G.presets.push(d.preset); save(); addXP(15, 'New shock'); }
  if (SHOCK_IDS.every(p => G.presets.includes(p))) unlock('stress');
  const m = G.m[d.id] || (G.m[d.id] = {}); m.p = m.p || []; if (!m.p.includes(d.preset)) { m.p.push(d.preset); save(); }
  if (d.preset === 'layoff') mission(d.id, 'layoff');
  if (m.p.length >= 3) mission(d.id, 'stress');
  if (d.preset === 'storm' && (d.v === Infinity || d.v >= d.need)) unlock('storm');
});
on('plan', d => {
  if (!d.ok) return;
  if (!G.plans.includes(d.id)) { G.plans.push(d.id); save(); addXP(25, 'Rescue plan'); }
  mission(d.id, 'rescue');
  if (d.first !== Infinity && d.first < d.needM) unlock('comeback');
});
on('budget', d => {
  if (!G.rules.includes(d.rule)) { G.rules.push(d.rule); save(); if (G.rules.length > 1) addXP(5, 'New rule'); }
  if (G.rules.length >= 6) unlock('rules');
  if (d.best && d.rule === d.best) { mission(d.id, 'fit'); unlock('fit'); }
});
on('zb', d => { const zb = CM.st.budget.zb || []; if (d.rule === 'zero' && Math.abs(d.left) < 1 && ((+zb[7] || 0) + (+zb[8] || 0)) > 0) unlock('zero'); });
on('ask', d => { G.asked++; save(); if (G.asked <= 30) addXP(5, 'Question'); unlock('ask1'); if (G.asked >= 10) unlock('ask10'); mission(d.id, 'ask'); mates.forEach(m => m.think(true)); });
on('answer', d => { mates.forEach(m => m.think(false)); if (!speak(d.text || '')) mates.forEach(m => m.talk(Math.min(4200, 500 + (d.text || '').length * 12))); });
on('profile', d => { if (!G.kyc.includes(d.id)) { G.kyc.push(d.id); save(); addXP(15, 'Profile'); } unlock('kyc'); mission(d.id, 'kyc'); });
on('upload', () => { unlock('byod'); SC = null; });
on('run', d => {
  addXP(Math.min(120, d.months * 10), 'Runway Run');
  if (d.win) { unlock('survivor'); if (d.hard) unlock('underdog'); if (d.clutch) unlock('clutch'); }
});
on('quiz', d => { if (d.correct) addXP(5, 'Quiz'); if (d.streak >= 5) unlock('reader'); if (d.streak >= 10) unlock('oracle'); });
window.CMQuests = { sfx, burst, say, scoreOf, tierOf, mates };
on('theme', d => { const dark = d.theme === 'dark' || (d.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); if (dark) unlock('night'); hudRender(); });
})();
