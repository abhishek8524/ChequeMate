"""Builds assets/study.json: dataset-wide findings for the landing page.

Uses the judges' definitions from the Tangerine brief (I, S, H, B from monthly_summary.csv)
and the same runway rule as the backend. Output holds aggregates plus one anonymous
(income rank, EI runway) pair per account for the 3D field - no account ids.
Usage: python3 scripts/study.py <path-to-data-dir>
"""
import csv, json, pathlib, statistics as st, sys
D = sys.argv[1]
rows = {}
for r in csv.DictReader(open(D + '/monthly_summary.csv')): rows.setdefault(int(r['account_id']), []).append(r)
loans = {int(r['account_id']): r for r in csv.DictReader(open(D + '/loans.csv'))}
acc = {int(r['account_id']): r for r in csv.DictReader(open(D + '/accounts.csv'))}
dist = {r['district_id']: r for r in csv.DictReader(open(D + '/districts.csv'))}
def rw(B, inc, sp, one=0):
    left = B - one; gap = sp - inc
    if left <= 0: return 0.0
    if gap <= 0: return 999.0
    return round(min(left / gap, 120), 1)
out = []
for a, rs in rows.items():
    rs.sort(key=lambda r: r['month']); f = lambda k: [float(r[k]) for r in rs]
    I, S, H = st.median(f('money_in')), st.median(f('money_out')), st.median(f('household_bills'))
    B = st.mean(f('avg_daily_balance')[-6:]); F = st.median([float(r['household_bills']) + float(r['insurance']) + float(r['loan_payments']) for r in rs])
    neg12 = sum(1 for r in rs[-12:] if int(float(r['days_below_zero'])) > 0)
    ln = loans.get(a); d = dist[acc[a]['district_id']]
    out.append(dict(a=a, I=I, S=S, H=H, B=B, F=F, n=len(rs), neg12=neg12,
        base=rw(B, I, S), ei=rw(B, .55 * I, S), furn=rw(B, I, S, S), combo=rw(B, .55 * I, S + .15 * H),
        loan=ln['status'] if ln else None, dflt=int(ln['defaulted']) if ln else None,
        region=d['region'], unemp=float(d['unemployment_rate_2023'] or 0), sal=float(d['average_salary'])))
N = len(out); pct = lambda c: round(100 * sum(1 for o in out if c(o)) / N, 1)
R = {}
R['n'] = N
R['ei_make6'] = pct(lambda o: o['ei'] >= 6); R['combo_make6'] = pct(lambda o: o['combo'] >= 6)
R['ei_under3'] = pct(lambda o: o['ei'] < 3)
R['furn_zero'] = pct(lambda o: o['furn'] == 0)
R['base_noshort'] = pct(lambda o: o['base'] == 999)
R['median_ei'] = st.median([o['ei'] for o in out])
R['median_buffer_months_spend'] = round(st.median([o['B'] / o['S'] for o in out if o['S'] > 0]), 2)
# income quintiles
srt = sorted(out, key=lambda o: o['I']); q = []
for i in range(5):
    g = srt[i * N // 5:(i + 1) * N // 5]
    q.append(dict(q=i + 1, I_lo=round(g[0]['I']), I_hi=round(g[-1]['I']), ei_short6=round(100 * sum(1 for o in g if o['ei'] < 6) / len(g), 1),
                  med_B=round(st.median([o['B'] for o in g])), med_gap_ei=round(st.median([o['S'] - .55 * o['I'] for o in g]))))
R['quintiles'] = q
# loans vs runway
L = [o for o in out if o['loan']]
def drate(c): g = [o for o in L if c(o)]; return (len(g), round(100 * sum(o['dflt'] for o in g) / len(g), 1) if g else None)
R['loan_n'] = len(L)
R['default_by_ei'] = {'<3': drate(lambda o: o['ei'] < 3), '3-6': drate(lambda o: 3 <= o['ei'] < 6), '6+': drate(lambda o: o['ei'] >= 6)}
R['default_by_neg'] = {'never overdrawn (12m)': drate(lambda o: o['neg12'] == 0), 'overdrawn 1+ months': drate(lambda o: o['neg12'] > 0)}
R['loan_payment_share_F'] = round(st.median([float(loans[o['a']]['monthly_payment']) / o['S'] for o in L if loans[o['a']]['status'] in 'CD']) * 100, 1)
R['bills_share_S'] = round(st.median([o['H'] / o['S'] for o in out if o['S'] > 0]) * 100, 1)
R['neg_any12'] = pct(lambda o: o['neg12'] > 0)
# region
reg = {}
for o in out: reg.setdefault(o['region'], []).append(o)
R['regions'] = sorted([dict(region=k, n=len(v), ei_short6=round(100 * sum(1 for o in v if o['ei'] < 6) / len(v), 1), unemp=round(st.mean([o['unemp'] for o in v]), 2)) for k, v in reg.items()], key=lambda x: -x['ei_short6'])
# runway distribution under EI
bins = [(0, 1), (1, 3), (3, 6), (6, 12), (12, 999.5)]
R['ei_hist'] = [dict(b=f'{a}-{b}', pct=round(100 * sum(1 for o in out if a <= o['ei'] < b) / N, 1)) for a, b in bins]
R['ei_hist'][-1]['b'] = '12+'

# anonymous field for the 3D hero: sorted by income, EI runway capped at 12.5 (12.5 = 12+ / no shortfall)
R['field'] = [round(min(o['ei'], 12.5), 1) for o in sorted(out, key=lambda o: o['I'])]
R['twists'] = {'ei55_make6': R['ei_make6'], 'combo_make6': R['combo_make6'], 'furnace_zero': R['furn_zero']}
dest = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'study.json'
dest.write_text(json.dumps(R, separators=(',', ':')))
print('wrote', dest, round(dest.stat().st_size / 1024), 'KB')
