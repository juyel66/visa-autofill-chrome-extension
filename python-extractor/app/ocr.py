import os
from typing import Any, List, Optional
import numpy as np
from pydantic import BaseModel, Field

# Ensure Paddle and PaddleX don't check network or trigger oneDNN crash on Windows CPU
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_use_onednn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"


class OCRBox(BaseModel):
    text: str
    confidence: float
    bbox: List[Any] = Field(default_factory=list)


_ocr_instance = None


def get_ocr_instance():
    """Lazy initialize PaddleOCR instance with safe CPU settings."""
    global _ocr_instance
    if _ocr_instance is not None:
        return _ocr_instance

    import paddle.inference as pi

    # Patch create_predictor to safely disable oneDNN on CPU
    orig_create_predictor = pi.create_predictor

    def safe_create_predictor(config):
        if hasattr(config, "disable_onednn"):
            config.disable_onednn()
        if hasattr(config, "disable_mkldnn"):
            config.disable_mkldnn()
        if hasattr(config, "enable_new_ir"):
            config.enable_new_ir(False)
        return orig_create_predictor(config)

    pi.create_predictor = safe_create_predictor

    from paddleocr import PaddleOCR

    # Using PP-OCRv4 mobile models which are fast, accurate, and stable on local CPU
    _ocr_instance = PaddleOCR(
        ocr_version="PP-OCRv4",
        lang="en",
        use_doc_unwarping=False,
        use_doc_orientation_classify=False,
        use_textline_orientation=False,
    )
    return _ocr_instance


def run_ocr(image: np.ndarray) -> List[OCRBox]:
    """
    Run PaddleOCR on an image (RGB or BGR numpy array).
    Returns list of OCRBox containing text, confidence, and bounding box coordinates.
    """
    ocr = get_ocr_instance()
    results = list(ocr.predict(image))
    
    if not results:
        return []
    
    data = results[0]
    boxes: List[OCRBox] = []
    
    rec_texts = data.get("rec_texts", [])
    rec_scores = data.get("rec_scores", [])
    rec_boxes = data.get("rec_boxes", [])
    
    for text, score, box in zip(rec_texts, rec_scores, rec_boxes):
        text_clean = str(text).strip()
        if not text_clean:
            continue
        # Convert numpy box coordinates to python floats
        coords = []
        if hasattr(box, "tolist"):
            coords = box.tolist()
        elif isinstance(box, (list, tuple)):
            coords = [list(pt) if isinstance(pt, (list, tuple)) else pt for pt in box]
            
        boxes.append(
            OCRBox(
                text=text_clean,
                confidence=round(float(score), 4),
                bbox=coords,
            )
        )
        
    return boxes
