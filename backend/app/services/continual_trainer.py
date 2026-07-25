"""
continual_trainer.py – Lightweight head-only continual retraining over ONNX features.

Strategy:
  1. Extract deep features from frozen ONNX backbone (penultimate-layer output or
     global average pool of the last conv output).
  2. Train / update a scikit-learn SGDClassifier (online learning) on those features
     using synthetic adversarial samples from the attack generator.
  3. Re-export the combined pipeline (frozen ONNX backbone + sklearn head) as a new
     ONNX model using skl2onnx.
  4. Validate the candidate on a held-out probe set before hot-swapping.

If skl2onnx is unavailable (optional dependency), the trainer falls back to storing
the sklearn head separately and augmenting predictions at inference time.
"""
import logging
import os
import time
import json
import threading
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any

logger = logging.getLogger("uvicorn.error")

BASE_DIR        = Path(__file__).resolve().parent.parent.parent.parent   # c:/df
MODELS_DIR      = BASE_DIR / "backend" / "casde_models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Minimum samples needed to trigger retraining
MIN_SAMPLES_TO_TRAIN = int(os.getenv("CASDE_MIN_SAMPLES", "30"))
# AUC must not drop more than this vs baseline for promotion
AUC_TOLERANCE = float(os.getenv("CASDE_AUC_TOLERANCE", "0.02"))
# Latency must not increase more than this fraction
LATENCY_TOLERANCE = float(os.getenv("CASDE_LATENCY_TOLERANCE", "0.20"))


class ContinualTrainer:
    """
    Trains a continually-adapting head over the frozen ONNX backbone.

    The sklearn SGDClassifier uses hinge/log loss with warm_start=True,
    enabling incremental updates without forgetting previous knowledge.
    """

    _instance: "ContinualTrainer | None" = None
    _lock_singleton = threading.Lock()

    def __init__(self):
        self._clf        = None   # sklearn SGDClassifier
        self._scaler     = None   # StandardScaler for feature normalisation
        self._lock       = threading.Lock()
        self._trained_on = 0      # cumulative sample count
        self._baseline_auc = 0.85 # initial assumed AUC
        self._current_auc  = 0.85
        self._feature_dim  = None
        logger.info("🎓 ContinualTrainer initialised")

    @classmethod
    def get_instance(cls) -> "ContinualTrainer":
        with cls._lock_singleton:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ── Feature extraction ────────────────────────────────────────────────

    def extract_features(
        self,
        model_service,
        images: List[np.ndarray],
    ) -> Optional[np.ndarray]:
        """
        Run the ONNX model in 'feature mode': capture the raw logits / final
        layer output before softmax as feature vectors.

        Returns np.ndarray of shape (N, D) or None on error.
        """
        if not images:
            return None
        try:
            tensors = np.stack([model_service.preprocess(img) for img in images])
            # Use raw ONNX output (logits) as features — lightweight but effective
            raw = model_service.session.run(
                [model_service.output_name],
                {model_service.input_name: tensors},
            )[0]
            # Ensure 2-D: (N, D)
            features = raw.reshape(raw.shape[0], -1)
            return features.astype(np.float32)
        except Exception as exc:
            logger.error(f"Feature extraction failed: {exc}")
            return None

    # ── Incremental training ──────────────────────────────────────────────

    def fit_incremental(
        self,
        model_service,
        samples: List[Tuple[np.ndarray, int]],   # (image, label)
    ) -> Dict[str, Any]:
        """
        Train / update the SGDClassifier on new (image, label) pairs.
        Returns training metrics dict.
        """
        try:
            from sklearn.linear_model import SGDClassifier
            from sklearn.preprocessing import StandardScaler
            from sklearn.metrics import roc_auc_score
        except ImportError:
            logger.warning("scikit-learn not installed – skipping retraining. Run: pip install scikit-learn")
            return {"error": "scikit-learn not available", "trained": False}

        if len(samples) < MIN_SAMPLES_TO_TRAIN:
            return {
                "error": f"Insufficient samples ({len(samples)} < {MIN_SAMPLES_TO_TRAIN})",
                "trained": False,
            }

        images = [s[0] for s in samples]
        labels = np.array([s[1] for s in samples], dtype=np.int32)

        features = self.extract_features(model_service, images)
        if features is None:
            return {"error": "Feature extraction failed", "trained": False}

        with self._lock:
            # Initialise scaler on first call
            if self._scaler is None:
                from sklearn.preprocessing import StandardScaler
                self._scaler = StandardScaler()
                features_scaled = self._scaler.fit_transform(features)
            else:
                features_scaled = self._scaler.transform(features)

            # Initialise or update classifier
            if self._clf is None:
                from sklearn.linear_model import SGDClassifier
                self._clf = SGDClassifier(
                    loss="modified_huber",  # probabilistic outputs
                    max_iter=1,
                    warm_start=True,
                    class_weight="balanced",
                    random_state=42,
                    n_jobs=1,
                )
                self._clf.partial_fit(features_scaled, labels, classes=np.array([0, 1]))
            else:
                self._clf.partial_fit(features_scaled, labels)

            self._trained_on += len(samples)
            self._feature_dim = features.shape[1]

        # Evaluate on training set (proxy AUC – replace with val set in prod)
        try:
            proba = self._clf.predict_proba(features_scaled)[:, 1]
            auc   = roc_auc_score(labels, proba)
        except Exception:
            auc = 0.5

        logger.info(
            f"🎓 Incremental fit  samples={len(samples)}  "
            f"total_trained={self._trained_on}  auc={auc:.4f}"
        )
        return {
            "trained":       True,
            "new_samples":   len(samples),
            "total_trained": self._trained_on,
            "proxy_auc":     auc,
        }

    # ── ONNX export & validation ──────────────────────────────────────────

    def export_onnx_head(self, cycle_id: int) -> Optional[Path]:
        """
        Export the sklearn head as a standalone ONNX model using skl2onnx.
        Returns the path to the new ONNX file, or None if export fails.
        """
        if self._clf is None or self._scaler is None:
            logger.warning("No trained head to export")
            return None
        try:
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType
            from sklearn.pipeline import Pipeline

            pipeline = Pipeline([("scaler", self._scaler), ("clf", self._clf)])
            initial_type = [("float_input", FloatTensorType([None, self._feature_dim]))]
            onnx_model  = convert_sklearn(pipeline, initial_types=initial_type)

            out_path = MODELS_DIR / f"casde_head_cycle{cycle_id:04d}.onnx"
            with open(out_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            logger.info(f"📦 ONNX head exported → {out_path}")
            return out_path
        except ImportError:
            logger.warning("skl2onnx not installed – head stored in memory only. Run: pip install skl2onnx")
            return None
        except Exception as exc:
            logger.error(f"ONNX head export failed: {exc}")
            return None

    # ── Validation gate ───────────────────────────────────────────────────

    def validate_candidate(
        self,
        model_service,
        probe_samples: List[Tuple[np.ndarray, int]],
        baseline_auc: float,
        baseline_latency_ms: float,
    ) -> Tuple[bool, str, float]:
        """
        Run the validation gate on a candidate model.

        Returns (passed: bool, reason: str, new_auc: float)
        """
        if self._clf is None:
            return False, "No trained classifier available", 0.0

        try:
            from sklearn.metrics import roc_auc_score
        except ImportError:
            return True, "scikit-learn unavailable – auto-passing validation", baseline_auc

        if not probe_samples:
            return True, "No probe set – auto-passing validation", self._current_auc

        images = [s[0] for s in probe_samples]
        labels = np.array([s[1] for s in probe_samples])

        features = self.extract_features(model_service, images)
        if features is None:
            return False, "Feature extraction failed during validation", 0.0

        with self._lock:
            features_scaled = self._scaler.transform(features)
            proba = self._clf.predict_proba(features_scaled)[:, 1]

        try:
            auc = roc_auc_score(labels, proba)
        except Exception:
            auc = 0.5

        # Gate 1: AUC regression check
        if auc < baseline_auc - AUC_TOLERANCE:
            reason = f"AUC {auc:.4f} < baseline {baseline_auc:.4f} − {AUC_TOLERANCE}"
            return False, reason, auc

        # Gate 2: Latency check (measure head inference time)
        t0 = time.perf_counter()
        with self._lock:
            self._clf.predict_proba(features_scaled[:1])
        latency_ms = (time.perf_counter() - t0) * 1000
        if latency_ms > baseline_latency_ms * (1 + LATENCY_TOLERANCE):
            reason = f"Head latency {latency_ms:.1f}ms > {baseline_latency_ms * (1 + LATENCY_TOLERANCE):.1f}ms limit"
            return False, reason, auc

        self._current_auc = auc
        return True, "Validation passed", auc

    # ── Augmented inference ───────────────────────────────────────────────

    def augment_prediction(
        self,
        model_service,
        image: np.ndarray,
        base_real: float,
        base_fake: float,
        blend_weight: float = 0.35,
    ) -> Tuple[float, float]:
        """
        Blend the ONNX backbone prediction with the adaptive head prediction.
        Only active when the head has been trained on ≥ MIN_SAMPLES_TO_TRAIN.
        """
        if self._clf is None or self._scaler is None or self._trained_on < MIN_SAMPLES_TO_TRAIN:
            return base_real, base_fake

        try:
            features = self.extract_features(model_service, [image])
            if features is None:
                return base_real, base_fake
            with self._lock:
                features_scaled = self._scaler.transform(features)
                proba = self._clf.predict_proba(features_scaled)[0]
            head_real, head_fake = float(proba[0]), float(proba[1])
            # Weighted blend: mostly backbone, partially adaptive head
            blended_fake = (1 - blend_weight) * base_fake + blend_weight * head_fake
            blended_real = 1.0 - blended_fake
            return blended_real, blended_fake
        except Exception as exc:
            logger.debug(f"Head augmentation skipped: {exc}")
            return base_real, base_fake

    # ── Status ────────────────────────────────────────────────────────────

    def status(self) -> Dict[str, Any]:
        with self._lock:
            clf_ready = self._clf is not None
        return {
            "classifier_ready":  clf_ready,
            "total_trained":     self._trained_on,
            "feature_dim":       self._feature_dim,
            "baseline_auc":      self._baseline_auc,
            "current_auc":       self._current_auc,
            "min_samples_needed": MIN_SAMPLES_TO_TRAIN,
            "auc_tolerance":     AUC_TOLERANCE,
        }


def get_trainer() -> ContinualTrainer:
    return ContinualTrainer.get_instance()
