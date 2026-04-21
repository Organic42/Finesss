import Papa from "papaparse";

export type CsvRow = Record<string, string | number | null>;

export interface ColumnProfile {
  name: string;
  kind: "date" | "numeric" | "categorical" | "unknown";
  sample: (string | number | null)[];
  nullCount: number;
  uniqueCount: number;
}

export interface DetectedSchema {
  dateCol: string | null;
  incomeCol: string | null;
  expenseCol: string | null;
  numericCols: string[];
  categoricalCols: string[];
  columns: ColumnProfile[];
}

export interface ParsedCsv {
  rows: CsvRow[];
  schema: DetectedSchema;
  headers: string[];
  errors: string[];
}

const DATE_HINTS = [
  "date",
  "day",
  "transaction_date",
  "transactiondate",
  "txn_date",
  "posted",
  "posted_date",
  "timestamp",
];
const INCOME_HINTS = [
  "income",
  "revenue",
  "sales",
  "credit",
  "inflow",
  "amount_in",
  "receipt",
];
const EXPENSE_HINTS = [
  "expense",
  "expenses",
  "cost",
  "debit",
  "outflow",
  "amount_out",
  "spend",
  "spending",
];

const MAX_ROWS = 20000;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function tryParseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[,\s$€₹£]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function tryParseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const raw = String(v).trim();
  // ISO fast-path
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // US MM/DD/YYYY or DD/MM/YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, a, b, c] = m;
    const yyyy = c.length === 2 ? `20${c}` : c;
    const mm = a.padStart(2, "0");
    const dd = b.padStart(2, "0");
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return null;
}

function profileColumn(name: string, values: unknown[]): ColumnProfile {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const numericParsed = nonNull.map(tryParseNumber);
  const dateParsed = nonNull.map(tryParseDate);
  const numericHits = numericParsed.filter((v) => v !== null).length;
  const dateHits = dateParsed.filter((v) => v !== null).length;
  const unique = new Set(nonNull.map((v) => String(v))).size;

  let kind: ColumnProfile["kind"] = "unknown";
  if (nonNull.length === 0) {
    kind = "unknown";
  } else if (dateHits / nonNull.length >= 0.8) {
    kind = "date";
  } else if (numericHits / nonNull.length >= 0.8) {
    kind = "numeric";
  } else if (unique > 0 && unique <= Math.max(30, nonNull.length * 0.4)) {
    kind = "categorical";
  }

  return {
    name,
    kind,
    sample: nonNull.slice(0, 5) as (string | number | null)[],
    nullCount: values.length - nonNull.length,
    uniqueCount: unique,
  };
}

function pickByHint(profiles: ColumnProfile[], hints: string[], kind: ColumnProfile["kind"]) {
  for (const hint of hints) {
    const exact = profiles.find(
      (p) => p.kind === kind && normalizeHeader(p.name) === hint,
    );
    if (exact) return exact.name;
    const contains = profiles.find(
      (p) => p.kind === kind && normalizeHeader(p.name).includes(hint),
    );
    if (contains) return contains.name;
  }
  return null;
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h) => h.trim(),
      preview: MAX_ROWS,
      complete: (result) => {
        const errors = result.errors.map(
          (e) => `${e.type} row ${e.row ?? "?"}: ${e.message}`,
        );
        const headers = result.meta.fields ?? [];
        const rows = result.data as CsvRow[];
        if (!headers.length || !rows.length) {
          reject(new Error("CSV has no headers or rows"));
          return;
        }

        const profiles = headers.map((h) =>
          profileColumn(
            h,
            rows.map((r) => r[h]),
          ),
        );

        const dateCol =
          pickByHint(profiles, DATE_HINTS, "date") ??
          profiles.find((p) => p.kind === "date")?.name ??
          null;
        const incomeCol =
          pickByHint(profiles, INCOME_HINTS, "numeric") ??
          profiles.find((p) => p.kind === "numeric")?.name ??
          null;
        const expenseCol =
          pickByHint(profiles, EXPENSE_HINTS, "numeric") ??
          profiles.find(
            (p) => p.kind === "numeric" && p.name !== incomeCol,
          )?.name ??
          null;

        resolve({
          rows,
          headers,
          errors,
          schema: {
            dateCol,
            incomeCol,
            expenseCol,
            numericCols: profiles.filter((p) => p.kind === "numeric").map((p) => p.name),
            categoricalCols: profiles
              .filter((p) => p.kind === "categorical")
              .map((p) => p.name),
            columns: profiles,
          },
        });
      },
      error: (err: Error) => reject(err),
    });
  });
}

export interface DailyAggregate {
  date: string;
  income: number;
  expense: number;
  profit: number;
  count: number;
}

export function aggregateDaily(
  rows: CsvRow[],
  schema: DetectedSchema,
): DailyAggregate[] {
  if (!schema.dateCol) return [];
  const buckets = new Map<string, DailyAggregate>();
  for (const row of rows) {
    const date = tryParseDate(row[schema.dateCol]);
    if (!date) continue;
    const income = schema.incomeCol
      ? tryParseNumber(row[schema.incomeCol]) ?? 0
      : 0;
    const expense = schema.expenseCol
      ? tryParseNumber(row[schema.expenseCol]) ?? 0
      : 0;
    const bucket = buckets.get(date) ?? {
      date,
      income: 0,
      expense: 0,
      profit: 0,
      count: 0,
    };
    bucket.income += income;
    bucket.expense += expense;
    bucket.profit = bucket.income - bucket.expense;
    bucket.count += 1;
    buckets.set(date, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function breakdownBy(
  rows: CsvRow[],
  schema: DetectedSchema,
  dim: string,
  metric: "income" | "expense",
): { label: string; value: number }[] {
  const col = metric === "income" ? schema.incomeCol : schema.expenseCol;
  if (!col) return [];
  const totals = new Map<string, number>();
  for (const row of rows) {
    const v = tryParseNumber(row[col]);
    if (v == null) continue;
    const key = String(row[dim] ?? "—").trim() || "—";
    totals.set(key, (totals.get(key) ?? 0) + v);
  }
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
}

export interface ForecastPoint {
  date: string;
  income: number;
  expense: number;
  profit: number;
  kind: "forecast";
}

export function simpleForecast(
  daily: DailyAggregate[],
  days = 90,
  window = 30,
): ForecastPoint[] {
  if (daily.length < Math.max(window, 7)) return [];
  const tail = daily.slice(-window);
  const avgIncome = tail.reduce((s, r) => s + r.income, 0) / tail.length;
  const avgExpense = tail.reduce((s, r) => s + r.expense, 0) / tail.length;
  // Linear trend via simple least-squares over the tail
  const xs = tail.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const trend = (key: "income" | "expense") => {
    const ys = tail.map((r) => r[key]);
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    return den === 0 ? 0 : num / den;
  };
  const incomeTrend = trend("income");
  const expenseTrend = trend("expense");

  const last = new Date(daily[daily.length - 1].date);
  const out: ForecastPoint[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() + i);
    const income = Math.max(0, avgIncome + incomeTrend * (window + i));
    const expense = Math.max(0, avgExpense + expenseTrend * (window + i));
    out.push({
      date: d.toISOString().slice(0, 10),
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      profit: Math.round((income - expense) * 100) / 100,
      kind: "forecast",
    });
  }
  return out;
}
