"use client";

import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, ImageIcon, AlertCircle, Loader2, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";

interface DropZoneProps {
  onFile: (file: File) => void;
  isLoading: boolean;
  progress: number;
}

const ACCEPT = ".jpg,.jpeg,.png,.webp,.bmp,.mp4,.mov,.avi,.mkv,.wmv";
const MAX_MB  = 500;

export default function DropZone({ onFile, isLoading, progress }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileError,  setFileError]  = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): boolean => {
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`File size exceeds ${MAX_MB} MB limit.`);
      return false;
    }
    setFileError(null);
    return true;
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && validate(file)) {
        setSelectedFile(file);
        onFile(file);
      }
    },
    [onFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validate(file)) {
      setSelectedFile(file);
      onFile(file);
    }
    e.target.value = "";
  };

  const openFilePicker = () => {
    if (!isLoading && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={openFilePicker}
        animate={{
          scale: isDragging ? 1.015 : 1,
        }}
        transition={{ duration: 0.2 }}
        className={`relative group border-2 border-dashed rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
          isDragging
            ? "border-sky-500 bg-sky-50/90 shadow-2xl shadow-sky-500/25 ring-4 ring-sky-200"
            : isLoading
            ? "border-sky-400 bg-white"
            : "border-sky-200/90 hover:border-sky-500 bg-white/95 hover:bg-white backdrop-blur-2xl shadow-xl shadow-sky-900/5 hover:shadow-2xl hover:shadow-sky-500/10"
        }`}
      >
        {/* Ambient Ocean Gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-sky-100/40 via-transparent to-teal-50/50 pointer-events-none group-hover:opacity-100 transition-opacity z-0" />

        {isLoading ? (
          <LoadingState progress={progress} fileName={selectedFile?.name} />
        ) : (
          <IdleState isDragging={isDragging} onButtonClick={openFilePicker} />
        )}

        {!isLoading && (
          <input
            ref={inputRef}
            id="file-upload"
            type="file"
            accept={ACCEPT}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
            onChange={handleChange}
          />
        )}
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {fileError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-center gap-2 text-rose-600 text-xs font-bold"
          >
            <AlertCircle className="w-4 h-4" />
            {fileError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Format pills */}
      <div className="mt-6 flex flex-wrap justify-center items-center gap-2">
        <span className="text-xs text-slate-500 font-bold mr-2">Supported Formats:</span>
        {["JPG", "PNG", "WEBP", "MP4", "MOV", "AVI"].map((fmt) => (
          <span
            key={fmt}
            className="text-[11px] font-mono px-3 py-1 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-800 font-black shadow-2xs"
          >
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}

function IdleState({ isDragging, onButtonClick }: { isDragging: boolean; onButtonClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center relative z-10 pointer-events-none">
      <motion.div
        animate={{ y: isDragging ? -8 : 0 }}
        className="flex justify-center mb-6"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 via-sky-600 to-teal-500 flex items-center justify-center shadow-lg shadow-sky-500/35 group-hover:scale-105 transition-transform duration-300">
            <Upload className="w-9 h-9 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-white flex items-center justify-center border border-sky-100 shadow-md">
            <Film className="w-4 h-4 text-sky-600" />
          </div>
          <div className="absolute -top-2 -right-2 w-9 h-9 rounded-2xl bg-white flex items-center justify-center border border-sky-100 shadow-md">
            <ImageIcon className="w-4 h-4 text-teal-600" />
          </div>
        </div>
      </motion.div>

      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2.5 tracking-tight">
        {isDragging ? "Drop your file to begin analysis" : "Upload Image or Video for Forensic Verification"}
      </h3>
      <p className="text-slate-500 text-sm max-w-md mx-auto mb-6 font-medium leading-relaxed">
        Drag &amp; drop your media file here, or click anywhere inside to select from your device. Max file size: 500 MB.
      </p>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onButtonClick();
        }}
        className="pointer-events-auto inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition-all duration-300 shadow-lg shadow-sky-600/30 cursor-pointer"
      >
        <Sparkles className="w-4 h-4 text-white" />
        Select File to Analyze
      </button>
    </div>
  );
}

function LoadingState({ progress, fileName }: { progress: number; fileName?: string }) {
  const steps = [
    { threshold: 30, text: "Uploading & Buffer Allocation" },
    { threshold: 70, text: "OpenCV YuNet Face Extraction & Framing" },
    { threshold: 100, text: "ONNX Neural Tensor Inference" },
  ];

  const currentStep = steps.find((s) => progress <= s.threshold) || steps[2];

  return (
    <div className="flex flex-col items-center justify-center py-6 relative z-10">
      <div className="relative mb-6">
        <Loader2 className="w-16 h-16 text-sky-600 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black text-slate-900 font-mono">{progress}%</span>
        </div>
      </div>

      <h4 className="text-xl font-black text-slate-900 mb-1 tracking-tight">
        {progress < 100 ? "Processing Forensic Scan..." : "Finalizing Forensic Audit"}
      </h4>
      {fileName && <p className="text-xs text-slate-500 font-mono mb-6 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{fileName}</p>}

      <div className="w-full max-w-md space-y-3">
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-sky-100 shadow-inner">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-teal-400 shadow-xs"
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
        <p className="text-xs text-sky-800 font-extrabold font-mono text-center flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 animate-pulse text-sky-600" />
          {currentStep.text}
        </p>
      </div>
    </div>
  );
}
