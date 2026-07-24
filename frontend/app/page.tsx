"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { 
  Shield, Sparkles, Lock, ArrowRight, ArrowLeft, ShieldCheck, Layers, 
  Cpu, AlertCircle, Loader2, FileSearch, Zap, Activity, CheckCircle2, 
  ChevronDown, Database, Eye, FileText, LockKeyhole, RefreshCw
} from "lucide-react";
import DropZone from "@/components/upload/DropZone";
import RiskGauge from "@/components/dashboard/RiskGauge";
import ScoreCard from "@/components/dashboard/ScoreCard";
import FrameTimeline from "@/components/dashboard/FrameTimeline";
import FaceInspector from "@/components/dashboard/FaceInspector";
import ConfidenceReport from "@/components/dashboard/ConfidenceReport";
import ForensicDetails from "@/components/dashboard/ForensicDetails";
import MetricsPanel from "@/components/dashboard/MetricsPanel";
import { useDetection } from "@/hooks/useDetection";
import { isVideoResult } from "@/lib/types";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setAuthLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const {
    isLoading, progress, result, error,
    mediaType, previewUrl, analyse, reset,
  } = useDetection();

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-sky-600 animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-bold tracking-wider font-mono">VERIFYING FORENSIC SESSION...</p>
      </div>
    );
  }

  // 🔒 NOT LOGGED IN -> Show Professional Gateway
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden bg-grid-pattern">
        {/* Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] glow-ocean pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[250px] glow-teal pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl w-full text-center relative z-10"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-extrabold mb-8 shadow-2xs">
            <Lock className="w-4 h-4 text-sky-600" />
            <span>AUTHENTICATION REQUIRED FOR FORENSIC ACCESS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-slate-900 leading-[1.1] mb-6 tracking-tight">
            Sign In to Access{" "}
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-teal-500 bg-clip-text text-transparent">
              AI Synthetic Media Forensics
            </span>
          </h1>

          <p className="text-slate-600 text-base sm:text-xl max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            Verify video integrity, perform OpenCV face bounding box crops, analyze frame-by-frame temporal risk, and export JSON audit reports.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-sky-600/30 group"
            >
              <span>Sign In to Platform</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-sm tracking-wide transition-all border border-slate-200 shadow-sm"
            >
              <span>Create Free Account</span>
            </Link>
          </div>

          {/* Locked Feature Preview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { icon: ShieldCheck, title: "Spatial Face Crop", desc: "OpenCV YuNet face localization with 20% box margin overlays." },
              { icon: Layers, title: "Temporal Frame Scan", desc: "Sample frame risk distribution chart across video timestamps." },
              { icon: Cpu, title: "ONNX Neural Engine", desc: "Real-time deepfake classification running PyTorch ONNX models." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="glass-panel glass-panel-hover p-6 rounded-3xl border border-sky-100 bg-white/90">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200/60 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-sky-600" />
                  </div>
                  <h3 className="text-slate-900 font-black text-base mb-1.5">{f.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // 🔓 LOGGED IN -> Show All Deepfake Platform Features
  return (
    <div className="min-h-screen relative bg-grid-pattern pb-20">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[900px] h-[450px] glow-ocean pointer-events-none" />
      <div className="absolute top-96 right-10 w-[600px] h-[350px] glow-teal pointer-events-none" />

      <AnimatePresence mode="wait">
        {!result && (
          <motion.section
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center justify-center px-6 pt-10 pb-20 max-w-7xl mx-auto"
          >
            {/* Welcome User Banner */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full
                         bg-sky-50 border border-sky-200 text-sky-700 text-xs font-extrabold tracking-wide shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-sky-600 animate-pulse" />
              <span>Welcome Back, {user.user_metadata?.full_name || user.email}</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-6xl md:text-7xl font-black text-center text-slate-900 leading-[1.1] mb-6 tracking-tight"
            >
              Detect Deepfakes with{" "}
              <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-teal-500 bg-clip-text text-transparent">
                Neural Precision
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-600 text-center max-w-2xl mb-10 text-base sm:text-xl leading-relaxed font-medium"
            >
              Upload images or videos for instant AI verification. Our local neural engine executes face localization, CHW normalization, and frame-by-frame risk scoring.
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap justify-center gap-3 mb-12"
            >
              {[
                { icon: ShieldCheck, text: "OpenCV YuNet Bounding Boxes" },
                { icon: Layers,      text: "Video Frame Risk Timelines" },
                { icon: Cpu,         text: "Local ONNX Runtime Inference" },
                { icon: FileSearch,  text: "Export JSON Audit Reports" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl
                             bg-white/90 border border-sky-100/80 text-slate-700 text-xs font-extrabold shadow-2xs backdrop-blur-md"
                >
                  <Icon className="w-4 h-4 text-sky-600" />
                  {text}
                </div>
              ))}
            </motion.div>

            {/* Main Upload Zone */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full mb-16"
            >
              <DropZone onFile={analyse} isLoading={isLoading} progress={progress} />
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-12 flex items-center gap-3 px-6 py-3.5 rounded-2xl
                             bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold shadow-md"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 📊 Real-Time Platform Stats Ribbon */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
            >
              {[
                { label: "AVG INFERENCE SPEED", value: "< 150 ms", sub: "Sub-second response time", icon: Zap, color: "text-amber-600" },
                { label: "DATA RETENTION", value: "0 %", sub: "Instant file unlinking", icon: LockKeyhole, color: "text-emerald-600" },
                { label: "FACE DETECTOR", value: "YuNet 2023", sub: "OpenCV ONNX face Model", icon: Eye, color: "text-sky-600" },
                { label: "EXECUTION PROVIDER", value: "CPU / CUDA", sub: "ONNX Runtime engine", icon: Cpu, color: "text-teal-600" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="glass-panel p-5 rounded-3xl border border-sky-100/80 bg-white/90 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-slate-400 font-mono tracking-wider">{s.label}</span>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 mb-0.5 tracking-tight font-mono">{s.value}</p>
                    <p className="text-xs text-slate-500 font-medium">{s.sub}</p>
                  </div>
                );
              })}
            </motion.div>

            {/* 🛡️ Forensic Core Capabilities Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full text-left mb-20"
            >
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-xs font-black font-mono px-3 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200 uppercase tracking-wider mb-3 inline-block">
                  FORENSIC ARCHITECTURE
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
                  Powered by State-of-the-Art Vision Models
                </h2>
                <p className="text-slate-600 text-sm sm:text-base font-medium">
                  DeepGuard combines computer vision bounding box isolation with PyTorch tensor normalization to audit digital media.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: "Spatial Face Crop & Padding",
                    desc: "OpenCV YuNet automatically isolates face coordinates with a 20% spatial padding margin to preserve edge manipulation cues around the jawline and hair.",
                    badge: "OpenCV YuNet",
                    icon: ShieldCheck,
                  },
                  {
                    title: "ImageNet CHW Preprocessing",
                    desc: "Crops are scaled to 224x224 RGB tensors, normalized using standard ImageNet mean ([0.485, 0.456, 0.406]) and std ([0.229, 0.224, 0.225]).",
                    badge: "Tensor Norm",
                    icon: Database,
                  },
                  {
                    title: "Video Frame Sampling",
                    desc: "Videos undergo periodic frame extraction (2 FPS sample rate), evaluating batch tensors to pinpoint the exact timestamps of highest synthetic risk.",
                    badge: "Temporal Batch",
                    icon: Layers,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="glass-panel glass-panel-hover p-7 rounded-3xl border border-sky-100 bg-white/90 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-sky-600" />
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-sky-700 font-extrabold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Production Ready</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* ❓ Interactive FAQ Accordion Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="w-full max-w-4xl text-left"
            >
              <div className="text-center mb-10">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
                  Frequently Asked Questions
                </h3>
                <p className="text-slate-500 text-sm font-medium">
                  Everything you need to know about DeepGuard's synthetic media verification pipeline.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    q: "How does DeepGuard determine if a face is synthetic or authentic?",
                    a: "DeepGuard passes extracted facial regions through a trained ONNX neural network model. The model outputs binary sigmoid or softmax probability distributions representing the likelihood of AI manipulation versus authentic media.",
                  },
                  {
                    q: "Are uploaded media files stored permanently on the server?",
                    a: "No. File uploads are stored temporarily in an ephemeral isolated directory for the duration of inference. Once facial bounding boxes and neural scores are calculated, files are unlinked from disk in a mandatory finally block.",
                  },
                  {
                    q: "What video formats are supported?",
                    a: "DeepGuard supports all major web video codecs including MP4, MOV, AVI, MKV, and WMV up to 500 MB in file size.",
                  },
                  {
                    q: "Can I download forensic reports for legal or audit purposes?",
                    a: "Yes! Every completed scan provides a downloadable JSON Forensic Audit Report containing raw probabilities, frame timestamps, face bounding box coordinates, and system metrics.",
                  },
                ].map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={faq.q}
                      className="glass-panel rounded-2xl border border-sky-100 bg-white/90 overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm cursor-pointer hover:bg-sky-50/50 transition-colors"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-sky-600 transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed font-medium border-t border-sky-100/60"
                          >
                            {faq.a}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.section>
        )}

        {/* ── Results Dashboard ─────────────────────────────────────────── */}
        {result && mediaType && (
          <motion.section
            key="results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-7xl mx-auto px-6 py-10"
          >
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-6 border-b border-sky-100 gap-4">
              <div>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-600 font-extrabold hover:text-sky-800 mb-2 group transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  Back to Upload Hub
                </button>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-xs font-black font-mono px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 uppercase tracking-wide">
                    VERIFICATION COMPLETE
                  </span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-bold capitalize">{mediaType} File Audit</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{result.filename}</h2>
              </div>

              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold transition-all border border-slate-200 shadow-2xs cursor-pointer"
              >
                Scan Another File
              </button>
            </div>

            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center border border-sky-100">
                <RiskGauge
                  fakeScore={result.overall_fake}
                  verdict={result.verdict}
                  riskLevel={result.risk_level}
                />
              </div>
              <ScoreCard result={result} mediaType={mediaType} />
            </div>

            {/* Multivariate Report Confidence Score Breakdown */}
            <ConfidenceReport result={result} mediaType={mediaType} />

            {/* Media Inspector */}
            {previewUrl && (
              <div className="mb-6">
                <FaceInspector
                  previewUrl={previewUrl}
                  faces={"faces" in result ? result.faces : []}
                  mediaType={mediaType}
                />
              </div>
            )}

            {/* Video Frame Timeline */}
            {isVideoResult(result) && (
              <div className="mb-6">
                <FrameTimeline
                  frames={result.frames}
                  highRiskTimestamps={result.highest_risk_timestamps}
                />
              </div>
            )}

            {/* In-Depth Forensic Analysis Checklist & Chain of Custody */}
            <div className="mb-6">
              <ForensicDetails result={result} mediaType={mediaType} />
            </div>

            {/* Metrics & Actions */}
            <MetricsPanel result={result} mediaType={mediaType} onReset={reset} />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
