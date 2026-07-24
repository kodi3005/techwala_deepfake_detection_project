"use client";
import { motion } from "framer-motion";

interface RiskGaugeProps {
  fakeScore: number; // 0–1
  verdict: string;
  riskLevel: "low" | "medium" | "high";
}

const RISK_COLORS = {
  low:    { from: "#059669", to: "#10b981", text: "AUTHENTIC", badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  medium: { from: "#d97706", to: "#f59e0b", text: "SUSPICIOUS", badgeBg: "bg-amber-50 border-amber-200 text-amber-700" },
  high:   { from: "#dc2626", to: "#ef4444", text: "DEEPFAKE", badgeBg: "bg-rose-50 border-rose-200 text-rose-700" },
};

export default function RiskGauge({ fakeScore, verdict, riskLevel }: RiskGaugeProps) {
  const colors = RISK_COLORS[riskLevel];
  const pct    = Math.round(fakeScore * 100);

  // SVG arc params
  const R      = 85;
  const cx     = 120;
  const cy     = 120;
  const stroke = 16;
  const startAngle = -200;
  const sweep  = 220; // degrees
  const endAngle   = startAngle + sweep * fakeScore;

  const polarToXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };

  const describeArc = (startDeg: number, endDeg: number) => {
    const s = polarToXY(startDeg);
    const e = polarToXY(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const bgPath   = describeArc(startAngle, startAngle + sweep);
  const fillPath = describeArc(startAngle, endAngle);
  const needle   = polarToXY(startAngle + sweep * fakeScore);

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <svg width="240" height="175" viewBox="0 0 240 175">
        <defs>
          <linearGradient id="gaugeArcGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={bgPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {/* Filled Arc */}
        <motion.path
          d={fillPath}
          fill="none"
          stroke="url(#gaugeArcGradLight)"
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* Needle dot */}
        <motion.circle
          cx={needle.x}
          cy={needle.y}
          r={8}
          fill={colors.from}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        />

        {/* Center Percentage Text */}
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#0f172a" fontSize="36" fontWeight="900" fontFamily="sans-serif">
          {pct}%
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700" letterSpacing="1">
          DEEPFAKE PROBABILITY
        </text>
      </svg>

      {/* Verdict badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={`mt-2 px-6 py-2 rounded-full font-black text-sm tracking-widest border ${colors.badgeBg} shadow-sm`}
      >
        {verdict}
      </motion.div>
    </div>
  );
}
