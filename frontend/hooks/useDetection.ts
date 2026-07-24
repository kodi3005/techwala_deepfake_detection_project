// hooks/useDetection.ts
"use client";
import { useState, useCallback } from "react";
import { detectImage, detectVideo } from "@/lib/api";
import { DetectionResult } from "@/lib/types";
import { saveDetectionResult } from "@/lib/db";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "bmp"];
const VIDEO_EXTS = ["mp4", "mov", "avi", "mkv", "wmv"];

export function useDetection() {
  const [isLoading, setIsLoading]   = useState(false);
  const [progress,  setProgress]    = useState(0);
  const [result,    setResult]      = useState<DetectionResult | null>(null);
  const [error,     setError]       = useState<string | null>(null);
  const [mediaType, setMediaType]   = useState<"image" | "video" | null>(null);
  const [previewUrl,setPreviewUrl]  = useState<string | null>(null);

  const analyse = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setProgress(0);

    // Revoke old preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type: "image" | "video" | null = IMAGE_EXTS.includes(ext)
      ? "image"
      : VIDEO_EXTS.includes(ext)
      ? "video"
      : null;

    if (!type) {
      setError("Unsupported file format.");
      return;
    }
    setMediaType(type);
    setIsLoading(true);

    try {
      const res =
        type === "image"
          ? await detectImage(file, setProgress)
          : await detectVideo(file, setProgress);
      setResult(res);

      // Asynchronously save forensic result to Supabase
      saveDetectionResult(res, type).catch(err => 
        console.error("Failed to save record:", err)
      );

    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Analysis failed. Is the backend running?";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [previewUrl]);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setResult(null);
    setError(null);
    setProgress(0);
    setMediaType(null);
    setPreviewUrl(null);
  }, [previewUrl]);

  return { isLoading, progress, result, error, mediaType, previewUrl, analyse, reset };
}
