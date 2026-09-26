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


def test_clean_person_name_and_garbage_rejection():
    from app.extractor import clean_person_name

    # Obvious alphanumeric OCR garbage tokens rejected
    assert clean_person_name("G70E") == ""
    assert clean_person_name("G7OE") == ""
    assert clean_person_name("70E") == ""
    assert clean_person_name("O7E") == ""
    assert clean_person_name("410G7A") == ""
    assert clean_person_name("3AN933") == ""
    assert clean_person_name("D05") == ""

    # Embedded garbage tokens filtered out of person name
    assert clean_person_name("SHREE G70E JOTIMOY") == "SHREE JOTIMOY"
    assert clean_person_name("SHREE 410G7A JOTIMOY") == "SHREE JOTIMOY"
    assert clean_person_name("SHREE 70E JOTIMOY") == "SHREE JOTIMOY"

    # MRZ filler conversion and whitespace normalization
    assert clean_person_name("SHREE<JOTIMOY") == "SHREE JOTIMOY"
    assert clean_person_name("SHREE<<JOTIMOY") == "SHREE JOTIMOY"
    assert clean_person_name("SHREE   JOTIMOY") == "SHREE JOTIMOY"


def test_name_shapes():
    from app.extractor import clean_person_name
    from app.mrz import parse_td3_mrz

    # Case A: Visual clean
    # Surname = RAY, Given = SHREE JOTIMOY
    assert clean_person_name("RAY") == "RAY"
    assert clean_person_name("SHREE JOTIMOY") == "SHREE JOTIMOY"

    # Case B: MRZ SHREE<JOTIMOY
    mrz_res = parse_td3_mrz(
        "PBGDRAY<<SHREE<JOTIMOY<<<<<<<<<<<<<<<<<<<<<<",
        "A214969610BGD9309186M3101193823562605148<<<"
    )
    assert mrz_res.surname == "RAY"
    assert mrz_res.given_names == "SHREE JOTIMOY"

    # Case C: OCR contains SHREE G70E JOTIMOY, but MRZ contains SHREE<JOTIMOY
    cleaned_ocr = clean_person_name("SHREE G70E JOTIMOY")
    assert cleaned_ocr == "SHREE JOTIMOY"
    assert mrz_res.given_names == "SHREE JOTIMOY"

    # Case D: Single given name preserved exactly after normalization
    assert clean_person_name("JOTIMOY") == "JOTIMOY"
    mrz_single = parse_td3_mrz(
        "PBGDRAY<<JOTIMOY<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
        "A214969610BGD9309186M3101193823562605148<<<"
    )
    assert mrz_single.given_names == "JOTIMOY"

    # Case E: Multiple given names preserved with single spaces
    assert clean_person_name("MOHAMMAD ABDUL KARIM") == "MOHAMMAD ABDUL KARIM"
    mrz_multi = parse_td3_mrz(
        "PBGDAHMED<<MOHAMMAD<ABDUL<KARIM<<<<<<<<<<<<<",
        "A214969610BGD9309186M3101193823562605148<<<"
    )
    assert mrz_multi.given_names == "MOHAMMAD ABDUL KARIM"


def test_phone_number_extraction_variations():
    from app.extractor import normalize_phone_number

    # Phone with +880
    assert normalize_phone_number("+8801744777846") == "+8801744777846"
    assert normalize_phone_number("Mobile No: +8801744777846") == "+8801744777846"
    assert normalize_phone_number("Telephone: +8801744777846") == "+8801744777846"

    # Phone with spaces
    assert normalize_phone_number("+880 1744 777846") == "+8801744777846"
    assert normalize_phone_number("01744 777 846") == "01744777846"

    # Phone with hyphens
    assert normalize_phone_number("+880-1744-777846") == "+8801744777846"
    assert normalize_phone_number("01744-777846") == "01744777846"

    # Phone without country code
    assert normalize_phone_number("01744777846") == "01744777846"
    assert normalize_phone_number("Tel: 01744777846") == "01744777846"

    # Missing / Invalid phone
    assert normalize_phone_number("") == ""
    assert normalize_phone_number("NO PHONE") == ""
    assert normalize_phone_number("Permanent Address") == ""

    # Reject 10-digit NID
    assert normalize_phone_number("8235626051") == ""


def test_passport_date_labels_and_validation():
    from app.extractor import normalize_date

    # Issue Date formats
    assert normalize_date("20 JAN 2026") == "2026-01-20"
    assert normalize_date("20/01/2026") == "2026-01-20"
    assert normalize_date("20-01-2026") == "2026-01-20"

    # Expiry Date formats
    assert normalize_date("19 JAN 2031") == "2031-01-19"
    assert normalize_date("19/01/2031") == "2031-01-19"

    # Strict Validation: expiryDate > issueDate
    issue = normalize_date("2026-01-20")
    expiry = normalize_date("2031-01-19")
    assert expiry > issue

