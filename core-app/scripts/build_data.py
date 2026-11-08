"""Build the ChequeMate data bundle from the Tangerine track CSVs.
Usage: python scripts/build_data.py <path-to-data-dir>
Writes data/accounts.json (per-account metrics + monthly series) and data/insights.json (population findings).
Metrics follow the judges' definitions in the track README exactly."""
import sys, json, numpy as np, pandas as pd
D = sys.argv[1].rstrip('/') + '/'
ms = pd.read_csv(D+'monthly_summary.csv').sort_values(['account_id','month'])
ln = pd.read_csv(D+'loans.csv'); acc = pd.read_csv(D+'accounts.csv'); cl = pd.read_csv(D+'clients.csv')
dp = pd.read_csv(D+'dispositions.csv'); cd = pd.read_csv(D+'cards.csv'); di = pd.read_csv(D+'districts.csv')
so = pd.read_csv(D+'standing_orders.csv', dtype={'to_bank':str})

s = pd.to_datetime(ln.loan_start)
ln['running'] = (s.dt.year*12 + s.dt.month - 1 + ln.duration_months) > 2025*12 + 11  # still paying after Dec 2025
g = ms.groupby('account_id')
m = pd.DataFrame({
  'I': g.money_in.median(), 'S': g.money_out.median(), 'H': g.household_bills.median(),
  'F': (ms.household_bills + ms.insurance + ms.loan_payments).groupby(ms.account_id).median(),
  'B': g.tail(6).groupby('account_id').avg_daily_balance.mean(),
})
m['P'] = ln.set_index('account_id').pipe(lambda l: l.monthly_payment.where(l.running, 0)).reindex(m.index).fillna(0)
inc = ['cash_deposits','transfers_in','pension_in','interest_in']
out = ['household_bills','insurance','loan_payments','bank_fees','cash_withdrawals_genuine','card_withdrawals','transfers_out_other']
mean_in = g[inc].mean(); mean_out = g[out].mean()

own = dp[dp.type=='owner'].merge(cl, on='client_id').set_index('account_id')
joint = set(dp[dp.type!='owner'].account_id)
card = cd.merge(dp, on='disposition_id').set_index('account_id').card_type
acc = acc.set_index('account_id'); dmap = di.set_index('district_id')
lni = ln.set_index('account_id')
so_sum = so.groupby(['account_id','purpose'], dropna=False).amount.sum()

def r2(x): return round(float(x), 2)
accounts = {}
for aid, grp in g:
    mm = m.loc[aid]; o = own.loc[aid]; d = dmap.loc[acc.loc[aid,'district_id']]
    rec = {
      'I': r2(mm.I), 'S': r2(mm.S), 'F': r2(mm.F), 'H': r2(mm.H), 'B': r2(mm.B), 'P': r2(mm.P),
      'm0': grp.month.iloc[0], 'n': len(grp),
      'in': grp.money_in.round(0).astype(int).tolist(), 'out': grp.money_out.round(0).astype(int).tolist(),
      'bal': grp.avg_daily_balance.round(0).astype(int).tolist(), 'bills': grp.household_bills.round(0).astype(int).tolist(),
      'neg': int(grp.days_below_zero.sum()),
      'mi': [r2(mean_in.loc[aid,c]) for c in inc], 'mo': [r2(mean_out.loc[aid,c]) for c in out],
      'age': 2025 - int(o.birth_date[:4]), 'sex': o.gender, 'joint': aid in joint,
      'card': card.get(aid, None), 'dist': d.district_name, 'region': d.region,
      'dsal': r2(d.average_salary), 'unemp': None if pd.isna(d.unemployment_rate_2023) else r2(d.unemployment_rate_2023),
      'opened': acc.loc[aid,'account_opened'], 'freq': acc.loc[aid,'frequency'],
    }
    if aid in lni.index:
        l = lni.loc[aid]
        rec['loan'] = {'amt': r2(l.amount), 'dur': int(l.duration_months), 'pay': r2(l.monthly_payment), 'start': l.loan_start,
                       'status': l.status, 'running': bool(l.running), 'def': int(l.defaulted)}
    accounts[int(aid)] = rec
json.dump(accounts, open('data/accounts.json','w'), separators=(',',':'))

# ---------- population insights ----------
def runway(B, I, S, one=0, mult=1.0, extra=0.0):
    bl = B - one; gap = S + extra - I*mult
    return np.where(bl <= 0, 0, np.where(gap <= 0, 120, np.minimum(bl/np.where(gap<=0,1,gap), 120)))
m['ei'] = runway(m.B, m.I, m.S, mult=.55)
m['q'] = pd.qcut(m.I, 4, labels=['Q1','Q2','Q3','Q4'])
quart = []
for q, d in m.groupby('q', observed=True):
    quart.append({'q': q, 'I': r2(d.I.median()), 'spendRatio': r2((d.S/d.I).median()), 'bufferMonths': r2((d.B/d.S).median()),
                  'outIn6': r2((d.ei < 6).mean()), 'n': len(d)})
L = ln.set_index('account_id').join(m)
L['q'] = pd.qcut(L.I, 4, labels=['Q1','Q2','Q3','Q4'])
def auc(score, y):  # higher score = more risk
    from itertools import product
    r = pd.Series(score).rank().values; y = np.asarray(y); n1 = y.sum(); n0 = len(y)-n1
    return (r[y==1].sum() - n1*(n1+1)/2) / (n1*n0)
L['vol'] = (g.money_in.std()/g.money_in.mean()).reindex(L.index)
L['payshare'] = L.monthly_payment / L.I
ins = {
  'quartiles': quart,
  'defaultByQuartile': {k: r2(v) for k, v in L.groupby('q', observed=True).defaulted.mean().items()},
  'auc': {'income': r2(auc(-L.I, L.defaulted)), 'runway': r2(auc(-L.ei, L.defaulted)),
          'volatility': r2(auc(L.vol, L.defaulted)), 'paymentShare': r2(auc(L.payshare, L.defaulted))},
  'fragileDefault': r2(L[L.ei < 6].defaulted.mean()), 'sturdyDefault': r2(L[L.ei >= 6].defaulted.mean()),
  'jointDefault': {'joint': [int(L[L.index.isin(joint)].defaulted.sum()), int(L.index.isin(joint).sum())],
                   'solo': [int(L[~L.index.isin(joint)].defaulted.sum()), int((~L.index.isin(joint)).sum())]},
  'cardDefault': {k: r2(v) for k, v in L.assign(c=card.reindex(L.index).fillna('none')).groupby('c').defaulted.mean().items()},
  'loans': len(L), 'defaults': int(L.defaulted.sum()),
  'season': {'in': [r2(x) for x in (ms.groupby(ms.month.str[5:]).money_in.mean()/ms.money_in.mean())],
             'out': [r2(x) for x in (ms.groupby(ms.month.str[5:]).money_out.mean()/ms.money_out.mean())]},
  'scatter': m.sample(900, random_state=7).assign(ei=lambda d: d.ei.round(1)).reset_index()[['account_id','I','ei']].round(0).values.tolist(),
  'eiHist': np.histogram(np.minimum(m.ei, 36), bins=36, range=(0,36))[0].tolist(),
  'pair': [28754, 35412],
}
json.dump(ins, open('data/insights.json','w'), separators=(',',':'))
print(json.dumps({k: v for k, v in ins.items() if k not in ('scatter','eiHist')}, indent=1))
