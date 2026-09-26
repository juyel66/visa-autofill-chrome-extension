import io
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
FIXTURE_JOSODA = "../tests/fixtures/Josoda passport.pdf"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_extract_passport_invalid_extension():
    response = client.post(
        "/extract-passport",
        files={"file": ("test.png", b"fake png bytes", "image/png")},
    )
    assert response.status_code == 400
    assert "Only PDF files are supported" in response.json()["detail"]


def test_extract_passport_empty_file():
    response = client.post(
        "/extract-passport",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400
    assert "Uploaded file is empty" in response.json()["detail"]


def test_extract_passport_endpoint_valid():
    path = FIXTURE_JOSODA if os.path.exists(FIXTURE_JOSODA) else "tests/fixtures/Josoda passport.pdf"
    if not os.path.exists(path):
        pytest.skip("Test fixture not found")

    with open(path, "rb") as f:
        pdf_bytes = f.read()

    response = client.post(
        "/extract-passport",
        files={"file": ("passport.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "personal" in data
    assert "passport" in data
    assert "mrz" in data
    assert data["mrz"]["detected"] is True
    assert data["mrz"]["valid"] is True
    assert data["passport"]["number"] == "A21496961"
    assert data["personal"]["surname"] == "RAY"
