/* ChequeMate 3D: glossy chess pieces and Mate, the pawn who coaches.
   three.js r128 (vendored). Every scene pauses when it is off screen, and falls back to 2D when WebGL is missing. */
(() => {
'use strict';
const T = window.THREE;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function glOK() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }
const OK = !!T && glOK();

/* Two-stop gradients, light top to deep base, taken from the app icon and the iOS system colours. */
const PAL = {
  accent: ['#6CBBFF', '#3A2FD6'],
  mint: ['#8EF5EE', '#0A8C9A'],
  purple: ['#E3B0FF', '#6A2BD0'],
  warn: ['#FFD66B', '#D9620B'],
  crit: ['#FF8FA0', '#C2102E'],
  gold: ['#FFE9A8', '#B97A08'],
  good: ['#86EFA6', '#0A7A5A'],
  ghost: ['#D5D9E2', '#8A90A0'],
};
const MOOD = { good: '#30D158', warn: '#FF9F0A', crit: '#FF453A', info: '#0A84FF' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const isDark = () => { const r = document.documentElement.getAttribute('data-theme'); return r ? r === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const lin = hex => new T.Color(hex).convertSRGBToLinear();

/* ---------- geometry ---------- */
function paint(geo, pal, y0, y1) {
  const lo = lin(pal[1]), hi = lin(pal[0]), c = new T.Color(), pos = geo.attributes.position, arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const t = clamp((pos.getY(i) - y0) / ((y1 - y0) || 1), 0, 1); c.copy(lo).lerp(hi, Math.pow(t, .7)); arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new T.BufferAttribute(arr, 3)); return geo;
}
const glossy = () => new T.MeshPhysicalMaterial({ vertexColors: true, metalness: .1, roughness: .24, clearcoat: 1, clearcoatRoughness: .06 });
const lathe = (pts, seg = 64) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);
const BASE = [[0, 0], [.62, 0], [.645, .03], [.645, .11], [.6, .15], [.62, .19], [.52, .25], [.43, .3]];
const PAWN_BODY = [...BASE, [.33, .38], [.26, .55], [.215, .78], [.33, .84], [.345, .88], [.33, .92], [.2, .97], [0, .99]];

function piece(kind, palName) {
  const pal = PAL[palName] || PAL.accent, g = new T.Group(), mat = glossy();
  let H = 1.5;
  const parts = [];
  switch (kind) {
    case 'rook':
      H = 1.4; parts.push(lathe([...BASE, [.37, .38], [.33, .98], [.42, 1.04], [.45, 1.08], [.45, 1.18], [0, 1.18]]));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = new T.BoxGeometry(.2, .2, .13); b.rotateY(a); b.translate(Math.sin(a) * .36, 1.28, Math.cos(a) * .36); parts.push(b); }
      break;
    case 'bishop':
      H = 1.78; parts.push(lathe([...BASE, [.32, .38], [.25, .6], [.19, .88], [.33, .93], [.34, .97], [.2, 1.02], [.23, 1.1], [.28, 1.24], [.26, 1.38], [.18, 1.52], [.08, 1.6], [0, 1.62]]));
      parts.push(new T.SphereGeometry(.085, 24, 16).translate(0, 1.69, 0));
      break;
    case 'queen':
      H = 1.9; parts.push(lathe([...BASE, [.34, .38], [.26, .62], [.2, 1.0], [.35, 1.05], [.36, 1.1], [.22, 1.15], [.27, 1.32], [.37, 1.5], [.3, 1.52], [.12, 1.56], [0, 1.58]]));
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; parts.push(new T.SphereGeometry(.062, 20, 14).translate(Math.sin(a) * .34, 1.56, Math.cos(a) * .34)); }
      parts.push(new T.SphereGeometry(.11, 24, 16).translate(0, 1.7, 0));
      break;
    case 'king':
      H = 2.08; parts.push(lathe([...BASE, [.35, .38], [.27, .62], [.21, 1.05], [.36, 1.1], [.37, 1.15], [.23, 1.2], [.28, 1.36], [.35, 1.52], [.3, 1.56], [.14, 1.6], [0, 1.62]]));
      parts.push(new T.BoxGeometry(.1, .42, .1).translate(0, 1.8, 0), new T.BoxGeometry(.32, .1, .1).translate(0, 1.86, 0));
      break;
    case 'knight': {
      H = 1.6; parts.push(lathe([...BASE, [.4, .36], [.38, .42], [0, .42]]));
      const s = new T.Shape();
      s.moveTo(-.3, .4); s.lineTo(.3, .4); s.quadraticCurveTo(.34, .66, .16, .8); s.quadraticCurveTo(.38, .86, .5, .98);
      s.quadraticCurveTo(.56, 1.08, .46, 1.14); s.quadraticCurveTo(.3, 1.18, .22, 1.3); s.lineTo(.2, 1.52); s.lineTo(.06, 1.4);
      s.quadraticCurveTo(-.2, 1.42, -.34, 1.12); s.quadraticCurveTo(-.42, .8, -.3, .4);
      const e = new T.ExtrudeGeometry(s, { depth: .26, bevelEnabled: true, bevelThickness: .06, bevelSize: .05, bevelSegments: 4, curveSegments: 24 });
      e.translate(0, 0, -.13); parts.push(e);
      break;
    }
    default: // pawn
      H = 1.52; parts.push(lathe(PAWN_BODY), new T.SphereGeometry(.31, 48, 32).translate(0, 1.2, 0));
  }
  parts.forEach(geo => { paint(geo, pal, 0, H); const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); });
  g.userData.H = H; g.userData.kind = kind;
  return g;
}

/* ---------- studio lighting baked into an environment map ---------- */
function makeEnv(renderer) {
  const pm = new T.PMREMGenerator(renderer), sc = new T.Scene();
  sc.add(new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshBasicMaterial({ color: 0x8d96aa, side: T.BackSide })));
  const panel = (c, w, h, x, y, z, rx, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); sc.add(m); };
  panel(0xffffff, 6, 2.4, 0, 4.9, 0, Math.PI / 2, 0);
  panel(0xffffff, 3, 4, -4.9, 1, 1, 0, Math.PI / 2);
  panel(0xdfe8ff, 3, 4, 4.9, 1.2, -1, 0, -Math.PI / 2);
  panel(0x7fb0ff, 8, 1.4, 0, -1, -4.9, 0, 0);
  const tex = pm.fromScene(sc, .035).texture; pm.dispose(); return tex;
}

/* ---------- a stage: renderer + camera + lights, paused when off screen ---------- */
class Stage {
  constructor(el, o = {}) {
    this.el = el; this.fns = []; this.alive = true; this.vis = false;
    const r = this.r = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = o.exposure || 1.08;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.setClearColor(0x000000, 0);
    r.domElement.className = 'gl'; el.appendChild(r.domElement);
    const s = this.scene = new T.Scene(); s.environment = makeEnv(r);
    const cam = this.cam = new T.PerspectiveCamera(o.fov || 28, 1, .1, 100); cam.position.set(...(o.cam || [0, 1.4, 6.2])); cam.lookAt(new T.Vector3(...(o.look || [0, .85, 0])));
    s.add(new T.HemisphereLight(0xffffff, 0x3a4660, .55));
    const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(2.5, 5, 3.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -.0005;
    Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: .5, far: 16 }); s.add(key);
    const rim = new T.DirectionalLight(0x9cc4ff, .75); rim.position.set(-3, 2.5, -4); s.add(rim);
    if (o.floor !== false) { const f = new T.Mesh(new T.PlaneGeometry(14, 14), new T.ShadowMaterial({ opacity: .17 })); f.rotation.x = -Math.PI / 2; f.position.y = o.floorY || 0; f.receiveShadow = true; s.add(f); }
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.size()); this.ro.observe(el); }
    this.size();
    if (typeof IntersectionObserver !== 'undefined') { this.io = new IntersectionObserver(es => { this.vis = es[es.length - 1].isIntersecting; }); this.io.observe(el); } else this.vis = true;
    this.t0 = performance.now(); this.last = this.t0;
    const loop = now => {
      if (!this.alive) return; requestAnimationFrame(loop);
      if (!this.vis || document.hidden) { this.last = now; return; }
      const dt = reduce ? 0 : Math.min(.05, (now - this.last) / 1000); this.last = now;
      const t = reduce ? 1.2 : (now - this.t0) / 1000; this.t = t;
      this.fns.forEach(f => f(t, dt)); r.render(s, cam);
    };
    requestAnimationFrame(loop);
  }
  size() { const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  on(f) { this.fns.push(f); }
}

/* ---------- Mate: a pawn with a face ---------- */
function makeMate() {
  const g = new T.Group(), mat = glossy(), H = 1.52, pal = PAL.accent;
  const bodyG = new T.Group(); g.add(bodyG);
  const bodyGeo = paint(lathe(PAWN_BODY), pal, 0, H); const body = new T.Mesh(bodyGeo, mat); body.castShadow = true; bodyG.add(body);
  const head = new T.Group(); head.position.set(0, 1.2, 0); bodyG.add(head);
  const hs = new T.SphereGeometry(.31, 48, 32).translate(0, 1.2, 0); paint(hs, pal, 0, H); hs.translate(0, -1.2, 0);
  const hm = new T.Mesh(hs, mat); hm.castShadow = true; head.add(hm);
  const SKIN = {
    classic: mat,
    glass: new T.MeshPhysicalMaterial({ color: lin('#A9D4FF'), transparent: true, opacity: .62, roughness: .03, metalness: .05, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.2, depthWrite: false }),
    holo: new T.MeshPhysicalMaterial({ color: lin('#7CF7FF'), emissive: lin('#1B8CFF'), emissiveIntensity: .9, transparent: true, opacity: .8, roughness: .35, depthWrite: false }),
    gold: new T.MeshPhysicalMaterial({ color: lin('#F2C14E'), metalness: 1, roughness: .2, clearcoat: 1, clearcoatRoughness: .05 }),
  };
  function setSkin(k) { const m = SKIN[k] || mat; body.material = m; hm.material = m; }
  const eyeMat = new T.MeshPhysicalMaterial({ color: 0x14151a, roughness: .12, clearcoat: 1 }), shine = new T.MeshBasicMaterial({ color: 0xffffff });
  const eyes = [-1, 1].map(sx => {
    const e = new T.Group(); e.add(new T.Mesh(new T.SphereGeometry(.058, 24, 16), eyeMat));
    const sp = new T.Mesh(new T.SphereGeometry(.019, 12, 8), shine); sp.position.set(.018, .024, .05); e.add(sp);
    e.position.set(sx * .112, .05, .272); e.scale.z = .6; head.add(e); return e;
  });
  const mouth = new T.Mesh(new T.TorusGeometry(.075, .017, 10, 24, Math.PI), new T.MeshBasicMaterial({ color: 0x14151a }));
  mouth.position.set(0, -.07, .29); mouth.rotation.set(-.25, 0, Math.PI); head.add(mouth);
  const cheekMat = new T.MeshBasicMaterial({ color: 0xff6b8a, transparent: true, opacity: .42 });
  [-1, 1].forEach(sx => { const c = new T.Mesh(new T.CircleGeometry(.046, 20), cheekMat); c.position.set(sx * .19, -.04, .247); c.rotation.y = sx * .666; head.add(c); });
  const ringMat = new T.MeshBasicMaterial({ color: lin(MOOD.good), transparent: true, opacity: .5, depthWrite: false });
  const ring = new T.Mesh(new T.RingGeometry(.68, .8, 72), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = .004; g.add(ring);

  const S = { mood: 'good', look: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, blinkAt: 1.5, jump: -1, talkUntil: 0, talking: false, think: false, t: 0 };
  function mouthFor(m) {
    if (m === 'crit') { mouth.rotation.z = 0; mouth.scale.set(.85, .75, 1); mouth.position.y = -.125; }
    else if (m === 'warn') { mouth.rotation.z = Math.PI; mouth.scale.set(.85, .28, 1); mouth.position.y = -.09; }
    else { mouth.rotation.z = Math.PI; mouth.scale.set(1, 1, 1); mouth.position.y = -.07; }
  }
  function setMood(m) { S.mood = m in MOOD ? m : 'good'; ringMat.color.copy(lin(MOOD[S.mood])); if (!S.talking) mouthFor(S.mood); }
  function update(t, dt) {
    S.t = t;
    let y = Math.sin(t * 2.1) * .035, spin = 0;
    if (S.jump >= 0) { const k = (t - S.jump) / .9; if (k >= 1) S.jump = -1; else { y += Math.sin(k * Math.PI) * .55; spin = ease(k) * Math.PI * 2; } }
    const f = Math.min(1, dt * 6); S.cur.x += (S.look.x - S.cur.x) * f; S.cur.y += (S.look.y - S.cur.y) * f;
    bodyG.position.y = y; bodyG.rotation.y = spin + S.cur.x * .3; bodyG.rotation.z = Math.sin(t * 1.3) * .03;
    head.rotation.y = S.cur.x * .55; head.rotation.x = S.think ? -.32 + Math.sin(t * 3) * .05 : S.cur.y * .35; head.rotation.z = S.think ? .2 : 0;
    if (t > S.blinkAt) { const k = (t - S.blinkAt) / .14; eyes.forEach(e => e.scale.y = k < 1 ? Math.abs(1 - 2 * k) * .9 + .1 : 1); if (k >= 1) S.blinkAt = t + 2.2 + Math.random() * 3; }
    if (performance.now() < S.talkUntil) { S.talking = true; mouth.rotation.z = Math.PI; mouth.position.y = -.075; mouth.scale.set(.9, .55 + 1.1 * Math.abs(Math.sin(t * 13)), 1); }
    else if (S.talking) { S.talking = false; mouthFor(S.mood); }
    ringMat.opacity = .32 + .2 * Math.sin(t * 2.4); ring.scale.setScalar(1 - y * .3);
  }
  return {
    group: g, update, setMood, setSkin,
    look(x, y) { S.look.x = clamp(x, -1, 1); S.look.y = clamp(y, -1, 1); },
    celebrate() { if (!reduce) S.jump = S.t; },
    talk(ms) { S.talkUntil = performance.now() + (reduce ? 0 : ms); },
    think(on) { S.think = !!on; },
  };
}

function follow(el, mate) {
  addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    mate.look((e.clientX - (r.left + r.width / 2)) / (innerWidth * .5), (e.clientY - (r.top + r.height / 2)) / (innerHeight * .5));
  }, { passive: true });
}

/* ---------- fallbacks ---------- */
const GLYPH = { pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚' };
function flat(el, kind, cls = '') { el.innerHTML = `<span class="flat-piece ${cls}" aria-hidden="true">${GLYPH[kind] || GLYPH.pawn}︎</span>`; }
const noop = () => {};

/* ---------- public mounts ---------- */
function mountMate(el, o = {}) {
  if (!OK) { flat(el, 'pawn', 'mate-flat'); return { setMood: noop, celebrate: noop, talk: noop, think: noop, look: noop, setSkin: noop }; }
  const st = new Stage(el, { cam: o.cam || [0, 1.15, 4.4], look: o.look || [0, .8, 0], fov: o.fov || 27, exposure: 1.1 });
  const m = makeMate(); st.scene.add(m.group); st.on(m.update); follow(el, m);
  return m;
}

function checkerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), n = 8, s = 512 / n;
  const dark = isDark(), a = dark ? '#3A3A42' : '#F4F6FB', b = dark ? '#24242A' : '#D3DBEA';
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? b : a; x.fillRect(i * s, j * s, s, s); }
  const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4; return tex;
}

/** The paradox, acted out: the gold king (big paycheque) topples, the green pawn (small paycheque) stays standing. */
function mountHero(el) {
  if (!OK) { el.insertAdjacentHTML('afterbegin', '<div class="flat-duo" aria-hidden="true"><span class="flat-piece fallen">♚︎</span><span class="flat-piece good">♟︎</span></div>'); return {}; }
  const st = new Stage(el, { cam: [0, 2.5, 7.4], look: [0, .75, 0], fov: 30, floorY: -.16 });
  const world = new T.Group(); st.scene.add(world);
  const topMat = new T.MeshPhysicalMaterial({ map: checkerTexture(), roughness: .32, clearcoat: .7, clearcoatRoughness: .1 });
  const sideMat = new T.MeshPhysicalMaterial({ color: isDark() ? 0x1c1c22 : 0xe7ebf3, roughness: .3, clearcoat: 1 });
  const board = new T.Mesh(new T.CylinderGeometry(2.15, 2.2, .16, 96), [sideMat, topMat, sideMat]); board.position.y = -.08; board.receiveShadow = true; board.castShadow = true; world.add(board);
  document.addEventListener('cm:theme', () => { topMat.map.dispose(); topMat.map = checkerTexture(); topMat.needsUpdate = true; sideMat.color.set(isDark() ? 0x1c1c22 : 0xe7ebf3); });

  const king = piece('king', 'gold'), pawn = piece('pawn', 'good');
  const kPos = new T.Vector3(-.62, 0, .15), d = new T.Vector3(-.45, 0, -.89).normalize(), axis = new T.Vector3(d.z, 0, -d.x);
  const pivot = new T.Group(); pivot.position.copy(kPos).addScaledVector(d, .62); king.position.copy(d).multiplyScalar(-.62); pivot.add(king); world.add(pivot);
  pawn.position.set(.78, 0, .35); world.add(pawn);
  // a few coins at the king's feet, the paycheque that wasn't enough
  const coinMat = new T.MeshPhysicalMaterial({ color: lin('#F5C451'), metalness: .85, roughness: .25, clearcoat: 1 });
  const coins = [[-1.45, .023, .75], [-1.45, .07, .75], [-1.43, .117, .73], [-1.05, .023, 1.15]].map(([x, y, z]) => { const c = new T.Mesh(new T.CylinderGeometry(.17, .17, .045, 40), coinMat); c.position.set(x, y, z); c.castShadow = true; world.add(c); return c; });
  const P = 7.6, FALL = 1.36;
  st.on(t => {
    const k = t % P; let th = 0, hop = 0;
    if (k < 2.2) th = Math.sin(t * 2) * .012;
    else if (k < 3.0) { const u = (k - 2.2) / .8; th = Math.sin(u * Math.PI * 5) * .07 * u; }
    else if (k < 3.7) { const u = (k - 3.0) / .7; th = u * u * FALL; }
    else if (k < 4.2) { const u = (k - 3.7) / .5; th = FALL - Math.sin(u * Math.PI) * .09 * (1 - u); }
    else if (k < 6.3) th = FALL;
    else if (k < 7.3) th = FALL * (1 - ease((k - 6.3) / 1));
    if (k > 3.8 && k < 4.6) hop = Math.sin((k - 3.8) / .8 * Math.PI);
    pivot.quaternion.setFromAxisAngle(axis, th);
    pawn.position.y = hop * .38; pawn.rotation.y = hop > 0 ? ease((k - 3.8) / .8) * Math.PI * 2 : Math.sin(t * .8) * .2;
    coins[3].rotation.y = t * .6;
    world.rotation.y = Math.sin(t * .22) * .32 - .1;
  });
  return { stage: st };
}

/** A promotion pedestal for the player's current rank. */
function mountRank(el, kind, pal) {
  if (!OK) { flat(el, kind, 'rank-flat'); return { set(k) { flat(el, k, 'rank-flat'); } }; }
  const st = new Stage(el, { cam: [0, 1.5, 6.1], look: [0, 1.05, 0], fov: 29 });
  const pedMat = new T.MeshPhysicalMaterial({ color: isDark() ? 0x2c2c2e : 0xffffff, roughness: .25, clearcoat: 1 });
  const ped = new T.Mesh(new T.CylinderGeometry(.95, 1.02, .26, 80), pedMat); ped.position.y = .13; ped.castShadow = ped.receiveShadow = true; st.scene.add(ped);
  document.addEventListener('cm:theme', () => pedMat.color.set(isDark() ? 0x2c2c2e : 0xffffff));
  const holder = new T.Group(); holder.position.y = .26; st.scene.add(holder);
  // orbiting sparkles
  const N = 70, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([Math.random() * Math.PI * 2, 1.0 + Math.random() * .5, .3 + Math.random() * 1.9, .3 + Math.random() * .6]);
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const pm = new T.PointsMaterial({ color: lin(PAL[pal] ? PAL[pal][0] : PAL.accent[0]), size: .06, transparent: true, opacity: .9, depthWrite: false });
  st.scene.add(new T.Points(pg, pm));
  let cur = null, next = null, swapAt = -1;
  const put = (k, p) => { const g = piece(k, p); g.scale.setScalar(.001); holder.add(g); return g; };
  cur = put(kind, pal); cur.scale.setScalar(1);
  st.on((t, dt) => {
    holder.rotation.y += dt * .5; holder.position.y = .26 + Math.sin(t * 1.6) * .04;
    for (let i = 0; i < N; i++) { const [a, r, h, sp] = seeds[i]; const ang = a + t * sp; pos[i * 3] = Math.cos(ang) * r; pos[i * 3 + 1] = h + Math.sin(t * 1.5 + a) * .08; pos[i * 3 + 2] = Math.sin(ang) * r; }
    pg.attributes.position.needsUpdate = true;
    if (next) {
      if (swapAt < 0) swapAt = t; const k = clamp((t - swapAt) / .9, 0, 1);
      cur.scale.setScalar(Math.max(.001, 1 - ease(Math.min(1, k * 2)))); cur.rotation.y += dt * 12;
      next.scale.setScalar(Math.max(.001, ease(clamp(k * 2 - 1, 0, 1)))); next.rotation.y = (1 - k) * Math.PI * 4;
      if (k >= 1) { holder.remove(cur); cur = next; next = null; swapAt = -1; }
    }
  });
  return {
    set(k, p) {
      if (cur && cur.userData.kind === k && !next) return;
      pm.color.copy(lin(PAL[p] ? PAL[p][0] : PAL.accent[0]));
      if (reduce) { holder.remove(cur); cur = put(k, p); cur.scale.setScalar(1); return; }
      next = put(k, p);
    },
  };
}

/** Runway in coins: one gold coin per month the buffer covers, red ghosts for the months still needed. */
function mountCoins(el) {
  if (!OK) return { set() {} };
  const st = new Stage(el, { cam: [0, 2.3, 5.0], look: [0, .55, 0], fov: 32 });
  const world = new T.Group(); st.scene.add(world);
  const plateMat = new T.MeshPhysicalMaterial({ color: isDark() ? 0x1c1c1e : 0xffffff, roughness: .5, clearcoat: isDark() ? .25 : 1, envMapIntensity: isDark() ? .35 : 1 });
  const plate = new T.Mesh(new T.CylinderGeometry(2.1, 2.2, .14, 96), plateMat); plate.position.y = -.07; plate.receiveShadow = true; world.add(plate);
  document.addEventListener('cm:theme', () => { const d = isDark(); plateMat.color.set(d ? 0x1c1c1e : 0xffffff); plateMat.clearcoat = d ? .25 : 1; plateMat.envMapIntensity = d ? .35 : 1; });
  const rimGeo = new T.CylinderGeometry(.44, .44, .1, 48), faceGeo = new T.CylinderGeometry(.33, .33, .108, 48);
  const gold = new T.MeshPhysicalMaterial({ color: lin('#F2BE45'), metalness: .9, roughness: .2, clearcoat: 1 });
  const goldFace = new T.MeshPhysicalMaterial({ color: lin('#FFDB7A'), metalness: .85, roughness: .28, clearcoat: 1 });
  const ghost = new T.MeshPhysicalMaterial({ color: lin('#FF453A'), transparent: true, opacity: .2, roughness: .4, depthWrite: false });
  const STACKS = [[-1.0, .2], [0, -.25], [1.0, .2]], PER = 8, H = .112;
  const slot = i => { const s = STACKS[Math.floor(i / PER) % 3]; return [s[0] + (Math.random() - .5) * .04, .05 + (i % PER) * H, s[1] + (Math.random() - .5) * .04]; };
  let coins = [], ghosts = [];
  const make = (isGhost) => { const g = new T.Group(); const r = new T.Mesh(rimGeo, isGhost ? ghost : gold); r.castShadow = !isGhost; g.add(r); if (!isGhost) g.add(new T.Mesh(faceGeo, goldFace)); world.add(g); return g; };
  const now = () => (reduce ? -100 : (st.t || 0));
  st.on((t) => {
    world.rotation.y = Math.sin(t * .3) * .25;
    const all = coins.concat(ghosts);
    for (const c of all) {
      const k = clamp((t - c.t0) / .5, 0, 1);
      if (c.out) { c.g.position.y = c.y + k * 1.6; c.g.scale.setScalar(Math.max(.001, 1 - k)); if (k >= 1 && !c.gone) { world.remove(c.g); c.gone = true; } }
      else { const b = 1 - Math.pow(1 - k, 3); c.g.position.set(c.x, c.y + (1 - b) * 3.2, c.z); c.g.rotation.y = (1 - b) * 3 + c.spin; }
    }
    coins = coins.filter(c => !c.gone); ghosts = ghosts.filter(c => !c.gone);
  });
  return {
    set(n, need) {
      n = clamp(Math.floor(n), 0, 24); need = clamp(Math.ceil(need || 0), 0, 24);
      const live = coins.filter(c => !c.out);
      let t = now();
      if (live.length < n) for (let i = live.length; i < n; i++) { const [x, y, z] = slot(i); coins.push({ g: make(false), x, y, z, t0: t + (i - live.length) * .06, spin: Math.random() * 3 }); }
      else for (let i = live.length - 1; i >= n; i--) { const c = live[i]; c.out = true; c.t0 = t + (live.length - 1 - i) * .03; c.y = c.g.position.y; }
      ghosts.forEach(c => { if (!c.out) { c.out = true; c.t0 = t; c.y = c.g.position.y; } });
      for (let i = n; i < need; i++) { const [x, y, z] = slot(i); ghosts.push({ g: make(true), x, y, z, t0: t + .3 + (i - n) * .04, spin: 0 }); }
    },
  };
}


/** 3D runway terrain: one bar per (income, bills) scenario, height = months of runway. Drag to orbit, hover to read, click to load. */
function mountTerrain(el, onPick) {
  if (!OK) return null;
  const st = new Stage(el, { cam: [0, 7.4, 11.2], look: [0, .9, 0], fov: 31, floorY: -.02 });
  const world = new T.Group(); st.scene.add(world);
  const baseMat = new T.MeshPhysicalMaterial({ color: isDark() ? 0x1c1c22 : 0xffffff, roughness: .45, clearcoat: .6 });
  const base = new T.Mesh(new T.BoxGeometry(1, .12, 1), baseMat); base.position.y = -.06; base.receiveShadow = true; world.add(base);
  document.addEventListener('cm:theme', () => baseMat.color.set(isDark() ? 0x1c1c22 : 0xffffff));
  const COL = ['#FF453A', '#FF8A80', '#FFB340', '#7BE495', '#30D158'].map(lin);
  const boxGeo = new T.BoxGeometry(1, 1, 1); boxGeo.translate(0, .5, 0);
  const tip = document.createElement('div'); tip.className = 'terr-tip'; tip.hidden = true; el.appendChild(tip);
  const labels = new T.Group(); world.add(labels);
  let bars = [], data = null, ring = null, hover = null, rotY = -.5, drag = null, idle = 0;
  const sprite = (text, size = .32, color = '#8E8E93') => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '600 34px -apple-system, Inter, sans-serif'; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 32);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(size * 4, size, 1); return sp;
  };
  const cls = v => v === Infinity || v >= 12 ? 4 : v >= 6 ? 3 : v >= 3 ? 2 : v >= 1 ? 1 : 0;
  function build(d) {
    bars.forEach(b => world.remove(b.mesh)); bars = []; labels.clear();
    const R = d.rows.length, C = d.cols.length, gap = 1.05, w = (C - 1) * gap, dep = (R - 1) * gap;
    base.scale.set(w + 1.4, 1, dep + 1.4);
    d.vals.forEach((row, i) => row.forEach((v, j) => {
      const m = new T.Mesh(boxGeo, new T.MeshPhysicalMaterial({ color: COL[cls(v)], roughness: .28, clearcoat: 1, clearcoatRoughness: .1, metalness: .05 }));
      m.scale.set(.82, .001, .82); m.position.set(j * gap - w / 2, 0, i * gap - dep / 2); m.castShadow = true; m.receiveShadow = true;
      m.userData = { i, j, v }; world.add(m); bars.push({ mesh: m, h: .001, target: .08 + Math.min(v === Infinity ? 24 : v, 24) / 24 * 3.2, delay: (i + j) * .04 });
    }));
    d.cols.forEach((c, j) => { const sp = sprite(c + '%'); sp.position.set(j * gap - w / 2, .05, dep / 2 + 1.05); labels.add(sp); });
    d.rows.forEach((r, i) => { const sp = sprite('+' + r + '%'); sp.position.set(-w / 2 - 1.25, .05, i * gap - dep / 2); labels.add(sp); });
    const t1 = sprite('Income kept →', .3, '#0A84FF'); t1.position.set(0, .05, dep / 2 + 1.7); labels.add(t1);
    const t2 = sprite('Bills ↓', .3, '#0A84FF'); t2.position.set(-w / 2 - 1.25, .05, -dep / 2 - .9); labels.add(t2);
    if (!ring) { ring = new T.Mesh(new T.RingGeometry(.56, .66, 4, 1), new T.MeshBasicMaterial({ color: lin('#0A84FF'), transparent: true, opacity: .95, side: T.DoubleSide })); ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4); world.add(ring); }
    const t0 = st.t || 0; bars.forEach(b => b.t0 = t0);
  }
  function setCur(cur) { const b = bars.find(x => x.mesh.userData.i === cur[0] && x.mesh.userData.j === cur[1]); if (ring) { ring.visible = !!b; if (b) ring.position.set(b.mesh.position.x, .02, b.mesh.position.z); ring.userData.bar = b; } }
  const ray = new T.Raycaster(), mv = new T.Vector2();
  const cv = st.r.domElement; cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
  const pick = e => { const r = cv.getBoundingClientRect(); mv.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, st.cam); const hit = ray.intersectObjects(bars.map(b => b.mesh))[0]; return hit && hit.object; };
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, r: rotY, moved: false }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointerup', e => { cv.style.cursor = 'grab'; if (drag && !drag.moved) { const o = pick(e); if (o && onPick) onPick(o.userData.i, o.userData.j); } drag = null; });
  cv.addEventListener('pointermove', e => {
    idle = st.t || 0;
    if (drag) { const dx = e.clientX - drag.x; if (Math.abs(dx) > 3) drag.moved = true; rotY = drag.r + dx * .008; return; }
    const o = pick(e); hover = o;
    if (o && data) { const r = el.getBoundingClientRect(); const { i, j, v } = o.userData; tip.hidden = false; tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top - 10) + 'px';
      tip.innerHTML = `<b>${v === Infinity ? '120+' : v.toFixed(1)} months</b><span>Income ${data.cols[j]}%, bills +${data.rows[i]}%</span>`; }
    else tip.hidden = true;
  });
  cv.addEventListener('pointerleave', () => { tip.hidden = true; hover = null; });
  st.on((t, dt) => {
    if (!drag && t - idle > 3) rotY += dt * .12;
    world.rotation.y += (rotY - world.rotation.y) * Math.min(1, dt * 8 || 1);
    for (const b of bars) {
      const k = clamp((t - (b.t0 || 0) - b.delay) / .7, 0, 1), e = 1 - Math.pow(1 - k, 3);
      if (reduce) b.h = b.target; else b.h += (b.target - b.h) * (k >= 1 ? Math.min(1, dt * 10) : e);
      b.mesh.scale.y = Math.max(.001, b.h);
      const hi = hover === b.mesh; b.mesh.material.emissive = b.mesh.material.emissive || new T.Color(); b.mesh.material.emissive.setScalar(hi ? .18 : 0);
    }
    if (ring && ring.visible) { const pul = 1 + Math.sin(t * 4) * .06; ring.scale.set(pul, pul, 1); }
  });
  return {
    set(d) {
      const same = data && data.rows.join() === d.rows.join() && data.cols.join() === d.cols.join();
      data = d;
      if (!same || !bars.length) build(d);
      else d.vals.forEach((row, i) => row.forEach((v, j) => { const b = bars[i * d.cols.length + j]; b.mesh.userData.v = v; b.target = .08 + Math.min(v === Infinity ? 24 : v, 24) / 24 * 3.2; b.mesh.material.color.copy(COL[cls(v)]); }));
      setCur(d.cur);
    },
  };
}

/** Render pieces once to images, for icons that look like the 3D ones. */
function snapshot(items, size = 160) {
  if (!OK) return {};
  const out = {};
  let r;
  try {
    r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(size, size, false); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.12; r.setClearColor(0, 0);
    const s = new T.Scene(); s.environment = makeEnv(r);
    s.add(new T.HemisphereLight(0xffffff, 0x3a4660, .6));
    const key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(2.5, 5, 3.5); s.add(key);
    const rim = new T.DirectionalLight(0x9cc4ff, .8); rim.position.set(-3, 2.5, -4); s.add(rim);
    const cam = new T.PerspectiveCamera(30, 1, .1, 50);
    for (const it of items) {
      let obj, H;
      if (it.kind === 'mate') { const m = makeMate(); if (it.skin) m.setSkin(it.skin); m.update(0.5, 0); obj = m.group; obj.children.filter(c => c.geometry && c.geometry.type === 'RingGeometry').forEach(c => c.visible = false); H = 1.55; }
      else { obj = piece(it.kind, it.pal); H = obj.userData.H; obj.rotation.y = it.kind === 'knight' ? -.55 : .5; }
      s.add(obj);
      if (it.kind === 'mate') { cam.position.set(0, 1.25, 2.45); cam.lookAt(0, 1.08, 0); }
      else { const dd = H * 2.35; cam.position.set(0, H * .62, dd); cam.lookAt(0, H * .5, 0); }
      r.render(s, cam); out[it.key || it.kind] = r.domElement.toDataURL('image/png');
      s.remove(obj);
    }
  } catch (e) { /* snapshots are optional */ }
  finally { if (r) { r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); } }
  return out;
}

window.CM3D = { ok: OK, PAL, mountMate, mountHero, mountRank, mountCoins, mountTerrain, snapshot };
})();
