# Local Python Passport OCR Proof of Concept

This service is an isolated, standalone proof-of-concept for extracting structured passport information locally using **PyMuPDF**, **PaddleOCR**, and a deterministic **ICAO Doc 9303 TD3 MRZ parser**.

> **Note**: This is an isolated experiment on branch `experiment/python-local-ocr`. It does not modify, replace, or integrate with existing Gemini extraction pipelines, SavedApplication, or React/Chrome Extension components.

---

## 1. Features

- **100% Local Processing**: No Gemini, OpenAI, or external cloud AI APIs.
- **Smart PDF Inspection**: Uses PyMuPDF (`fitz`) to detect text layers, prioritize passport identity pages, and render high-resolution raster images for OCR.
- **Robust Local OCR**: PaddleOCR (PP-OCRv4 mobile models) running locally on CPU with oneDNN and PIR safety handlers for Windows compatibility.
- **Deterministic TD3 MRZ Engine**:
  - Full support for 2-line, 44-character passport MRZ (ICAO Doc 9303).
  - 7-3-1 weight check-digit verification for Document Number, Date of Birth, and Expiry Date.
  - OCR fault tolerance (normalizes `<` substitutions, recovers missing delimiters, cleans character confusions).
- **Deterministic Field Precedence**:
  - Validated MRZ provides high-trust values for Document Number, Nationality, DOB, Gender, Expiry Date, and NID.
  - Visual OCR extracts Place of Birth, Date of Issue, Issuing Authority/Place, and Permanent Address components.
  - When MRZ is unavailable or invalid, visual OCR serves as the fallback.
  - Strict compliance: Empty string `""` for unextracted fields; never invents missing data.
- **Dual Interface**:
  - **CLI**: Direct command-line extraction with execution time and confidence reporting.
  - **FastAPI**: Microservice providing `GET /health` and `POST /extract-passport`.

---

## 2. Directory Structure

```
python-extractor/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI service with /health and /extract-passport
│   ├── extractor.py     # End-to-end extraction pipeline and CLI entrypoint
│   ├── pdf_processor.py # PyMuPDF text check, page scoring, and raster rendering
│   ├── ocr.py           # PaddleOCR wrapper with CPU safety patches
│   ├── mrz.py           # Deterministic TD3 MRZ parser and check digit validator
│   └── schemas.py       # Pydantic schemas for structured extraction & field sources
├── tests/
│   ├── __init__.py
│   ├── test_api.py           # FastAPI endpoint tests
│   ├── test_extractor.py     # Normalization and end-to-end extraction tests
│   ├── test_mrz.py           # Check digit calculations and TD3 parsing tests
│   ├── test_pdf_processor.py # PDF inspection, rendering, and malformed file tests
│   └── test_schemas.py       # Pydantic schema default value and serialization tests
├── requirements.txt     # Locked dependencies
└── README.md            # Documentation and accuracy report
```

---

## 3. Setup and Installation

### Prerequisites
- Python 3.10 or 3.11 (Managed automatically via `uv`)

### Environment Initialization
```bash
cd python-extractor
uv venv .venv --python 3.11
```

### Install Dependencies
```bash
.\.venv\Scripts\python -m pip install -r requirements.txt
```

---

## 4. Usage

### Command-Line Interface (CLI)
Run extraction on a passport PDF:
```bash
cd python-extractor
.\.venv\Scripts\python -m app.extractor "../tests/fixtures/Josoda passport.pdf"
```

For JSON output:
```bash
.\.venv\Scripts\python -m app.extractor "../tests/fixtures/Josoda passport.pdf" --json
```

### FastAPI Microservice
Start the local server on port 8001:
```bash
cd python-extractor
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8001
```

#### Endpoints:
- `GET /health`
  ```bash
  curl http://127.0.0.1:8001/health
  # Response: {"status": "ok"}
  ```

- `POST /extract-passport`
  ```bash
  curl -X POST "http://127.0.0.1:8001/extract-passport" \
       -H "accept: application/json" \
       -H "Content-Type: multipart/form-data" \
       -F "file=@../tests/fixtures/Josoda passport.pdf"
  ```

---

## 5. Running the Test Suite

Run all unit and integration tests with `pytest`:
```bash
cd python-extractor
.\.venv\Scripts\pytest -v
```

All 24 tests cover:
- PDF page inspection & scoring
- Text layer detection vs scanned image detection
- Malformed PDF error handling
- ICAO 9303 7-3-1 check digit validation
- TD3 MRZ parsing with valid and invalid check digits
- Date parsing & century resolution
- Pydantic schema default values (`""` for missing fields)
- FastAPI `/health` and `/extract-passport` validation
- Full end-to-end extraction against real passport fixture

---

## 6. Real Passport Benchmark Result (`tests/fixtures/Josoda passport.pdf`)

| Field | Extracted Value | Source | Confidence | Status |
|---|---|---|---|---|
| **Surname** | `RAY` | OCR / MRZ | 1.00 | Exact Match |
| **Given Name** | `SHREEJOTIMOY` | OCR / MRZ | 1.00 | Exact Match |
| **Date of Birth** | `1993-09-18` | MRZ | 0.95 | Exact Match |
| **Gender** | `male` | MRZ | 0.95 | Exact Match |
| **Nationality** | `BANGLADESHI` | OCR | 1.00 | Exact Match |
| **Place of Birth** | `THAKURGAON` | OCR | 1.00 | Exact Match |
| **Country of Birth** | `""` | None | - | Correct (Omitted) |
| **NID / Personal No** | `8235626051` | OCR / MRZ | 1.00 | Exact Match (10-digit smart NID) |
| **Passport Number** | `A21496961` | MRZ | 0.95 | Exact Match |
| **Issue Date** | `2026-01-20` | OCR | 0.99 | Exact Match |
| **Expiry Date** | `2031-01-19` | MRZ | 0.95 | Exact Match |
| **Issue Place** | `DIP/DHAKA` | OCR | 0.99 | Exact Match |
| **Issuing Country** | `BGD` | MRZ | 0.95 | Exact Match |
| **MRZ Status** | `detected: true`, `valid: true` | MRZ | 0.95 | Verified (All check digits pass) |
| **Address** | Line 1: `KASHIPUR`, District: `THAKURGAON`, Postal Code: `5120` | OCR | 0.96 | Structured Address |
