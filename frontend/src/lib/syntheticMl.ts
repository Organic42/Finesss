export interface DailyRow {
  date: string;
  userId: string;
  dayOfWeek: string;
  month: string;
  income: number;
  expense: number;
  profit: number;
  category: string;
  channel: string;
  region: string;
  customerSegment: string;
  marketingSpend: number;
  newCustomers: number;
}

export interface BacktestMetrics {
  folds: number;
  mae: number;
  rmse: number;
  mape: number;
}

export interface PredictedPoint {
  date: string;
  actual: number;
  predicted: number;
  residual: number;
}

export interface BreakdownItem {
  label: string;
  value: number;
}

export interface MonthlyForecast {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

export interface SyntheticMl {
  generatedAt: string;
  userId: string;
  model: {
    primary: string;
    targets: string[];
    lagWindows: number[];
    rollWindows: number[];
  };
  rowCount: number;
  dailyRows: DailyRow[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    totalProfit: number;
    totalNewCustomers: number;
    totalMarketingSpend: number;
  };
  categoryBreakdown: BreakdownItem[];
  channelBreakdown: BreakdownItem[];
  regionBreakdown: BreakdownItem[];
  segmentBreakdown: BreakdownItem[];
  backtest: { income: BacktestMetrics; expense: BacktestMetrics };
  featureImportance: { feature: string; importance: number }[];
  predictedVsActual: { income: PredictedPoint[]; expense: PredictedPoint[] };
  monthlyForecast: MonthlyForecast[];
}

export async function loadSyntheticMl(): Promise<SyntheticMl> {
  const res = await fetch("/synthetic_ml.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load synthetic_ml.json (${res.status})`);
  return (await res.json()) as SyntheticMl;
}
