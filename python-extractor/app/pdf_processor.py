from io import BytesIO
from typing import List, Optional, Tuple, Union
import numpy as np
import pymupdf
from pydantic import BaseModel, Field


class PDFPageInfo(BaseModel):
    page_number: int
    has_text: bool
    text: str = ""
    is_passport_candidate: bool = False
    priority_score: int = 0


class ProcessedPDF(BaseModel):
    total_pages: int
    pages: List[PDFPageInfo] = Field(default_factory=list)
    selected_page_index: int = 0
    has_usable_text: bool = False


PASSPORT_KEYWORDS = [
    "PASSPORT",
    "P<",
    "SURNAME",
    "GIVEN NAME",
    "NATIONALITY",
    "DATE OF BIRTH",
    "PLACE OF BIRTH",
    "DATE OF EXPIRY",
    "DATE OF ISSUE",
    "REPUBLIC",
    "PERSONAL NO",
    "BANGLADESH",
]


def score_page_text(text: str) -> int:
    """Calculate priority score for a page based on passport keywords."""
    upper = text.upper()
    score = 0
    for kw in PASSPORT_KEYWORDS:
        if kw in upper:
            score += 10
    if "P<" in upper:
        score += 50
    return score


def inspect_pdf(pdf_source: Union[str, bytes]) -> Tuple[pymupdf.Document, ProcessedPDF]:
    """
    Open PDF from file path or bytes, inspect pages for text and prioritize identity pages.
    """
    if isinstance(pdf_source, (str, bytes)) and isinstance(pdf_source, str):
        doc = pymupdf.open(pdf_source)
    else:
        doc = pymupdf.open(stream=pdf_source, filetype="pdf")

    processed = ProcessedPDF(total_pages=len(doc))
    best_score = -1
    best_page = 0
    any_usable_text = False

    for idx, page in enumerate(doc):
        text = page.get_text() or ""
        clean_text = text.strip()
        has_text = len(clean_text) >= 40
        if has_text:
            any_usable_text = True
            
        score = score_page_text(clean_text)
        
        # If no text, check image presence
        if not has_text:
            images = page.get_images()
            if images:
                # Scanned passport pages usually have large images
                score += 5

        # First page has natural preference if scores tie
        if idx == 0:
            score += 1

        is_candidate = score > 0
        if score > best_score:
            best_score = score
            best_page = idx

        processed.pages.append(
            PDFPageInfo(
                page_number=idx,
                has_text=has_text,
                text=clean_text,
                is_passport_candidate=is_candidate,
                priority_score=score,
            )
        )

    processed.selected_page_index = best_page
    processed.has_usable_text = any_usable_text
    return doc, processed


def render_page_to_image(page: pymupdf.Page, dpi: int = 200) -> np.ndarray:
    """
    Render a PyMuPDF page to a numpy RGB/BGR array for OCR processing.
    """
    pix = page.get_pixmap(dpi=dpi)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
    
    # If 4-channel RGBA, convert to 3-channel RGB
    if pix.n == 4:
        import cv2
        return cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    elif pix.n == 3:
        import cv2
        return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif pix.n == 1:
        import cv2
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    
    return img
