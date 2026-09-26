from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from .extractor import extract_passport
from .schemas import PassportExtractionResult

app = FastAPI(
    title="Local Passport OCR Extractor",
    description="Stand-alone local passport extraction service using PyMuPDF and PaddleOCR",
    version="1.0.0",
)

# Enable CORS safely for local extension development
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/extract-passport", response_model=PassportExtractionResult)
async def extract_passport_endpoint(file: UploadFile = File(...)):
    """
    Accept PDF upload and return structured passport extraction JSON.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF files are supported.",
        )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = extract_passport(content)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Passport extraction failed: {str(e)}",
        )
