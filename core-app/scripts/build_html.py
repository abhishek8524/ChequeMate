"""Assemble index.html (repo, works offline from file://) and artifact/page.html (hosted preview)."""
import pathlib
R = pathlib.Path(__file__).resolve().parent.parent
body = (R/'src/body.html').read_text()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">'
META = '<meta name="description" content="ChequeMate: financial resilience engine. Runway, shocks, plans, budgets and investing for any bank customer.">'
index = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ChequeMate</title>
{META}
{FONTS}
<link rel="stylesheet" href="assets/styles.css">
<link rel="stylesheet" href="assets/game.css">
<link rel="stylesheet" href="assets/play.css">
<link rel="stylesheet" href="assets/glass.css">
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
</body>
</html>
"""
import hashlib, re
ver = hashlib.md5(b''.join((R/f).read_bytes() for f in ['assets/app.js','assets/game.js','assets/play.js','assets/mate3d.js','assets/fx.js','assets/viz.js','assets/styles.css','assets/game.css','assets/play.css','assets/glass.css'])).hexdigest()[:8]
index = re.sub(r'((?:src|href)="(?:assets|data)/[^"?]+\.(?:js|css))"', lambda m: m.group(1) + '?v=' + ver + '"', index)
(R/'index.html').write_text(index)
css = (R/'assets/styles.css').read_text() + '\n' + (R/'assets/game.css').read_text() + '\n' + (R/'assets/play.css').read_text() + '\n' + (R/'assets/glass.css').read_text(); js = (R/'assets/app.js').read_text()
m3d = (R/'assets/mate3d.js').read_text() + '\n' + (R/'assets/fx.js').read_text(); game = (R/'assets/game.js').read_text() + '\n' + (R/'assets/play.js').read_text() + '\n' + (R/'assets/viz.js').read_text()
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
