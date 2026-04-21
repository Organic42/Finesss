"use client";

import { create } from "zustand";

export interface KpiSeriesPoint {
  date: string;
  income: number;
  expense: number;
}

export interface KpiSnapshot {
  userId: string;
  start: string;
  end: string;
  revenue: number;
  expense: number;
  profit: number;
  margin: number;
  transactionCount: number;
  series: KpiSeriesPoint[];
}

export interface ForecastMonthly {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

export interface ForecastSnapshot {
  horizonMonths: number;
  generatedFrom: string;
  monthly: ForecastMonthly[];
  daily: { date: string; income: number; expense: number; profit: number }[];
}

interface AppState {
  userId: string;
  kpi: KpiSnapshot | null;
  forecast: ForecastSnapshot | null;
  isLoadingKpi: boolean;
  isLoadingForecast: boolean;
  setUserId: (id: string) => void;
  setKpi: (kpi: KpiSnapshot | null) => void;
  setForecast: (fc: ForecastSnapshot | null) => void;
  setLoadingKpi: (v: boolean) => void;
  setLoadingForecast: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: "default_user",
  kpi: null,
  forecast: null,
  isLoadingKpi: false,
  isLoadingForecast: false,
  setUserId: (id) => set({ userId: id }),
  setKpi: (kpi) => set({ kpi }),
  setForecast: (forecast) => set({ forecast }),
  setLoadingKpi: (v) => set({ isLoadingKpi: v }),
  setLoadingForecast: (v) => set({ isLoadingForecast: v }),
}));
