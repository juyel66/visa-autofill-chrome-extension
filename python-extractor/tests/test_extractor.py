import os
import pytest
from app.extractor import (
    extract_passport,
    normalize_date,
    normalize_gender,
    parse_address_components,
)

FIXTURE_JOSODA = "../tests/fixtures/Josoda passport.pdf"


def test_normalize_date():
    assert normalize_date("18SEP1993") == "1993-09-18"
    assert normalize_date("20 JAN 2026") == "2026-01-20"
    assert normalize_date("2026-01-20") == "2026-01-20"
    assert normalize_date("19/01/2031") == "2031-01-19"
    assert normalize_date("invalid") == ""


def test_normalize_gender():
    assert normalize_gender("M") == "male"
    assert normalize_gender("male") == "male"
    assert normalize_gender("F") == "female"
    assert normalize_gender("female") == "female"
    assert normalize_gender("X") == ""


def test_parse_address_components():
    raw = "KASHIPUR, RANISANKAIL, MUZAHIDABAD COLONI, 5120, THAKURGAON"
    addr = parse_address_components(raw)
    assert addr.postalCode == "5120"
    assert addr.district == "THAKURGAON"
    assert addr.city == "THAKURGAON"
    assert "KASHIPUR" in addr.line1


def test_end_to_end_passport_extraction():
    path = FIXTURE_JOSODA if os.path.exists(FIXTURE_JOSODA) else "tests/fixtures/Josoda passport.pdf"
    if not os.path.exists(path):
        pytest.skip("Passport fixture not found")

    res = extract_passport(path)

    # 1. Personal Data
    assert res.personal.surname == "RAY"
    assert res.personal.givenName == "SHREE JOTIMOY"
    assert res.personal.fullName == "SHREE JOTIMOY RAY"
    assert res.personal.dateOfBirth == "1993-09-18"
    assert res.personal.gender == "male"
    assert res.personal.nationality == "BANGLADESHI"
    assert res.personal.placeOfBirth == "THAKURGAON"
    assert res.personal.countryOfBirth == ""  # Never auto-filled
    assert res.personal.nid == "8235626051"

    # 2. Passport Data
    assert res.passport.number == "A21496961"
    assert res.passport.issueDate == "2026-01-20"
    assert res.passport.expiryDate == "2031-01-19"
    assert res.passport.issuePlace == "DIP/DHAKA"
    assert res.passport.issuingCountry == "BGD"
    assert res.passport.previousPassport.number == "BK0965579"

    # 3. MRZ Data
    assert res.mrz.detected is True
    assert res.mrz.valid is True
    assert res.mrz.confidence >= 0.85
    assert len(res.mrz.rawLines) == 2

    # 4. Address & Contact Data
    assert res.address.postalCode == "5120"
    assert res.address.district == "THAKURGAON"
    assert "KASHIPUR" in res.address.line1
    assert res.address.phone == "+8801744777846"

    # 5. Family Data
    assert res.family.father.name == "SHREE KHIDAR MOHAN"
    assert res.family.mother.name == "PANCHAMI RANI"
    assert res.family.spouse.name == "JASHODA RANI"

    # 6. Field Sources Tracking
    assert "personal.dateOfBirth" in res.fieldSources
    assert res.fieldSources["personal.dateOfBirth"].source == "mrz"
    assert "passport.issueDate" in res.fieldSources
    assert res.fieldSources["passport.issueDate"].source == "ocr"
