"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "./GlassCard";
import { api, type Transaction } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export function TransactionsView() {
  const { userId } = useAppStore();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ date: "", income: "", expense: "" });

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api.listTransactions(userId);
      setRows(data);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const res = await api.uploadCsv(file, userId);
      setMsg(
        `Inserted ${res.inserted} rows, skipped ${res.skipped}.` +
          (res.errors.length ? ` First error: ${res.errors[0].reason}` : ""),
      );
      await refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return;
    try {
      await api.createTransaction({
        userId,
        date: form.date,
        income: form.income ? Number(form.income) : 0,
        expense: form.expense ? Number(form.expense) : 0,
      });
      setForm({ date: "", income: "", expense: "" });
      setMsg("Transaction added.");
      await refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTransaction(id);
      await refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">
          Transactions
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Upload a CSV or add rows manually
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h2 className="text-white font-semibold">CSV Upload</h2>
          <p className="text-xs text-slate-400 mt-1">
            Columns: <code>date, income, expense</code> (userId optional)
          </p>
          <label className="mt-4 inline-flex items-center gap-3 cursor-pointer">
            <span className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20">
              {uploading ? "Uploading…" : "Choose file"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </GlassCard>

        <GlassCard>
          <h2 className="text-white font-semibold">Add Transaction</h2>
          <form onSubmit={handleCreate} className="mt-3 flex flex-col gap-2">
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="bg-white/10 border border-white/20 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-white/40"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Income"
                value={form.income}
                onChange={(e) => setForm({ ...form, income: e.target.value })}
                className="flex-1 bg-white/10 border border-white/20 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-white/40"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Expense"
                value={form.expense}
                onChange={(e) => setForm({ ...form, expense: e.target.value })}
                className="flex-1 bg-white/10 border border-white/20 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-white/40"
              />
            </div>
            <button
              type="submit"
              className="mt-1 bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20"
            >
              Add
            </button>
          </form>
        </GlassCard>
      </div>

      {msg && <GlassCard className="text-sm text-slate-200">{msg}</GlassCard>}

      <GlassCard padded={false}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-semibold">
            {loading ? "Loading…" : `${rows.length} transactions`}
          </h2>
          <button
            onClick={refresh}
            className="text-xs text-slate-300 hover:text-white border border-white/15 hover:border-white/30 rounded-lg px-3 py-1.5"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-400">
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-right px-5 py-3">Income</th>
                <th className="text-right px-5 py-3">Expense</th>
                <th className="text-right px-5 py-3">Profit</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="px-5 py-2 text-slate-200">{r.date}</td>
                  <td className="px-5 py-2 text-right text-indigo-300">
                    {Number(r.income).toLocaleString()}
                  </td>
                  <td className="px-5 py-2 text-right text-amber-300">
                    {Number(r.expense).toLocaleString()}
                  </td>
                  <td className="px-5 py-2 text-right text-emerald-300">
                    {(Number(r.income) - Number(r.expense)).toLocaleString()}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No transactions yet — upload a CSV to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
