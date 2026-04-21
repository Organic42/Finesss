# FinEase — Project Report

A detailed write-up of goals, architecture, design decisions, and delivery status. For setup/run instructions, see [README.md](./README.md).

---

## 1. Problem Statement

Micro, small, and medium-sized enterprises (MSMEs) typically operate on spreadsheets, juggle cash flow manually, and lack the budget for an enterprise BI stack. FinEase delivers a **premium, self-hostable financial dashboard** that:

1. Ingests transactional data (CSV or manual entry).
2. Surfaces KPIs (revenue, expense, profit, margin) with historical context.
3. Forecasts future performance using a modern time-series ML pipeline.
4. Provides a grounded, context-aware AI assistant for plain-language queries.

The entire stack is designed to run on a single laptop with Postgres + Python + Node — no managed cloud services required.

---

## 2. High-Level Architecture

```
┌─────────────────────────┐       ┌──────────────────────────┐
│  Browser (Next.js 16)   │       │  NestJS 11 API (:4000)   │
│  Zustand ↔ ChatWidget   │ ──►   │  TypeORM ↔ PostgreSQL    │
│  Recharts + Framer      │       │  child_process ↔ Python  │
│  Tailwind v4 glassmorph │       │  @google/generative-ai   │
└─────────────────────────┘       └──────────────────────────┘
```

The frontend is a purely client-rendered SPA (Next.js App Router, all data pages are `"use client"`) that talks to the NestJS API over HTTP with JSON. The API is a thin orchestrator: it owns the schema, delegates ML work to Python subprocesses, and proxies natural-language queries to Gemini with a fallback model.

---

## 3. Module-by-Module Breakdown

### 3.1 Backend — `backend/src/modules/transactions/`

Responsible for the canonical `transactions` table.

- **Entity** ([`transaction.entity.ts`](backend/src/modules/transactions/entities/transaction.entity.ts)) — UUID primary key, `userId` (default `"default_user"`), `date`, `income` / `expense` decimals, `createdAt` timestamp, compound index on `[userId, date]` for fast time-range queries.
- **DTOs** — `CreateTransactionDto` (class-validator: non-negative decimals, ISO date), `KpiQueryDto` (optional range + userId).
- **Controller** — REST CRUD + `GET /kpi` aggregation + `POST /upload` (multer `FileInterceptor`, 10 MB cap).
- **Service** — CSV ingest normalizes column aliases (`date|day|transaction_date`, `income|revenue|sales`, `expense|expenses|cost`) and date formats (ISO + US `MM/DD/YYYY`); chunked batch save (500 per chunk). KPI aggregation coerces numeric strings back to numbers (TypeORM decimals round-trip as strings).

### 3.2 Backend — `backend/src/modules/ml/`

Thin bridge to the Python pipeline.

- **MlService** ([`ml.service.ts`](backend/src/modules/ml/ml.service.ts)) — resolves the Python binary in priority order:
  1. `backend/ml/.venv/Scripts/python.exe` (Windows) or `bin/python` (POSIX)
  2. Configured `PYTHON_BIN` env var
- Spawns scripts via `child_process.spawn`, streams stdout/stderr, and parses the **last JSON line** of stdout (so diagnostic logging doesn't break parsing).
- **Endpoints** — `POST /api/ml/train`, `GET /api/ml/forecast?months=N`.

### 3.3 Backend — `backend/ml/` (Python)

- **`train.py`** — Reads transactions from Postgres via SQLAlchemy (same credentials as NestJS, loaded from `backend/.env`). Pipeline:
  1. Aggregate to daily totals, reindex to a continuous date range (fills zero-days).
  2. Engineer features: `year, month, day, dow, dayofyear, weekofyear, is_month_start, is_month_end` + lag features at `{1, 2, 3, 7, 14, 30}` + rolling mean/std at `{7, 14, 30}` (shift-by-1 to avoid leakage).
  3. **Time-series split backtest** (`TimeSeriesSplit`, up to 5 folds, clamped to `len/30`). Reports mean MAE, RMSE, MAPE.
  4. Fit final `XGBRegressor` (`hist` tree method, 400 trees, depth 5) on full history.
  5. Serialize `{model, feature_cols, lag_windows, roll_windows, target}` via joblib to `backend/ml/models/*.pkl`.
  6. Save daily history snapshot to `models/history.parquet` so `forecast.py` can bootstrap lag/rolling features without re-reading Postgres.
- **`forecast.py`** — Loads models + history, then walks day-by-day:
  - Builds a single-row feature matrix from the *current* (possibly predicted) history.
  - Predicts income & expense, clips to ≥ 0, appends to history, continues.
  - Aggregates daily predictions into monthly buckets.
- **Output contract** — Both scripts print **a single JSON line to stdout** on success; errors go to stderr with non-zero exit.

### 3.4 Backend — `backend/src/modules/ai/`

- **AiService** ([`ai.service.ts`](backend/src/modules/ai/ai.service.ts)) — Lazy-instantiates `GoogleGenerativeAI` on first call; throws `ServiceUnavailableException` if `GEMINI_API_KEY` is empty.
- **Model cascade** — Primary `gemini-2.0-flash-lite`, fallback `gemini-1.5-flash`. Falls back on errors matching: `429 / quota / rate / unavailable / overloaded / 503 / 500`.
- **Grounded prompting** — System prompt + trimmed KPI/forecast JSON (capped at 8 KB) is interpolated before the user message. Guidance: *"if a figure isn't present, say so rather than guessing."*

### 3.5 Frontend — `frontend/src/`

- **`store/useAppStore.ts`** — Zustand store with `{ userId, kpi, forecast, loading flags }`. Single source of truth for chart data **and** the chatbot's live context.
- **`lib/api.ts`** — Typed fetch wrappers. One place to change the API base URL (`NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:4000/api`).
- **Pages** (App Router):
  - `/` — [`DashboardView.tsx`](frontend/src/components/DashboardView.tsx) — 4 KPI tiles + stacked historical+forecast area chart.
  - `/analytics` — [`AnalyticsView.tsx`](frontend/src/components/AnalyticsView.tsx) — Monthly bar chart + horizon selector + "Retrain" button that calls `POST /api/ml/train` then refetches forecast.
  - `/ml` — [`MlInsightsView.tsx`](frontend/src/components/MlInsightsView.tsx) — reads synthetic JSON directly from `/public`, renders backtest metrics, feature importance, predicted-vs-actual scatter, residuals, and breakdowns.
  - `/transactions` — CSV upload + manual add + deletable list.
  - `/reports` — Consolidated summary + JSON export.
- **`components/bot/ChatWidget.tsx`** — Floating glass chat panel. On every send, reads the current Zustand state and attaches a trimmed `{ userId, kpi, forecast }` context object. The user types a plain question; the bot sees live numbers.

---

## 4. Design Decisions & Rationale

| Decision                                                                                  | Why                                                                                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Python subprocess for ML** (not a Python microservice)                                  | Zero extra infra; `child_process` + JSON stdout is the simplest durable contract.                         |
| **XGBoost over deep learning**                                                            | MSME datasets are small (≤ 2–3 years daily). Tree ensembles are faster to train, more interpretable, and don't need a GPU. |
| **Lag + rolling features with shift-by-1**                                                | Prevents target leakage; matches how the model will see data at inference time.                          |
| **Autoregressive forecasting over direct multi-output**                                   | Honors temporal dependence between consecutive days, which is where seasonal + trend signals live.       |
| **Zustand instead of React Context**                                                      | Chatbot needs to read KPI data from a deeply nested widget without prop drilling or rerender storms.     |
| **Glassmorphism with Tailwind v4 theme tokens**                                           | Brand differentiation + v4's `@theme` directive avoids a `tailwind.config.ts` file entirely.             |
| **Gemini fallback model**                                                                 | Free-tier quotas hit 429s frequently; a cheaper fallback keeps the chatbot responsive.                   |
| **`DB_SYNCHRONIZE=true` in dev**                                                          | Zero-migration schema evolution while iterating. Must be turned off for production.                      |

---

## 5. Data Model

### `transactions` table

| Column      | Type          | Notes                                     |
| ----------- | ------------- | ----------------------------------------- |
| `id`        | `uuid`        | Primary key, auto-generated               |
| `userId`    | `varchar(50)` | Defaults to `"default_user"`              |
| `date`      | `date`        | ISO `YYYY-MM-DD`                          |
| `income`    | `decimal(15,2)` | Defaults to 0                           |
| `expense`   | `decimal(15,2)` | Defaults to 0                           |
| `createdAt` | `timestamptz` | Auto                                      |

**Index**: compound on `(userId, date)` for range scans.

---

## 6. ML Pipeline — Metrics & Outputs

### `POST /api/ml/train` response (example)

```json
{
  "userId": "default_user",
  "rows": 730,
  "dateRange": { "start": "2024-04-22", "end": "2026-04-21" },
  "targets": [
    {
      "target": "income",
      "metrics": { "mae": 218.4, "rmse": 289.7, "mape": 5.9, "folds": 5 },
      "model_path": ".../models/income_model.pkl"
    },
    {
      "target": "expense",
      "metrics": { "mae": 184.1, "rmse": 241.0, "mape": 6.3, "folds": 5 },
      "model_path": ".../models/expense_model.pkl"
    }
  ],
  "historyPath": ".../models/history.parquet"
}
```

### `GET /api/ml/forecast?months=6` response shape

```json
{
  "horizonMonths": 6,
  "generatedFrom": "2026-04-21",
  "monthly": [{ "month": "2026-05", "income": 127400, "expense": 95300, "profit": 32100 }],
  "daily":   [{ "date":  "2026-04-22", "income": 4230.7, "expense": 3120.5, "profit": 1110.2 }]
}
```

---

## 7. Delivery Status

| Phase | Deliverable                                                       | Status                                              |
| ----- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 1     | Next.js + NestJS scaffold, Transactions CRUD + CSV ingest         | ✅ Authored, backend `nest build` passes            |
| 2     | Python ML (`train.py`, `forecast.py`) + `MlModule` bridge         | ✅ Authored, `nest build` passes                    |
| 3     | Glassmorphism UI, Zustand store, Dashboard/Analytics/Transactions/Reports | ✅ Authored, `next build` passes (6 routes)  |
| 4     | `AiModule` (Gemini + fallback) + floating `ChatWidget`            | ✅ Authored, both builds pass                       |
| 5     | Rich synthetic data + `/ml` visualizer page                       | ✅ JSON generated (201 KB), `/ml` route builds      |

### What's verified
- **Backend** compiles cleanly (`nest build`).
- **Frontend** builds cleanly (`next build`, 6 static routes).
- **Synthetic data generators** run end-to-end (stdlib-only Python).
- **ML Insights visualizer** renders statically from JSON.

### What's **not** verified yet (environment-blocked)
- `POST /api/ml/train` and `GET /api/ml/forecast` — blocked on:
  - Postgres not reachable on `localhost:5432` at verification time.
  - Python 3.14 in the venv; `xgboost` / `pandas` have no 3.14 wheels. Fix: install Python 3.12, rebuild the venv.
- `POST /api/ai/chat` — works as soon as `GEMINI_API_KEY` is set in `backend/.env`.

See the **Troubleshooting** table in the README for remediation steps.

---

## 8. Security & Production Notes

- **`DB_SYNCHRONIZE=true` MUST be disabled** for production. Add a migrations directory (`typeorm migration:generate`) and flip the flag.
- **CORS** is currently open to `CORS_ORIGIN` (single string). Tighten to a strict allow-list before deploy.
- **Multer file limit** is 10 MB. Raise only after adding virus scanning + row-count caps.
- **Gemini API key** is backend-only; the frontend never sees it. Keep it out of logs.
- **No auth layer** yet — `userId` is a free-form string defaulting to `default_user`. Add JWT / session auth before multi-tenant use.

---

## 9. Future Work

1. **Real auth** (NextAuth / Clerk) + per-user data isolation.
2. **Persisted training runs** — store backtest metrics + feature importance in Postgres so `/ml` reflects real models (not just synthetic data).
3. **WebSocket streaming** for the chatbot instead of full-response.
4. **Docker Compose** bundling Postgres + backend + frontend for one-command bootstrap.
5. **Expand `transactions` schema** — add `category`, `channel`, `region` columns so richer synthetic signals can flow into the real ML pipeline.
6. **Scheduled retraining** via a cron inside NestJS (`@Cron` from `@nestjs/schedule`).
7. **Migrations** — switch from `synchronize: true` to proper TypeORM migrations.

---

## 10. Credits

- Time-series forecasting patterns derived from the XGBoost + `TimeSeriesSplit` idiom.
- Glassmorphism tokens inspired by Apple's visionOS / iOS material language.
- Gemini fallback pattern adapted from community guidance on handling 429s in free-tier LLM APIs.
