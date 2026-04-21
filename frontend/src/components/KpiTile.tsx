"use client";

import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "success" | "warn" | "danger";
}

const TONES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  brand: "from-indigo-500/60 to-sky-400/60",
  success: "from-emerald-500/60 to-teal-400/60",
  warn: "from-amber-500/60 to-orange-400/60",
  danger: "from-rose-500/60 to-pink-400/60",
};

export function KpiTile({ label, value, hint, tone = "brand" }: KpiTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <GlassCard className="relative overflow-hidden">
        <div
          className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${TONES[tone]} blur-2xl opacity-50`}
          aria-hidden
        />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-slate-300">
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          {hint ? (
            <div className="mt-1 text-xs text-slate-400">{hint}</div>
          ) : null}
        </div>
      </GlassCard>
    </motion.div>
  );
}
