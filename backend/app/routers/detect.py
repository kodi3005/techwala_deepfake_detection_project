"""
detect.py  –  /api/v1/detect/image  &  /api/v1/detect/video
"""
import time
import uuid
import shutil
import logging
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
import json

from app.config import UPLOAD_DIR, MAX_FILE_MB
from app.schemas.detection import (
    ImageDetectionResponse,
    VideoDetectionResponse,
    FaceResult,
    BoundingBox,
)
from app.services.model_service import get_model
from app.services.face_detector import detect_faces
from app.services.video_processor import analyse_video
from app.utils.report_generator import build_json_report

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/v1/detect", tags=["detection"])

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".wmv"}
MAX_BYTES  = MAX_FILE_MB * 1024 * 1024


def _risk(fake: float) -> tuple[str, str]:
    if fake < 0.40:
        return "low",    "AUTHENTIC"
    if fake < 0.70:
        return "medium", "SUSPICIOUS"
    return "high",       "DEEPFAKE"


def _save_upload(upload: UploadFile) -> Path:
    suffix  = Path(upload.filename or "file").suffix.lower()
    dest    = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    with open(dest, "wb") as f:
        chunk_size = 1024 * 1024  # 1 MB
        total = 0
        while True:
            chunk = upload.file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_BYTES:
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds {MAX_FILE_MB} MB limit",
                )
            f.write(chunk)
    return dest


# ── Image endpoint ────────────────────────────────────────────────────────────

@router.post("/image", response_model=ImageDetectionResponse)
async def detect_image(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in IMAGE_EXTS:
        raise HTTPException(400, f"Unsupported image format: {ext}")

    t0   = time.perf_counter()
    path = _save_upload(file)

    try:
        model  = get_model()
        bgr    = cv2.imread(str(path))
        if bgr is None:
            raise HTTPException(422, "Cannot decode image file")

        boxes, crops = detect_faces(bgr)
        predictions  = model.predict_batch(crops)

        face_results = []
        for i, ((x, y, w, h), (real_s, fake_s)) in enumerate(
            zip(boxes, predictions)
        ):
            lbl = "Real" if real_s >= fake_s else "Fake"
            face_results.append(
                FaceResult(
                    face_id=i,
                    bbox=BoundingBox(x=x, y=y, width=w, height=h),
                    real_score=round(real_s, 4),
                    fake_score=round(fake_s, 4),
                    label=lbl,
                )
            )

        fake_scores  = [f.fake_score for f in face_results]
        overall_fake = float(np.mean(fake_scores)) if fake_scores else 0.5
        overall_real = 1.0 - overall_fake
        risk, verdict = _risk(overall_fake)
        elapsed_ms   = round((time.perf_counter() - t0) * 1000, 1)

        return ImageDetectionResponse(
            filename=file.filename or path.name,
            overall_real=round(overall_real, 4),
            overall_fake=round(overall_fake, 4),
            risk_level=risk,
            verdict=verdict,
            faces_detected=len(face_results),
            faces=face_results,
            processing_time_ms=elapsed_ms,
        )
    finally:
        path.unlink(missing_ok=True)


# ── Video endpoint ────────────────────────────────────────────────────────────

@router.post("/video", response_model=VideoDetectionResponse)
async def detect_video(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in VIDEO_EXTS:
        raise HTTPException(400, f"Unsupported video format: {ext}")

    t0   = time.perf_counter()
    path = _save_upload(file)

    try:
        model              = get_model()
        duration, frames   = analyse_video(path, model)

        if not frames:
            raise HTTPException(422, "No frames could be analysed (no faces detected or empty video)")

        fake_scores  = [f.fake_score for f in frames]
        overall_fake = float(np.mean(fake_scores))
        overall_real = 1.0 - overall_fake
        risk, verdict = _risk(overall_fake)

        # Highest-risk timestamps (top 5)
        sorted_frames = sorted(frames, key=lambda f: f.fake_score, reverse=True)
        top_ts = [f.timestamp_sec for f in sorted_frames[:5]]

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        return VideoDetectionResponse(
            filename=file.filename or path.name,
            duration_sec=round(duration, 2),
            total_frames_analyzed=len(frames),
            overall_real=round(overall_real, 4),
            overall_fake=round(overall_fake, 4),
            risk_level=risk,
            verdict=verdict,
            frames=frames,
            highest_risk_timestamps=top_ts,
            processing_time_ms=elapsed_ms,
        )
    finally:
        path.unlink(missing_ok=True)


# ── Report download endpoint ──────────────────────────────────────────────────

@router.post("/report")
async def download_report(request: Request):
    body       = await request.json()
    media_type = body.get("media_type", "image")
    result     = body.get("result", {})
    report_json = build_json_report(result, media_type)

    return StreamingResponse(
        iter([report_json.encode()]),
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="deepfake_report.json"'
        },
    )
