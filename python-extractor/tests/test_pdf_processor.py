import os
import pytest
import pymupdf
from app.pdf_processor import (
    inspect_pdf,
    render_page_to_image,
    score_page_text,
    ProcessedPDF,
)

FIXTURE_JOSODA = "../tests/fixtures/Josoda passport.pdf"
FIXTURE_KHOKON = "../tests/fixtures/Khokon WEB 27.pdf"


def test_score_page_text():
    assert score_page_text("PASSPORT PEOPLE'S REPUBLIC OF BANGLADESH") >= 20
    assert score_page_text("P<BGDRAY<<SHREE") >= 60
    assert score_page_text("RANDOM TEXT WITHOUT KEYWORDS") == 0


def test_inspect_scanned_pdf():
    path = FIXTURE_JOSODA if os.path.exists(FIXTURE_JOSODA) else "tests/fixtures/Josoda passport.pdf"
    doc, info = inspect_pdf(path)
    assert info.total_pages == 1
    assert len(info.pages) == 1
    assert info.selected_page_index == 0
    # Scanned PDF has no native text layer
    assert info.has_usable_text is False


def test_inspect_text_pdf():
    path = FIXTURE_KHOKON if os.path.exists(FIXTURE_KHOKON) else "tests/fixtures/Khokon WEB 27.pdf"
    doc, info = inspect_pdf(path)
    assert info.total_pages >= 1
    # Form PDF has native text layer
    assert info.has_usable_text is True


def test_render_page_to_image():
    path = FIXTURE_JOSODA if os.path.exists(FIXTURE_JOSODA) else "tests/fixtures/Josoda passport.pdf"
    doc, info = inspect_pdf(path)
    img = render_page_to_image(doc[0], dpi=100)
    assert img is not None
    assert len(img.shape) == 3
    assert img.shape[2] == 3  # 3 color channels


def test_malformed_pdf_handling():
    corrupted_bytes = b"%PDF-1.4 corrupted garbage content not a real pdf"
    with pytest.raises(Exception):
        inspect_pdf(corrupted_bytes)
