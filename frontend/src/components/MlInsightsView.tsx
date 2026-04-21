"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { GlassCard } from "./GlassCard";
import { KpiTile } from "./KpiTile";
import { loadSyntheticMl, type SyntheticMl } from "@/lib/syntheticMl";

const PIE_COLORS = [
  "#818cf8",
  "#22d3ee",
  "#34d399",
  "#f59e0b",
  "#fb7185",
  "#a78bfa",
  "#60a5fa",
];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const tooltipStyle = {
  background: "rgba(15,23,42,0.92)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 12,
  color: "#e2e8f0",
} as const;

export function MlInsightsView() {
  const [data, setData] = useState<SyntheticMl | null>(null);
  const [target, setTarget] = useState<"income" | "expense">("income");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSyntheticMl()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scatterDomain = useMemo(() => {
    if (!data) return { min: 0, max: 1 };
    const pts = data.predictedVsActual[target];
    const values = pts.flatMap((p) => [p.actual, p.predicted]);
    return {
      min: Math.min(...values) * 0.95,
      max: Math.max(...values) * 1.05,
    };
  }, [data, target]);

  const diagonalRef = useMemo(() => {
    if (!data) return [];
    return [
      { x: scatterDomain.min, y: scatterDomain.min },
      { x: scatterDomain.max, y: scatterDomain.max },
    ];
  }, [data, scatterDomain]);

  if (error) {
    return (
      <GlassCard>
        <p className="text-rose-300 text-sm">
          Failed to load synthetic ML data: {error}
        </p>
        <p className="text-slate-400 text-xs mt-2">
          Run{" "}
          <code className="bg-white/10 px-1.5 py-0.5 rounded">
            python backend/ml/generate_synthetic_ml.py
          </code>{" "}
          to regenerate the file.
        </p>
      </GlassCard>
    );
  }

  if (!data) {
    return <GlassCard>Loading model insights…</GlassCard>;
  }

  const metrics = data.backtest[target];
  const pva = data.predictedVsActual[target];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            ML Insights
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Visualizing what the {data.model.primary} learned — synthetic
            dataset ({data.rowCount} rows, generated {data.generatedAt})
          </p>
        </div>
        <div className="flex gap-1 bg-white/5 border border-white/15 rounded-xl p-1 w-fit">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={
                "px-3 py-1.5 text-xs rounded-lg transition-colors " +
                (target === t
                  ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow"
                  : "text-slate-300 hover:text-white")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Backtest metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiTile label="MAE" value={metrics.mae.toFixed(2)} tone="brand" />
        <KpiTile label="RMSE" value={metrics.rmse.toFixed(2)} tone="warn" />
        <KpiTile
          label="MAPE"
          value={`${metrics.mape.toFixed(2)}%`}
          tone="success"
        />
        <KpiTile
          label="Folds"
          value={String(metrics.folds)}
          hint="Time-series split"
          tone="brand"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Feature Importance */}
        <GlassCard>
          <h2 className="text-white text-lg font-semibold">
            Feature Importance
          </h2>
          <p className="text-slate-400 text-xs mb-4">
            Which signals drive model predictions (normalized XGBoost gain)
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.featureImportance}
                layout="vertical"
                margin={{ left: 48 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  stroke="#94a3b8"
                  fontSize={10}
                  width={120}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="importance"
                  fill="#818cf8"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Predicted vs Actual scatter */}
        <GlassCard>
          <h2 className="text-white text-lg font-semibold capitalize">
            Predicted vs Actual — {target}
          </h2>
          <p className="text-slate-400 text-xs mb-4">
            Last 90-day holdout fold. Points near the diagonal ≈ good
            predictions.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Actual"
                  domain={[scatterDomain.min, scatterDomain.max]}
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Predicted"
                  domain={[scatterDomain.min, scatterDomain.max]}
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <ZAxis range={[50, 50]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ color: "#e2e8f0" }} />
                <Scatter
                  name="Predictions"
                  data={pva.map((p) => ({ x: p.actual, y: p.predicted }))}
                  fill="#22d3ee"
                />
                <Scatter
                  name="Ideal"
                  data={diagonalRef}
                  line={{ stroke: "#f472b6", strokeDasharray: "4 4" }}
                  fill="#f472b6"
                  shape={() => <g />}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Residuals over time */}
        <GlassCard className="lg:col-span-2">
          <h2 className="text-white text-lg font-semibold capitalize">
            Residuals — {target}
          </h2>
          <p className="text-slate-400 text-xs mb-4">
            Actual − Predicted. Values near zero ≈ unbiased; systematic drift
            ≈ bias.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pva}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={10}
                  minTickGap={24}
                />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="residual"
                  stroke="#f59e0b"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Category pie */}
        <GlassCard>
          <h2 className="text-white text-lg font-semibold">
            Expense by Category
          </h2>
          <p className="text-slate-400 text-xs mb-4">
            Where the money goes across the whole dataset
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} />
                <Pie
                  data={data.categoryBreakdown}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {data.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ color: "#e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Channel / Region / Segment bars */}
        <GlassCard>
          <h2 className="text-white text-lg font-semibold">Revenue Mix</h2>
          <p className="text-slate-400 text-xs mb-4">
            Channel, region, and segment contributions to total income
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  ...data.channelBreakdown.map((b) => ({
                    dim: `Ch · ${b.label}`,
                    value: b.value,
                  })),
                  ...data.regionBreakdown.map((b) => ({
                    dim: `Rg · ${b.label}`,
                    value: b.value,
                  })),
                  ...data.segmentBreakdown.map((b) => ({
                    dim: `Sg · ${b.label}`,
                    value: b.value,
                  })),
                ]}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="dim"
                  stroke="#94a3b8"
                  fontSize={10}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => fmtCurrency(Number(v))}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Monthly forecast */}
        <GlassCard className="lg:col-span-2">
          <h2 className="text-white text-lg font-semibold">
            6-Month Forecast (Synthetic)
          </h2>
          <p className="text-slate-400 text-xs mb-4">
            Projected income/expense/profit — illustrative only
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyForecast}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => fmtCurrency(Number(v))}
                />
                <Legend wrapperStyle={{ color: "#e2e8f0" }} />
                <Bar dataKey="income" fill="#818cf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
