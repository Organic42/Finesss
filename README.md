FinEase — MSME Financial Intelligence Dashboard

A production-grade financial dashboard for micro, small, and medium-sized businesses. FinEase combines a NestJS + PostgreSQL API, an XGBoost forecasting pipeline in Python, a Next.js 16 glassmorphism UI, and a context-aware Groq Llama 3.3-powered chatbot (FinBot) that reads live KPIs from the Zustand store on every turn.

Table of Contents

Architecture

Repository Layout

Prerequisites

Quick Start

Environment Variables

Database Setup

Python ML Environment

Running the Apps

API Endpoints

Frontend Routes

Synthetic Data & ML Insights Visualizer

Common Commands

Troubleshooting

Architecture

┌────────────────────────────┐        ┌──────────────────────────────┐
│  Next.js 16 (App Router)   │        │  NestJS 11 (TypeScript)      │
│  ── Glassmorphism UI       │◄──────►│  ── /api/transactions        │
│  ── Zustand store          │  HTTP  │  ── /api/ml/train|forecast   │
│  ── Recharts + Framer      │        │  ── /api/ai/chat             │
│  ── Floating ChatWidget    │        │                              │
└────────────────────────────┘        └──────────────┬───────────────┘
                                                     │
                                      ┌──────────────┴───────────────┐
                                      │                              │
                                      ▼                              ▼
                               ┌──────────────┐             ┌──────────────┐
                               │  PostgreSQL  │             │  Python 3.12 │
                               │  TypeORM     │             │  XGBoost,    │
                               │  transactions│◄────────────│  scikit-learn│
                               └──────────────┘  SQLAlchemy │  (child_proc)│
                                                            └──────────────┘
                                                                 ▲
                                                                 │
                                                        ┌────────┴────────┐
                                                        │  Groq API       │
                                                        │  Llama-3.3-70b  │
                                                        └─────────────────┘


Repository Layout

Finesss/
├── backend/                          NestJS API + ML orchestration
│   ├── src/
│   │   ├── main.ts                   Bootstrap (CORS, /api prefix, ValidationPipe)
│   │   ├── app.module.ts             Root module (Config + TypeORM + feature modules)
│   │   ├── config/
│   │   │   ├── env.validation.ts     class-validator env schema
│   │   │   └── typeorm.config.ts     Async Postgres config
│   │   └── modules/
│   │       ├── transactions/         CRUD + CSV upload + KPI aggregation
│   │       ├── ml/                   spawns Python train.py / forecast.py (CSV-based)
│   │       └── ai/                   Groq Llama 3.3 chat integration
│   ├── ml/                           Python ML pipeline
│   │   ├── requirements.txt
│   │   ├── train.py                  XGBoost regressors + time-series backtest
│   │   ├── forecast.py               Autoregressive 3–12 month forecast
│   │   ├── generate_synthetic.py     CSV generator (for /api/transactions/upload)
│   │   └── generate_synthetic_ml.py  JSON generator (for /ml visualizer)
│   └── .env / .env.example
│
├── frontend/                         Next.js 16 (App Router)
│   ├── src/
│   │   ├── app/                      Routes: /, /analytics, /ml, /transactions, /reports
│   │   ├── components/
│   │   │   ├── GlassCard.tsx         Reusable glassmorphism surface
│   │   │   ├── Navbar.tsx            Sticky glass header
│   │   │   ├── KpiTile.tsx           Animated KPI tile
│   │   │   ├── DashboardView.tsx     Homepage: KPIs + historical-vs-forecast chart
│   │   │   ├── AnalyticsView.tsx     Monthly forecast + retrain button
│   │   │   ├── TransactionsView.tsx  CSV upload + manual add + list
│   │   │   ├── ReportsView.tsx       Consolidated summary + JSON export
│   │   │   ├── MlInsightsView.tsx    Model visualizer (synthetic data)
│   │   │   └── bot/
│   │   │       ├── ChatWidget.tsx    Floating FinBot (reads Zustand)
│   │   │       └── MessageBubble.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                Typed fetch wrappers
│   │   │   └── syntheticMl.ts        /ml page loader + types
│   │   └── store/
│   │       └── useAppStore.ts        Zustand: { userId, kpi, forecast }
│   └── public/synthetic_ml.json      Generated by generate_synthetic_ml.py
│
├── README.md                         (this file)
└── REPORT.md                         Project report / architectural deep-dive


Prerequisites

Tool

Version

Notes

Node.js

20.x or newer

Tested on 24.15.0

npm

10.x+

Ships with Node

PostgreSQL

14+

Local or Docker

Python

3.12 or 3.13

⚠ Not 3.14 — xgboost/pandas wheels are not yet available on 3.14

Groq API key

any

Get one free

Quick Start

# 1. Clone
git clone <your-fork-url> finease && cd finease

# 2. Install Node deps
cd backend && npm install && cd ../frontend && npm install && cd ..

# 3. Create the Postgres database (in DBeaver or psql)
#    CREATE DATABASE finease;

# 4. Set up backend env
cp backend/.env.example backend/.env
#    Fill in DB credentials + GROQ_API_KEY

# 5. Create the Python ML venv (MUST be Python 3.12 or 3.13)
cd backend/ml
py -3.12 -m venv .venv
./.venv/Scripts/activate       # Windows Git Bash
# source .venv/bin/activate    # macOS/Linux
pip install --upgrade pip
pip install -r requirements.txt
cd ../..

# 6. Run both apps (in two terminals)
cd backend && npm run start:dev      # → http://localhost:4000/api
cd frontend && npm run dev           # → http://localhost:3000


Environment Variables

backend/.env:

PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=finease
DB_SYNCHRONIZE=true              # dev only — auto-creates schema
CORS_ORIGIN=http://localhost:3000
GROQ_API_KEY=your_groq_api_key_here
PYTHON_BIN=python                # fallback — MlService auto-detects backend/ml/.venv first
ML_DIR=ml                        # resolved relative to backend/


Frontend reads NEXT_PUBLIC_API_BASE_URL (defaults to http://localhost:4000/api). Override in frontend/.env.local if needed.

Database Setup

Using DBeaver

Connect to your local Postgres (default: postgres / postgres on localhost:5432).

Open a new SQL editor and run:

CREATE DATABASE finease
  WITH OWNER = postgres
       ENCODING = 'UTF8'
       TEMPLATE = template0;


Refresh the Databases node — finease should appear.

That's it — TypeORM auto-creates the transactions table on first backend boot because DB_SYNCHRONIZE=true.

Using Docker (alternative)

docker run --name finease-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec -it finease-pg psql -U postgres -c "CREATE DATABASE finease;"


Python ML Environment

⚠ Python version matters. xgboost, pandas, and scikit-learn don't ship 3.14 wheels yet. Use 3.12 or 3.13.

cd backend/ml
py -3.12 -m venv .venv                  # Windows py-launcher picks 3.12
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r requirements.txt
./.venv/Scripts/python.exe -c "import xgboost, sklearn, pandas, sqlalchemy, psycopg2, joblib; print('ok')"


The NestJS MlService auto-detects the venv at backend/ml/.venv/Scripts/python.exe (Windows) or backend/ml/.venv/bin/python (POSIX). If neither exists, it falls back to the PYTHON_BIN env var.

Running the Apps

Target

Command

URL

Backend dev

cd backend && npm run start:dev

http://localhost:4000/api

Backend prod

cd backend && npm run build && npm run start:prod

http://localhost:4000/api

Frontend dev

cd frontend && npm run dev

http://localhost:3000

Frontend build

cd frontend && npm run build && npm run start

http://localhost:3000

API Endpoints

All endpoints are prefixed with /api.

Transactions (/api/transactions)

Method

Path

Body / Query

Purpose

GET

/

?userId=default_user

List all transactions

GET

/kpi

?userId=&start=YYYY-MM-DD&end=YYYY-MM-DD

Aggregated KPIs + daily series

GET

/:id

—

Fetch one by UUID

POST

/

{ userId?, date, income?, expense? }

Create one

POST

/upload

multipart/form-data field file

Bulk CSV ingest (10 MB limit)

DELETE

/:id

—

Delete by UUID

CSV format — headers are case-insensitive; accepted aliases:

date / day / transaction_date

income / revenue / sales

expense / expenses / cost

userId / user_id (optional; falls back to query param or default_user)

ML (/api/ml)

Method

Path

Body / Query

Purpose

POST

/train

{ userId? }

Spawns train.py → fits income+expense models

GET

/forecast

?months=6 (1–12)

Spawns forecast.py → autoregressive projection

AI (/api/ai)

Method

Path

Body

Purpose

POST

/chat

{ message: string, context?: object }

FinBot reply via Groq Llama 3.3

Frontend Routes

Route

Purpose

/

Dashboard — KPI tiles + historical-vs-forecast area chart

/analytics

Monthly forecast bars + horizon selector (3–12 mo) + retrain button

/ml

ML Insights visualizer (reads synthetic JSON, no backend required)

/transactions

CSV upload + manual add + paginated list with delete

/reports

Consolidated summary + JSON export

The floating FinBot chat widget is global. It reads KPI + forecast from the Zustand store and silently attaches them to every /api/ai/chat payload.

Synthetic Data & ML Insights Visualizer

Two generators are included — both are stdlib-only and do not require the venv.

1. CSV for the real ingest pipeline

python backend/ml/generate_synthetic.py
# Writes: backend/ml/synthetic_transactions.csv  (730 rows, 4 columns)


Upload via the Transactions page or:

curl -F "file=@backend/ml/synthetic_transactions.csv" \
     http://localhost:4000/api/transactions/upload


2. Rich JSON for the /ml visualizer

python backend/ml/generate_synthetic_ml.py
# Writes: frontend/public/synthetic_ml.json  (~200 KB, 13 columns + model artifacts)


The /ml page fetches this JSON directly (no backend hop) and renders:

Backtest metrics (MAE / RMSE / MAPE / folds) per target

Feature importance bar chart

Predicted vs actual scatter with diagonal reference

Residuals time series

Category / channel / region / segment breakdowns

6-month forecast bars

Common Commands

Backend

Command

Purpose

npm run start:dev

Dev server w/ watch + TypeScript on the fly

npm run build

nest build → dist/

npm run start:prod

Run compiled dist/main.js

npm run lint

ESLint

npm test

Jest unit tests

Frontend

Command

Purpose

npm run dev

Next dev server (Turbopack)

npm run build

Production build

npm run start

Serve the production build

npm run lint

ESLint

Python ML

Command

Purpose

./.venv/Scripts/python.exe train.py

Train models → backend/ml/models/*.pkl

./.venv/Scripts/python.exe forecast.py --months 6

6-month forecast JSON to stdout

python generate_synthetic.py

Write synthetic CSV

python generate_synthetic_ml.py

Write synthetic JSON for /ml page

Troubleshooting

Symptom

Fix

ModuleNotFoundError: No module named 'joblib' when training

The venv is missing deps — run pip install -r requirements.txt inside backend/ml/.venv.

pandas fails to build with Could not parse vswhere.exe output

You're on Python 3.14. xgboost/pandas have no 3.14 wheels yet. Install Python 3.12 and recreate the venv.

Backend starts but fails with getaddrinfo ENOTFOUND or connection refused on port 5432

Postgres is not running. Start the service (Get-Service postgresql* → Start-Service ...) or run the Docker command above.

CORS errors in the browser

Set CORS_ORIGIN=http://localhost:3000 in backend/.env and restart the backend.

FinBot replies with "Sorry — I couldn't reach the AI service"

Set GROQ_API_KEY in backend/.env and restart the backend.

/api/ml/train returns 500 Python train.py failed

Check backend logs for the stderr field — usually it's the venv or a Postgres connectivity error.

Recharts warns width(-1) and height(-1) during next build

Harmless — it's a build-time prerender warning; resolves in the browser.

License

MIT License.