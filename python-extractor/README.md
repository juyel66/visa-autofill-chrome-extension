# Local Python Passport OCR Extractor

The Local Python Passport Extractor is a production-hardened microservice powering passport extraction and autofill for the **Visa Autofill Chrome Extension**. It combines high-speed native PDF parsing via **PyMuPDF**, local deep-learning OCR via **PaddleOCR**, and a deterministic **ICAO Doc 9303 TD3 MRZ parser** to deliver fast, secure, and private document processing entirely on local hardware.

---

## 1. System Architecture

The extractor serves as the primary extraction engine for passport documents:

```
PDF upload
  │
  ▼
Python FastAPI (http://127.0.0.1:8001/extract-passport)
  │
  ▼
PyMuPDF Text Extraction (fast-path inspection in <15ms)
  │
  ├── [If text layer sufficient] ──► Skip OCR (0s OCR duration)
  │
  └── [If scanned / image-only] ──► Thread-Safe PaddleOCR Singleton (PP-OCRv4 CPU)
                                            │
                                            ▼
                                  MRZ & OCR Fusion Engine
                                  (ICAO 9303 7-3-1 check digit verification)
                                            │
                                            ▼
                                  Extracted JSON & Diagnostics
                                            │
                                            ▼
Chrome Extension Client (SHA-256 in-flight dedupe, finite timeout & error handling)
  │
  ▼
SavedApplication Storage & Field Normalizer
  │
  ▼
Full-Page Application Workspace (autofill, field review & manual edit persistence)
```

### Architectural Highlights

1. **PDF Upload**: Handled via Chrome extension popup, dashboard, or documents view. The frontend enforces PDF-only validation for passport extraction.
2. **FastAPI Microservice**: Exposes `GET /health` and `POST /extract-passport` with CORS configured for Chrome extension origins.
3. **PyMuPDF Text Extraction**: Fast-path inspection detects whether a digital text layer exists. If core passport identity fields are present, extraction completes in <50ms without invoking OCR.
4. **Thread-Safe OCR Singleton**: When a scanned document requires raster OCR, PaddleOCR is executed on the prioritized passport identity page. The singleton is protected by a thread-safe initialization lock (`threading.Lock`) with double-checked locking, preventing race conditions between background warmup and incoming requests.
5. **MRZ / OCR Fusion**: Check digits for Document Number, Date of Birth, and Expiry Date are verified using ICAO 9303 weights (7-3-1). Verified MRZ takes deterministic precedence for identity particulars; visual text supplies address, place of issue, and issue date.
6. **Extracted JSON & Diagnostics**: Returns standardized schemas with field-level confidence, source tracking (`mrz`, `ocr`, `pdf_text`, `derived`), and truthful extraction diagnostics (`pdfTextFound`, `pdfTextChars`, `pageCount`, `ocrExecuted`, `ocrPageCount`, `extractionDurationMs`).
7. **Chrome Extension Integration**: `pythonExtractorClient.ts` performs content-based deduplication using SHA-256 hashes of the PDF payload. In-flight duplicate requests share the same promise without redundant network or CPU calls.
8. **SavedApplication & Workspace**: Extracted fields are mapped into `SavedApplication` and synced with the active applicant profile, maintaining user-edited values and enabling seamless visa portal autofill.

---

## 2. Directory Structure

```
python-extractor/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI service with /health, /extract-passport, and timeout safety
│   ├── extractor.py     # End-to-end extraction pipeline, fast-path, and CLI entrypoint
│   ├── pdf_processor.py # PyMuPDF inspection, page prioritization, and image rendering
│   ├── ocr.py           # Thread-safe PaddleOCR singleton wrapper with CPU oneDNN handlers
│   ├── mrz.py           # Deterministic ICAO Doc 9303 TD3 MRZ parser & check digit validator
│   └── schemas.py       # Pydantic schemas for structured extraction, field sources & diagnostics
├── tests/
│   ├── __init__.py
│   ├── test_api.py           # FastAPI endpoint tests (/health, /extract-passport)
│   ├── test_extractor.py     # End-to-end extraction and normalization tests
│   ├── test_mrz.py           # Check digit calculations and TD3 parsing tests
│   ├── test_pdf_processor.py # PDF inspection, rendering, and malformed file tests
│   └── test_schemas.py       # Schema validation and serialization tests
├── requirements.txt     # UTF-8 encoded dependency specifications
└── README.md            # Architecture and operational documentation
```

---

## 3. Setup and Installation

### Prerequisites
- Python 3.11 (Recommended: managed via `uv` or standard Python)
- Windows / macOS / Linux

### 1. Create Virtual Environment
Using `uv` (recommended):
```bash
cd python-extractor
uv venv .venv --python 3.11
```

Or using standard Python:
```bash
cd python-extractor
python -m venv .venv
```

### 2. Install Dependencies
Using `uv`:
```bash
uv pip install -r requirements.txt
```

Or using pip:
```bash
# Windows
.\.venv\Scripts\python -m pip install -r requirements.txt

# Linux / macOS
./.venv/bin/python -m pip install -r requirements.txt
```

---

## 4. Running the Service

### A. Automatic Auto-Start (Recommended)
From the extension root repository:
```bash
npm run dev
```
The unified development runner (`scripts/dev.mjs`):
1. Probes `http://127.0.0.1:8001/health`.
2. If already running, reuses the existing Python instance.
3. If not running, launches `python-extractor/.venv/Scripts/python.exe -m uvicorn app.main:app --port 8001 --host 127.0.0.1`.
4. Starts Vite dev server concurrently.
5. On shutdown (`Ctrl+C`), terminates the Python server only if it was started by the runner.

To run only the Python service via npm:
```bash
npm run dev:python
```

### B. Manual Server Start
```bash
cd python-extractor

# Windows
.\.venv\Scripts\python -m uvicorn app.main:app --port 8001 --host 127.0.0.1 --reload

# Linux / macOS
./.venv/bin/python -m uvicorn app.main:app --port 8001 --host 127.0.0.1 --reload
```

---

## 5. API Reference

### Health Check
- **Endpoint**: `GET /health`
- **Response**: `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

### Passport Extraction
- **Endpoint**: `POST /extract-passport`
- **Content-Type**: `multipart/form-data`
- **Parameters**: `file` (UploadFile, PDF only)
- **Response**: `200 OK`
  ```json
  {
    "personal": {
      "surname": "RAY",
      "givenName": "SHREE JOTIMOY",
      "fullName": "SHREE JOTIMOY RAY",
      "dateOfBirth": "1993-09-18",
      "gender": "male",
      "nationality": "BANGLADESH",
      "placeOfBirth": "THAKURGAON",
      "countryOfBirth": "",
      "nid": "8235626051"
    },
    "passport": {
      "number": "A21496961",
      "issueDate": "2026-01-20",
      "expiryDate": "2031-01-19",
      "issuePlace": "DIP/DHAKA",
      "issuingCountry": "BANGLADESH"
    },
    "address": {
      "line1": "KASHIPUR",
      "line2": "RANISANKAIL, MUZAHIDABAD COLONI",
      "city": "THAKURGAON",
      "district": "THAKURGAON",
      "postalCode": "5120",
      "country": "BANGLADESH"
    },
    "mrz": {
      "detected": true,
      "valid": true,
      "rawLines": [
        "PBGDRAY<<SHREE<JOTIMOY<<<<<<<<<<<<<<<<<<<<<<",
        "A214969610BGD9309186M31011938235626051<<<<48"
      ],
      "confidence": 0.95
    },
    "diagnostics": {
      "pdfTextFound": true,
      "pdfTextChars": 450,
      "pageCount": 1,
      "ocrExecuted": false,
      "ocrPageCount": 0,
      "extractionDurationMs": 42.5
    }
  }
  ```

### Timeout & Error Safety
- **Non-PDF Files**: Returns `400 Bad Request` with `"Invalid file format. Only PDF files are supported."`
- **Empty Files**: Returns `400 Bad Request` with `"Uploaded file is empty."`
- **Timeout**: Enforces a 120-second backend safety timeout returning `504 Gateway Timeout` with `"Passport extraction timed out after 120 seconds on server."`

---

## 6. Running Tests

### Python Test Suite
```bash
# Run all Python unit and API tests
.\.venv\Scripts\python -m pytest python-extractor/tests/test_schemas.py python-extractor/tests/test_mrz.py python-extractor/tests/test_pdf_processor.py python-extractor/tests/test_api.py -v
```

### TypeScript Client Tests
```bash
# Run TypeScript client and integration tests
npx tsx -r ./tests/setup.ts src/core/extraction/local/__tests__/pythonExtractorClient.test.ts
npm test
```
