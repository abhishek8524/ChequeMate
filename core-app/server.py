"""ChequeMate local server: serves the static app and proxies the coach to Gemini.

The Gemini key stays on this machine (read from .env or the GEMINI_API_KEY environment variable)
and is never sent to the browser. Run:  python3 server.py   (default port 8000)
"""
import json, os, pathlib, re, ssl, sys, time, urllib.error, urllib.request
from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent
PORT = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8000))
MODELS = {'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-pro', 'gemini-3.5-flash-lite'}
DEFAULT_MODEL = 'gemini-2.5-flash'
FALLBACK = ['gemini-2.5-flash', 'gemini-3.5-flash-lite']   # tried in order when a model is overloaded
MAX_BODY = 200_000
RATE = (20, 60)  # requests per IP per window (seconds)
DENY = ('.env', 'server.py', '.git', '.gitignore', 'scripts/', '.DS_Store')
# One link serves everything: the data API is passed through to the FastAPI backend on this machine.
# Only the endpoints the app uses are forwarded; the database itself is never reachable from the browser.
BACKEND = os.environ.get('BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')
API_OK = re.compile(r'^/api/(health|simulate|simulate/support|plan|quest|explain|accounts/\d{1,18}(/(insights|profile|lookalikes))?)$')
API_RATE = (240, 60)  # requests per visitor per minute
api_hits = defaultdict(deque)


def load_key():
    k = os.environ.get('GEMINI_API_KEY', '').strip()
    env = ROOT / '.env'
    if not k and env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith('GEMINI_API_KEY='):
                k = line.split('=', 1)[1].strip().strip('"\'')
    return k


KEY = load_key()
hits = defaultdict(deque)


def tls_context():
    """python.org builds on macOS ship without CA certs; fall back to certifi or the system bundle."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for f in ('/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'):
        if os.path.exists(f):
            return ssl.create_default_context(cafile=f)
    return ssl.create_default_context()


TLS = tls_context()


def gemini(model, payload):
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        data=json.dumps(payload).encode(), method='POST',
        headers={'Content-Type': 'application/json', 'x-goog-api-key': KEY})
    try:
        with urllib.request.urlopen(req, timeout=60, context=TLS) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return 502, json.dumps({'error': {'message': f"Couldn't reach Gemini: {getattr(e, 'reason', e)}"}}).encode()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quieter log: skip static files
        if self.path.startswith('/api/'):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')  # always revalidate, so browsers never run a stale app.js
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _blocked(self):
        p = self.path.split('?', 1)[0].lstrip('/')
        return any(p == d.rstrip('/') or p.startswith(d) for d in DENY) or '/.' in '/' + p

    def _proxy(self, method):
        path = self.path.split('?', 1)[0]
        if not API_OK.match(path):
            return self._json(404, {'detail': 'Not found'})
        ip = self.headers.get('CF-Connecting-IP') or self.client_address[0]
        q, now = api_hits[ip], time.time()
        while q and now - q[0] > API_RATE[1]:
            q.popleft()
        if len(q) >= API_RATE[0]:
            return self._json(429, {'detail': 'Too many requests. Try again in a moment.'})
        q.append(now)
        data = None
        if method == 'POST':
            n = int(self.headers.get('Content-Length') or 0)
            if n <= 0 or n > MAX_BODY:
                return self._json(413, {'detail': 'Request too large'})
            data = self.rfile.read(n)
        req = urllib.request.Request(BACKEND + self.path, data=data, method=method,
                                     headers={'Content-Type': 'application/json'} if data else {})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                code, body = r.status, r.read()
        except urllib.error.HTTPError as e:
            code, body = e.code, e.read()
        except (urllib.error.URLError, TimeoutError, OSError):
            return self._json(503, {'detail': 'The data server is not running'})
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith('/api/gemini/status'):
            return self._json(200, {'ok': bool(KEY), 'model': DEFAULT_MODEL})
        if self.path.startswith('/api/'):
            return self._proxy('GET')
        if self._blocked():
            return self.send_error(404)
        path, _, query = self.path.partition('?')
        if path == '/':  # landing page first; the engine lives at /index.html (alias /app)
            self.path = '/home.html' + ('?' + query if query else '')
        elif path == '/app':
            self.path = '/index.html' + ('?' + query if query else '')
        return super().do_GET()

    def do_HEAD(self):
        if self._blocked():
            return self.send_error(404)
        return super().do_HEAD()

    def do_POST(self):
        if self.path.startswith('/api/') and not self.path.startswith('/api/gemini'):
            return self._proxy('POST')
        if not self.path.startswith('/api/gemini'):
            return self.send_error(404)
        if not KEY:
            return self._json(503, {'error': {'message': 'No Gemini key on the server'}})
        ip = self.headers.get('CF-Connecting-IP') or self.client_address[0]
        q, now = hits[ip], time.time()
        while q and now - q[0] > RATE[1]:
            q.popleft()
        if len(q) >= RATE[0]:
            return self._json(429, {'error': {'message': 'Too many questions in a minute. Try again shortly.'}})
        q.append(now)
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BODY:
            return self._json(413, {'error': {'message': 'Request too large'}})
        try:
            req = json.loads(self.rfile.read(n))
        except ValueError:
            return self._json(400, {'error': {'message': 'Bad JSON'}})
        model = req.get('model') if req.get('model') in MODELS else DEFAULT_MODEL
        payload = {k: req[k] for k in ('systemInstruction', 'contents', 'generationConfig') if k in req}
        tried = [model] + [m for m in FALLBACK if m != model]
        for m in tried:
            p = json.loads(json.dumps(payload))
            if '2.5-flash' in m:  # short coach answers: skip hidden "thinking" so it doesn't eat the token budget
                p.setdefault('generationConfig', {}).setdefault('thinkingConfig', {'thinkingBudget': 0})
            code, body = gemini(m, p)
            if code != 200:
                print(f'  gemini {m}: HTTP {code} {body[:160]!r}', flush=True)
            if code not in (429, 500, 502, 503, 504):
                break
        try:
            out = json.loads(body)
        except ValueError:
            out = {'error': {'message': f'Gemini returned HTTP {code}'}}
        if isinstance(out, dict):
            out['servedBy'] = m
        return self._json(code, out)


if __name__ == '__main__':
    print(f'ChequeMate on http://localhost:{PORT}  (Gemini coach: {"on" if KEY else "off, no key in .env"})')
    ThreadingHTTPServer(('', PORT), Handler).serve_forever()
