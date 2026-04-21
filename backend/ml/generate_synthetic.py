"""
Generate a synthetic transactions CSV for FinEase dev/testing.

~2 years of daily income/expense for userId=default_user, with:
  - gradual upward trend
  - weekly seasonality (weekends lower)
  - monthly payroll spike on expenses
  - gaussian noise

Output: backend/ml/synthetic_transactions.csv
Columns: date,userId,income,expense   (matches CSV ingest aliases)
"""
from __future__ import annotations

import csv
from datetime import date, timedelta
from pathlib import Path
import math
import random

OUT = Path(__file__).resolve().parent / "synthetic_transactions.csv"
USER_ID = "default_user"
DAYS = 730  # ~2 years
START = date.today() - timedelta(days=DAYS)
SEED = 42

random.seed(SEED)


def simulate():
    rows = []
    base_income = 3500.0
    base_expense = 2400.0
    for i in range(DAYS):
        d = START + timedelta(days=i)
        trend = i * 0.8  # slow growth
        weekly = math.sin((d.weekday() / 6.0) * math.pi) * 400  # peaks midweek
        weekend_dip = -600 if d.weekday() >= 5 else 0
        noise_i = random.gauss(0, 250)
        noise_e = random.gauss(0, 180)
        payroll_spike = 1500 if d.day == 1 else 0

        income = max(0.0, base_income + trend + weekly + weekend_dip + noise_i)
        expense = max(0.0, base_expense + trend * 0.6 + noise_e + payroll_spike)

        rows.append(
            {
                "date": d.isoformat(),
                "userId": USER_ID,
                "income": round(income, 2),
                "expense": round(expense, 2),
            }
        )
    return rows


def main():
    rows = simulate()
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "userId", "income", "expense"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
