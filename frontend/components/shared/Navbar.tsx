"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanSearch, History, FileText, Cpu, Sparkles, ShieldCheck } from "lucide-react";
import AuthButton from "./AuthButton";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Scan Hub", href: "/", icon: ScanSearch },
    { name: "History", href: "/history", icon: History },
    { name: "API Docs", href: "http://localhost:8000/docs", icon: FileText, external: true },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-2xl border-b border-sky-100/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3.5 group shrink-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-gradient-to-br from-sky-500 via-sky-600 to-teal-500 p-0.5 shadow-md shadow-sky-500/25 group-hover:scale-105 transition-transform duration-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="DeepGuard Logo"
                className="w-full h-full object-cover rounded-[14px] bg-white"
              />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-white animate-pulse" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-lg tracking-tight">DeepGuard</span>
              <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-2xs uppercase">
                NEURAL FORENSICS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 tracking-wide font-bold">
              AI Media Authenticity &amp; Deepfake Intelligence
            </p>
          </div>
        </Link>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-sky-100/80 shadow-2xs">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = !link.external && pathname === link.href;

            if (link.external) {
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-sky-700 hover:bg-white transition-all"
                >
                  <Icon className="w-4 h-4 text-sky-500" />
                  {link.name}
                </a>
              );
            }

            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                    : "text-slate-600 hover:text-sky-700 hover:bg-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Right: Engine Status + Auth */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50/90 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">ONNX Inference Active</span>
          </div>

          <div className="h-5 w-px bg-sky-100 hidden sm:block" />

          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
