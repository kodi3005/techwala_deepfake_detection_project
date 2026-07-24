"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, ScanSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden bg-grid-pattern">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] glow-ocean pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full glass-panel p-10 rounded-3xl border border-sky-100/90 shadow-2xl relative z-10"
      >
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-6 shadow-sm">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>

        <span className="text-xs font-black font-mono px-3 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider mb-3 inline-block">
          404 ERROR &bull; ROUTE NOT FOUND
        </span>

        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
          Page Not Located
        </h1>

        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8">
          The requested forensic path or route resource does not exist on the DeepGuard server.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs tracking-wide transition-all shadow-lg shadow-sky-600/30"
          >
            <ScanSearch className="w-4 h-4" />
            <span>Return to Scan Hub</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
