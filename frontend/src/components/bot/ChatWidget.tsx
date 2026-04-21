"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageBubble } from "./MessageBubble";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm FinBot. Ask me about your revenue, expenses, or forecast — I'm reading your live KPIs.",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { userId, kpi, forecast } = useAppStore();

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setBusy(true);

    // Silently attach live KPI + forecast snapshot from Zustand
    const context = {
      userId,
      kpi: kpi
        ? {
            start: kpi.start,
            end: kpi.end,
            revenue: kpi.revenue,
            expense: kpi.expense,
            profit: kpi.profit,
            margin: kpi.margin,
            transactionCount: kpi.transactionCount,
          }
        : null,
      forecast: forecast
        ? {
            horizonMonths: forecast.horizonMonths,
            generatedFrom: forecast.generatedFrom,
            monthly: forecast.monthly,
          }
        : null,
    };

    try {
      const res = await api.chat(text, context);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: res.reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: `Sorry — I couldn't reach the AI service. (${(err as Error).message})`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 shadow-xl shadow-indigo-500/30 flex items-center justify-center text-white text-2xl hover:scale-105 transition-transform"
      >
        {open ? "×" : "💬"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-40 w-[92vw] max-w-sm h-[70vh] max-h-[560px] flex flex-col bg-slate-900/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-emerald-400/50 shadow" />
              <div className="flex-1">
                <div className="text-white text-sm font-semibold">FinBot</div>
                <div className="text-slate-400 text-xs">
                  {kpi ? "Reading live KPIs" : "Waiting for KPI data"}
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2"
            >
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} text={m.text} />
              ))}
              {busy && (
                <MessageBubble role="assistant" text="Thinking…" />
              )}
            </div>

            <div className="border-t border-white/10 p-2 flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder="Ask about your finances…"
                className="flex-1 resize-none bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-white/40 max-h-32"
              />
              <button
                onClick={send}
                disabled={busy || !draft.trim()}
                className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-sm font-medium"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
