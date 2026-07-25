"""
main.py  –  FastAPI application entry-point
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import ALLOWED_ORIGINS
from app.routers import detect, health
from app.routers import casde_router
from app.services.model_service import get_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Load ONNX model ───────────────────────────────────────────────────
    logger.info("⏳  Loading ONNX model …")
    try:
        get_model()
        logger.info("✅  Model ready")
    except Exception as exc:
        logger.error(f"❌  Model load failed: {exc}")

    # ── Start CASDE adversarial self-learning engine ───────────────────────
    try:
        from app.services.adversarial_engine import get_engine
        engine = get_engine()
        engine.start()
        logger.info("🤖  CASDE adversarial engine started")
    except Exception as exc:
        logger.error(f"❌  CASDE engine start failed: {exc}")

    yield

    # ── Shutdown CASDE engine ─────────────────────────────────────────────
    try:
        from app.services.adversarial_engine import get_engine
        get_engine().stop()
    except Exception:
        pass
    logger.info("🛑  Shutting down")


app = FastAPI(
    title="DeepFake Detection API",
    version="1.0.0",
    description="ONNX-powered deepfake detection for images and videos",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(detect.router)
app.include_router(casde_router.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


@app.get("/")
async def root():
    return {"message": "DeepFake Detection API is running", "docs": "/docs"}
