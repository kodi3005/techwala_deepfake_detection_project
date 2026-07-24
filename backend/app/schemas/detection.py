from pydantic import BaseModel
from typing import List, Optional

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class FaceResult(BaseModel):
    face_id: int
    bbox: BoundingBox
    real_score: float
    fake_score: float
    label: str

class ImageDetectionResponse(BaseModel):
    filename: str
    overall_real: float
    overall_fake: float
    risk_level: str          # "low" | "medium" | "high"
    verdict: str             # "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE"
    faces_detected: int
    faces: List[FaceResult]
    processing_time_ms: float

class FrameResult(BaseModel):
    frame_index: int
    timestamp_sec: float
    real_score: float
    fake_score: float
    faces_detected: int

class VideoDetectionResponse(BaseModel):
    filename: str
    duration_sec: float
    total_frames_analyzed: int
    overall_real: float
    overall_fake: float
    risk_level: str
    verdict: str
    frames: List[FrameResult]
    highest_risk_timestamps: List[float]
    processing_time_ms: float

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    model_path: str
    onnx_runtime_version: str
