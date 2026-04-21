"use client";

import { useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function ReportsView() {
  const { userId, kpi, forecast, setKpi, setForecast } = useAppStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!kpi) {
          const data = await api.getKpi({ userId });
          if (!cancelled) setKpi(data);
        }
      } catch {
        /* ignore */
      }
      try {
        if (!forecast) {
          const data = await api.getForecast(6);
          if (!cancelled) setForecast(data);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, kpi, forecast, setKpi, setForecast]);

  const downloadJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      userId,
      kpi,
      forecast,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finease-report-${userId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Reports
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Consolidated summary of performance + forecast
          </p>
        </div>
        <button
          onClick={downloadJson}
          className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20"
        >
          Export JSON
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h2 className="text-white font-semibold mb-2">Historical</h2>
          {kpi ? (
            <ul className="text-sm text-slate-200 space-y-1">
              <li>Range: {kpi.start} → {kpi.end}</li>
              <li>Revenue: {fmtCurrency(kpi.revenue)}</li>
              <li>Expense: {fmtCurrency(kpi.expense)}</li>
              <li>Profit: {fmtCurrency(kpi.profit)}</li>
              <li>Margin: {(kpi.margin * 100).toFixed(1)}%</li>
              <li>Transactions: {kpi.transactionCount}</li>
            </ul>
          ) : (
            <p className="text-slate-400 text-sm">No KPIs available.</p>
          )}
        </GlassCard>

        <GlassCard>
          <h2 className="text-white font-semibold mb-2">Forecast</h2>
          {forecast ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="text-left py-2">Month</th>
                    <th className="text-right py-2">Income</th>
                    <th className="text-right py-2">Expense</th>
                    <th className="text-right py-2">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.monthly.map((m) => (
                    <tr key={m.month} className="border-t border-white/5">
                      <td className="py-1.5 text-slate-200">{m.month}</td>
                      <td className="py-1.5 text-right text-indigo-300">
                        {fmtCurrency(m.income)}
                      </td>
                      <td className="py-1.5 text-right text-amber-300">
                        {fmtCurrency(m.expense)}
                      </td>
                      <td className="py-1.5 text-right text-emerald-300">
                        {fmtCurrency(m.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">
              No forecast available. Train a model first.
            </p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
