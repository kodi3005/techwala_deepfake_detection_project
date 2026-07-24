import os
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent.parent   # c:/df
MODEL_PATH = os.getenv("MODEL_PATH", str(BASE_DIR / "model.onnx"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "backend" / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ── Inference ────────────────────────────────────────────────────────────────
DEVICE          = os.getenv("DEVICE", "cpu")          # "cpu" | "cuda"
IMG_SIZE        = int(os.getenv("IMG_SIZE", "224"))   # model input resolution
BATCH_SIZE      = int(os.getenv("BATCH_SIZE", "8"))   # video frame batch size
FRAMES_PER_SEC  = float(os.getenv("FRAMES_PER_SEC", "1.0"))  # sampling rate
MAX_FILE_MB     = int(os.getenv("MAX_FILE_MB", "500"))

# ── Labels ───────────────────────────────────────────────────────────────────
# Adjust if your model's output ordering differs
CLASS_LABELS = ["Real", "Fake"]   # index-0 = Real, index-1 = Fake

# ── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
