"""Checks the live backend against the judges' runway definitions (needs the backend on :8001).
Usage: python3 scripts/verify_runway.py <data-dir> [seed] [n-accounts]
"""
import csv, json, random, statistics as st, urllib.request, sys
D = sys.argv[1]
rows = {}
for r in csv.DictReader(open(D + '/monthly_summary.csv')):
    rows.setdefault(int(r['account_id']), []).append(r)
loans = {int(r['account_id']): r for r in csv.DictReader(open(D + '/loans.csv'))}
def judge(a):
    rs = sorted(rows[a], key=lambda r: r['month']); f = lambda k: [float(r[k]) for r in rs]
    I = st.median(f('money_in')); S = st.median(f('money_out')); H = st.median(f('household_bills'))
    F = st.median([float(r['household_bills']) + float(r['insurance']) + float(r['loan_payments']) for r in rs])
    B = st.mean([float(r['avg_daily_balance']) for r in rs[-6:]])
    return dict(I=I, S=S, H=H, F=F, B=B)
def runway(B, inc, sp, one=0):
    left = B - one; gap = sp - inc
    if left <= 0: return 0.0
    if gap <= 0: return 'no_shortfall'
    return round(min(left / gap, 120), 1)
def api(path, body=None):
    req = urllib.request.Request('http://127.0.0.1:8001' + path, data=json.dumps(body).encode() if body else None, headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=30))
random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
ids = random.sample(sorted(rows), int(sys.argv[3]) if len(sys.argv) > 3 else 40)
bad = 0; metric_bad = 0
for a in ids:
    j = judge(a); m = api(f'/api/accounts/{a}')
    for k in 'ISHB':
        if abs(float(m[k]) - j[k]) > 0.01: metric_bad += 1; print('METRIC', a, k, m[k], j[k])
    twists = {
      'base': (dict(), runway(j['B'], j['I'], j['S'])),
      'ei55': (dict(income_retained_pct='55'), runway(j['B'], .55 * j['I'], j['S'])),
      'furnace': (dict(one_off_cost=f"{j['S']:.10f}"), runway(j['B'], j['I'], j['S'], j['S'])),
      'ei+bills15': (dict(income_retained_pct='55', bills_increase_pct='15'), runway(j['B'], .55 * j['I'], j['S'] + .15 * j['H'])),
    }
    for name, (body, exp) in twists.items():
        r = api('/api/simulate', dict(account_id=a, **body))
        got = 'no_shortfall' if r['status'] in ('no_shortfall', 'capped') and exp == 'no_shortfall' else (float(r['runway_months']) if r.get('runway_months') is not None else r['status'])
        if r['status'] == 'capped' and exp == 120: got = 120.0
        if got != exp: bad += 1; print('RUNWAY', a, name, 'api', r['status'], r.get('runway_months'), 'judge', exp)
print(f'{len(ids)} accounts x 4 scenarios: runway mismatches={bad}, metric mismatches={metric_bad}')
