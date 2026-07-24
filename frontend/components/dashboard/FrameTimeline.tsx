"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { FrameResult } from "@/lib/types";
import { motion } from "framer-motion";

interface FrameTimelineProps {
  frames: FrameResult[];
  highRiskTimestamps: number[];
}

export default function FrameTimeline({ frames, highRiskTimestamps }: FrameTimelineProps) {
  const data = frames.map((f) => ({
    ts:   f.timestamp_sec.toFixed(1),
    fake: Math.round(f.fake_score * 100),
    real: Math.round(f.real_score * 100),
  }));

  const getColor = (value: number) => {
    if (value >= 70) return "#dc2626";
    if (value >= 40) return "#d97706";
    return "#059669";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-panel rounded-3xl p-6 backdrop-blur-xl border border-sky-100"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-slate-900 font-extrabold text-base">Frame-by-Frame Timeline</h3>
          <p className="text-xs text-slate-500 font-medium">Temporal deepfake risk distribution across frames</p>
        </div>
        <div className="flex gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/>Authentic</span>
          <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/>Caution</span>
          <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"/>Deepfake</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="ts"
            tick={{ fill: "#64748b", fontSize: 11 }}
            label={{ value: "Time (s)", position: "insideBottom", offset: -2, fill: "#475569", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #0284c7", borderRadius: 12, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
            labelStyle={{ color: "#0f172a", fontWeight: "bold", fontSize: 12 }}
            formatter={(value: any, name: any) => [
              `${value}%`,
              name === "fake" ? "Fake Probability" : "Real Confidence",
            ]}
          />
          <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="4 2" label={{ value: "High Risk", fill: "#dc2626", fontSize: 10, fontWeight: "bold" }} />
          <ReferenceLine y={40} stroke="#d97706" strokeDasharray="4 2" label={{ value: "Caution",   fill: "#d97706", fontSize: 10, fontWeight: "bold" }} />
          <Bar dataKey="fake" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.fake)} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {highRiskTimestamps.length > 0 && (
        <div className="mt-4 pt-4 border-t border-sky-100">
          <p className="text-xs text-slate-500 font-bold mb-2">⚠️ Highest-risk moments detected</p>
          <div className="flex flex-wrap gap-2">
            {highRiskTimestamps.map((ts) => (
              <span
                key={ts}
                className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono font-bold"
              >
                {ts.toFixed(1)}s
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
