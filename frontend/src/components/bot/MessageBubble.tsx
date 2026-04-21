"use client";

import { motion } from "framer-motion";

interface Props {
  role: "user" | "assistant";
  text: string;
}

export function MessageBubble({ role, text }: Props) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={[
          "max-w-[85%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words border",
          isUser
            ? "bg-gradient-to-br from-indigo-500/80 to-sky-500/80 text-white border-white/20 rounded-br-sm"
            : "bg-white/10 text-slate-100 border-white/15 rounded-bl-sm",
        ].join(" ")}
      >
        {text}
      </div>
    </motion.div>
  );
}
