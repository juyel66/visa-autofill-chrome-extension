import os
import threading
from typing import Any, List, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field
from rapidocr_onnxruntime import RapidOCR

# Ensure thread-safe singleton
_ocr_lock = threading.Lock()
_ocr_instance: Optional[RapidOCR] = None


class OCRBox(BaseModel):
    text: str
    confidence: float
    bbox: List[Any] = Field(default_factory=list)


# Apply ONNX Runtime and RapidOCR performance enhancements:
# 1. Enable ONNX Runtime CPU memory arena to prevent repeated OS malloc/free across layers & crops,
#    and allow short spinning to eliminate thread wake-up overhead.
try:
    from rapidocr_onnxruntime.utils.infer_engine import OrtInferSession
    _orig_init_sess_opts = OrtInferSession._init_sess_opts

    def _optimized_init_sess_opts(config):
        sess_opt = _orig_init_sess_opts(config)
        sess_opt.enable_cpu_mem_arena = True
        try:
            sess_opt.add_session_config_entry("session.intra_op.allow_spinning", "1")
        except Exception:
            pass
        return sess_opt

    OrtInferSession._init_sess_opts = staticmethod(_optimized_init_sess_opts)
except Exception as e:
    print(f"[ocr] Note: OrtInferSession patch skipped: {e}")


def get_ocr_instance() -> RapidOCR:
    """
    Lazy initialize RapidOCR singleton instance with optimized ONNX Runtime settings.
    Thread-safe initialization via double-checked locking.
    """
    global _ocr_instance
    if _ocr_instance is not None:
        return _ocr_instance

    with _ocr_lock:
        if _ocr_instance is not None:
            return _ocr_instance

        # Initialize RapidOCR with PP-OCRv4 ONNX models and single-item CRNN recognition batches
        # to avoid dynamic tensor padding latency on CPU.
        _ocr_instance = RapidOCR(
            det_limit_type="min",
            det_limit_side_len=800,
            rec_batch_num=1,
        )

        # Warm up both detection and recognition ONNX Runtime sessions with realistic dimensions
        # so subsequent user requests execute immediately without cold-allocation pauses
        try:
            dummy_det = np.zeros((1636, 1157, 3), dtype=np.uint8)
            _ocr_instance.text_det(dummy_det)
            dummy_rec = [np.zeros((48, 120 * i, 3), dtype=np.uint8) for i in range(1, 8)]
            _ocr_instance.text_rec(dummy_rec)
            print("[ocr] RapidOCR PP-OCRv4 ONNX Runtime singleton initialized & warmed up.")
        except Exception as e:
            print(f"[ocr] Warmup warning: {e}")

        return _ocr_instance


def run_ocr(
    image: np.ndarray,
    crops: Optional[List[Tuple[int, int, int, int]]] = None,
) -> List[OCRBox]:
    """
    Run RapidOCR on an image (RGB or BGR numpy array).
    Supports optional targeted crops: List of (y1, y2, x1, x2).
    Returns list of OCRBox containing text, confidence, and bounding box coordinates.
    """
    engine = get_ocr_instance()
    boxes: List[OCRBox] = []

    if crops:
        for y1, y2, x1, x2 in crops:
            crop_img = image[y1:y2, x1:x2]
            if crop_img.shape[0] < 5 or crop_img.shape[1] < 5:
                continue
            res, _ = engine(crop_img, use_cls=False)
            if not res:
                continue
            for b in res:
                text_clean = str(b[1]).strip()
                if not text_clean:
                    continue
                # Offset bounding box coordinates back to full image space
                coords = [[float(pt[0] + x1), float(pt[1] + y1)] for pt in b[0]]
                boxes.append(
                    OCRBox(
                        text=text_clean,
                        confidence=round(float(b[2]), 4),
                        bbox=coords,
                    )
                )

        # Sort combined boxes in reading order: top-to-bottom, left-to-right
        boxes.sort(
            key=lambda b: (
                min(p[1] for p in b.bbox) if b.bbox else 0,
                min(p[0] for p in b.bbox) if b.bbox else 0,
            )
        )
        return boxes

    # Full-page / single image path
    res, _ = engine(image, use_cls=False)
    if not res:
        return []

    for b in res:
        text_clean = str(b[1]).strip()
        if not text_clean:
            continue
        coords = [[float(pt[0]), float(pt[1])] for pt in b[0]]
        boxes.append(
            OCRBox(
                text=text_clean,
                confidence=round(float(b[2]), 4),
                bbox=coords,
            )
        )

    return boxes

