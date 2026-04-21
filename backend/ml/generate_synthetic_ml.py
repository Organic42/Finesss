"""
Generate a rich synthetic dataset for the ML Insights visualizer.

Stdlib only (no venv needed). Writes `frontend/public/synthetic_ml.json`
containing:
  - dailyRows: 2 years of daily business data with richer columns
  - categoryBreakdown: expense distribution by category
  - channelBreakdown: revenue distribution by channel
  - regionBreakdown: revenue by region
  - backtest: simulated MAE/RMSE/MAPE for income + expense targets
  - featureImportance: simulated XGBoost feature gains
  - predictedVsActual: last holdout fold pairs for income + expense
  - residuals: daily residuals (actual - predicted) over last fold
  - monthlyForecast: 6-month forward projection

This is visualizer-only — the real ML pipeline lives in train.py / forecast.py.
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "frontend" / "public" / "synthetic_ml.json"

SEED = 42
DAYS = 730
USER_ID = "default_user"

CATEGORIES = [
    ("Inventory", 0.32),
    ("Payroll", 0.28),
    ("Rent & Utilities", 0.12),
    ("Marketing", 0.10),
    ("Logistics", 0.08),
    ("Software & Tools", 0.06),
    ("Other", 0.04),
]
CHANNELS = [("Retail", 0.45), ("Online", 0.35), ("Wholesale", 0.20)]
REGIONS = [("North", 0.30), ("South", 0.25), ("East", 0.22), ("West", 0.23)]
SEGMENTS = [("SMB", 0.55), ("Enterprise", 0.15), ("Individual", 0.30)]

FEATURES = [
    "income_lag_1",
    "income_lag_7",
    "income_roll_mean_7",
    "income_roll_mean_30",
    "dow",
    "month",
    "is_month_end",
    "marketing_spend",
    "new_customers",
    "expense_lag_1",
    "expense_roll_mean_7",
    "dayofyear",
    "weekofyear",
    "is_month_start",
    "income_lag_30",
]

rng = random.Random(SEED)


def weighted_pick(items):
    r = rng.random()
    acc = 0.0
    for name, w in items:
        acc += w
        if r <= acc:
            return name
    return items[-1][0]


def simulate_daily():
    start = date.today() - timedelta(days=DAYS)
    base_income = 3800.0
    base_expense = 2500.0
    rows = []
    for i in range(DAYS):
        d = start + timedelta(days=i)
        trend = i * 0.9
        weekly = math.sin((d.weekday() / 6.0) * math.pi) * 450
        weekend = -700 if d.weekday() >= 5 else 0
        payroll = 1800 if d.day == 1 else 0
        marketing_spend = max(0.0, rng.gauss(200, 60) + (400 if d.weekday() == 0 else 0))
        new_customers = max(0, int(rng.gauss(18, 7) + (marketing_spend / 40.0)))

        income = max(0.0, base_income + trend + weekly + weekend + rng.gauss(0, 260) + new_customers * 12)
        expense = max(0.0, base_expense + trend * 0.6 + rng.gauss(0, 190) + payroll + marketing_spend)

        rows.append(
            {
                "date": d.isoformat(),
                "userId": USER_ID,
                "dayOfWeek": d.strftime("%a"),
                "month": d.strftime("%b"),
                "income": round(income, 2),
                "expense": round(expense, 2),
                "profit": round(income - expense, 2),
                "category": weighted_pick(CATEGORIES),
                "channel": weighted_pick(CHANNELS),
                "region": weighted_pick(REGIONS),
                "customerSegment": weighted_pick(SEGMENTS),
                "marketingSpend": round(marketing_spend, 2),
                "newCustomers": new_customers,
            }
        )
    return rows


def breakdown(rows, key, value_key):
    totals: dict[str, float] = {}
    for r in rows:
        totals[r[key]] = totals.get(r[key], 0.0) + float(r[value_key])
    return [
        {"label": k, "value": round(v, 2)}
        for k, v in sorted(totals.items(), key=lambda x: -x[1])
    ]


def simulate_backtest():
    return {
        "income": {
            "folds": 5,
            "mae": round(rng.uniform(180, 260), 2),
            "rmse": round(rng.uniform(240, 340), 2),
            "mape": round(rng.uniform(4.8, 7.2), 2),
        },
        "expense": {
            "folds": 5,
            "mae": round(rng.uniform(150, 220), 2),
            "rmse": round(rng.uniform(200, 290), 2),
            "mape": round(rng.uniform(5.1, 7.8), 2),
        },
    }


def simulate_feature_importance():
    # Normalize a random gain vector, sorted desc
    raw = [rng.uniform(0.02, 1.0) for _ in FEATURES]
    # Give lag/rolling features an edge (realistic for time-series)
    for i, f in enumerate(FEATURES):
        if "lag_1" in f or "roll_mean_7" in f:
            raw[i] *= 2.2
        elif "lag" in f or "roll" in f:
            raw[i] *= 1.5
    s = sum(raw)
    vals = sorted(
        [{"feature": f, "importance": round(v / s, 4)} for f, v in zip(FEATURES, raw)],
        key=lambda x: -x["importance"],
    )
    return vals


def simulate_predicted_vs_actual(rows, target):
    # Take the last 90 days of history as "holdout fold"
    fold = rows[-90:]
    out = []
    for r in fold:
        actual = float(r[target])
        # Predicted = actual + gaussian noise proportional to scale
        noise = rng.gauss(0, max(50.0, actual * 0.08))
        predicted = max(0.0, actual + noise)
        out.append(
            {
                "date": r["date"],
                "actual": round(actual, 2),
                "predicted": round(predicted, 2),
                "residual": round(actual - predicted, 2),
            }
        )
    return out


def simulate_monthly_forecast(rows):
    # Base on the trailing 30-day averages and extrapolate 6 months
    tail = rows[-30:]
    avg_income = sum(r["income"] for r in tail) / len(tail)
    avg_expense = sum(r["expense"] for r in tail) / len(tail)
    last = date.fromisoformat(rows[-1]["date"])
    out = []
    for m in range(1, 7):
        # monthly = daily avg * ~30 + small trend/noise
        growth = 1 + 0.015 * m
        inc = avg_income * 30 * growth * rng.uniform(0.97, 1.05)
        exp = avg_expense * 30 * (1 + 0.010 * m) * rng.uniform(0.97, 1.05)
        # Find target month label
        yy, mm = last.year, last.month + m
        while mm > 12:
            mm -= 12
            yy += 1
        out.append(
            {
                "month": f"{yy}-{mm:02d}",
                "income": round(inc, 2),
                "expense": round(exp, 2),
                "profit": round(inc - exp, 2),
            }
        )
    return out


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = simulate_daily()
    payload = {
        "generatedAt": date.today().isoformat(),
        "userId": USER_ID,
        "model": {
            "primary": "xgboost-regressor",
            "targets": ["income", "expense"],
            "lagWindows": [1, 2, 3, 7, 14, 30],
            "rollWindows": [7, 14, 30],
        },
        "rowCount": len(rows),
        "dailyRows": rows,
        "summary": {
            "totalIncome": round(sum(r["income"] for r in rows), 2),
            "totalExpense": round(sum(r["expense"] for r in rows), 2),
            "totalProfit": round(sum(r["profit"] for r in rows), 2),
            "totalNewCustomers": sum(r["newCustomers"] for r in rows),
            "totalMarketingSpend": round(sum(r["marketingSpend"] for r in rows), 2),
        },
        "categoryBreakdown": breakdown(rows, "category", "expense"),
        "channelBreakdown": breakdown(rows, "channel", "income"),
        "regionBreakdown": breakdown(rows, "region", "income"),
        "segmentBreakdown": breakdown(rows, "customerSegment", "income"),
        "backtest": simulate_backtest(),
        "featureImportance": simulate_feature_importance(),
        "predictedVsActual": {
            "income": simulate_predicted_vs_actual(rows, "income"),
            "expense": simulate_predicted_vs_actual(rows, "expense"),
        },
        "monthlyForecast": simulate_monthly_forecast(rows),
    }

    with OUT.open("w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"Wrote {len(rows)} daily rows + model artifacts to {OUT}")


if __name__ == "__main__":
    main()
