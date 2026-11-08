"""Assemble index.html (repo, works offline from file://) and artifact/page.html (hosted preview)."""
import pathlib
R = pathlib.Path(__file__).resolve().parent.parent
body = (R/'src/body.html').read_text()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap">'
META = '<meta name="description" content="ChequeMate: financial resilience engine. Runway, shocks, plans, budgets and investing for any bank customer.">'
index = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Resilience Rewired</title>
{META}
{FONTS}
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23FFB347'/%3E%3Cstop offset='1' stop-color='%23FF2D55'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='24' height='24' rx='6' fill='url(%23g)'/%3E%3Cpath d='M3.8 8.4 7.4 15.6h9.2l3.6-7.2-4.5 3.4L12 5.2l-3.7 6.6z' fill='%23fff'/%3E%3Crect x='7.2' y='16.7' width='9.6' height='2.5' rx='1.25' fill='%23fff'/%3E%3Cpath d='M9.7 12.3l1.6 1.6 3-3.3' fill='none' stroke='%23FF5E62' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/styles.css">
<link rel="stylesheet" href="assets/game.css">
<link rel="stylesheet" href="assets/play.css">
<link rel="stylesheet" href="assets/glass.css">
<link rel="stylesheet" href="assets/rr.css">
<script>(function(){{var r=document.documentElement;try{{var q=new URLSearchParams(location.search).get('ui');if(q==='rr'||q==='ios')localStorage.setItem('cm.ui',JSON.stringify(q));}}catch(e){{}}var ui='ios';try{{ui=JSON.parse(localStorage.getItem('cm.ui')||'"ios"');}}catch(e){{}}r.setAttribute('data-ui',ui==='rr'?'rr':'ios');try{{var t=JSON.parse(localStorage.getItem('cm.theme')||'"system"');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);r.setAttribute('data-rr-theme',d?'dark':'light');r.setAttribute('data-text',JSON.parse(localStorage.getItem('cm.rr.text')||'"standard"'));}}catch(e){{}}}})();</script>
</head>
<body>
{body}
<script src="assets/vendor/chart.umd.min.js"></script>
<script src="assets/vendor/papaparse.min.js"></script>
<script src="assets/vendor/three.min.js"></script>
<script src="assets/mate3d.js"></script>
<script src="assets/fx.js"></script>
<script src="data/insights.js"></script>
<script src="data/accounts.js"></script>
<script src="assets/app.js"></script>
<script src="assets/game.js"></script>
<script src="assets/play.js"></script>
<script src="assets/viz.js"></script>
<script src="assets/rr.js"></script>
<script src="assets/rr2.js"></script>
<script src="assets/api.js"></script>
<script src="assets/live.js"></script>
<script src="assets/live-ios.js"></script>
</body>
</html>
"""
import hashlib, re
ver = hashlib.md5(b''.join((R/f).read_bytes() for f in ['assets/app.js','assets/game.js','assets/play.js','assets/mate3d.js','assets/fx.js','assets/viz.js','assets/styles.css','assets/game.css','assets/play.css','assets/glass.css','assets/rr.css','assets/rr.js','assets/live-ios.js','assets/rr2.js','assets/api.js','assets/live.js'])).hexdigest()[:8]
index = re.sub(r'((?:src|href)="(?:assets|data)/[^"?]+\.(?:js|css))"', lambda m: m.group(1) + '?v=' + ver + '"', index)
(R/'index.html').write_text(index)
css = (R/'assets/styles.css').read_text() + '\n' + (R/'assets/game.css').read_text() + '\n' + (R/'assets/play.css').read_text() + '\n' + (R/'assets/glass.css').read_text() + '\n' + (R/'assets/rr.css').read_text(); js = (R/'assets/app.js').read_text()
m3d = (R/'assets/mate3d.js').read_text() + '\n' + (R/'assets/fx.js').read_text(); game = (R/'assets/game.js').read_text() + '\n' + (R/'assets/play.js').read_text() + '\n' + (R/'assets/viz.js').read_text() + '\n' + (R/'assets/rr.js').read_text() + '\n' + (R/'assets/rr2.js').read_text() + '\n' + (R/'assets/api.js').read_text() + '\n' + (R/'assets/live.js').read_text()
page = f"""<title>ChequeMate</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FONTS}
<style>
{css}
</style>
{body}
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
{m3d}
</script>
<script src="data/insights.js"></script>
<script src="data/accounts.js"></script>
<script>
{js}
</script>
<script>
{game}
</script>
"""
(R/'artifact').mkdir(exist_ok=True); (R/'artifact/page.html').write_text(page)
print('built', len(index), len(page))
