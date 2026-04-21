"""
FinEase ML — Training pipeline.

Reads transactions from Postgres, engineers temporal + lag + rolling features,
runs time-series split backtesting (MAE / RMSE / MAPE), fits XGBoost regressors
for `income` and `expense`, and persists the fitted models + metadata to
`backend/ml/models/`.

Usage:
    python train.py --user-id default_user
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Tuple

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
from sqlalchemy import create_engine, text
from xgboost import XGBRegressor

HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Load backend/.env so DB creds match the NestJS config
load_dotenv(HERE.parent / ".env")

LAG_WINDOWS = [1, 2, 3, 7, 14, 30]
ROLL_WINDOWS = [7, 14, 30]
TARGETS = ("income", "expense")


def build_engine():
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    user = os.getenv("DB_USERNAME", "postgres")
    pw = os.getenv("DB_PASSWORD", "postgres")
    db = os.getenv("DB_DATABASE", "finease")
    url = f"postgresql+psycopg2://{user}:{pw}@{host}:{port}/{db}"
    return create_engine(url, future=True)


def load_data(user_id: str) -> pd.DataFrame:
    engine = build_engine()
    query = text(
        """
        SELECT date, income, expense
        FROM transactions
        WHERE "userId" = :uid
        ORDER BY date ASC
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"uid": user_id})

    if df.empty:
        raise SystemExit(f"No transactions found for userId={user_id}")

    df["date"] = pd.to_datetime(df["date"])
    # Aggregate to daily in case of multiple rows per day
    df = df.groupby("date", as_index=False).agg(income=("income", "sum"), expense=("expense", "sum"))
    # Reindex to continuous daily range so lag features are stable
    full_idx = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
    df = df.set_index("date").reindex(full_idx).fillna(0.0)
    df.index.name = "date"
    return df.reset_index()


def engineer_features(df: pd.DataFrame, target: str) -> pd.DataFrame:
    out = df.copy()
    out["year"] = out["date"].dt.year
    out["month"] = out["date"].dt.month
    out["day"] = out["date"].dt.day
    out["dow"] = out["date"].dt.dayofweek
    out["dayofyear"] = out["date"].dt.dayofyear
    out["weekofyear"] = out["date"].dt.isocalendar().week.astype(int)
    out["is_month_start"] = out["date"].dt.is_month_start.astype(int)
    out["is_month_end"] = out["date"].dt.is_month_end.astype(int)

    for lag in LAG_WINDOWS:
        out[f"{target}_lag_{lag}"] = out[target].shift(lag)

    for win in ROLL_WINDOWS:
        shifted = out[target].shift(1)
        out[f"{target}_roll_mean_{win}"] = shifted.rolling(win).mean()
        out[f"{target}_roll_std_{win}"] = shifted.rolling(win).std()

    return out.dropna().reset_index(drop=True)


def feature_matrix(df: pd.DataFrame, target: str) -> Tuple[pd.DataFrame, pd.Series, list[str]]:
    drop_cols = {"date", "income", "expense"}
    feature_cols = [c for c in df.columns if c not in drop_cols]
    X = df[feature_cols]
    y = df[target]
    return X, y, feature_cols


@dataclass
class BacktestMetrics:
    mae: float
    rmse: float
    mape: float
    folds: int


def backtest(X: pd.DataFrame, y: pd.Series, n_splits: int = 5) -> BacktestMetrics:
    n_splits = max(2, min(n_splits, max(2, len(X) // 30)))
    tscv = TimeSeriesSplit(n_splits=n_splits)
    maes, rmses, mapes = [], [], []
    for train_idx, test_idx in tscv.split(X):
        X_tr, X_te = X.iloc[train_idx], X.iloc[test_idx]
        y_tr, y_te = y.iloc[train_idx], y.iloc[test_idx]
        model = make_model()
        model.fit(X_tr, y_tr, verbose=False)
        pred = model.predict(X_te)
        maes.append(mean_absolute_error(y_te, pred))
        rmses.append(np.sqrt(mean_squared_error(y_te, pred)))
        denom = np.where(np.abs(y_te) < 1e-6, 1e-6, np.abs(y_te))
        mapes.append(float(np.mean(np.abs((y_te - pred) / denom)) * 100))
    return BacktestMetrics(
        mae=float(np.mean(maes)),
        rmse=float(np.mean(rmses)),
        mape=float(np.mean(mapes)),
        folds=n_splits,
    )


def make_model() -> XGBRegressor:
    return XGBRegressor(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        tree_method="hist",
        random_state=42,
        n_jobs=0,
    )


def train_target(df_daily: pd.DataFrame, target: str) -> dict:
    feats = engineer_features(df_daily, target)
    if len(feats) < 30:
        raise SystemExit(
            f"Not enough history after feature engineering for {target} "
            f"(need >=30 rows, got {len(feats)})"
        )
    X, y, feature_cols = feature_matrix(feats, target)
    metrics = backtest(X, y)

    final_model = make_model()
    final_model.fit(X, y, verbose=False)

    model_path = MODELS_DIR / f"{target}_model.pkl"
    joblib.dump(
        {
            "model": final_model,
            "feature_cols": feature_cols,
            "lag_windows": LAG_WINDOWS,
            "roll_windows": ROLL_WINDOWS,
            "target": target,
        },
        model_path,
    )
    return {"target": target, "metrics": asdict(metrics), "model_path": str(model_path)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", default="default_user")
    args = parser.parse_args()

    df_daily = load_data(args.user_id)
    results = {
        "userId": args.user_id,
        "rows": int(len(df_daily)),
        "dateRange": {
            "start": df_daily["date"].min().strftime("%Y-%m-%d"),
            "end": df_daily["date"].max().strftime("%Y-%m-%d"),
        },
        "targets": [train_target(df_daily, t) for t in TARGETS],
    }
    
    # [FIX APPLIED HERE]: Persist a snapshot using CSV instead of Parquet
    history_path = MODELS_DIR / "history.csv"
    df_daily.to_csv(history_path, index=False)
    results["historyPath"] = str(history_path)

    print(json.dumps(results))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)