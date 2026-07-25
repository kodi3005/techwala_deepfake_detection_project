"""
sample_buffer.py – Thread-safe ring buffer for hard/uncertain inference samples.

When the detection pipeline produces a result with confidence below the
UNCERTAINTY_THRESHOLD, the raw frame/image is pushed here. The adversarial
engine drains this buffer periodically to generate attack variants and retrain.
"""
import threading
import time
import logging
import numpy as np
from collections import deque
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger("uvicorn.error")

UNCERTAINTY_THRESHOLD = float(__import__("os").getenv("UNCERTAINTY_THRESHOLD", "0.25"))
BUFFER_MAX_SIZE       = int(__import__("os").getenv("BUFFER_MAX_SIZE", "500"))


@dataclass
class BufferedSample:
    """One uncertain inference sample stored for adversarial reuse."""
    image:          np.ndarray         # BGR frame / face crop
    fake_score:     float              # Model's fake probability
    real_score:     float              # Model's real probability
    source:         str                # "image" | "video"
    filename:       str
    timestamp:      float = field(default_factory=time.time)
    # Pseudo-label assigned after buffer analysis (None = undecided)
    pseudo_label:   Optional[int] = None   # 0 = Real, 1 = Fake


class SampleBuffer:
    """
    Concurrent ring-buffer for collecting uncertain inference samples.

    Thread-safe for producers (inference threads) and consumers (CASDE engine).
    Implements max-size eviction: oldest samples are dropped when full.
    """

    _instance: "SampleBuffer | None" = None
    _lock_singleton = threading.Lock()

    def __init__(self, max_size: int = BUFFER_MAX_SIZE):
        self._buf: deque[BufferedSample] = deque(maxlen=max_size)
        self._lock = threading.Lock()
        self._total_pushed = 0
        self._total_drained = 0

    # ── Singleton ──────────────────────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> "SampleBuffer":
        with cls._lock_singleton:
            if cls._instance is None:
                cls._instance = cls()
                logger.info(
                    f"🗃️  SampleBuffer initialised  max_size={BUFFER_MAX_SIZE}  "
                    f"uncertainty_threshold={UNCERTAINTY_THRESHOLD}"
                )
        return cls._instance

    # ── Producer API ───────────────────────────────────────────────────────

    def push(
        self,
        image: np.ndarray,
        fake_score: float,
        real_score: float,
        source: str = "image",
        filename: str = "",
    ) -> bool:
        """
        Push a sample if it is sufficiently uncertain (confidence near 0.5).
        Returns True if the sample was accepted.
        """
        uncertainty = 1.0 - abs(fake_score - real_score)
        if uncertainty < UNCERTAINTY_THRESHOLD:
            return False  # High-confidence result – not useful for retraining

        sample = BufferedSample(
            image=image.copy(),
            fake_score=fake_score,
            real_score=real_score,
            source=source,
            filename=filename,
        )
        with self._lock:
            self._buf.append(sample)
            self._total_pushed += 1

        logger.debug(
            f"📥 Sample buffered  fake={fake_score:.3f}  real={real_score:.3f}  "
            f"uncertainty={uncertainty:.3f}  buf_size={len(self._buf)}"
        )
        return True

    # ── Consumer API ───────────────────────────────────────────────────────

    def drain(self, n: int | None = None) -> List[BufferedSample]:
        """
        Drain up to `n` samples from the buffer (default: all).
        Returns the drained list; buffer is cleared of those items.
        """
        with self._lock:
            if n is None or n >= len(self._buf):
                samples = list(self._buf)
                self._buf.clear()
            else:
                samples = [self._buf.popleft() for _ in range(n)]
            self._total_drained += len(samples)
        logger.info(f"🔄 Drained {len(samples)} samples from buffer")
        return samples

    def peek(self, n: int = 10) -> List[BufferedSample]:
        """Non-destructive peek at the oldest n samples."""
        with self._lock:
            return list(self._buf)[:n]

    # ── Stats ──────────────────────────────────────────────────────────────

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._buf)

    def stats(self) -> dict:
        with self._lock:
            sizes = [len(self._buf)]
        return {
            "current_size":   sizes[0],
            "max_size":       self._buf.maxlen,
            "total_pushed":   self._total_pushed,
            "total_drained":  self._total_drained,
            "uncertainty_threshold": UNCERTAINTY_THRESHOLD,
        }


# Module-level convenience accessor
def get_buffer() -> SampleBuffer:
    return SampleBuffer.get_instance()
