// lib/types.ts
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceResult {
  face_id: number;
  bbox: BoundingBox;
  real_score: number;
  fake_score: number;
  label: string;
}

export interface ImageDetectionResult {
  filename: string;
  overall_real: number;
  overall_fake: number;
  risk_level: "low" | "medium" | "high";
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE";
  faces_detected: number;
  faces: FaceResult[];
  processing_time_ms: number;
}

export interface FrameResult {
  frame_index: number;
  timestamp_sec: number;
  real_score: number;
  fake_score: number;
  faces_detected: number;
}

export interface VideoDetectionResult {
  filename: string;
  duration_sec: number;
  total_frames_analyzed: number;
  overall_real: number;
  overall_fake: number;
  risk_level: "low" | "medium" | "high";
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE";
  frames: FrameResult[];
  highest_risk_timestamps: number[];
  processing_time_ms: number;
}

export type DetectionResult = ImageDetectionResult | VideoDetectionResult;

export function isVideoResult(r: DetectionResult): r is VideoDetectionResult {
  return "frames" in r && "duration_sec" in r;
}
