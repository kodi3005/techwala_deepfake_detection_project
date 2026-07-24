"""
model_service.py  –  ONNX Runtime inference engine
Loads model.onnx once at startup; exposes predict_image() and predict_batch().
"""
import logging
import numpy as np
import onnxruntime as ort
from pathlib import Path
from typing import List, Tuple

from app.config import MODEL_PATH, IMG_SIZE, CLASS_LABELS, DEVICE

logger = logging.getLogger("uvicorn.error")


def _get_providers() -> List[str]:
    available = ort.get_available_providers()
    if DEVICE == "cuda" and "CUDAExecutionProvider" in available:
        logger.info("Using CUDAExecutionProvider")
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    logger.info("Using CPUExecutionProvider")
    return ["CPUExecutionProvider"]


class ModelService:
    _instance: "ModelService | None" = None

    def __init__(self):
        if not Path(MODEL_PATH).exists():
            raise FileNotFoundError(f"model.onnx not found at: {MODEL_PATH}")

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4

        self.session = ort.InferenceSession(
            MODEL_PATH,
            sess_options=opts,
            providers=_get_providers(),
        )
        self.input_name  = self.session.get_inputs()[0].name
        self.input_shape = self.session.get_inputs()[0].shape   # e.g. [1,3,224,224]
        self.output_name = self.session.get_outputs()[0].name

        # Detect expected H×W from model meta (fallback to IMG_SIZE)
        try:
            _, _, self.h, self.w = self.input_shape
            if not isinstance(self.h, int):
                self.h = self.w = IMG_SIZE
        except Exception:
            self.h = self.w = IMG_SIZE

        logger.info(
            f"✅ Model loaded  |  input={self.input_name}  "
            f"shape=[N,3,{self.h},{self.w}]  providers={_get_providers()}"
        )

    # ── public helpers ────────────────────────────────────────────────────────

    def preprocess(self, bgr_img: np.ndarray) -> np.ndarray:
        """Convert a BGR OpenCV image to a normalised CHW float32 tensor."""
        import cv2
        img = cv2.resize(bgr_img, (self.w, self.h))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img  = (img - mean) / std
        return img.transpose(2, 0, 1)   # HWC → CHW

    def softmax(self, logits: np.ndarray) -> np.ndarray:
        e = np.exp(logits - logits.max(axis=-1, keepdims=True))
        return e / e.sum(axis=-1, keepdims=True)

    def predict_batch(self, images: List[np.ndarray]) -> List[Tuple[float, float]]:
        """
        images  – list of BGR numpy arrays (any size)
        returns – list of (real_score, fake_score) tuples, each in [0, 1]
        """
        batch = np.stack([self.preprocess(img) for img in images])
        outputs = self.session.run([self.output_name], {self.input_name: batch})[0]

        # Handle both 1-output (binary sigmoid) and 2-output (softmax) heads
        if outputs.shape[-1] == 1:
            # Binary sigmoid: output is P(fake)
            fake_probs = 1.0 / (1.0 + np.exp(-outputs.squeeze(-1)))
            real_probs = 1.0 - fake_probs
        else:
            probs = self.softmax(outputs)
            # CLASS_LABELS = ["Real", "Fake"]  →  index 0 = Real, 1 = Fake
            real_probs = probs[:, 0]
            fake_probs = probs[:, 1]

        return list(zip(real_probs.tolist(), fake_probs.tolist()))

    def predict_single(self, bgr_img: np.ndarray) -> Tuple[float, float]:
        return self.predict_batch([bgr_img])[0]


# Singleton accessor used by FastAPI startup
_service: ModelService | None = None

def get_model() -> ModelService:
    global _service
    if _service is None:
        _service = ModelService()
    return _service
