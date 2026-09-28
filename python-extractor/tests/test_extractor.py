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
    assert res.fieldSources["passport.issueDate"].source in ("ocr", "ocr_spatial")


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


def test_task120_case_a_structured_labeled_address():
    raw = "VILL: KASHIPUR, PO: RANISANKAIL, DIST: THAKURGAON, PIN: 5120"
    addr = parse_address_components(raw)
    assert "KASHIPUR" in addr.line1
    assert "RANISANKAIL" in addr.line2
    assert addr.district == "THAKURGAON"
    assert addr.city == "THAKURGAON"
    assert addr.postalCode == "5120"


def test_task120_case_b_address_split_across_multiple_ocr_boxes():
    from app.extractor import extract_address_blocks_from_boxes

    boxes = [
        ([[100, 200], [250, 200], [250, 220], [100, 220]], ("Present Address:", 0.98)),
        ([[100, 230], [200, 230], [200, 250], [100, 250]], ("KASHIPUR", 0.95)),
        ([[100, 260], [220, 260], [220, 280], [100, 280]], ("RANISANKAIL", 0.96)),
        ([[100, 290], [320, 290], [320, 310], [100, 310]], ("MUZAHIDABAD COLONI", 0.94)),
        ([[100, 320], [230, 320], [230, 340], [100, 340]], ("THAKURGAON", 0.99)),
        ([[100, 350], [160, 350], [160, 370], [100, 370]], ("5120", 0.99)),
    ]
    blocks = extract_address_blocks_from_boxes(boxes)
    assert "present" in blocks
    lines, conf = blocks["present"]
    addr = parse_address_components(lines)
    assert "KASHIPUR" in addr.line1
    assert "RANISANKAIL" in addr.line2
    assert "MUZAHIDABAD COLONI" in addr.line2
    assert addr.district == "THAKURGAON"
    assert addr.city == "THAKURGAON"
    assert addr.postalCode == "5120"


def test_task120_case_c_address_with_zip_code():
    raw = "HOUSE 10, ROAD 4, DHANMONDI, DHAKA, 1205"
    addr = parse_address_components(raw)
    assert addr.postalCode == "1205"
    assert addr.district == "DHAKA"
    assert "HOUSE 10" in addr.line1


def test_task120_case_d_address_with_phone_880():
    from app.extractor import normalize_phone_number

    raw_addr = "KASHIPUR, RANISANKAIL, THAKURGAON, 5120, Mobile: +8801744777846"
    addr = parse_address_components(raw_addr)
    # Phone stripped from address lines
    assert "+880" not in addr.line1
    assert "+880" not in addr.line2
    assert addr.postalCode == "5120"
    assert addr.district == "THAKURGAON"
    # Extracted phone is valid
    assert normalize_phone_number("+8801744777846") == "+8801744777846"


def test_task120_case_e_no_explicit_permanent_address_fallback():
    from app.extractor import extract_address_blocks_from_boxes

    boxes = [
        ([[100, 200], [250, 200], [250, 220], [100, 220]], ("Present Address:", 0.98)),
        ([[100, 230], [200, 230], [200, 250], [100, 250]], ("KASHIPUR", 0.95)),
        ([[100, 260], [220, 260], [220, 280], [100, 280]], ("THAKURGAON 5120", 0.96)),
    ]
    blocks = extract_address_blocks_from_boxes(boxes)
    assert "present" in blocks
    assert "permanent" not in blocks  # No explicit permanent in document


def test_task120_case_f_explicit_separate_permanent_address():
    from app.extractor import extract_address_blocks_from_boxes

    boxes = [
        # Present Address block
        ([[100, 200], [250, 200], [250, 220], [100, 220]], ("Present Address:", 0.98)),
        ([[100, 230], [200, 230], [200, 250], [100, 250]], ("DANDAPAL MAREA", 0.95)),
        ([[100, 260], [220, 260], [220, 280], [100, 280]], ("PANCHAGARH 5020", 0.96)),
        # Permanent Address block
        ([[100, 400], [250, 400], [250, 420], [100, 420]], ("Permanent Address:", 0.98)),
        ([[100, 430], [200, 430], [200, 450], [100, 450]], ("SONDHANI PARA", 0.95)),
        ([[100, 460], [220, 460], [220, 480], [100, 480]], ("KALIGANJ, PANCHAGARH 5020", 0.96)),
    ]
    blocks = extract_address_blocks_from_boxes(boxes)
    assert "present" in blocks
    assert "permanent" in blocks
    addr_pres = parse_address_components(blocks["present"][0])
    addr_perm = parse_address_components(blocks["permanent"][0])
    assert "DANDAPAL" in addr_pres.line1
    assert "SONDHANI" in addr_perm.line1
    assert addr_pres.line1 != addr_perm.line1


def test_task120_case_g_no_postal_code():
    raw = "VILL: KASHIPUR, THAKURGAON, BANGLADESH"
    addr = parse_address_components(raw)
    assert addr.postalCode == ""
    assert addr.district == "THAKURGAON"


def test_task120_case_h_foreign_address():
    raw = "450 5TH AVE, NEW YORK, NY 10018, USA"
    addr = parse_address_components(raw, is_bangladeshi=False)
    assert addr.country == "USA"
    assert addr.postalCode == "10018"
    assert addr.country != "BANGLADESH"


def test_task120_case_i_unrelated_4digit_number_not_postal_code():
    # Year in date context e.g. 1993, 2026 should not be postal code
    raw_with_dob = "DATE OF BIRTH: 18 SEP 1993"
    addr = parse_address_components(raw_with_dob)
    assert addr.postalCode == ""

    raw_with_issue = "ISSUED ON 20 JAN 2026 AT DHAKA"
    addr2 = parse_address_components(raw_with_issue)
    assert addr2.postalCode == ""


# ============================================================================
# TASK 121: 25-CASE TEST MATRIX (PYTHON SUITE)
# ============================================================================

def test_task121_test1_date_of_issue_inline():
    from app.extractor import extract_date_of_issue
    val, src = extract_date_of_issue(text_content="Passport Details\nDate of Issue: 20/01/2026\nDate of Expiry: 19/01/2031", known_expiry="2031-01-19")
    assert val == "2026-01-20"
    assert src.source == "passport_text"
    assert src.hasConflict is False


def test_task121_test2_date_of_issue_multiline():
    from app.extractor import extract_date_of_issue
    text = "Date of Issue ( dd/mm/yyyy )\n20/01/2026\nDate of Expiry ( dd/mm/yyyy )\n19/01/2031"
    val, src = extract_date_of_issue(text_content=text, known_expiry="2031-01-19")
    assert val == "2026-01-20"
    assert src.source == "passport_text"


def test_task121_test3_date_of_issue_separate_ocr_boxes():
    from app.extractor import extract_date_of_issue
    # Label at [614, 1498, 829, 1519], date below at [624, 1524, 752, 1541]
    boxes = [
        ([[614, 1498], [829, 1498], [829, 1519], [614, 1519]], ("Date of Issue", 0.95)),
        ([[624, 1524], [752, 1524], [752, 1541], [624, 1541]], ("20/01/2026", 0.98)),
        ([[616, 1548], [890, 1548], [890, 1565], [616, 1565]], ("Date of Expiry", 0.95)),
        ([[624, 1571], [754, 1571], [754, 1591], [624, 1591]], ("19/01/2031", 0.98)),
    ]
    val, src = extract_date_of_issue(ocr_boxes=boxes, known_expiry="2031-01-19")
    assert val == "2026-01-20"
    assert src.source == "ocr_spatial"


def test_task121_test4_issue_date_near_expiry_date():
    from app.extractor import extract_date_of_issue
    # Candidate date should not mistakenly take expiry date
    boxes = [
        ([[100, 100], [200, 100], [200, 120], [100, 120]], ("Date of Issue", 0.95)),
        ([[220, 100], [320, 100], [320, 120], [220, 120]], ("20/01/2026", 0.99)),
        ([[100, 130], [200, 130], [200, 150], [100, 150]], ("Date of Expiry", 0.95)),
        ([[220, 130], [320, 130], [320, 150], [220, 150]], ("19/01/2031", 0.99)),
    ]
    val, src = extract_date_of_issue(ocr_boxes=boxes, known_expiry="2031-01-19")
    assert val == "2026-01-20"


def test_task121_test5_dob_issue_expiry_all_present():
    from app.extractor import extract_date_of_issue
    boxes = [
        ([[100, 50], [200, 50], [200, 70], [100, 70]], ("Date of Birth", 0.95)),
        ([[220, 50], [320, 50], [320, 70], [220, 70]], ("18/09/1993", 0.99)),
        ([[100, 100], [200, 100], [200, 120], [100, 120]], ("Date of Issue", 0.95)),
        ([[220, 100], [320, 100], [320, 120], [220, 120]], ("20/01/2026", 0.99)),
        ([[100, 150], [200, 150], [200, 170], [100, 170]], ("Date of Expiry", 0.95)),
        ([[220, 150], [320, 150], [320, 170], [220, 170]], ("19/01/2031", 0.99)),
    ]
    val, src = extract_date_of_issue(ocr_boxes=boxes, known_dob="1993-09-18", known_expiry="2031-01-19")
    assert val == "2026-01-20"
    assert val != "1993-09-18"


def test_task121_test6_ocr_separator_corruption():
    from app.extractor import parse_and_normalize_date
    assert parse_and_normalize_date("20/01/2026") == "2026-01-20"
    assert parse_and_normalize_date("20-01-2026") == "2026-01-20"
    assert parse_and_normalize_date("20.01.2026") == "2026-01-20"
    assert parse_and_normalize_date("20 01 2026") == "2026-01-20"
    assert parse_and_normalize_date("20:01:2026") == "2026-01-20"
    assert parse_and_normalize_date("20,01,2026") == "2026-01-20"
    assert parse_and_normalize_date("20012026") == "2026-01-20"


def test_task121_test7_issue_expiry_relationship():
    from app.extractor import extract_date_of_issue
    # If a candidate issue date is after known expiry date, it must be rejected!
    text = "Date of Issue: 20/01/2035\nDate of Expiry: 19/01/2031"
    val, src = extract_date_of_issue(text_content=text, known_expiry="2031-01-19")
    assert val == ""  # Rejected because 2035 > 2031


def test_task121_test8_previous_passport_issue_date_disambiguation():
    from app.extractor import extract_date_of_issue
    # Document containing previous passport section and current passport section
    text = (
        "B. Passport Details\n"
        "Passport No. A07350151\n"
        "Date of Issue: 27-MAR-2023\n"
        "Date of Expiry: 26-MAR-2033\n"
        "Previous Passport Details\n"
        "Passport No. BK0965579\n"
        "Date of Issue: 15-JAN-2018\n"
    )
    val, src = extract_date_of_issue(text_content=text, known_expiry="2033-03-26")
    assert val == "2023-03-27"
    assert val != "2018-01-15"


def test_task121_test9_text_layer_and_ocr_agree():
    from app.extractor import extract_date_of_issue
    text = "Date of Issue: 20/01/2026"
    boxes = [
        ([[100, 100], [200, 100], [200, 120], [100, 120]], ("Date of Issue", 0.95)),
        ([[220, 100], [320, 100], [320, 120], [220, 120]], ("20/01/2026", 0.98)),
    ]
    val, src = extract_date_of_issue(text_content=text, ocr_boxes=boxes, known_expiry="2031-01-19")
    assert val == "2026-01-20"
    assert src.confidence == 0.99


def test_task121_test10_text_layer_and_ocr_conflict():
    from app.extractor import extract_date_of_issue
    text = "Date of Issue: 20/01/2026"
    boxes = [
        ([[100, 100], [200, 100], [200, 120], [100, 120]], ("Date of Issue", 0.95)),
        ([[220, 100], [320, 100], [320, 120], [220, 120]], ("20/07/2026", 0.98)),
    ]
    val, src = extract_date_of_issue(text_content=text, ocr_boxes=boxes, known_expiry="2031-01-19")
    assert val == ""
    assert src.hasConflict is True
    assert "Conflicting issue date candidates" in (src.conflictDetails or "")


def test_task121_test11_missing_date_of_issue():
    from app.extractor import extract_date_of_issue
    val, src = extract_date_of_issue(text_content="Name: John Doe\nNo date here")
    assert val == ""
    assert src.hasConflict is False


def test_task121_test12_postal_code_inline():
    from app.extractor import extract_postal_codes
    p_pres, p_perm, src = extract_postal_codes(text_content="Present Address: KASHIPUR, Postal Code: 5120, THAKURGAON")
    assert p_pres == "5120"
    assert p_perm == "5120"


def test_task121_test13_postal_code_next_ocr_line():
    from app.extractor import extract_postal_codes
    text = "Present Address\nPostal Code\n5120\nTHAKURGAON"
    p_pres, p_perm, src = extract_postal_codes(text_content=text)
    assert p_pres == "5120"


def test_task121_test14_postal_label_nearby_ocr_box():
    from app.extractor import extract_postal_codes
    boxes = [
        ([[100, 100], [200, 100], [200, 120], [100, 120]], ("Postal Code:", 0.95)),
        ([[220, 100], [280, 100], [280, 120], [220, 120]], ("5120", 0.98)),
    ]
    p_pres, p_perm, src = extract_postal_codes(ocr_boxes=boxes)
    assert p_pres == "5120"
    assert p_perm == "5120"


def test_task121_test15_address_contains_5120_without_explicit_label():
    from app.extractor import extract_postal_codes
    text = "Present Address\nKASHIPUR, RANISANKAIL, 5120, THAKURGAON"
    p_pres, p_perm, src = extract_postal_codes(text_content=text)
    assert p_pres == "5120"


def test_task121_test16_address_contains_2026_and_postal_5120():
    from app.extractor import extract_postal_codes
    text = "Present Address: Issued in 2026, KASHIPUR, Postal Code 5120, THAKURGAON"
    info = {"issue_date": "2026-01-20"}
    p_pres, p_perm, src = extract_postal_codes(text_content=text, known_info=info)
    assert p_pres == "5120"
    assert p_pres != "2026"


def test_task121_test17_nid_digits_not_confused_with_postal():
    from app.extractor import extract_postal_codes
    info = {"nid": "8235626051"}
    text = "NID: 8235626051, Present Address: THAKURGAON 5120"
    p_pres, p_perm, src = extract_postal_codes(text_content=text, known_info=info)
    assert p_pres == "5120"


def test_task121_test18_phone_digits_not_confused_with_postal():
    from app.extractor import extract_postal_codes
    info = {"phone": "+8801744777846"}
    text = "Mobile: +8801744777846, Present Address: THAKURGAON 5120"
    p_pres, p_perm, src = extract_postal_codes(text_content=text, known_info=info)
    assert p_pres == "5120"


def test_task121_test19_passport_number_not_confused_with_postal():
    from app.extractor import extract_postal_codes
    info = {"passport_no": "A21496961"}
    text = "Passport: A21496961, Present Address: THAKURGAON 5120"
    p_pres, p_perm, src = extract_postal_codes(text_content=text, known_info=info)
    assert p_pres == "5120"


def test_task121_test20_foreign_postal_code():
    from app.extractor import extract_postal_codes
    text = "Present Address: 450 5TH AVE, NEW YORK, NY 10018, USA"
    p_pres, p_perm, src = extract_postal_codes(text_content=text, is_bangladeshi=False)
    assert p_pres == "10018"


def test_task121_test21_postal_code_missing():
    from app.extractor import extract_postal_codes
    text = "Present Address: KASHIPUR, THAKURGAON, BANGLADESH"
    p_pres, p_perm, src = extract_postal_codes(text_content=text)
    assert p_pres == ""
    assert p_perm == ""


def test_task121_test22_present_postal_copies_to_permanent_as_derived():
    from app.extractor import extract_postal_codes
    text = "Present Address: KASHIPUR, 5120, THAKURGAON\n(No permanent address)"
    p_pres, p_perm, src = extract_postal_codes(text_content=text)
    assert p_pres == "5120"
    assert p_perm == "5120"
    assert src["permanentAddress.postalCode"].source == "derived"


def test_task121_test23_explicit_permanent_differs_from_present():
    from app.extractor import extract_postal_codes
    text = (
        "Present Address: PANCHAGARH 5020 BANGLADESH\n"
        "Permanent Address: DHAKA 1205 BANGLADESH\n"
    )
    p_pres, p_perm, src = extract_postal_codes(text_content=text)
    assert p_pres == "5020"
    assert p_perm == "1205"


def test_task121_bilingual_slash_ocr_issue_date_label():
    from app.extractor import extract_date_of_issue
    boxes = [
        ([[628, 1615], [834, 1615], [834, 1639], [628, 1639]], ("rs f/Date of/ssue", 0.74)),
        ([[632, 1632], [764, 1632], [764, 1659], [632, 1659]], ("06SEP2025", 0.99)),
        ([[627, 1662], [884, 1662], [884, 1689], [627, 1689]], ("Cslrs ns/Date ofExpiry", 0.73)),
        ([[631, 1684], [767, 1684], [767, 1707], [631, 1707]], ("05SEP2030", 0.99)),
    ]
    val, src = extract_date_of_issue(ocr_boxes=boxes, known_dob="2015-07-28", known_expiry="2030-09-05")
    assert val == "2025-09-06"
    assert src.hasConflict is False
    assert src.source == "ocr_spatial"


