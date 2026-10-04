import asyncio
from contextlib import asynccontextmanager
import time
import traceback
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pymupdf

from .extractor import extract_passport
from .ocr import get_ocr_instance
from .schemas import PassportExtractionResult


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warmup OCR model singleton in background thread so /health is immediately responsive (Phase 7)
    asyncio.create_task(asyncio.to_thread(get_ocr_instance))
    yield


app = FastAPI(
    title="Local Passport OCR Extractor",
    description="Stand-alone local passport extraction service using PyMuPDF and PaddleOCR",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS safely for local extension development
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)


@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(request, exc: ResponseValidationError):
    tb = traceback.format_exc()
    print(f"[main] !!! ResponseValidationError on {request.url}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Response schema validation error: {str(exc)}"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    tb = traceback.format_exc()
    print(f"[main] !!! Unhandled exception on {request.url}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/extract-passport", response_model=PassportExtractionResult)
async def extract_passport_endpoint(file: UploadFile = File(...)):
    """
    Accept PDF upload and return structured passport extraction JSON.
    Fast text-layer extraction via PyMuPDF is checked first; OCR is only invoked
    when the text layer is insufficient.
    """
    t_req_start = time.time()
    print(f"\n[main] >>> Request received: POST /extract-passport (filename: {file.filename})")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF files are supported.",
        )

    t_read_start = time.time()
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file content: {e}")
    t_read_dur = (time.time() - t_read_start) * 1000

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    print(f"[main] PDF read: {len(content)} bytes in {t_read_dur:.2f} ms")

    try:
        # Finite 120-second safe timeout ensures backend never hangs indefinitely while accommodating CPU OCR.
        t_extract_start = time.time()
        result = await asyncio.wait_for(
            asyncio.to_thread(extract_passport, content),
            timeout=180.0,
        )
        t_extract_dur = (time.time() - t_extract_start) * 1000
        t_total = (time.time() - t_req_start) * 1000

        print(
            f"[main] <<< Extraction completed: backend processing={result.processingTimeMs:.2f} ms, "
            f"thread duration={t_extract_dur:.2f} ms, total request time={t_total:.2f} ms"
        )
        return result
    except asyncio.TimeoutError:
        t_timeout = (time.time() - t_req_start) * 1000
        print(f"[main] !!! Extraction timed out after {t_timeout:.2f} ms for {file.filename}")
        raise HTTPException(
            status_code=504,
            detail="Passport extraction timed out after 120 seconds on server.",
        )
    except HTTPException:
        raise
    except pymupdf.FileDataError as e:
        t_err = (time.time() - t_req_start) * 1000
        print(f"[main] !!! PDF data error after {t_err:.2f} ms: {e}")
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF file is damaged, invalid, or encrypted. Please provide a standard passport PDF.",
        )
    except Exception as e:
        t_err = (time.time() - t_req_start) * 1000
        tb = traceback.format_exc()
        print(f"[main] !!! Extraction failed after {t_err:.2f} ms: {e}\n{tb}")
        raise HTTPException(
            status_code=500,
            detail=f"Passport extraction failed: {str(e)}",
        )

