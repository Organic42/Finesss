import type {
  ForecastSnapshot,
  KpiSnapshot,
} from "@/store/useAppStore";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`API ${path} failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface Transaction {
  id: string;
  userId: string;
  date: string;
  income: number;
  expense: number;
  createdAt: string;
}

export const api = {
  getKpi: (params: { userId?: string; start?: string; end?: string }) => {
    const qs = new URLSearchParams();
    if (params.userId) qs.set("userId", params.userId);
    if (params.start) qs.set("start", params.start);
    if (params.end) qs.set("end", params.end);
    const query = qs.toString();
    return request<KpiSnapshot>(`/transactions/kpi${query ? `?${query}` : ""}`);
  },
  listTransactions: (userId?: string) => {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return request<Transaction[]>(`/transactions${qs}`);
  },
  createTransaction: (body: {
    userId?: string;
    date: string;
    income?: number;
    expense?: number;
  }) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteTransaction: (id: string) =>
    request<void>(`/transactions/${id}`, { method: "DELETE" }),
  uploadCsv: async (file: File, userId?: string) => {
    const form = new FormData();
    form.append("file", file);
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`${API_BASE}/transactions/upload${qs}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
    }
    return res.json() as Promise<{
      inserted: number;
      skipped: number;
      errors: { row: number; reason: string }[];
    }>;
  },
  train: (userId = "default_user") =>
    request<unknown>("/ml/train", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  getForecast: (months = 6) =>
    request<ForecastSnapshot>(`/ml/forecast?months=${months}`),
  chat: (message: string, context: unknown) =>
    request<{ reply: string; model: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, context }),
    }),
};
