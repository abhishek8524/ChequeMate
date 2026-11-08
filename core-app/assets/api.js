/* ChequeMate API client: the only path from the browser to the FastAPI backend (never to the database).
   Base URL: ?api=<url> (remembered), else localStorage cm.api, else the same host on port 8001. */
(() => {
'use strict';
const KEY = 'cm.api';
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const fromQuery = new URLSearchParams(location.search).get('api');
if (fromQuery) set(KEY, fromQuery.replace(/\/+$/, ''));
const DEFAULT = `${location.protocol === 'https:' ? 'https:' : 'http:'}//${location.hostname || '127.0.0.1'}:8001`;
let base = (get(KEY) || DEFAULT).replace(/\/+$/, '');

class ApiError extends Error {
  constructor(kind, status, message) { super(message); this.kind = kind; this.status = status; }
}
function detailText(d, status) {
  if (Array.isArray(d)) return d.map(x => { const loc = Array.isArray(x && x.loc) ? x.loc.filter(p => p !== 'body').join('.') : ''; return (loc ? loc + ': ' : '') + String((x && x.msg) || 'invalid value'); }).join('; ');
  if (typeof d === 'string') return d;
  return `HTTP ${status}`;
}
async function request(path, { method = 'GET', body, timeout = 15000, signal } = {}) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort('timeout'), timeout);
  const onAbort = () => ctrl.abort('cancelled');
  if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  let res;
  try {
    res = await fetch(base + path, { method, mode: 'cors', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
  } catch (e) {
    if (ctrl.signal.aborted) throw new ApiError(ctrl.signal.reason === 'timeout' ? 'timeout' : 'cancelled', 0, ctrl.signal.reason === 'timeout' ? 'The backend took too long to answer.' : 'Request cancelled.');
    throw new ApiError('network', 0, 'Could not reach the backend. It may be stopped, or the browser blocked it (CORS).');
  } finally { clearTimeout(t); if (signal) signal.removeEventListener('abort', onAbort); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON body */ }
  if (!res.ok) {
    const kind = res.status === 404 ? 'not_found' : res.status === 422 ? 'invalid' : res.status === 503 ? 'unavailable' : 'http';
    throw new ApiError(kind, res.status, detailText(data && data.detail, res.status));
  }
  return data;
}
/* Results are cached by the complete request (account + every assumption). Failures are not cached. */
const cache = new Map();
function cached(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const p = fn().catch(e => { cache.delete(key); throw e; });
  cache.set(key, p); if (cache.size > 400) cache.delete(cache.keys().next().value);
  return p;
}
const post = (path, body) => cached(path + ' ' + JSON.stringify(body), () => request(path, { method: 'POST', body }));
const getC = path => cached(path, () => request(path));

function describe(err) {
  if (!(err instanceof ApiError)) return 'Something went wrong while loading live data.';
  switch (err.kind) {
    case 'not_found': return "We couldn't find that account.";
    case 'invalid': return `That combination can't be worked out. Try smaller numbers. (${err.message})`;
    case 'unavailable': return 'Your account records are unavailable right now.';
    case 'network': return "We can't reach the server right now.";
    case 'timeout': return 'That took too long. Please try again.';
    case 'cancelled': return 'Request cancelled.';
    default: return 'Something went wrong. Please try again.';
  }
}
window.CMApi = {
  get base() { return base; },
  setBase(url) { base = (url || DEFAULT).replace(/\/+$/, ''); set(KEY, url ? base : null); cache.clear(); },
  clearCache() { cache.clear(); },
  ApiError, describe, request,
  health: () => request('/api/health', { timeout: 8000 }),
  account: id => getC(`/api/accounts/${id}`),
  profile: id => getC(`/api/accounts/${id}/profile`),
  insights: id => getC(`/api/accounts/${id}/insights`),
  lookalikes: id => getC(`/api/accounts/${id}/lookalikes`),
  simulate: body => post('/api/simulate', body),
  support: body => post('/api/simulate/support', body),
  plan: body => post('/api/plan', body),
  quest: body => post('/api/quest', body),
  explain: body => post('/api/explain', body),
};
})();
