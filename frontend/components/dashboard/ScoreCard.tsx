"use client";
import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Skull } from "lucide-react";
import { ImageDetectionResult, VideoDetectionResult } from "@/lib/types";

type Props = {
  result: ImageDetectionResult | VideoDetectionResult;
  mediaType: "image" | "video";
};

function isVideo(r: Props["result"]): r is VideoDetectionResult {
  return "frames" in r;
}

const RISK_CONFIG = {
  low:    { icon: ShieldCheck,   color: "#059669", bg: "from-emerald-50/50 via-white to-white", border: "border-emerald-200" },
  medium: { icon: AlertTriangle, color: "#d97706", bg: "from-amber-50/50 via-white to-white",   border: "border-amber-200"   },
  high:   { icon: Skull,         color: "#dc2626", bg: "from-rose-50/50 via-white to-white",     border: "border-rose-200"     },
};

export default function ScoreCard({ result, mediaType }: Props) {
  const cfg   = RISK_CONFIG[result.risk_level];
  const Icon  = cfg.icon;
  const video = isVideo(result) ? result : null;

  const stats = [
    {
      label: "Authentic Score",
      value: `${Math.round(result.overall_real * 100)}%`,
      color: "#059669",
    },
    {
      label: "Deepfake Risk",
      value: `${Math.round(result.overall_fake * 100)}%`,
      color: "#dc2626",
    },
    {
      label: mediaType === "video" ? "Frames Analyzed" : "Faces Scanned",
      value: video ? video.total_frames_analyzed : (result as ImageDetectionResult).faces_detected,
      color: "#0284c7",
    },
    {
      label: "Inference Speed",
      value: `${(result.processing_time_ms / 1000).toFixed(1)}s`,
      color: "#0d9488",
    },
  ];

  if (video) {
    stats.push({
      label: "Video Duration",
      value: `${video.duration_sec.toFixed(1)}s`,
      color: "#4f46e5",
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-3xl border bg-gradient-to-br ${cfg.bg} ${cfg.border} p-6 md:p-8 shadow-xl shadow-sky-900/5 relative overflow-hidden flex flex-col justify-between`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs"
              style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}
            >
              <Icon className="w-6 h-6" style={{ color: cfg.color }} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base md:text-lg truncate max-w-[220px] md:max-w-[280px]">
                {result.filename}
              </h3>
              <p className="text-xs text-slate-500 font-semibold capitalize">
                {mediaType} Verification &bull; {result.risk_level} Risk Level
              </p>
            </div>
          </div>
        </div>

        {/* Dual Progress Bars */}
        <div className="space-y-3 mb-6 bg-slate-50/80 p-4 rounded-2xl border border-sky-100/60">
          <ScoreBar label="REAL CONFIDENCE" value={result.overall_real} color="#059669" />
          <ScoreBar label="DEEPFAKE PROBABILITY" value={result.overall_fake} color="#dc2626" />
        </div>
      </div>

      {/* Grid of Key Indicators */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3.5 border border-sky-100 shadow-2xs">
            <p className="text-[11px] text-slate-500 font-bold mb-1">{s.label}</p>
            <p className="font-black text-lg tracking-tight" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5 font-bold">
        <span className="text-slate-600 tracking-wider text-[10px]">{label}</span>
        <span className="font-mono" style={{ color }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <motion.div
          className="h-full rounded-full shadow-2xs"
          style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
