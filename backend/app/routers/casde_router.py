"""
casde_router.py – REST API for CASDE status, history, and control.

Endpoints:
  GET  /api/v1/casde/status         – Full engine + buffer + trainer status
  GET  /api/v1/casde/history        – Recent evolution cycles (paginated)
  GET  /api/v1/casde/history/{id}   – Single cycle detail
  GET  /api/v1/casde/models         – Model version history
  POST /api/v1/casde/trigger        – Manually trigger an immediate cycle
  POST /api/v1/casde/buffer/clear   – Clear the sample buffer (admin)
  GET  /api/v1/casde/attacks        – List available attack types
"""
import logging
from fastapi import APIRouter, HTTPException, Query
from typing import List

from app.schemas.casde_schemas import (
    CASDeStatusSchema,
    EvolutionCycleSchema,
    TriggerResponseSchema,
    ModelVersionSchema,
)

logger = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/v1/casde", tags=["casde"])


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=CASDeStatusSchema)
async def casde_status():
    """Full CASDE engine, buffer, trainer, and evolution summary."""
    from app.services.adversarial_engine import get_engine
    return get_engine().status()


# ── Evolution history ─────────────────────────────────────────────────────────

@router.get("/history", response_model=List[EvolutionCycleSchema])
async def evolution_history(limit: int = Query(20, ge=1, le=100)):
    """List the most recent evolution cycles."""
    from app.services.evolution_log import get_evolution_log
    cycles = get_evolution_log().get_recent_cycles(limit=limit)
    return cycles


@router.get("/history/{cycle_id}", response_model=EvolutionCycleSchema)
async def evolution_cycle_detail(cycle_id: int):
    """Detailed view of a single evolution cycle."""
    from app.services.evolution_log import get_evolution_log
    cycle = get_evolution_log().get_cycle(cycle_id)
    if not cycle:
        raise HTTPException(404, f"Cycle {cycle_id} not found")
    return cycle


# ── Model versions ────────────────────────────────────────────────────────────

@router.get("/models", response_model=List[ModelVersionSchema])
async def model_versions(limit: int = Query(20, ge=1, le=100)):
    """List ONNX head model versions exported by CASDE."""
    from app.services.evolution_log import get_evolution_log
    return get_evolution_log().get_model_versions(limit=limit)


# ── Manual trigger ────────────────────────────────────────────────────────────

@router.post("/trigger", response_model=TriggerResponseSchema)
async def trigger_cycle():
    """Manually trigger an immediate CASDE adaptation cycle."""
    from app.services.adversarial_engine import get_engine
    engine = get_engine()
    msg    = engine.trigger_now()
    logger.info(f"🔔 Manual CASDE trigger fired (cycle #{engine._current_cycle + 1} incoming)")
    return TriggerResponseSchema(message=msg, cycle=engine._current_cycle + 1)


# ── Buffer management ─────────────────────────────────────────────────────────

@router.post("/buffer/clear")
async def clear_buffer():
    """Clear all samples from the uncertainty buffer (admin action)."""
    from app.services.sample_buffer import get_buffer
    buf     = get_buffer()
    n       = buf.size
    buf.drain()
    logger.info(f"🗑️  Buffer cleared ({n} samples removed)")
    return {"message": f"Buffer cleared – {n} samples removed", "cleared": n}


@router.get("/buffer/stats")
async def buffer_stats():
    """Current buffer statistics."""
    from app.services.sample_buffer import get_buffer
    return get_buffer().stats()


# ── Attack catalogue ──────────────────────────────────────────────────────────

@router.get("/attacks")
async def list_attack_types():
    """List all available adversarial attack types and their descriptions."""
    from app.services.attack_generator import ATTACK_FUNCTIONS
    return {
        "attack_types": list(ATTACK_FUNCTIONS.keys()),
        "descriptions": {
            "frequency_blend":    "FFT-domain face frequency injection (high-frequency ring amplification)",
            "alpha_blend":        "Alpha-composite synthetic face patch over centre region",
            "gaussian_noise":     "Structured Gaussian noise simulating compression artefacts",
            "color_shift":        "YCbCr channel shift replicating GAN colour leakage bias",
            "texture_patch":      "Adversarial texture patch overlay in random corner",
            "sharpness_warp":     "Unsharp-mask warping to simulate upscaling artefacts",
            "jpeg_recompression": "Simulated JPEG compression block artefacts at varying quality",
            "temporal_blend":     "Frame interpolation blend simulating video temporal attacks",
        },
        "intensity_levels": [0.2, 0.4, 0.6, 0.8, 1.0],
    }
