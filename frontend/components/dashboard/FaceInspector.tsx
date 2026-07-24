"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { FaceResult } from "@/lib/types";
import { Eye, EyeOff, Scan, UserCheck, AlertOctagon } from "lucide-react";

interface FaceInspectorProps {
  previewUrl: string;
  faces: FaceResult[];
  mediaType: "image" | "video";
  naturalWidth?: number;
  naturalHeight?: number;
}

export default function FaceInspector({
  previewUrl,
  faces,
  mediaType,
  naturalWidth = 640,
  naturalHeight = 480,
}: FaceInspectorProps) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  const renderedW = imgEl?.clientWidth  ?? naturalWidth;
  const renderedH = imgEl?.clientHeight ?? naturalHeight;
  const scaleX = renderedW / naturalWidth;
  const scaleY = renderedH / naturalHeight;

  const riskColor = (fake: number) =>
    fake >= 0.7 ? "#dc2626" : fake >= 0.4 ? "#d97706" : "#059669";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-panel rounded-3xl p-6 backdrop-blur-xl border border-sky-100"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600">
            <Scan className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-slate-900 font-extrabold text-base">Media Inspector &amp; Bounding Boxes</h3>
            <p className="text-xs text-slate-500 font-medium">Cropped face analysis and spatial feature overlays</p>
          </div>
        </div>

        <button
          onClick={() => setShowBoxes((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200
                     text-slate-700 text-xs font-bold transition-colors border border-slate-200"
        >
          {showBoxes ? <Eye className="w-3.5 h-3.5 text-sky-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
          {showBoxes ? "Hide" : "Show"} Bounding Boxes
        </button>
      </div>

      {/* Main Image/Video Container */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-100 border border-sky-100 flex items-center justify-center min-h-[280px]">
        {mediaType === "image" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(el) => setImgEl(el)}
              src={previewUrl}
              alt="Analyzed forensic media"
              className="max-w-full max-h-[420px] object-contain rounded-xl"
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgEl(img);
              }}
            />
            {showBoxes && imgEl &&
              faces.map((face) => (
                <FaceBox
                  key={face.face_id}
                  face={face}
                  scaleX={scaleX}
                  scaleY={scaleY}
                  color={riskColor(face.fake_score)}
                />
              ))}
          </>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-[420px] rounded-xl"
          />
        )}
      </div>

      {/* Detected Faces Grid */}
      {faces.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Scanned Face Breakdown ({faces.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {faces.map((face) => (
              <FaceCard key={face.face_id} face={face} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function FaceBox({
  face, scaleX, scaleY, color,
}: {
  face: FaceResult; scaleX: number; scaleY: number; color: string;
}) {
  const { x, y, width, height } = face.bbox;
  return (
    <div
      className="absolute pointer-events-none transition-all"
      style={{
        left:   x * scaleX,
        top:    y * scaleY,
        width:  width  * scaleX,
        height: height * scaleY,
        border: `2.5px solid ${color}`,
        boxShadow: `0 0 10px ${color}80`,
        borderRadius: 6,
      }}
    >
      <span
        className="absolute -top-6 left-0 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider text-white shadow-xs"
        style={{ background: color }}
      >
        {face.label} {Math.round(face.fake_score * 100)}%
      </span>
    </div>
  );
}

function FaceCard({ face }: { face: FaceResult }) {
  const isFake = face.label === "Fake";
  return (
    <div
      className="rounded-2xl p-3.5 text-center transition-all border shadow-2xs"
      style={{
        background:  isFake ? "#fff1f2" : "#ecfdf5",
        borderColor: isFake ? "#fecdd3" : "#a7f3d0",
      }}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {isFake ? (
          <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
        ) : (
          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
        )}
        <span className="text-xs font-bold text-slate-700">Face #{face.face_id + 1}</span>
      </div>

      <p className="font-black text-sm" style={{ color: isFake ? "#dc2626" : "#059669" }}>
        {face.label}
      </p>
      <p className="text-[11px] text-slate-500 font-mono mt-0.5 font-bold">
        {Math.round(face.fake_score * 100)}% risk
      </p>
    </div>
  );
}
