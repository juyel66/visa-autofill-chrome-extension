import re
from datetime import datetime
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field


class ParsedMRZ(BaseModel):
    detected: bool = False
    valid: bool = False
    raw_lines: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    document_type: str = ""
    issuing_country: str = ""
    surname: str = ""
    given_names: str = ""
    passport_number: str = ""
    nationality: str = ""
    date_of_birth: str = ""  # YYYY-MM-DD
    gender: str = ""        # male | female | ""
    expiry_date: str = ""   # YYYY-MM-DD
    personal_number: str = ""
    checks_passed: bool = False


# ICAO Doc 9303 check digit weighting: 7, 3, 1 repeating
WEIGHTS = [7, 3, 1]


def char_to_value(c: str) -> int:
    """Convert character to ICAO 9303 value."""
    c = c.upper()
    if c.isdigit():
        return int(c)
    if 'A' <= c <= 'Z':
        return ord(c) - ord('A') + 10
    if c == '<':
        return 0
    return 0


def calculate_check_digit(data: str) -> int:
    """Calculate check digit for a string using 7-3-1 weights."""
    total = 0
    for idx, ch in enumerate(data):
        weight = WEIGHTS[idx % 3]
        total += char_to_value(ch) * weight
    return total % 10


def verify_check_digit(data: str, expected_digit: str) -> bool:
    """Check if the calculated check digit matches the expected digit."""
    if not expected_digit.isdigit():
        return False
    return calculate_check_digit(data) == int(expected_digit)


def parse_mrz_date(date_str: str, is_expiry: bool = False) -> str:
    """
    Parse YYMMDD into YYYY-MM-DD format.
    Handles century resolution:
    - For DOB: current year is pivot (e.g. in 2026: 27-99 -> 1927-1999, 00-26 -> 2000-2026)
    - For Expiry: within +50 years -> 20xx
    """
    if len(date_str) != 6 or not date_str.isdigit():
        return ""
    
    yy = int(date_str[0:2])
    mm = int(date_str[2:4])
    dd = int(date_str[4:6])
    
    if not (1 <= mm <= 12 and 1 <= dd <= 31):
        return ""
    
    current_year = datetime.now().year
    current_yy = current_year % 100
    
    if is_expiry:
        if yy <= (current_yy + 50) % 100:
            year = 2000 + yy
        else:
            year = 1900 + yy
    else:
        if yy <= current_yy:
            year = 2000 + yy
        else:
            year = 1900 + yy
            
    return f"{year:04d}-{mm:02d}-{dd:02d}"


def clean_mrz_line(raw: str) -> str:
    """Clean common OCR artifacts in MRZ line."""
    cleaned = raw.strip().upper()
    cleaned = cleaned.replace("«", "<").replace("(", "<").replace(")", "<")
    cleaned = cleaned.replace("[", "<").replace("]", "<").replace("{", "<").replace("}", "<")
    cleaned = cleaned.replace(" ", "")
    cleaned = re.sub(r"[^A-Z0-9<]", "", cleaned)
    return cleaned


def is_candidate_line1(cleaned: str) -> bool:
    """Check if cleaned text is candidate for MRZ Line 1."""
    if not (cleaned.startswith("P<") or (cleaned.startswith("P") and len(cleaned) >= 15)):
        return False
    if "<" not in cleaned:
        return False
    # Filter out normal English headers starting with P
    if any(kw in cleaned for kw in ["PERSONAL", "PERMANENT", "PASSPORT", "SIGNATURE", "EMERGENCY"]):
        return False
    return True


def is_candidate_line2(cleaned: str) -> bool:
    """Check if cleaned text is candidate for MRZ Line 2."""
    if len(cleaned) < 28:
        return False
    if not re.match(r"^[A-Z0-9]{8,10}", cleaned):
        return False
    digit_count = sum(1 for c in cleaned if c.isdigit())
    if digit_count < 8:
        return False
    return True


def find_mrz_lines(ocr_lines: List[Tuple[str, float]]) -> Optional[Tuple[str, str, float]]:
    """
    Find 2 candidate TD3 lines from OCR results.
    Returns (line1, line2, avg_confidence) if found.
    """
    line1_candidates = []
    line2_candidates = []

    for text, conf in ocr_lines:
        cleaned = clean_mrz_line(text)
        if is_candidate_line1(cleaned):
            line1_candidates.append((cleaned, conf))
        if is_candidate_line2(cleaned):
            line2_candidates.append((cleaned, conf))

    # Look for matching pair where check digits pass
    for l1, conf1 in line1_candidates:
        for l2, conf2 in line2_candidates:
            if len(l2) >= 28:
                c_doc = verify_check_digit(l2[0:9], l2[9])
                c_dob = verify_check_digit(l2[13:19], l2[19])
                c_exp = verify_check_digit(l2[21:27], l2[27])
                if c_doc or c_dob or c_exp:
                    avg_conf = (conf1 + conf2) / 2.0
                    return l1, l2, avg_conf

    # Fallback to pair if candidates exist
    if line1_candidates and line2_candidates:
        l1, conf1 = line1_candidates[-1]  # Typically at bottom of page
        l2, conf2 = line2_candidates[-1]
        return l1, l2, (conf1 + conf2) / 2.0

    return None


def parse_td3_mrz(
    line1: str,
    line2: str,
    confidence: float = 0.0,
    surname_hint: Optional[str] = None
) -> ParsedMRZ:
    """
    Parse and validate a standard 2-line TD3 MRZ.
    Handles lines with OCR missing delimiters, truncated filler '<',
    and multi-token given names / surnames.
    """
    result = ParsedMRZ(
        detected=True,
        raw_lines=[line1, line2],
        confidence=confidence
    )
    
    # 1. Normalize Line 1
    l1 = clean_mrz_line(line1)
    if len(l1) >= 4 and l1[0] == 'P' and l1[1] != '<' and l1[1:4].isalpha():
        l1 = "P<" + l1[1:]
    elif not l1.startswith("P<") and l1.startswith("P"):
        l1 = "P<" + l1[1:]
        
    l1 = l1.ljust(44, '<')[:44]
    
    result.document_type = l1[0:2].replace("<", "")
    result.issuing_country = l1[2:5].replace("<", "")
    
    name_section = l1[5:44]
    parts = name_section.split("<<")
    if len(parts) >= 2 and any(c.isalpha() for c in parts[1]):
        result.surname = " ".join([p for p in parts[0].split("<") if p]).strip()
        result.given_names = " ".join([p for p in parts[1].split("<") if p]).strip()
    else:
        # The << was trailing filler or omitted by OCR
        content = parts[0]
        if surname_hint and content.startswith(surname_hint.upper().strip()):
            clean_hint = surname_hint.upper().strip()
            rem = content[len(clean_hint):].lstrip("<")
            result.surname = clean_hint
            result.given_names = " ".join([p for p in rem.split("<") if p]).strip()
        elif "<" in content:
            sub_tokens = [p for p in content.split("<") if p]
            result.surname = sub_tokens[0].strip()
            result.given_names = " ".join(sub_tokens[1:]).strip()
        else:
            result.surname = content.replace("<", "").strip()
            result.given_names = ""

    # 2. Normalize and Parse Line 2
    l2 = clean_mrz_line(line2)
    if len(l2) >= 28:
        pass_num_raw = l2[0:9]
        pass_num_check = l2[9]
        result.passport_number = pass_num_raw.replace("<", "").strip()
        
        result.nationality = l2[10:13].replace("<", "")
        
        dob_raw = l2[13:19]
        dob_check = l2[19]
        result.date_of_birth = parse_mrz_date(dob_raw, is_expiry=False)
        
        sex_char = l2[20].upper()
        if sex_char == 'M':
            result.gender = "male"
        elif sex_char == 'F':
            result.gender = "female"
        else:
            result.gender = ""
            
        exp_raw = l2[21:27]
        exp_check = l2[27]
        result.expiry_date = parse_mrz_date(exp_raw, is_expiry=True)
        
        if len(l2) > 28:
            rem = l2[28:]
            m_nid = re.search(r"(\d{10,17})", rem)
            if m_nid:
                result.personal_number = m_nid.group(1)
            else:
                result.personal_number = rem.replace("<", "").strip()
                
        # Check digit validations
        pass_valid = verify_check_digit(pass_num_raw, pass_num_check)
        dob_valid = verify_check_digit(dob_raw, dob_check)
        exp_valid = verify_check_digit(exp_raw, exp_check)
        
        valid_count = sum([1 for v in [pass_valid, dob_valid, exp_valid] if v])
        result.checks_passed = (valid_count >= 2)
        result.valid = result.checks_passed and bool(result.passport_number)
        
    return result
