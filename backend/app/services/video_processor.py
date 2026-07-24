"""
video_processor.py  –  Frame extraction + batch inference for video files
Uses OpenCV (pure Python, no FFmpeg binary required).
"""
import cv2
import logging
import numpy as np
from pathlib import Path
from typing import List

from app.config import BATCH_SIZE, FRAMES_PER_SEC
from app.schemas.detection import FrameResult
from app.services.model_service import ModelService
from app.services.face_detector import detect_faces

logger = logging.getLogger("uvicorn.error")


def analyse_video(
    video_path: str | Path,
    model: ModelService,
) -> tuple[float, List[FrameResult]]:
    """
    Returns:
        duration_sec  – total video length
        frame_results – list of FrameResult objects
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    fps      = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_f  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_f / fps

    # Which frame indices to sample
    step          = max(1, int(fps / FRAMES_PER_SEC))
    sample_idxs   = list(range(0, total_f, step))

    logger.info(
        f"Video: {Path(video_path).name}  fps={fps:.1f}  "
        f"frames={total_f}  sampling every {step} frames  "
        f"→ {len(sample_idxs)} samples"
    )

    frame_results: List[FrameResult] = []
    batch_frames: List[np.ndarray]   = []
    batch_meta:   List[dict]         = []

    def flush_batch():
        if not batch_frames:
            return
        predictions = model.predict_batch(batch_frames)
        for meta, (real_s, fake_s) in zip(batch_meta, predictions):
            frame_results.append(
                FrameResult(
                    frame_index=meta["idx"],
                    timestamp_sec=round(meta["ts"], 2),
                    real_score=round(real_s, 4),
                    fake_score=round(fake_s, 4),
                    faces_detected=meta["faces"],
                )
            )
        batch_frames.clear()
        batch_meta.clear()

    current_frame = 0
    sample_set    = set(sample_idxs)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if current_frame in sample_set:
            boxes, crops = detect_faces(frame)
            # Use the highest-confidence face (first detected)
            best_crop = crops[0]
            batch_frames.append(best_crop)
            batch_meta.append(
                {
                    "idx":   current_frame,
                    "ts":    current_frame / fps,
                    "faces": len(boxes),
                }
            )
            if len(batch_frames) >= BATCH_SIZE:
                flush_batch()

        current_frame += 1

    flush_batch()
    cap.release()

    return duration, frame_results
