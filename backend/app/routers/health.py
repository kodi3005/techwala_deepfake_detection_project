import onnxruntime as ort
from fastapi import APIRouter
from app.schemas.detection import HealthResponse
from app.services.model_service import get_model
from app.config import MODEL_PATH, DEVICE

router = APIRouter(prefix="/api/v1", tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health():
    try:
        model  = get_model()
        loaded = True
    except Exception:
        loaded = False

    return HealthResponse(
        status="ok" if loaded else "degraded",
        model_loaded=loaded,
        device=DEVICE,
        model_path=MODEL_PATH,
        onnx_runtime_version=ort.__version__,
    )
