import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatWidget } from "@/components/bot/ChatWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinEase — MSME Financial Intelligence",
  description:
    "Premium financial dashboard for small and mid-size businesses with AI forecasting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-slate-200">
        <div className="aurora-layer" aria-hidden />
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
        <footer className="px-6 py-6 text-center text-xs text-slate-400/80">
          © {new Date().getFullYear()} FinEase · Built for MSMEs
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
