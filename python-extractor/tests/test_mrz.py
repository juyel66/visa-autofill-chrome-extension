import pytest
from app.mrz import (
    calculate_check_digit,
    verify_check_digit,
    parse_mrz_date,
    clean_mrz_line,
    is_candidate_line1,
    is_candidate_line2,
    find_mrz_lines,
    parse_td3_mrz,
)


def test_calculate_check_digit():
    # Passport A21496961 -> check digit 0
    assert calculate_check_digit("A21496961") == 0
    # DOB 930918 -> check digit 6
    assert calculate_check_digit("930918") == 6
    # Expiry 310119 -> check digit 3
    assert calculate_check_digit("310119") == 3


def test_verify_check_digit_valid():
    assert verify_check_digit("A21496961", "0") is True
    assert verify_check_digit("930918", "6") is True
    assert verify_check_digit("310119", "3") is True


def test_verify_check_digit_invalid():
    assert verify_check_digit("A21496961", "5") is False
    assert verify_check_digit("930918", "9") is False
    assert verify_check_digit("310119", "X") is False


def test_parse_mrz_date():
    # DOB
    assert parse_mrz_date("930918", is_expiry=False) == "1993-09-18"
    assert parse_mrz_date("050512", is_expiry=False) == "2005-05-12"
    # Expiry
    assert parse_mrz_date("310119", is_expiry=True) == "2031-01-19"
    assert parse_mrz_date("281231", is_expiry=True) == "2028-12-31"
    # Invalid date
    assert parse_mrz_date("999999", is_expiry=False) == ""
    assert parse_mrz_date("123", is_expiry=False) == ""


def test_clean_mrz_line():
    raw = "P«BGDRAY<<SHREE (JOTIMOY) [123]   "
    cleaned = clean_mrz_line(raw)
    assert "«" not in cleaned
    assert " " not in cleaned
    assert "(" not in cleaned
    assert "[" not in cleaned
    assert cleaned.startswith("P<BGDRAY<<SHREE<JOTIMOY<<123")


def test_is_candidate_line1():
    assert is_candidate_line1("P<BGDRAY<<SHREE<JOTIMOY<<<<<<<<<<<<<<<<<<<<<") is True
    assert is_candidate_line1("PBGDRAYSHREE<JOTIMOY<<<") is True
    # English text should be rejected
    assert is_candidate_line1("PERSONALDATAANDEMERGENCYCONTACT") is False
    assert is_candidate_line1("PERMANENTADDRESS") is False
    assert is_candidate_line1("SHORT") is False


def test_is_candidate_line2():
    l2 = "A214969610BGD9309186M31011938235626051<<<<48"
    assert is_candidate_line2(l2) is True
    assert is_candidate_line2("SHORTLINE") is False
    assert is_candidate_line2("NO_DIGITS_HERE_AT_ALL_ABCDEFGHIJKLMN") is False


def test_parse_td3_mrz_valid():
    l1 = "P<BGDRAY<<SHREE<JOTIMOY<<<<<<<<<<<<<<<<<<<<<"
    l2 = "A214969610BGD9309186M31011938235626051<<<<48"
    result = parse_td3_mrz(l1, l2, confidence=0.95)
    
    assert result.detected is True
    assert result.valid is True
    assert result.checks_passed is True
    assert result.document_type == "P"
    assert result.issuing_country == "BGD"
    assert result.surname == "RAY"
    assert result.given_names == "SHREE JOTIMOY"
    assert result.passport_number == "A21496961"
    assert result.nationality == "BGD"
    assert result.date_of_birth == "1993-09-18"
    assert result.gender == "male"
    assert result.expiry_date == "2031-01-19"
    assert result.personal_number == "8235626051"


def test_parse_td3_mrz_invalid():
    # Corrupted check digits
    l1 = "P<BGDTEST<<USER<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
    l2 = "A999999999BGD9999999M9999999999999999<<<<<<9"
    result = parse_td3_mrz(l1, l2, confidence=0.90)
    
    assert result.detected is True
    assert result.valid is False
    assert result.checks_passed is False
