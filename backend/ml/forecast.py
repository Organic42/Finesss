"""
FinEase ML — Autoregressive forecast.

Loads the fitted income/expense XGBoost models and the daily history snapshot,
then rolls forward day-by-day recomputing lag/rolling features from its own
predictions. Aggregates daily forecasts into monthly buckets (3–6 months).

Usage:
    python forecast.py --months 6
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE / "models"
TARGETS = ("income", "expense")


def load_artifacts() -> dict:
    artifacts = {}
    for target in TARGETS:
        path = MODELS_DIR / f"{target}_model.pkl"
        if not path.exists():
            raise SystemExit(f"Missing model: {path}. Run train.py first.")
        artifacts[target] = joblib.load(path)
        
    # [FIX APPLIED HERE]: Read history snapshot using CSV instead of Parquet
    history_path = MODELS_DIR / "history.csv"
    if not history_path.exists():
        raise SystemExit(f"Missing history snapshot: {history_path}. Run train.py first.")
    
    history = pd.read_csv(history_path)
    history["date"] = pd.to_datetime(history["date"])
    return {"artifacts": artifacts, "history": history}


def build_row(history: pd.DataFrame, next_date: pd.Timestamp, artifact: dict) -> pd.DataFrame:
    target = artifact["target"]
    lag_windows = artifact["lag_windows"]
    roll_windows = artifact["roll_windows"]
    feature_cols = artifact["feature_cols"]

    row = {
        "year": next_date.year,
        "month": next_date.month,
        "day": next_date.day,
        "dow": next_date.dayofweek,
        "dayofyear": next_date.dayofyear,
        "weekofyear": int(next_date.isocalendar().week),
        "is_month_start": int(next_date.is_month_start),
        "is_month_end": int(next_date.is_month_end),
    }

    series = history[target].values
    for lag in lag_windows:
        row[f"{target}_lag_{lag}"] = float(series[-lag]) if len(series) >= lag else 0.0

    for win in roll_windows:
        window_slice = series[-win:] if len(series) >= win else series
        row[f"{target}_roll_mean_{win}"] = float(np.mean(window_slice)) if len(window_slice) else 0.0
        row[f"{target}_roll_std_{win}"] = float(np.std(window_slice, ddof=1)) if len(window_slice) > 1 else 0.0

    return pd.DataFrame([[row[c] for c in feature_cols]], columns=feature_cols)


def forecast(months: int) -> dict:
    bundle = load_artifacts()
    history = bundle["history"].copy()
    artifacts = bundle["artifacts"]

    last_date = history["date"].max()
    horizon_end = (last_date + pd.DateOffset(months=months)).normalize()
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), horizon_end, freq="D")

    daily_rows = []
    for next_date in future_dates:
        predicted = {"date": next_date}
        for target in TARGETS:
            X_row = build_row(history, next_date, artifacts[target])
            yhat = float(artifacts[target]["model"].predict(X_row)[0])
            predicted[target] = max(0.0, yhat)
        history = pd.concat(
            [history, pd.DataFrame([predicted])],
            ignore_index=True,
        )
        daily_rows.append(predicted)

    daily_df = pd.DataFrame(daily_rows)
    daily_df["profit"] = daily_df["income"] - daily_df["expense"]

    monthly = (
        daily_df.assign(month=daily_df["date"].dt.to_period("M"))
        .groupby("month", as_index=False)
        .agg(income=("income", "sum"), expense=("expense", "sum"), profit=("profit", "sum"))
    )
    monthly["month"] = monthly["month"].astype(str)

    return {
        "horizonMonths": months,
        "generatedFrom": last_date.strftime("%Y-%m-%d"),
        "monthly": monthly.round(2).to_dict(orient="records"),
        "daily": [
            {
                "date": r["date"].strftime("%Y-%m-%d"),
                "income": round(float(r["income"]), 2),
                "expense": round(float(r["expense"]), 2),
                "profit": round(float(r["income"] - r["expense"]), 2),
            }
            for r in daily_rows
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--months", type=int, default=6)
    args = parser.parse_args()
    if args.months < 1 or args.months > 12:
        raise SystemExit("--months must be between 1 and 12")

    print(json.dumps(forecast(args.months)))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)