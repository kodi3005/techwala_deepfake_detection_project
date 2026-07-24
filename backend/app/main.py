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
from app.services.model_service import get_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("⏳  Loading ONNX model …")
    try:
        get_model()
        logger.info("✅  Model ready")
    except Exception as exc:
        logger.error(f"❌  Model load failed: {exc}")
    yield
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
