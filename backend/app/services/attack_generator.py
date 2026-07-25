"""
attack_generator.py – Synthetic deepfake attack variant generator.

Produces diverse adversarial samples from a set of real/uncertain face crops using
pure NumPy + OpenCV transformations — no GAN training required at generation time.
Each attack variant mimics a plausible emerging manipulation technique.

Attack catalogue:
  1. frequency_blend      – FFT-domain face frequency injection
  2. alpha_blend          – Alpha-composite face regions at varying intensity
  3. gaussian_noise       – Structured compression-artifact noise
  4. color_shift          – YCbCr colour-space bias (GAN colour leakage)
  5. texture_patch        – Adversarial texture patch overlay
  6. sharpness_warp       – Unsharp-mask warping (upscaling artefacts)
  7. jpeg_recompression   – Simulated JPEG compression block artefacts
  8. temporal_blend       – Frame interpolation blend (video temporal attacks)
"""
import cv2
import logging
import numpy as np
import random
import time
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any

from app.services.sample_buffer import BufferedSample

logger = logging.getLogger("uvicorn.error")


# ── Attack variant descriptor ─────────────────────────────────────────────────

@dataclass
class AttackVariant:
    name:         str
    attack_type:  str
    intensity:    float
    samples:      List[Tuple[np.ndarray, int]]   # (image, label 0=real/1=fake)
    meta:         Dict[str, Any] = field(default_factory=dict)


# ── Individual attack transformations ─────────────────────────────────────────

def _frequency_blend(img: np.ndarray, intensity: float) -> np.ndarray:
    """Inject synthetic high-frequency components via FFT blending."""
    if img.shape[0] < 8 or img.shape[1] < 8:
        return img
    gray      = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    f_shift   = np.fft.fftshift(np.fft.fft2(gray))
    magnitude = np.abs(f_shift)
    # Amplify high-frequency ring (deepfake frequency artifact)
    h, w    = gray.shape
    cy, cx  = h // 2, w // 2
    mask    = np.zeros((h, w), dtype=np.float32)
    r_inner = min(h, w) // 6
    r_outer = min(h, w) // 3
    for i in range(h):
        for j in range(w):
            d = np.sqrt((i - cy) ** 2 + (j - cx) ** 2)
            if r_inner < d < r_outer:
                mask[i, j] = intensity * 0.3
    f_shift = f_shift * (1.0 + mask)
    img_back = np.abs(np.fft.ifft2(np.fft.ifftshift(f_shift))).astype(np.uint8)
    result   = cv2.cvtColor(img_back, cv2.COLOR_GRAY2BGR)
    blended  = cv2.addWeighted(img, 1.0 - intensity * 0.4, result, intensity * 0.4, 0)
    return np.clip(blended, 0, 255).astype(np.uint8)


def _alpha_blend(img: np.ndarray, intensity: float) -> np.ndarray:
    """Alpha-blend a synthetic face patch over the centre region."""
    h, w    = img.shape[:2]
    result  = img.copy()
    margin  = max(5, int(min(h, w) * 0.15))
    roi     = img[margin:h - margin, margin:w - margin]
    if roi.size == 0:
        return img
    # Create a slightly colour-shifted version as the synthetic patch
    synthetic = roi.copy().astype(np.float32)
    synthetic[:, :, 0] = np.clip(synthetic[:, :, 0] * (1.0 + intensity * 0.15), 0, 255)
    synthetic[:, :, 1] = np.clip(synthetic[:, :, 1] * (1.0 - intensity * 0.08), 0, 255)
    synthetic = synthetic.astype(np.uint8)
    blended_roi = cv2.addWeighted(roi, 1.0 - intensity, synthetic, intensity, 0)
    result[margin:h - margin, margin:w - margin] = blended_roi
    return result


def _gaussian_noise(img: np.ndarray, intensity: float) -> np.ndarray:
    """Inject structured Gaussian noise simulating compression block artefacts."""
    noise = np.random.normal(0, intensity * 25.0, img.shape).astype(np.float32)
    result = np.clip(img.astype(np.float32) + noise, 0, 255).astype(np.uint8)
    return result


def _color_shift(img: np.ndarray, intensity: float) -> np.ndarray:
    """Shift YCbCr channels to simulate GAN colour leakage."""
    yuv    = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb).astype(np.float32)
    # Shift Cb and Cr channels (typical GAN colour bias)
    yuv[:, :, 1] = np.clip(yuv[:, :, 1] + intensity * 12.0, 0, 255)
    yuv[:, :, 2] = np.clip(yuv[:, :, 2] - intensity * 8.0, 0, 255)
    result = cv2.cvtColor(yuv.astype(np.uint8), cv2.COLOR_YCrCb2BGR)
    return result


def _texture_patch(img: np.ndarray, intensity: float) -> np.ndarray:
    """Overlay a small adversarial texture patch in a random corner."""
    h, w   = img.shape[:2]
    ph      = max(8, int(h * 0.12))
    pw      = max(8, int(w * 0.12))
    patch   = np.random.randint(0, 256, (ph, pw, 3), dtype=np.uint8)
    # Blend instead of hard overlay for realism
    result  = img.copy()
    ry      = random.randint(0, max(0, h - ph - 1))
    rx      = random.randint(0, max(0, w - pw - 1))
    region  = result[ry:ry + ph, rx:rx + pw]
    blended = cv2.addWeighted(region, 1.0 - intensity * 0.5, patch, intensity * 0.5, 0)
    result[ry:ry + ph, rx:rx + pw] = blended
    return result


def _sharpness_warp(img: np.ndarray, intensity: float) -> np.ndarray:
    """Apply unsharp-mask to simulate upscaling/super-resolution artefacts."""
    blur    = cv2.GaussianBlur(img, (0, 0), sigmaX=3)
    result  = cv2.addWeighted(img, 1.0 + intensity * 1.5, blur, -intensity * 1.5, 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def _jpeg_recompression(img: np.ndarray, intensity: float) -> np.ndarray:
    """Simulate JPEG compression block artefacts at varying quality."""
    quality = max(10, int(95 - intensity * 80))
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    _, encoded  = cv2.imencode(".jpg", img, encode_param)
    decoded     = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    # Blend with original
    if decoded is None:
        return img
    return cv2.addWeighted(img, 1.0 - intensity * 0.6, decoded, intensity * 0.6, 0)


def _temporal_blend(img: np.ndarray, intensity: float) -> np.ndarray:
    """Simulate temporal blending by mixing the frame with a shifted version."""
    shifted = np.roll(img, shift=int(intensity * 4), axis=1)
    return cv2.addWeighted(img, 1.0 - intensity * 0.3, shifted, intensity * 0.3, 0)


# ── Attack dispatch table ─────────────────────────────────────────────────────

ATTACK_FUNCTIONS = {
    "frequency_blend":    _frequency_blend,
    "alpha_blend":        _alpha_blend,
    "gaussian_noise":     _gaussian_noise,
    "color_shift":        _color_shift,
    "texture_patch":      _texture_patch,
    "sharpness_warp":     _sharpness_warp,
    "jpeg_recompression": _jpeg_recompression,
    "temporal_blend":     _temporal_blend,
}


# ── Attack variant generator ──────────────────────────────────────────────────

class AttackGenerator:
    """
    Generates diverse adversarial attack variants from a pool of uncertain samples.

    For each attack type, N intensity levels are swept to produce synthetic
    deepfake samples that are likely to challenge the current model.
    """

    INTENSITY_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0]

    def __init__(self):
        self._attack_types = list(ATTACK_FUNCTIONS.keys())
        logger.info(
            f"⚔️  AttackGenerator ready  "
            f"attack_types={len(self._attack_types)}  "
            f"intensity_levels={len(self.INTENSITY_LEVELS)}"
        )

    def generate_variants(
        self,
        samples: List[BufferedSample],
        max_variants: int = 8,
        samples_per_variant: int = 20,
    ) -> List[AttackVariant]:
        """
        Generate up to `max_variants` attack variants from the sample pool.

        Each variant uses a random attack type + intensity combination and
        produces `samples_per_variant` synthetic images labelled as Fake (1).
        Also generates the same count of Real (0) originals for class balance.

        Returns a list of AttackVariant objects.
        """
        if not samples:
            logger.warning("⚠️  AttackGenerator: empty sample pool – skipping")
            return []

        # Select source images (cycle through buffer, pick random subset)
        pool = [s.image for s in samples if s.image is not None]
        if not pool:
            return []

        selected_attacks = random.sample(
            [(at, iv) for at in self._attack_types for iv in self.INTENSITY_LEVELS],
            k=min(max_variants, len(self._attack_types) * len(self.INTENSITY_LEVELS)),
        )

        variants: List[AttackVariant] = []

        for attack_type, intensity in selected_attacks:
            fn    = ATTACK_FUNCTIONS[attack_type]
            synth : List[Tuple[np.ndarray, int]] = []

            for _ in range(samples_per_variant):
                src = random.choice(pool)
                try:
                    fake_img = fn(src.copy(), intensity)
                    synth.append((fake_img, 1))  # Fake label
                    # Pair with an original as Real label
                    synth.append((random.choice(pool).copy(), 0))
                except Exception as exc:
                    logger.debug(f"Attack transform error ({attack_type}): {exc}")
                    continue

            if not synth:
                continue

            variant = AttackVariant(
                name=f"{attack_type}_i{int(intensity*100):03d}_{int(time.time())}",
                attack_type=attack_type,
                intensity=intensity,
                samples=synth,
                meta={"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
            )
            variants.append(variant)
            logger.debug(
                f"🔧 Variant generated  type={attack_type}  intensity={intensity:.1f}  "
                f"samples={len(synth)}"
            )

        logger.info(f"⚔️  {len(variants)} attack variants generated from {len(samples)} buffer samples")
        return variants


# Singleton accessor
_gen: AttackGenerator | None = None
_gen_lock = __import__("threading").Lock()

def get_attack_generator() -> AttackGenerator:
    global _gen
    with _gen_lock:
        if _gen is None:
            _gen = AttackGenerator()
    return _gen
