"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { 
  History, Search, FileVideo, FileImage, ShieldCheck, AlertTriangle, 
  Skull, Calendar, ArrowLeft, Loader2, Filter, RefreshCw, Layers, Shield
} from "lucide-react";

interface ScanRecord {
  id: string;
  created_at: string;
  filename: string;
  media_type: "image" | "video";
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE";
  risk_level: "low" | "medium" | "high";
  overall_fake: number;
  overall_real: number;
  details: any;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVerdict, setFilterVerdict] = useState<string>("ALL");
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      fetchScans(session.user.id);
    };

    checkAuthAndFetch();
  }, [router, supabase]);

  const fetchScans = async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("detections")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setScans(data as ScanRecord[]);
      }
    } catch (err) {
      console.error("Failed to fetch scan history:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.filename.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterVerdict === "ALL" || scan.verdict === filterVerdict;
    return matchesSearch && matchesFilter;
  });

  const authenticCount = scans.filter(s => s.risk_level === "low").length;
  const deepfakeCount = scans.filter(s => s.risk_level === "high").length;

  const getVerdictBadge = (verdict: string, risk: string) => {
    switch (risk) {
      case "low":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            AUTHENTIC
          </span>
        );
      case "medium":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            SUSPICIOUS
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
            <Skull className="w-3.5 h-3.5" />
            DEEPFAKE
          </span>
        );
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-bold tracking-wider font-mono">LOADING AUDIT RECORD SESSION...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-6 max-w-7xl mx-auto bg-grid-pattern pb-20">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-6 border-b border-sky-100/80 gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-sky-600 font-extrabold hover:text-sky-800 mb-2 group transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Back to Scan Hub
          </Link>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center">
              <History className="w-5 h-5 text-sky-600" />
            </div>
            Forensic Audit Records
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Historical database of deepfake verification scans logged in Supabase.
          </p>
        </div>

        <button
          onClick={() => user && fetchScans(user.id)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-extrabold border border-slate-200 shadow-2xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${loading ? "animate-spin" : ""}`} />
          Refresh Database
        </button>
      </div>

      {/* Summary Metric Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-panel p-5 rounded-3xl border border-sky-100 bg-white/90">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 font-mono tracking-wider">TOTAL FORENSIC AUDITS</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 font-mono">{scans.length}</p>
          <p className="text-xs text-slate-500 font-medium">Logged scans in history</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-emerald-100 bg-emerald-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-emerald-600 font-mono tracking-wider">AUTHENTIC MEDIA</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-emerald-700 font-mono">{authenticCount}</p>
          <p className="text-xs text-slate-500 font-medium">Verified genuine files</p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-rose-100 bg-rose-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-rose-600 font-mono tracking-wider">DEEPFAKES DETECTED</span>
            <Skull className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-3xl font-black text-rose-700 font-mono">{deepfakeCount}</p>
          <p className="text-xs text-slate-500 font-medium">Synthetic manipulation alerts</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter history by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-sky-200/90 rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 shadow-2xs transition-all"
          />
        </div>

        {/* Verdict Select */}
        <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-sky-100">
          {["ALL", "AUTHENTIC", "DEEPFAKE"].map((v) => (
            <button
              key={v}
              onClick={() => setFilterVerdict(v)}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition-all ${
                filterVerdict === v
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Scan Records Table / Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-bold font-mono">LOADING AUDIT RECORDS...</p>
        </div>
      ) : filteredScans.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center text-slate-500">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900 mb-1">No Forensic Audit Records Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6 font-medium leading-relaxed">
            Media files processed by the ONNX neural model while logged in will automatically log to this audit trail.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-sky-600/30"
          >
            Start New Forensic Scan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScans.map((scan) => (
            <motion.div
              key={scan.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedScan(scan)}
              className="glass-panel glass-panel-hover rounded-3xl p-6 cursor-pointer relative group flex flex-col justify-between border border-sky-100 bg-white/95"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {scan.media_type === "video" ? (
                      <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 border border-sky-200/60">
                        <FileVideo className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 border border-teal-200/60">
                        <FileImage className="w-4 h-4" />
                      </div>
                    )}
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      {scan.media_type}
                    </span>
                  </div>
                  {getVerdictBadge(scan.verdict, scan.risk_level)}
                </div>

                <h3 className="font-black text-slate-900 text-base truncate mb-1" title={scan.filename}>
                  {scan.filename}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-6">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(scan.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-sky-100/80 flex items-center justify-between text-xs font-bold">
                <div>
                  <span className="text-slate-500 text-[11px]">Synthetic Risk: </span>
                  <span
                    className={`font-mono text-sm font-black ${
                      scan.overall_fake >= 0.7
                        ? "text-rose-600"
                        : scan.overall_fake >= 0.4
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {(scan.overall_fake * 100).toFixed(1)}%
                  </span>
                </div>

                <span className="text-sky-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-extrabold text-xs">
                  Inspect &rarr;
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Drawer for Scan Details */}
      <AnimatePresence>
        {selectedScan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-sky-100 rounded-3xl p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6 border-b border-sky-100 pb-4">
                <div>
                  <span className="text-[10px] font-black font-mono px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 uppercase tracking-wide mb-1 inline-block">
                    AUDIT RECORD #{selectedScan.id.substring(0, 8)}
                  </span>
                  <h3 className="font-black text-slate-900 text-xl truncate max-w-xs">
                    {selectedScan.filename}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedScan(null)}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs font-bold mb-6">
                <div className="flex justify-between py-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Verdict</span>
                  {getVerdictBadge(selectedScan.verdict, selectedScan.risk_level)}
                </div>
                <div className="flex justify-between py-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Fake Probability</span>
                  <span className="text-rose-600 font-mono text-sm font-black">
                    {(selectedScan.overall_fake * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Real Confidence</span>
                  <span className="text-emerald-600 font-mono text-sm font-black">
                    {(selectedScan.overall_real * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Media Format</span>
                  <span className="font-mono text-slate-800 uppercase">{selectedScan.media_type}</span>
                </div>
                <div className="flex justify-between py-2.5 border-b border-slate-100">
                  <span className="text-slate-500">Audit Timestamp</span>
                  <span className="text-slate-700">{new Date(selectedScan.created_at).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedScan(null)}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition-colors cursor-pointer"
              >
                Close Audit Record
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
