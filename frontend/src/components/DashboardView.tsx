"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "./GlassCard";
import { KpiTile } from "./KpiTile";
import CsvUploader from "@/components/CsvUploader";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

// FIXED: Changed from USD to INR and set locale to en-IN for proper Indian comma formatting
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) =>
  `${(n * 100).toFixed(1)}%`;

export function DashboardView() {
  const {
    userId,
    kpi,
    forecast,
    isLoadingKpi,
    isLoadingForecast,
    setKpi,
    setForecast,
    setLoadingKpi,
    setLoadingForecast,
  } = useAppStore();

  const fetchDashboardData = useCallback(async () => {
    setLoadingKpi(true);
    try {
      const data = await api.getKpi({ userId });
      setKpi(data);
    } catch {
      setKpi(null);
    } finally {
      setLoadingKpi(false);
    }

    setLoadingForecast(true);
    try {
      const data = await api.getForecast(6);
      setForecast(data);
    } catch {
      setForecast(null);
    } finally {
      setLoadingForecast(false);
    }
  }, [userId, setKpi, setForecast, setLoadingKpi, setLoadingForecast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const forecastArray = useMemo(() => {
    if (Array.isArray(forecast)) return forecast;
    if (forecast?.daily) return forecast.daily;
    if (forecast?.monthly) return forecast.monthly;
    return [];
  }, [forecast]);

  const nextMonthSales = forecastArray.length > 0 ? forecastArray[0].income : 0;
  const nextQuarterSales = forecastArray.length >= 3 
    ? forecastArray[0].income + forecastArray[1].income + forecastArray[2].income 
    : forecastArray.reduce((acc: number, curr: any) => acc + (curr.income || 0), 0);

  const series = useMemo(() => {
    const hist = (kpi?.series ?? []).map((p: any) => ({
      date: p.date,
      income: p.income,
      expense: p.expense,
      profit: p.income - p.expense,
      kind: "actual" as const,
    }));
    const fc = forecastArray.map((p: any) => ({
      date: p.date,
      income: p.income,
      expense: p.expense,
      profit: p.profit,
      kind: "forecast" as const,
    }));
    return [...hist, ...fc];
  }, [kpi, forecastArray]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">
          Executive Dashboard
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Real-time KPIs and XGBoost predicted sales
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <CsvUploader onUploadSuccess={fetchDashboardData} />
        </div>

        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <KpiTile
            label="Total Revenue"
            value={kpi ? fmtCurrency(kpi.revenue) : isLoadingKpi ? "…" : "—"}
            hint={kpi ? `${kpi.transactionCount} total records` : undefined}
            tone="brand"
          />
          <KpiTile
            label="Total Expense"
            value={kpi ? fmtCurrency(kpi.expense) : isLoadingKpi ? "…" : "—"}
            tone="warn"
          />
          <KpiTile
            label="Net Profit"
            value={kpi ? fmtCurrency(kpi.profit) : isLoadingKpi ? "…" : "—"}
            tone={kpi && kpi.profit < 0 ? "danger" : "success"}
          />
          <KpiTile
            label="Historical Margin"
            value={kpi ? fmtPct(kpi.margin) : isLoadingKpi ? "…" : "—"}
            tone="brand"
          />
          
          <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/20 blur-2xl rounded-full"></div>
            <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">AI Predicted (Next Month)</p>
            <p className="text-2xl font-bold text-white relative z-10">
              {forecastArray.length > 0 ? fmtCurrency(nextMonthSales) : isLoadingForecast ? "…" : "—"}
            </p>
          </div>
          
          <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden backdrop-blur-sm">
             <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/20 blur-2xl rounded-full"></div>
            <p className="text-emerald-200 text-xs font-medium uppercase tracking-wider mb-1">AI Predicted (Next Quarter)</p>
            <p className="text-2xl font-bold text-white relative z-10">
              {forecastArray.length > 0 ? fmtCurrency(nextQuarterSales) : isLoadingForecast ? "…" : "—"}
            </p>
          </div>
        </div>
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white text-lg font-semibold">
              Historical vs Forecast Trend
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {isLoadingForecast
                ? "Loading AI models…"
                : forecastArray.length > 0
                  ? `Showing actuals + 6-month XGBoost projection`
                  : "No forecast found. Upload data and run AI Forecast."}
            </p>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={11} 
                minTickGap={30} 
                tickFormatter={(val) => {
                  try { return new Date(val).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }
                  catch { return val; }
                }}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11} 
                tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`} 
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#f8fafc",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)"
                }}
              />
              <Legend wrapperStyle={{ color: "#cbd5e1" }} iconType="circle" />
              
              <Area
                type="monotone"
                dataKey="income"
                name="Income/Sales"
                stroke="#818cf8"
                fill="url(#gIncome)"
                strokeWidth={3}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Expenses"
                stroke="#f59e0b"
                fill="url(#gExpense)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}