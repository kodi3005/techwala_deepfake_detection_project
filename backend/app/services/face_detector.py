"""
face_detector.py  –  OpenCV DNN face detector (works with OpenCV 4 & 5)
Uses a lightweight Caffe SSD model bundled with OpenCV's data samples.
Falls back to full-image crop if no faces are found.
"""
import cv2
import logging
import numpy as np
from typing import List, Tuple

logger = logging.getLogger("uvicorn.error")


def _build_detector() -> "cv2.FaceDetectorYN | None":
    """Try to load OpenCV's YuNet face detector."""
    import urllib.request, pathlib, tempfile

    # Download from OpenCV Zoo
    YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

    tmpdir = pathlib.Path(tempfile.gettempdir()) / "deepguard_face_model"
    tmpdir.mkdir(exist_ok=True)
    model_path = tmpdir / "face_detection_yunet_2023mar.onnx"

    try:
        if not model_path.exists():
            logger.info("Downloading YuNet face detector model (100 KB)…")
            urllib.request.urlretrieve(YUNET_URL, model_path)
        # Create with a default size, will update size dynamically
        detector = cv2.FaceDetectorYN.create(
            model=str(model_path),
            config="",
            input_size=(320, 240)
        )
        logger.info("YuNet face detector loaded successfully")
        return detector
    except Exception as exc:
        logger.warning(f"Could not load YuNet face model: {exc}. Using full-image fallback.")
        return None


_detector = _build_detector()


def detect_faces(
    bgr_img: np.ndarray,
    confidence_threshold: float = 0.5,
) -> Tuple[List[Tuple[int, int, int, int]], List[np.ndarray]]:
    """
    Detect faces using YuNet or fall back to full image.

    Returns:
        boxes  – list of (x, y, w, h) tuples
        crops  – list of cropped face BGR images
    """
    h, w = bgr_img.shape[:2]

    if _detector is None or h <= 0 or w <= 0:
        # Fallback: treat whole image as one "face"
        return [(0, 0, w, h)], [bgr_img]

    try:
        # Update detector settings dynamically
        _detector.setInputSize((w, h))
        _detector.setScoreThreshold(confidence_threshold)
        retval, faces = _detector.detect(bgr_img)
    except Exception as exc:
        logger.warning(f"YuNet face detection failed: {exc}. Using full-image fallback.")
        return [(0, 0, w, h)], [bgr_img]

    if faces is None or len(faces) == 0:
        # No faces found – use full image
        return [(0, 0, w, h)], [bgr_img]

    boxes: List[Tuple[int, int, int, int]] = []
    crops: List[np.ndarray]               = []

    for face in faces:
        # face contains [x1, y1, w, h, ...]
        fx, fy, fw, fh = map(int, face[0:4])

        x1 = max(0, fx)
        y1 = max(0, fy)
        x2 = min(w, fx + fw)
        y2 = min(h, fy + fh)

        if x2 <= x1 or y2 <= y1:
            continue

        # 20% padding
        pad_x = int((x2 - x1) * 0.2)
        pad_y = int((y2 - y1) * 0.2)
        px1 = max(0, x1 - pad_x)
        py1 = max(0, y1 - pad_y)
        px2 = min(w, x2 + pad_x)
        py2 = min(h, y2 + pad_y)

        boxes.append((px1, py1, px2 - px1, py2 - py1))
        crops.append(bgr_img[py1:py2, px1:px2])

    if not boxes:
        return [(0, 0, w, h)], [bgr_img]

    return boxes, crops

