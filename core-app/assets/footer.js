/* Landing-page footer in the app: rising sparks, logo burst, back to top. Copied from home.js. */
(function () {
  const $ = s => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = $('#appFoot .ds-sparks'); if (!host) return;
  const cols = ['#FFD36B', '#FF5E62', '#7C5CFF', '#FF9A4D', '#5CC8FF'];
  for (let k = 0; k < 26; k++) { const i = document.createElement('i'); i.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--s:${(3 + Math.random() * 5).toFixed(1)}px;--c:${cols[k % cols.length]};--d:${(Math.random() * 6).toFixed(2)}s;--t:${(4 + Math.random() * 5).toFixed(2)}s;--dx:${((Math.random() - .5) * 120).toFixed(0)}px`; host.append(i); }
  const top = $('#appFoot [data-ds-top]');
  if (top) top.addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); const m = $('#main'); if (m && m.scrollTop) m.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  const logo = $('#appFoot .ds-logo'); if (!logo) return;
  logo.addEventListener('click', () => {
    if (reduce || !logo.animate) return;
    for (let k = 0; k < 18; k++) { const d = document.createElement('span'); d.className = 'dsburst'; d.style.background = cols[k % cols.length]; d.style.boxShadow = `0 0 10px ${cols[k % cols.length]}`; logo.append(d);
      const a = k / 18 * Math.PI * 2 + Math.random() * .3, r = 60 + Math.random() * 70; d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => d.remove(); }
    logo.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(20deg)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.2,1.5,.3,1)' });
  });
})();

/* skip link: move focus to the content without changing the hash (the hash picks the view) */
(function () {
  const s = document.querySelector('.skip-link'), m = document.getElementById('main'); if (!s || !m) return;
  s.addEventListener('click', e => { e.preventDefault(); m.focus({ preventScroll: false }); m.scrollIntoView(); });
})();
