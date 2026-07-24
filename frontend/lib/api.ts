// lib/api.ts
import axios from "axios";
import { ImageDetectionResult, VideoDetectionResult } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 600_000, // 10 min for large videos
});

export async function detectImage(
  file: File,
  onUploadProgress?: (pct: number) => void
): Promise<ImageDetectionResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImageDetectionResult>(
    "/api/v1/detect/image",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onUploadProgress) {
          onUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }
  );
  return data;
}

export async function detectVideo(
  file: File,
  onUploadProgress?: (pct: number) => void
): Promise<VideoDetectionResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<VideoDetectionResult>(
    "/api/v1/detect/video",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onUploadProgress) {
          onUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }
  );
  return data;
}

export async function downloadReport(
  result: object,
  mediaType: "image" | "video"
): Promise<void> {
  const { data } = await apiClient.post(
    "/api/v1/detect/report",
    { result, media_type: mediaType },
    { responseType: "blob" }
  );
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/json" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "deepfake_report.json";
  a.click();
  URL.revokeObjectURL(url);
}
