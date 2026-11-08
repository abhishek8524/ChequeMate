# ChequeMate

**Don't let a layoff checkmate your finances.**
Tangerine Track, Sheridan Datathon 2026: a financial resilience engine for real bank customers.

Pick any `account_id` and ChequeMate shows the customer's income, bills, buffer and runway, applies a shock live (job loss with EI, higher bills, a surprise repair, or any mix), and builds a goal plan and a backup plan from that customer's own numbers.

## Biggest finding: the Paycheque Paradox
If every customer were laid off with EI paying 55% of income:

| Income quarter | Typical income | Spends | Buffer lasts | Out within 6 months |
| --- | --: | --: | --: | --: |
| Lowest | $2,186 | 69% | 8.4 mo | 4% |
| Highest | $17,533 | 96% | 1.9 mo | 68% |

Account 28754 brings in $14,148 a month and lasts 4.7 months. Account 35412 brings in $2,859 and lasts 41.3 months. Income tells you how much flows through an account; runway tells you how long someone lasts. Runway also predicts real loan defaults better than income (AUC 0.72 vs 0.62).

Other findings: joint accounts with a loan defaulted 0 of 145 times (solo: 76 of 537); every defaulted loan had a day below zero first; January spending runs 45% above an average month.

## Run it
No build step and no server needed for the demo.

```bash
python3 server.py               # recommended: app + Gemini coach, http://localhost:8000
# or, without the shared Gemini coach
open index.html                 # macOS, works straight from the file
```

The interface follows Apple platform conventions (San Francisco type, iOS system colours, grouped lists, segmented controls, Wallet-style cards, Activity-style rings, a tab bar on phones) and supports light and dark mode. Chart.js, PapaParse and three.js are vendored in `assets/vendor`, so the app works offline. Fonts load from Google Fonts when online and fall back to system fonts otherwise.

### Gemini coach
Create a `.env` file next to `server.py` (it is git-ignored, never commit it):

```
GEMINI_API_KEY=your-google-ai-studio-key
```

Then run `python3 server.py`. The server calls Gemini for the app, so the key never reaches the browser. It uses `gemini-2.5-flash`, falls back to `gemini-2.5-flash-lite` when Google is busy, and limits each visitor to 20 questions a minute. Without a server, anyone can still paste their own key in **Profile** (stored only in their browser). With no key at all, the built-in coach answers from the same numbers.

### Play, Quests and Mate
- **Mate** is the 3D pawn coach (three.js). It reacts to the customer's runway, follows the cursor and can read answers aloud.
- **Quests**: XP, chess ranks from Pawn to King, 26 badges, six missions per customer, a 0–100 resilience score and leaderboards. Progress is saved in each browser.
- **Play**: *Runway Run* deals a year of life events to the current customer, and *Who lasts longer?* is a quiz built on the paycheque paradox.
- **Shock lab** adds a boss-rush view of every scenario and a 3D coin tower where each coin is one month of runway.

## Pages
- **The paradox**: the headline finding, quarter breakdown, scatter of 900 customers, default-prediction comparison.
- **Customer**: I, F, S, B and runway; layoff, no-income and combined-shock runways; auto insights; monthly charts.
- **Shock lab**: the judges' twist cards plus sliders for income kept, EI length, bills change, new monthly costs and one-off costs. Shows every step of the runway formula, a month-by-month projection and a stress grid.
- **Plan**: emergency-fund goal with timeline, and a backup plan that stacks levers (spending cut, loan deferral, bill trims, side income) and shows runway after each.
- **Budget**: 50/30/20, 70/20/10, 60/20/20, 80/20, 30/30/30/10 and zero-based, measured against actual spending, with the closest-fit rule.
- **Investing**: the Canadian order of operations (cushion, debt, emergency fund, TFSA/FHSA, RRSP), a growth calculator, 2026 limits.
- **Coach**: Gemini with the account, profile and current shock attached, or the offline coach.
- **Your data**: upload any `monthly_summary.csv` (plus optional `loans.csv`) for portfolio insights computed in the browser.
- **Resources** and **Profile** (per-customer details, goals, risk comfort, Gemini settings).

## How the numbers work
Exactly the judges' definitions from `monthly_summary.csv`:

| | Definition |
| --- | --- |
| I | median `money_in` |
| F | median `household_bills + insurance + loan_payments` |
| S | median `money_out` |
| B | mean `avg_daily_balance` over the last 6 rows |
| H | median `household_bills` |
| P | `monthly_payment` if the loan runs past Dec 2025, else 0 |

```
buffer_left = B - one_off_costs
gap         = spending_after_shock - income_after_shock
runway      = 0 if buffer_left <= 0, "no shortfall (120+)" if gap <= 0, else min(buffer_left / gap, 120)
```

The JavaScript engine was checked against a Python implementation of these formulas for all 4,500 accounts across 5 twists (22,500 cases, 0 mismatches).

The **projection chart** in the Shock lab goes one step further than the judges' formula: it lets income return (or not) after EI ends, so you can see the balance recover.

## Rebuild the data
```bash
python3 scripts/build_data.py path/to/data   # writes data/accounts.json + insights.json
python3 -c "import json;a=json.load(open('data/accounts.json'));open('data/accounts.js','w').write('window.CM_ACCOUNTS='+json.dumps(a,separators=(',',':'))+';')"
python3 -c "import json;a=json.load(open('data/insights.json'));open('data/insights.js','w').write('window.CM_INSIGHTS='+json.dumps(a,separators=(',',':'))+';')"
python3 scripts/build_html.py               # rebuilds index.html from src/body.html
```

## Sources
- PKDD'99 Discovery Challenge Financial dataset, CTU Prague Relational Dataset Repository: https://relational.fel.cvut.cz/dataset/Financial
- EI regular benefits: https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit.html
- EI benefit amount (55%, $729/week max in 2026): https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit/benefit-amount.html
- EI 2026 maximum insurable earnings: https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-employers/premium-reduction-program/2026-maximum-insurable-earnings.html
- TFSA limit for 2026: https://www.investmentexecutive.com/news/tfsa-dollar-limit-to-hold-steady-in-2026
- Statistics Canada tables 18-10-0004-01, 34-10-0133-01, 14-10-0287-01, 14-10-0223-01 (linked in the app's Resources page)

Not financial advice. Built for the Sheridan Datathon 2026.
