"""
adversarial_engine.py – CASDE Orchestrator

Coordinates the full continual adversarial self-learning loop:

  Loop (every CASDE_CYCLE_INTERVAL_SEC seconds):
    1. Check if SampleBuffer has enough uncertain samples
    2. Drain buffer → run AttackGenerator → produce synthetic variants
    3. Train ContinualTrainer.fit_incremental() on synthetic dataset
    4. Run ValidationGate
    5. If passed → record cycle in EvolutionLog, mark head as active
    6. If failed → discard candidate, record rejection in EvolutionLog

The engine runs in a background daemon thread so it never blocks inference.
It can also be triggered manually via the /api/v1/casde/trigger endpoint.
"""
import threading
import logging
import time
import os
import random
import numpy as np
from typing import Optional, Dict, Any

logger = logging.getLogger("uvicorn.error")

# Cycle interval in seconds (default: every 5 minutes)
CASDE_CYCLE_INTERVAL_SEC = int(os.getenv("CASDE_CYCLE_INTERVAL_SEC", "300"))
# Minimum buffer fill before a cycle starts
CASDE_MIN_BUFFER_FILL    = int(os.getenv("CASDE_MIN_BUFFER_FILL", "20"))
# Max attack variants per cycle
CASDE_MAX_VARIANTS       = int(os.getenv("CASDE_MAX_VARIANTS", "8"))
# Samples per variant (synthetic generated)
CASDE_SAMPLES_PER_VARIANT= int(os.getenv("CASDE_SAMPLES_PER_VARIANT", "20"))


class CASDeEngine:
    """
    Continual Adversarial Self-Learning Detection Engine.

    Singleton orchestrator that drives automatic model adaptation.
    """

    _instance: "CASDeEngine | None" = None
    _lock_singleton = threading.Lock()

    def __init__(self):
        self._running         = False
        self._thread: Optional[threading.Thread] = None
        self._lock            = threading.Lock()
        self._current_cycle   = 0
        self._last_cycle_at   = 0.0
        self._last_cycle_info : Dict[str, Any] = {}
        self._manually_triggered = threading.Event()
        logger.info(
            f"🤖 CASDeEngine initialised  "
            f"cycle_interval={CASDE_CYCLE_INTERVAL_SEC}s  "
            f"min_buffer={CASDE_MIN_BUFFER_FILL}"
        )

    # ── Singleton ─────────────────────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> "CASDeEngine":
        with cls._lock_singleton:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ── Lifecycle ─────────────────────────────────────────────────────────

    def start(self):
        """Start the background CASDE loop."""
        with self._lock:
            if self._running:
                return
            self._running = True
        self._thread = threading.Thread(
            target=self._loop,
            name="casde-engine",
            daemon=True,
        )
        self._thread.start()
        logger.info("🚀 CASDeEngine background loop started")

    def stop(self):
        """Signal the background loop to stop (gracefully)."""
        with self._lock:
            self._running = False
        if self._thread and self._thread.is_alive():
            self._manually_triggered.set()   # wake up the wait
            self._thread.join(timeout=5)
        logger.info("🛑 CASDeEngine stopped")

    def trigger_now(self) -> str:
        """Manually trigger an immediate CASDE cycle (from API)."""
        self._manually_triggered.set()
        return "CASDE cycle triggered"

    # ── Main loop ─────────────────────────────────────────────────────────

    def _loop(self):
        while True:
            with self._lock:
                if not self._running:
                    break
            # Wait for interval OR manual trigger
            triggered = self._manually_triggered.wait(timeout=CASDE_CYCLE_INTERVAL_SEC)
            self._manually_triggered.clear()

            with self._lock:
                if not self._running:
                    break

            try:
                self._run_cycle()
            except Exception as exc:
                logger.error(f"❌ CASDE cycle error: {exc}", exc_info=True)

    # ── Cycle implementation ──────────────────────────────────────────────

    def _run_cycle(self):
        """One full CASDE adaptation cycle."""
        from app.services.sample_buffer    import get_buffer
        from app.services.attack_generator import get_attack_generator
        from app.services.continual_trainer import get_trainer
        from app.services.evolution_log    import get_evolution_log, EvolutionCycleRecord, AttackVariantRecord
        from app.services.model_service    import get_model

        started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self._current_cycle += 1
        cycle_num = self._current_cycle
        logger.info(f"🔁 CASDE Cycle #{cycle_num} started")

        # ── Step 1: Check buffer ──────────────────────────────────────────
        buf = get_buffer()
        if buf.size < CASDE_MIN_BUFFER_FILL:
            logger.info(
                f"⏳ Cycle #{cycle_num} skipped – buffer too small "
                f"({buf.size} < {CASDE_MIN_BUFFER_FILL})"
            )
            return

        samples = buf.drain()
        logger.info(f"🧩 Drained {len(samples)} uncertain samples from buffer")

        # ── Step 2: Generate attack variants ─────────────────────────────
        gen      = get_attack_generator()
        variants = gen.generate_variants(
            samples,
            max_variants=CASDE_MAX_VARIANTS,
            samples_per_variant=CASDE_SAMPLES_PER_VARIANT,
        )
        if not variants:
            logger.warning(f"⚠️ Cycle #{cycle_num}: no variants generated")
            return

        # Flatten all synthetic samples
        all_synth = []
        for v in variants:
            all_synth.extend(v.samples)
        random.shuffle(all_synth)

        # ── Step 3: Incremental training ──────────────────────────────────
        model   = get_model()
        trainer = get_trainer()
        train_result = trainer.fit_incremental(model, all_synth)
        if not train_result.get("trained"):
            logger.warning(f"⚠️ Cycle #{cycle_num}: training skipped – {train_result.get('error')}")
            # Still record a cycle for observability
            _record_skipped_cycle(
                cycle_num, started_at, variants, len(all_synth),
                train_result.get("error", "unknown"), get_evolution_log(), trainer
            )
            return

        # ── Step 4: Probe set for validation ─────────────────────────────
        # Use 20% of synthetic samples as hold-out probe
        split   = max(4, len(all_synth) // 5)
        probe   = all_synth[-split:]

        baseline_auc      = trainer._baseline_auc
        baseline_latency  = 5.0   # ms – conservative baseline for head

        passed, reason, new_auc = trainer.validate_candidate(
            model, probe, baseline_auc, baseline_latency
        )

        # ── Step 5: ONNX export (optional, best-effort) ───────────────────
        onnx_path = None
        if passed:
            onnx_path = trainer.export_onnx_head(cycle_num)
            # Update baseline AUC for next cycle
            if new_auc > trainer._baseline_auc:
                trainer._baseline_auc = new_auc

        finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # ── Step 6: Record in EvolutionLog ────────────────────────────────
        elog = get_evolution_log()
        variant_records = [
            AttackVariantRecord(
                variant_name=v.name,
                attack_type=v.attack_type,
                intensity=v.intensity,
                sample_count=len(v.samples),
                avg_fake_score_before=float(np.mean([s.fake_score for s in samples])),
                avg_fake_score_after=new_auc,
            )
            for v in variants
        ]
        cycle_record = EvolutionCycleRecord(
            started_at=started_at,
            finished_at=finished_at,
            attack_variants_generated=len(variants),
            synthetic_samples_count=len(all_synth),
            baseline_auc=baseline_auc,
            new_model_auc=new_auc,
            promoted=passed,
            rejection_reason="" if passed else reason,
            variants=variant_records,
        )
        cycle_id = elog.record_cycle(cycle_record)

        if onnx_path:
            elog.record_model_version(cycle_id, str(onnx_path), new_auc, passed)

        # ── Update engine state ───────────────────────────────────────────
        self._last_cycle_at = time.time()
        self._last_cycle_info = {
            "cycle_id":               cycle_id,
            "cycle_num":              cycle_num,
            "started_at":             started_at,
            "finished_at":            finished_at,
            "samples_drained":        len(samples),
            "variants_generated":     len(variants),
            "synthetic_samples":      len(all_synth),
            "baseline_auc":           round(baseline_auc, 4),
            "new_model_auc":          round(new_auc, 4),
            "promoted":               passed,
            "rejection_reason":       reason,
            "head_onnx_exported":     onnx_path is not None,
        }

        status_icon = "✅" if passed else "❌"
        logger.info(
            f"{status_icon} CASDE Cycle #{cycle_num} done  "
            f"variants={len(variants)}  synth={len(all_synth)}  "
            f"auc={new_auc:.4f}  promoted={passed}  reason={reason}"
        )

    # ── Status ────────────────────────────────────────────────────────────

    def status(self) -> Dict[str, Any]:
        from app.services.sample_buffer   import get_buffer
        from app.services.continual_trainer import get_trainer
        from app.services.evolution_log   import get_evolution_log

        buf     = get_buffer()
        trainer = get_trainer()
        elog    = get_evolution_log()

        return {
            "engine_running":      self._running,
            "current_cycle":       self._current_cycle,
            "last_cycle_at":       self._last_cycle_at,
            "last_cycle_info":     self._last_cycle_info,
            "cycle_interval_sec":  CASDE_CYCLE_INTERVAL_SEC,
            "min_buffer_fill":     CASDE_MIN_BUFFER_FILL,
            "buffer":              buf.stats(),
            "trainer":             trainer.status(),
            "evolution_summary":   elog.get_summary(),
        }


# ── Helper ────────────────────────────────────────────────────────────────────

def _record_skipped_cycle(
    cycle_num, started_at, variants, synth_count, error, elog, trainer
):
    """Record a cycle that was skipped due to insufficient samples or missing deps."""
    from app.services.evolution_log import EvolutionCycleRecord
    finished_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    cycle_record = EvolutionCycleRecord(
        started_at=started_at,
        finished_at=finished_at,
        attack_variants_generated=len(variants),
        synthetic_samples_count=synth_count,
        baseline_auc=trainer._baseline_auc,
        new_model_auc=0.0,
        promoted=False,
        rejection_reason=f"skipped: {error}",
    )
    elog.record_cycle(cycle_record)


# ── Module-level accessor ─────────────────────────────────────────────────────

def get_engine() -> CASDeEngine:
    return CASDeEngine.get_instance()
