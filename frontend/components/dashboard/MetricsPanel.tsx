"use client";
import { motion } from "framer-motion";
import { RotateCcw, FileJson, Activity } from "lucide-react";
import { DetectionResult } from "@/lib/types";
import { downloadReport } from "@/lib/api";

interface MetricsPanelProps {
  result: DetectionResult;
  mediaType: "image" | "video";
  onReset: () => void;
}

export default function MetricsPanel({ result, mediaType, onReset }: MetricsPanelProps) {
  const handleDownload = async () => {
    await downloadReport(result as object, mediaType);
  };

  const rows: { label: string; value: string | number }[] = [
    { label: "File Name",          value: result.filename },
    { label: "Risk Level",         value: result.risk_level.toUpperCase() },
    { label: "Verification Status",value: result.verdict },
    { label: "Deepfake Risk",      value: `${(result.overall_fake * 100).toFixed(2)}%` },
    { label: "Authentic Confidence",value: `${(result.overall_real * 100).toFixed(2)}%` },
    { label: "Processing Duration",value: `${result.processing_time_ms.toFixed(0)} ms` },
  ];

  if ("faces_detected" in result) {
    rows.splice(3, 0, { label: "Faces Extracted", value: result.faces_detected });
  }
  if ("total_frames_analyzed" in result) {
    rows.splice(3, 0, {
      label: "Frames Sampled",
      value: (result as { total_frames_analyzed: number }).total_frames_analyzed,
    });
    rows.splice(4, 0, {
      label: "Video Duration",
      value: `${(result as { duration_sec: number }).duration_sec.toFixed(2)}s`,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-panel rounded-3xl p-6 backdrop-blur-xl border border-sky-100"
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-slate-900 font-extrabold text-base">Forensic Metadata &amp; Export</h3>
          <p className="text-xs text-slate-500 font-medium">Technical breakdown &amp; audit logging</p>
        </div>
      </div>

      <div className="space-y-2 mb-6 bg-slate-50 p-4 rounded-2xl border border-sky-100/60">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between py-2 border-b border-slate-200/60 last:border-0 text-xs"
          >
            <span className="text-slate-600 font-bold">{row.label}</span>
            <span className="text-slate-900 font-bold font-mono">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                     bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold tracking-wide uppercase
                     transition-all shadow-md shadow-sky-600/20 cursor-pointer"
        >
          <FileJson className="w-4 h-4" />
          Export JSON Audit
        </button>
        <button
          onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                     bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold tracking-wide uppercase
                     transition-all border border-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          New Verification
        </button>
      </div>
    </motion.div>
  );
}
