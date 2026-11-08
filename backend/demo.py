
from backend.simulator import calculate_runway

# Verified example metrics from the banking dataset
accounts = {
    28754: {
        "inflow": 14148.22,
        "spending": 13008.715,
        "buffer": 24342.62,
        "bills": 2963.86,
    },

    35412: {
        "inflow": 2858.71,
        "spending": 1877.49,
        "buffer": 12609.938,
        "bills": 1868.30,
    },
}

for account_id, profile in accounts.items():

    print(f"\nAccount {account_id}")

    scenarios = {
        "Job loss (55% income retained)": {
            "income_retained_pct": 55
        },

        "Furnace repair (one month spending)": {
            "one_off_cost": profile["spending"]
        },

        "Job loss + bills up 15%": {
            "income_retained_pct": 55,
            "bills_increase_pct": 15
        },

        "Job loss + furnace repair": {
            "income_retained_pct": 55,
            "one_off_cost": profile["spending"]
        },
    }

    for name, changes in scenarios.items():

        result = calculate_runway(
            **profile,
            **changes
        )

        print(
            f"  {name}: {result['runway_display']} "
            f"(gap: ${result['monthly_shortfall']:,.2f})"
        )
