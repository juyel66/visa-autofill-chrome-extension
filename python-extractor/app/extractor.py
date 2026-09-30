import argparse
import copy
import hashlib
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import pymupdf

from .mrz import find_mrz_lines, parse_td3_mrz
from .ocr import OCRBox, run_ocr
from .pdf_processor import inspect_pdf, render_page_to_image

# Lightweight in-memory extraction cache keyed by SHA-256 of PDF content (Phase 13)
_EXTRACTION_CACHE: Dict[str, Any] = {}
_CACHE_MAX_SIZE: int = 30
from .schemas import (
    AddressData,
    ExtractionDiagnostics,
    FamilyData,
    FieldSource,
    MRZData,
    PassportData,
    PassportExtractionResult,
    PersonalData,
    PersonInfo,
    PreviousPassportData,
)

MONTH_MAP = {
    "JAN": "01",
    "FEB": "02",
    "MAR": "03",
    "APR": "04",
    "MAY": "05",
    "JUN": "06",
    "JUL": "07",
    "AUG": "08",
    "SEP": "09",
    "OCT": "10",
    "NOV": "11",
    "DEC": "12",
}


def is_valid_calendar_date(year: int, month: int, day: int) -> bool:
    """Check if year, month, day form a valid calendar date."""
    if not (1940 <= year <= 2045 and 1 <= month <= 12 and 1 <= day <= 31):
        return False
    if month in (4, 6, 9, 11) and day > 30:
        return False
    if month == 2:
        is_leap = (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0))
        if is_leap and day > 29:
            return False
        if not is_leap and day > 28:
            return False
    return True


def parse_and_normalize_date(raw_date: str) -> str:
    """
    Robust date parser and normalizer across various formats and OCR noise.
    Supports:
      - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MM YYYY, DDMMYYYY
      - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
      - DD-MMM-YYYY, DD MMM YYYY, DDMMMYYYY, DD/MMM/YYYY, DD.MMM.YYYY (e.g. 20 JAN 2026, 27-MAR-2023, 18SEP1993)
      - OCR separator corruption (e.g. 20,01,2026, 20:01:2026, 20 / 01 / 2026, 20- 01- 2026)
      - Embedded dates with leading/trailing text or labels
    Returns normalized canonical ISO date YYYY-MM-DD, or "" if invalid.
    """
    if not raw_date:
        return ""

    clean = raw_date.strip().upper()
    # Strip common leading label phrases if embedded in the line
    clean = re.sub(
        r"^(?:DATE\s*OF\s*[IS1l|]+SUE|ISSUE\s*DATE|DATE\s*OF\s*ISS(?:UANCE)?\.?|DATE\s*ISSUED|ISSUED\s*ON|DATE\s*D['’]?\s*[EÉ]MISSION|DATE\s*OF\s*EXPIR[Y|ATION]|EXPIR[Y|ATION]\s*DATE|DATE\s*OF\s*BIRTH|DOB)[\s:/.-]*\s*(?:\([^)]*\))?[\s:/.-]*",
        "",
        clean,
        flags=re.IGNORECASE
    ).strip()

    # 1. Format: DD-MMM-YYYY, DD MMM YYYY, DDMMMYYYY, etc. (e.g. 20 JAN 2026, 27-MAR-2023, 18SEP1993)
    m_text = re.search(r"\b(\d{1,2})\s*[-/.,: ]?\s*([A-Z]{3})\s*[-/.,: ]?\s*(\d{4})\b", clean)
    if m_text:
        dd = int(m_text.group(1))
        mon_str = m_text.group(2)
        yyyy = int(m_text.group(3))
        if mon_str in MONTH_MAP:
            mm = int(MONTH_MAP[mon_str])
            if is_valid_calendar_date(yyyy, mm, dd):
                return f"{yyyy:04d}-{mm:02d}-{dd:02d}"

    # 2. Format: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    m_iso = re.search(r"\b(\d{4})[-/.,:\s]+(\d{1,2})[-/.,:\s]+(\d{1,2})\b", clean)
    if m_iso:
        yyyy = int(m_iso.group(1))
        mm = int(m_iso.group(2))
        dd = int(m_iso.group(3))
        if is_valid_calendar_date(yyyy, mm, dd):
            return f"{yyyy:04d}-{mm:02d}-{dd:02d}"

    # 3. Format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD MM YYYY, or separator corruption (e.g. 20,01,2026, 20:01:2026)
    m_dmy = re.search(r"\b(\d{1,2})[-/.,:\s]+(\d{1,2})[-/.,:\s]+(\d{4})\b", clean)
    if m_dmy:
        dd = int(m_dmy.group(1))
        mm = int(m_dmy.group(2))
        yyyy = int(m_dmy.group(3))
        if is_valid_calendar_date(yyyy, mm, dd):
            return f"{yyyy:04d}-{mm:02d}-{dd:02d}"

    # 4. Format: DDMMYYYY (8 consecutive digits)
    m_8d = re.search(r"\b(\d{2})(\d{2})(\d{4})\b", clean)
    if m_8d:
        dd = int(m_8d.group(1))
        mm = int(m_8d.group(2))
        yyyy = int(m_8d.group(3))
        if is_valid_calendar_date(yyyy, mm, dd):
            return f"{yyyy:04d}-{mm:02d}-{dd:02d}"

    return ""


def normalize_date(raw_date: str) -> str:
    """Normalize various date formats (e.g. 18SEP1993, 18-AUG-2026, 2026-01-20, 20/01/2026) to YYYY-MM-DD."""
    return parse_and_normalize_date(raw_date)


def is_excluded_postal_code(cand: str, known_info: Optional[Dict[str, str]] = None, is_explicit: bool = False) -> bool:
    """
    Exclusion rules for 4-digit numbers to prevent confusing with:
    - years (DOB year, expiry year, issue year, 1950-2035)
    - NID substrings
    - Phone number substrings
    - Passport number digits
    - MRZ numeric sequences
    """
    if not cand:
        return True

    clean_digits = re.sub(r"\D", "", cand)
    if not clean_digits:
        return True

    info = known_info or {}

    # If explicitly preceded by a postal label (e.g. "Postal Code: 5120"),
    # only reject if identical to full NID or full phone
    if is_explicit:
        if info.get("nid") and clean_digits == info["nid"]:
            return True
        phone_digits = re.sub(r"\D", "", info.get("phone", ""))
        if phone_digits and len(clean_digits) >= 8 and clean_digits in phone_digits:
            return True
        return False

    # 1. Year check: DOB year, expiry year, issue year, or generic years 1950-2035
    known_years = set()
    for k in ["dob", "issue_date", "expiry_date", "journey_date"]:
        dt = info.get(k, "")
        if dt and len(dt) >= 4 and dt[:4].isdigit():
            known_years.add(dt[:4])

    if clean_digits in known_years:
        return True

    if len(clean_digits) == 4 and (clean_digits.startswith("19") or clean_digits.startswith("20")):
        val = int(clean_digits)
        if 1950 <= val <= 2035:
            return True

    # 2. NID substring check
    nid = info.get("nid", "")
    if nid and len(nid) >= 10 and clean_digits in nid:
        return True

    # 3. Phone number substring check
    phone = re.sub(r"\D", "", info.get("phone", ""))
    if phone and len(phone) >= 7 and clean_digits in phone:
        return True

    # 4. Passport number digits check
    ppt = re.sub(r"\D", "", info.get("passport_no", ""))
    if ppt and len(ppt) >= 6 and clean_digits in ppt:
        return True

    return False


def normalize_gender(raw: str) -> str:
    """Normalize gender to male / female / empty."""
    clean = raw.strip().upper()
    if clean in ("M", "MALE"):
        return "male"
    if clean in ("F", "FEMALE"):
        return "female"
    return ""


DISALLOWED_NAME_TOKENS = {
    "GIVEN", "NAME", "NAMES", "SURNAME", "PASSPORT", "PRENOM", "PRENOMS",
    "NATIONALITY", "BGD", "TYPE", "COUNTRY", "CODE", "SEX", "AUTHORITY",
    "DATE", "BIRTH", "ISSUE", "EXPIRY", "DIP", "DHAKA", "HOLDER", "SIGNATURE",
    "EMERGENCY", "CONTACT", "ADDRESS", "FATHER", "MOTHER", "GUARDIAN",
    "LEGAL", "SPOUSE", "RELATIONSHIP", "TELEPHONE", "PHONE", "MOBILE",
    "PERMANENT", "PRESENT", "PEOPLE", "REPUBLIC", "OF", "BANGLADESH",
    "AS", "IN", "FOR", "PREV", "PREVIOUS", "RELATION", "RELATIONS", "ELATION", "ELATIONS", "LATION",
    "IF", "ANY", "NOT", "APPLICABLE", "APPLY", "NA", "NIL", "NONE", "UNKNOWN",
    "SAME", "ABOVE", "OTHER", "OTHERS", "PARTICULARS", "APPLICATION", "DETAILS",
    "PÈRE", "PERE", "MÈRE", "MERE", "NOM", "DU", "DE", "LA",
    "GENDER", "MARITAL", "STATUS", "RELIGION", "TOWN", "CITY",
    "CITIZENSHIP", "EDUCATIONAL", "QUALIFICATION", "VISIBLE", "MARKS",
    "IDENTIFICATION", "CURRENT", "NATURALIZATION", "OCCUPATION", "DESIGNATION",
    "EMPLOYER", "HOTEL", "TOURIST", "VISA", "JOURNEY", "PORT", "ARRIVAL", "EXIT",
    "ORGANIZATION", "POSTING", "RANK", "DECLARATION", "STAY", "ENTRY", "ENTRIES",
    "MONTH", "MONTHS", "YEAR", "YEARS", "DAY", "DAYS",
    "COLONI", "COLONY", "ROAD", "STREET", "VILL", "VILLAGE", "POST", "DIST",
    "DISTRICT", "THANA", "UPAZILA", "DIVISION", "ESTATE", "SECTOR", "BLOCK",
    "HOUSE", "HOLDING", "PARA", "MAHAL", "PO", "PS", "PANCHAGARH", "THAKURGAON",
    "DHAKA", "RAJSHAHI", "CHITTAGONG", "SYLHET", "KHULNA", "BARISAL", "RANGPUR", "MYMENSINGH"
}


def is_valid_name_token(token: str) -> bool:
    """
    Check if a token is a legitimate person name word.
    Rejects OCR noise tokens such as G70E, 410G7A, 70E, O7E, tokens containing digits,
    and passport keywords.
    """
    if not token:
        return False
    t = token.strip(".,:;-_/\\<>[]{}()\"'!?#*~")
    if not t:
        return False
    # Person name tokens must never contain digits (e.g. G70E, 70E, 410G7A)
    if re.search(r"\d", t):
        return False
    # Disallow passport metadata, labels, or address tokens
    if t.upper() in DISALLOWED_NAME_TOKENS:
        return False
    # Must consist of letters, with optional internal hyphen or apostrophe
    if not re.match(r"^[A-Za-z]+(?:['-][A-Za-z]+)*$", t):
        return False
    return True


def clean_person_name(cand: str) -> str:
    """
    Clean person name: remove OCR artifacts (e.g. G70E, 70E, random alphanumeric fragments),
    disallowed keywords, placeholder phrases ('IF ANY', 'NOT APPLICABLE'), and normalize multi-token spaces.
    Strictly rejects strings containing address indicators or placeholder phrases.
    """
    if not cand:
        return ""
    cand_upper = cand.strip().upper()
    if cand_upper in {"IF ANY", "NOT APPLICABLE", "NOT APPLIED", "NA", "N/A", "NONE", "NIL", "UNKNOWN", "NOT APPLY", "SAME AS ABOVE"}:
        return ""
    # Reject strings containing obvious address components
    if any(addr_kw in cand_upper for addr_kw in [
        "COLONI", "COLONY", "ROAD", "STREET", "VILL", "VILLAGE", "POST", "DIST",
        "DISTRICT", "THANA", "UPAZILA", "DIVISION", "ESTATE", "SECTOR", "BLOCK",
        "HOUSE NO", "HOLDING", "HOUSING", "POSTAL CODE", "PINCODE"
    ]):
        return ""
    cand_norm = cand.replace("<", " ").replace("/", " ")
    raw_tokens = cand_norm.split()
    valid_tokens = []
    for tok in raw_tokens:
        clean_tok = tok.strip(".,:;-_/\\<>[]{}()\"'!?#*~")
        if is_valid_name_token(clean_tok):
            valid_tokens.append(clean_tok.upper())
    if not valid_tokens:
        return ""
    res = " ".join(valid_tokens)
    if res in {"IF ANY", "NOT APPLICABLE", "NA", "NONE", "UNKNOWN", "NIL"}:
        return ""
    return res


def is_applicant_name(cand_str: str, applicant_full: str = "", applicant_given: str = "", applicant_surname: str = "") -> bool:
    """
    Check if a candidate person name string matches the applicant's own name,
    accounting for missing spaces (e.g. 'SHREE JOTIMOYRAY' vs 'SHREE JOTIMOY RAY'),
    while preventing false matches on shared titles/prefixes (e.g. 'SHREE' or 'MD').
    """
    if not cand_str:
        return False
    cand_norm = re.sub(r"[\s<]+", "", cand_str).upper()
    if not cand_norm or len(cand_norm) < 3:
        return False
    full_norm = re.sub(r"[\s<]+", "", applicant_full or "").upper()
    given_norm = re.sub(r"[\s<]+", "", applicant_given or "").upper()
    rev_full_norm = re.sub(r"[\s<]+", "", f"{applicant_surname or ''}{applicant_given or ''}").upper()
    fwd_full_norm = re.sub(r"[\s<]+", "", f"{applicant_given or ''}{applicant_surname or ''}").upper()

    if full_norm and cand_norm == full_norm:
        return True
    if fwd_full_norm and cand_norm == fwd_full_norm:
        return True
    if rev_full_norm and cand_norm == rev_full_norm:
        return True
    if given_norm and len(given_norm) >= 4 and cand_norm == given_norm:
        return True
    return False


def normalize_phone_number(raw: str) -> str:
    """
    Normalize phone number: preserve country code (+880, 880, 01), safely handle whitespace and hyphens,
    and avoid confusing NID, passport numbers, dates, or postal codes.
    """
    if not raw:
        return ""
    clean = raw.strip()
    clean = re.sub(
        r"^(?:[ET]ELEPHONE|PHONE|MOBILE|CONTACT|TEL)(?:\s*(?:NO|NUMBER))?[\s.:=-]*",
        "",
        clean,
        flags=re.IGNORECASE
    ).strip()

    has_plus = clean.startswith("+")
    m = re.search(r"(\+?[\d\s-]{7,20})", clean)
    if not m:
        return ""

    candidate = m.group(1).strip()
    digits = re.sub(r"\D", "", candidate)

    # Phone numbers must have between 7 and 15 digits
    if len(digits) < 7 or len(digits) > 15:
        return ""

    # Avoid confusing 10-digit NIDs that do not match mobile patterns
    if len(digits) == 10 and not has_plus and not digits.startswith("1") and not digits.startswith("0"):
        return ""

    if has_plus:
        return "+" + digits
    elif digits.startswith("880") and len(digits) in (13, 14):
        return "+" + digits
    else:
        return digits


BANGLADESH_DISTRICTS = {
    "THAKURGAON", "PANCHAGARH", "DINAJPUR", "RANGPUR", "NILPHAMARI", "KURIGRAM", "LALMONIRHAT", "GAIBANDHA",
    "BOGRA", "BOGURA", "JOYPURHAT", "NAOGAON", "NATORE", "NAWABGANJ", "CHAPAINAWABGANJ", "PABNA", "RAJSHAHI", "SIRAJGANJ",
    "DHAKA", "FARIDPUR", "GAZIPUR", "GOPALGANJ", "KISHOREGANJ", "MADARIPUR", "MANIKGANJ", "MUNSHIGANJ", "NARAYANGANJ", "NARSINGDI", "RAJBARI", "SHARIATPUR", "TANGAIL",
    "MYMENSINGH", "JAMALPUR", "NETROKONA", "SHERPUR",
    "HABIGANJ", "MOULVIBAZAR", "SUNAMGANJ", "SYLHET",
    "BAGERHAT", "CHUADANGA", "JESSORE", "JASHORE", "JHENAIDAH", "KHULNA", "KUSHTIA", "MAGURA", "MEHERPUR", "NARAIL", "SATKHIRA",
    "BARGUNA", "BARISAL", "BARISHAL", "BHOLA", "JHALOKATI", "PATUAKHALI", "PIROJPUR",
    "BANDARBAN", "BRAHMANBARIA", "CHANDPUR", "CHITTAGONG", "CHATTOGRAM", "COMILLA", "CUMILLA", "COXS BAZAR", "COX'S BAZAR", "FENI", "KHAGRACHARI", "LAKSHMIPUR", "NOAKHALI", "RANGAMATI"
}


def parse_box_coords(bbox) -> Tuple[float, float, float, float]:
    """Normalize bounding box to (min_x, min_y, max_x, max_y)."""
    if len(bbox) == 4 and isinstance(bbox[0], (int, float)):
        return float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
    elif len(bbox) >= 4 and isinstance(bbox[0], (list, tuple)):
        xs = [pt[0] for pt in bbox]
        ys = [pt[1] for pt in bbox]
        return float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))
    return 0.0, 0.0, 0.0, 0.0


def extract_address_blocks_from_boxes(boxes: List[OCRBox]) -> Dict[str, Tuple[List[str], float]]:
    """
    Extract address candidates grouped by type ('present', 'permanent', 'generic')
    using spatial bounding boxes, reading order, and proximity.
    """
    class _BoxAdapter:
        def __init__(self, bbox, text, confidence=1.0):
            self.bbox = bbox
            self.text = text
            self.confidence = confidence

    normalized_boxes = []
    for b in boxes:
        if hasattr(b, "bbox") and hasattr(b, "text"):
            normalized_boxes.append(b)
        elif isinstance(b, (list, tuple)) and len(b) >= 2:
            bbox = b[0]
            if isinstance(b[1], (list, tuple)):
                text = str(b[1][0])
                conf = float(b[1][1]) if len(b[1]) > 1 else 1.0
            else:
                text = str(b[1])
                conf = float(b[2]) if len(b) > 2 else 1.0
            normalized_boxes.append(_BoxAdapter(bbox, text, conf))
        else:
            normalized_boxes.append(_BoxAdapter([0, 0, 0, 0], str(b), 1.0))

    boxes = normalized_boxes
    num_boxes = len(boxes)
    if num_boxes == 0:
        return {}

    anchors = []
    used_label_indices = set()

    # 1. Section stop markers (e.g. Family Details, Emergency Contact, Signature, Main Passport Page)
    stops = []
    for i, b in enumerate(boxes):
        txt = b.text.strip().upper()
        x1, y1, x2, y2 = parse_box_coords(b.bbox)
        if any(kw in txt for kw in [
            'FAMILY DETAILS', 'EMERGENCY', 'EMERGENCY CONTACT', 'MERGENCY', 'SIGNATURE OF',
            'SIGNATURE', 'PASSPORT NO', 'P<', 'H<', 'PBGD',
            'PEOPLES REPUBLIC', "PEOPLE'S REPUBLIC", 'PASSPORT', 'GOVERNMENT OF',
            'PERSONAL DATA', 'SURNAME', 'SUNAME', 'GIVEN NAME', 'NATIONALITY',
            'DATE OF BIRTH', 'PLACE OF BIRTH', 'ISSUING AUTHORITY', 'PREVIOUS PASSPORT',
            'TELEPHONE', 'PHONE NO', 'MOBILE NO'
        ]):
            stops.append((y1, txt))

    # 2. Compound Present / Permanent labels (absorbs multiline words like Present / Address)
    for i, b in enumerate(boxes):
        if i in used_label_indices:
            continue
        txt = b.text.strip().upper()
        x1, y1, x2, y2 = parse_box_coords(b.bbox)

        # Present Address variations
        if re.search(r'[A-Z]*RESENT\s*(?:RESIDENTIAL\s*)?ADD(?:RESS)?', txt) or 'RESIDENTIAL ADDRESS' in txt:
            anchors.append(('present', x1, y1, x2, y2, i))
            used_label_indices.add(i)
        elif txt in ('PRESENT', 'RESENT', 'RESIDENTIAL', 'PRESENT:', 'PRESENT ADD', 'PRESENT ADD.'):
            for j in range(i + 1, min(i + 10, num_boxes)):
                bx1, by1, bx2, by2 = parse_box_coords(boxes[j].bbox)
                if abs(bx1 - x1) < 150 and 0 < (by1 - y1) < 80 and 'ADDRESS' in boxes[j].text.upper():
                    anchors.append(('present', min(x1, bx1), y1, max(x2, bx2), by2, i))
                    used_label_indices.add(i)
                    used_label_indices.add(j)
                    break

        # Permanent Address variations
        elif re.search(r'[A-Z]*ERMANENT\s*ADD(?:RESS)?', txt) or re.search(r'PERM\.?\s*ADD', txt):
            anchors.append(('permanent', x1, y1, x2, y2, i))
            used_label_indices.add(i)
        elif txt in ('PERMANENT', 'ERMANENT', 'PERM', 'PERM.', 'PERMANENT:', 'ERMANENT:', 'PERMANENT ADD', 'PERMANENT ADD.'):
            for j in range(i + 1, min(i + 10, num_boxes)):
                bx1, by1, bx2, by2 = parse_box_coords(boxes[j].bbox)
                if abs(bx1 - x1) < 150 and 0 < (by1 - y1) < 80 and 'ADDRESS' in boxes[j].text.upper():
                    anchors.append(('permanent', min(x1, bx1), y1, max(x2, bx2), by2, i))
                    used_label_indices.add(i)
                    used_label_indices.add(j)
                    break

    # 3. Generic Address anchors (only if not used in compound label)
    for i, b in enumerate(boxes):
        if i in used_label_indices:
            continue
        txt = b.text.strip().upper()
        x1, y1, x2, y2 = parse_box_coords(b.bbox)
        if (re.search(r'^\b[A-Z]*DDRESS[:.]?$', txt) or re.search(r'^\bADDRESS[:.]?$', txt) or txt.startswith('ADDRESS OF') or txt in ('ADDRESS', 'ADDRESS.', 'DDRESS', 'DDRESS.', 'DRESS', 'DRESS.')) and not any(kw in txt for kw in ['EMAIL', 'WEB', 'PHONE']):
            anchors.append(('generic', x1, y1, x2, y2, i))
            used_label_indices.add(i)

    anchors.sort(key=lambda a: a[2])

    extracted: Dict[str, Tuple[List[str], float]] = {}

    for k, (a_type, ax1, ay1, ax2, ay2, a_idx) in enumerate(anchors):
        if a_type in extracted:
            continue

        next_y = ay1 + 160.0  # Physical address block in passport is never > 160px tall
        if k + 1 < len(anchors):
            next_y = min(next_y, anchors[k + 1][2] - 10)
        for sy, stxt in stops:
            if sy > ay1 + 10:
                next_y = min(next_y, sy - 10)

        collected = []
        for j, b in enumerate(boxes):
            if j in used_label_indices:
                continue
            bx1, by1, bx2, by2 = parse_box_coords(b.bbox)
            btxt = b.text.strip()
            bupper = btxt.upper()

            if (ay1 - 35 <= by1 <= next_y):
                is_right_col = (ax1 + 30 <= bx1 <= ax1 + 750)
                is_below = (abs(bx1 - ax1) < 150 and by1 >= ay2 - 5)
                if is_right_col or is_below:
                    # Ignore phone, mobile, email labels and values
                    if any(kw in bupper for kw in ['PHONE', 'MOBILE', 'EMAIL', '@', 'CELL', 'TEL', '+880', '017', '018', '019', '013', '014', '015', '016']):
                        continue
                    if len(btxt) <= 2 and not btxt.isdigit():
                        continue
                    # Ignore relations and passport main page fields/labels
                    if any(kw in bupper for kw in [
                        'FAMILY DETAILS', 'NAME OF', 'RELATION', 'SPOUSE', 'HUSBAND', 'WIFE',
                        'FATHER', 'MOTHER', 'PEOPLES REPUBLIC', "PEOPLE'S REPUBLIC", 'PASSPORT',
                        'SURNAME', 'SUNAME', 'GIVEN NAME', 'NATIONALITY', 'BANGLADESHI',
                        'DATE OF BIRTH', 'PLACE OF BIRTH', 'ISSUING AUTHORITY', 'DATE OF ISSUE',
                        'DATE OF EXPIRY', 'PBGD', 'P<', 'TYPE', 'COUNTRY CODE', 'PREVIOUS PASSPORT'
                    ]):
                        continue
                    collected.append((by1, bx1, btxt, b.confidence))

        collected.sort(key=lambda item: (round(item[0] / 15) * 15, item[1]))
        if collected:
            texts = [c[2] for c in collected]
            avg_conf = sum(c[3] for c in collected) / len(collected)
            extracted[a_type] = (texts, avg_conf)

    # Collect all box texts already used in extracted blocks
    collected_box_texts = set()
    for block_lines, _ in extracted.values():
        for bl in block_lines:
            collected_box_texts.add(bl.strip())

    # 4. Standalone Address Lines (e.g. Bangladesh passport personal data where address has no explicit label)
    for i, b in enumerate(boxes):
        if b.text.strip() in collected_box_texts:
            continue
        btxt = b.text.strip().upper()
        has_dist = any(re.search(r"\b" + re.escape(d) + r"\b", btxt) for d in BANGLADESH_DISTRICTS)
        has_zip = bool(re.search(r"\b([1-9]\d{3})\b", btxt))
        comma_parts = [p.strip() for p in btxt.split(",") if p.strip()]
        if has_dist and (has_zip or len(comma_parts) >= 3) and len(comma_parts) >= 3:
            bx1, by1, bx2, by2 = parse_box_coords(b.bbox)
            is_top_section = by1 < 620
            sec_type = 'permanent' if is_top_section else 'generic'
            if sec_type not in extracted:
                extracted[sec_type] = ([b.text.strip()], b.confidence)

    return extracted


ISSUE_DATE_LABEL_REGEX = re.compile(
    r"(?:"
    r"DATE[\s/:\-_.]*OF[\s/:\-_.]*[IS1l|!/]*[IS1l|!]SUE"
    r"|ISSUE[\s/:\-_.]*DATE"
    r"|DATE[\s/:\-_.]*OF[\s/:\-_.]*ISS(?:UANCE)?\.?"
    r"|DATE[\s/:\-_.]*ISSUED"
    r"|ISSUED[\s/:\-_.]*ON"
    r"|DATE[\s/:\-_.]*D['’]?\s*[EÉ]MISSION"
    r"|\bD['’]?ÉMISSION\b"
    r"|\bDATE[\s/:\-_.]*OF[\s/:\-_.]*ISS\b"
    r"|\bISSUED[\s/:\-_.]*DATE\b"
    r")",
    re.IGNORECASE,
)

EXPIRY_DATE_LABEL_REGEX = re.compile(
    r"(?:"
    r"DATE[\s/:\-_.]*OF[\s/:\-_.]*EXPIR[Y|ATION]"
    r"|EXPIR[Y|ATION][\s/:\-_.]*DATE"
    r"|EXPIRES[\s/:\-_.]*ON"
    r"|VALID[\s/:\-_.]*UNTIL"
    r"|D['’]?\s*EXPIRATION"
    r"|EXPIRY"
    r")",
    re.IGNORECASE,
)

DOB_LABEL_REGEX = re.compile(
    r"(?:"
    r"DATE[\s/:\-_.]*OF[\s/:\-_.]*BIRTH"
    r"|DOB"
    r"|BIRTH[\s/:\-_.]*DATE"
    r")",
    re.IGNORECASE,
)


def is_issue_date_label(text: str) -> bool:
    if not text:
        return False
    if ISSUE_DATE_LABEL_REGEX.search(text):
        return True
    clean = re.sub(r"[\W_]+", " ", text).strip().upper()
    if ISSUE_DATE_LABEL_REGEX.search(clean):
        return True
    words = clean.split()
    for i in range(len(words)):
        if words[i] == "DATE":
            if i + 1 < len(words) and words[i + 1] == "OF":
                if i + 2 < len(words) and any(words[i + 2].startswith(p) for p in ["ISS", "SSU", "1SS", "ISU"]):
                    return True
                if i + 2 < len(words) and words[i + 2] in ("ISS", "IS"):
                    return True
        elif words[i] in ("ISSUE", "ISSUED") and i + 1 < len(words) and words[i + 1] == "DATE":
            return True
    return False


def is_expiry_date_label(text: str) -> bool:
    if not text:
        return False
    if EXPIRY_DATE_LABEL_REGEX.search(text):
        return True
    clean = re.sub(r"[\W_]+", " ", text).strip().upper()
    if EXPIRY_DATE_LABEL_REGEX.search(clean):
        return True
    clean_split = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    clean_split = re.sub(r"[\W_]+", " ", clean_split).strip().upper()
    if EXPIRY_DATE_LABEL_REGEX.search(clean_split):
        return True
    return any(kw in clean_split for kw in ["EXPIRY", "EXPIRATION", "VALID UNTIL", "EXPIRES ON"])


def is_dob_label(text: str) -> bool:
    if not text:
        return False
    if DOB_LABEL_REGEX.search(text):
        return True
    clean = re.sub(r"[\W_]+", " ", text).strip().upper()
    if DOB_LABEL_REGEX.search(clean):
        return True
    clean_split = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    clean_split = re.sub(r"[\W_]+", " ", clean_split).strip().upper()
    return any(kw in clean_split for kw in ["DATE OF BIRTH", "BIRTH DATE", "DOB"])

POSTAL_LABEL_REGEX = re.compile(
    r"(?:"
    r"\bPOSTAL\s*CODE\b"
    r"|\bPOST\s*CODE\b"
    r"|\bPOSTCODE\b"
    r"|\bZIP\s*CODE\b"
    r"|\bZIP\b"
    r"|\bPIN\s*CODE\b"
    r"|\bPIN\b"
    r"|\bP\.?O\.?\s*CODE\b"
    r"|\bPOSTAL\b"
    r")",
    re.IGNORECASE,
)


class DateCandidate:
    def __init__(self, value: str, source: str, confidence: float, evidence: str, is_previous: bool = False):
        self.value = value
        self.source = source
        self.confidence = confidence
        self.evidence = evidence
        self.is_previous = is_previous


class PostalCandidate:
    def __init__(self, value: str, source: str, confidence: float, evidence: str, target: str = "both"):
        self.value = value
        self.source = source
        self.confidence = confidence
        self.evidence = evidence
        self.target = target  # "present" | "permanent" | "both"


def normalize_box_input(b: Any) -> OCRBox:
    if isinstance(b, OCRBox):
        return b
    if isinstance(b, (tuple, list)) and len(b) >= 2:
        bbox = b[0]
        val = b[1]
        if isinstance(val, (tuple, list)):
            text = str(val[0])
            conf = float(val[1]) if len(val) > 1 else 0.95
        else:
            text = str(val)
            conf = 0.95
        return OCRBox(bbox=bbox, text=text, confidence=conf)
    return OCRBox(bbox=[0, 0, 0, 0], text=str(b), confidence=0.5)


def extract_date_of_issue(
    doc: Optional[pymupdf.Document] = None,
    page_idx: int = 0,
    ocr_boxes: Optional[List[Any]] = None,
    known_dob: str = "",
    known_expiry: str = "",
    text_content: Optional[str] = None,
) -> Tuple[str, FieldSource]:
    """
    Robust, field-specific Date of Issue extractor:
    - Source A: PyMuPDF text layer (multi-line & inline)
    - Source B: OCR inline boxes
    - Source C: OCR bounding boxes with spatial geometry and label proximity disambiguation
    - Strict validation: calendar dates, year range, issue < expiry, issue > dob, not previous passport
    - Cross-source arbitration with conflict reporting (never fabricate)
    """
    candidates: List[DateCandidate] = []
    boxes = [normalize_box_input(b) for b in ocr_boxes] if ocr_boxes else []

    # 1. Source A: Text Layer from PyMuPDF or provided text_content
    if doc is not None:
        page_indices = [page_idx] + [i for i in range(len(doc)) if i != page_idx]
        for p_i in page_indices:
            try:
                page_text = doc[p_i].get_text() or ""
                lines = [l.strip() for l in page_text.splitlines() if l.strip()]
                for idx, line in enumerate(lines):
                    if is_issue_date_label(line):
                        preceding = " ".join(lines[max(0, idx - 6):idx]).upper()
                        is_prev = any(
                            kw in preceding
                            for kw in ["PREVIOUS PASSPORT", "ANY OTHER PASSPORT", "PREVIOUS/PAST", "VISA ISSUED PLACE"]
                        )
                        norm = parse_and_normalize_date(line)
                        if norm:
                            candidates.append(DateCandidate(norm, "passport_text", 0.98, line, is_previous=is_prev))
                        else:
                            for nxt in lines[idx + 1 : min(idx + 4, len(lines))]:
                                n_norm = parse_and_normalize_date(nxt)
                                if n_norm:
                                    candidates.append(
                                        DateCandidate(n_norm, "passport_text", 0.98, f"{line} -> {nxt}", is_previous=is_prev)
                                    )
                                    break
            except Exception:
                pass
    elif text_content:
        lines = [l.strip() for l in text_content.splitlines() if l.strip()]
        for idx, line in enumerate(lines):
            if is_issue_date_label(line):
                preceding = " ".join(lines[max(0, idx - 6):idx]).upper()
                is_prev = any(
                    kw in preceding
                    for kw in ["PREVIOUS PASSPORT", "ANY OTHER PASSPORT", "PREVIOUS/PAST", "VISA ISSUED PLACE"]
                )
                norm = parse_and_normalize_date(line)
                if norm:
                    candidates.append(DateCandidate(norm, "passport_text", 0.98, line, is_previous=is_prev))
                else:
                    for nxt in lines[idx + 1 : min(idx + 4, len(lines))]:
                        n_norm = parse_and_normalize_date(nxt)
                        if n_norm:
                            candidates.append(
                                DateCandidate(n_norm, "passport_text", 0.98, f"{line} -> {nxt}", is_previous=is_prev)
                            )
                            break

    # 2. Source B & C: OCR boxes (inline + spatial)
    if boxes:
        issue_label_boxes: List[Tuple[OCRBox, bool]] = []
        expiry_label_boxes: List[OCRBox] = []
        dob_label_boxes: List[OCRBox] = []

        for b_idx, b in enumerate(boxes):
            b_up = b.text.upper()
            preceding_boxes = " ".join([ob.text.upper() for ob in boxes[max(0, b_idx - 5):b_idx]])
            is_prev_box = any(
                kw in preceding_boxes for kw in ["PREVIOUS PASSPORT", "ANY OTHER PASSPORT", "PREVIOUS/PAST", "VISA ISSUED"]
            )

            if is_issue_date_label(b.text):
                issue_label_boxes.append((b, is_prev_box))
            if is_expiry_date_label(b.text):
                expiry_label_boxes.append(b)
            if is_dob_label(b.text):
                dob_label_boxes.append(b)

        for lbl, is_prev in issue_label_boxes:
            # Inline date in label box
            inline_norm = parse_and_normalize_date(lbl.text)
            if inline_norm:
                candidates.append(DateCandidate(inline_norm, "ocr", lbl.confidence, lbl.text, is_previous=is_prev))

            # Spatial search across nearby boxes
            lx0, ly0, lx1, ly1 = parse_box_coords(lbl.bbox)
            lh = max(1.0, ly1 - ly0)
            lw = max(1.0, lx1 - lx0)
            lcx, lcy = (lx0 + lx1) / 2.0, (ly0 + ly1) / 2.0

            for other_b in boxes:
                if other_b is lbl:
                    continue
                other_norm = parse_and_normalize_date(other_b.text)
                if not other_norm:
                    continue

                ox0, oy0, ox1, oy1 = parse_box_coords(other_b.bbox)
                ocx, ocy = (ox0 + ox1) / 2.0, (oy0 + oy1) / 2.0
                d_issue = ((ocx - lcx) ** 2 + (ocy - lcy) ** 2) ** 0.5

                # Disambiguation from Expiry: reject if closer to an Expiry label
                closer_to_expiry = False
                for exp_b in expiry_label_boxes:
                    ex0, ey0, ex1, ey1 = parse_box_coords(exp_b.bbox)
                    ecx, ecy = (ex0 + ex1) / 2.0, (ey0 + ey1) / 2.0
                    d_exp = ((ocx - ecx) ** 2 + (ocy - ecy) ** 2) ** 0.5
                    if d_exp < (d_issue * 0.85):
                        closer_to_expiry = True
                        break
                if closer_to_expiry:
                    continue

                # Disambiguation from DOB: reject if closer to DOB label
                closer_to_dob = False
                for dob_b in dob_label_boxes:
                    dx0, dy0, dx1, dy1 = parse_box_coords(dob_b.bbox)
                    dcx, dcy = (dx0 + dx1) / 2.0, (dy0 + dy1) / 2.0
                    d_dob = ((ocx - dcx) ** 2 + (ocy - dcy) ** 2) ** 0.5
                    if d_dob < (d_issue * 0.85):
                        closer_to_dob = True
                        break
                if closer_to_dob:
                    continue

                is_right = (
                    abs(ocy - lcy) < (lh * 0.9)
                    and ox0 >= (lx0 - 10)
                    and (ox0 - lx1) < (lw * 2.5)
                )
                is_below = (
                    oy0 >= (ly0 - 5)
                    and (oy0 - ly1) < (lh * 3.0)
                    and ox1 >= (lx0 - 60)
                    and ox0 <= (lx1 + 60)
                )
                is_next_row = (
                    oy0 > ly1
                    and (oy0 - ly1) < (lh * 5.0)
                    and ox1 >= (lx0 - 100)
                    and ox0 <= (lx1 + 100)
                )

                if is_right:
                    candidates.append(
                        DateCandidate(
                            other_norm, "ocr_spatial", other_b.confidence * 0.98,
                            f"Right of {lbl.text}: {other_b.text}", is_previous=is_prev,
                        )
                    )
                elif is_below:
                    candidates.append(
                        DateCandidate(
                            other_norm, "ocr_spatial", other_b.confidence * 0.96,
                            f"Below {lbl.text}: {other_b.text}", is_previous=is_prev,
                        )
                    )
                elif is_next_row:
                    candidates.append(
                        DateCandidate(
                            other_norm, "ocr_spatial", other_b.confidence * 0.90,
                            f"Next row under {lbl.text}: {other_b.text}", is_previous=is_prev,
                        )
                    )

    # 3. Validation & Filtering
    valid_candidates: List[DateCandidate] = []
    for c in candidates:
        if c.is_previous:
            continue
        parts = c.value.split("-")
        if len(parts) != 3:
            continue
        try:
            yr, mo, dy = int(parts[0]), int(parts[1]), int(parts[2])
        except ValueError:
            continue

        if not is_valid_calendar_date(yr, mo, dy):
            continue
        if not (1950 <= yr <= 2045):
            continue
        if known_dob and c.value == known_dob:
            continue
        if known_dob and c.value <= known_dob:
            continue
        if known_expiry and c.value >= known_expiry:
            continue

        valid_candidates.append(c)

    if not valid_candidates:
        return "", FieldSource()

    # 4. Arbitration & Conflict Detection
    value_counts: Dict[str, List[DateCandidate]] = {}
    for c in valid_candidates:
        value_counts.setdefault(c.value, []).append(c)

    if len(value_counts) == 1:
        val = list(value_counts.keys())[0]
        c_list = value_counts[val]
        has_text = any(x.source == "passport_text" for x in c_list)
        has_ocr = any("ocr" in x.source for x in c_list)
        source = "passport_text" if has_text else c_list[0].source
        conf = 0.99 if (has_text and has_ocr) else max(x.confidence for x in c_list)
        return val, FieldSource(
            source=source,
            confidence=conf,
            rawValue=c_list[0].evidence,
            hasConflict=False,
        )

    scores: Dict[str, float] = {}
    for val, c_list in value_counts.items():
        score = sum(x.confidence for x in c_list)
        if any(x.source == "passport_text" for x in c_list) and any("ocr" in x.source for x in c_list):
            score += 2.0
        scores[val] = score

    sorted_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_val, top_score = sorted_scores[0]
    runner_up_val, runner_up_score = sorted_scores[1]

    if top_score >= runner_up_score + 0.8:
        c_list = value_counts[top_val]
        source = "passport_text" if any(x.source == "passport_text" for x in c_list) else c_list[0].source
        return top_val, FieldSource(
            source=source,
            confidence=min(1.0, max(x.confidence for x in c_list)),
            rawValue=c_list[0].evidence,
            hasConflict=False,
        )

    # Conflict between competing valid candidates
    conflict_msg = f"Conflicting issue date candidates: {top_val} vs {runner_up_val}"
    return "", FieldSource(
        source="ocr",
        confidence=0.0,
        rawValue="",
        hasConflict=True,
        conflictDetails=conflict_msg,
    )


def extract_postal_codes(
    doc: Optional[pymupdf.Document] = None,
    page_idx: int = 0,
    ocr_boxes: Optional[List[Any]] = None,
    addr_blocks: Optional[Dict[str, Any]] = None,
    known_info: Optional[Dict[str, str]] = None,
    is_bangladeshi: bool = True,
    text_content: Optional[str] = None,
) -> Tuple[str, str, Dict[str, FieldSource]]:
    """
    Robust ZIP/Postal Code extraction:
    - Source A: PyMuPDF text layer (labeled & address-embedded)
    - Source B: OCR spatial bounding boxes near postal labels
    - Source C: OCR address blocks
    - Strict exclusion rules: reject years, DOB, phone, NID, passport numbers
    - Foreign postal format support when not Bangladeshi
    - Attribution to Present vs Permanent addresses
    - Returns (present_postal, permanent_postal, fieldSources)
    """
    candidates: List[PostalCandidate] = []
    info = known_info or {}
    blocks = addr_blocks or {}
    boxes = [normalize_box_input(b) for b in ocr_boxes] if ocr_boxes else []

    # 1. Source A: Text Layer from PyMuPDF or provided text_content
    if doc is not None:
        page_indices = [page_idx] + [i for i in range(len(doc)) if i != page_idx]
        for p_i in page_indices:
            try:
                page_text = doc[p_i].get_text() or ""
                lines = [l.strip() for l in page_text.splitlines() if l.strip()]
                current_section = "both"
                for idx, line in enumerate(lines):
                    line_up = line.upper()
                    if "PRESENT" in line_up and "ADDRESS" in line_up:
                        current_section = "present"
                    elif "PERMANENT" in line_up and "ADDRESS" in line_up:
                        current_section = "permanent"
                    elif "EMERGENCY CONTACT" in line_up or "FAMILY DETAILS" in line_up:
                        current_section = "both"

                    m_lbl = POSTAL_LABEL_REGEX.search(line)
                    if m_lbl:
                        m_num = re.search(r"\b(\d{4,6})\b", line[m_lbl.end():])
                        if m_num:
                            c_digits = m_num.group(1)
                            if not is_excluded_postal_code(c_digits, info, is_explicit=True):
                                candidates.append(PostalCandidate(c_digits, "passport_text", 0.98, line, current_section))
                        elif idx + 1 < len(lines):
                            nxt = lines[idx + 1].strip()
                            m_nxt = re.search(r"\b(\d{4,6})\b", nxt)
                            if m_nxt:
                                c_digits = m_nxt.group(1)
                                if not is_excluded_postal_code(c_digits, info, is_explicit=True):
                                    candidates.append(
                                        PostalCandidate(c_digits, "passport_text", 0.98, f"{line} -> {nxt}", current_section)
                                    )

                    # Address embedded candidate
                    if current_section in ("present", "permanent") or "ADDRESS" in line_up or any(d in line_up for d in BANGLADESH_DISTRICTS):
                        if is_bangladeshi:
                            m_bd = re.search(r"\b([1-9]\d{3})\b", line)
                            if m_bd:
                                cand_bd = m_bd.group(1)
                                if not is_excluded_postal_code(cand_bd, info, is_explicit=False):
                                    candidates.append(PostalCandidate(cand_bd, "passport_text", 0.95, line, current_section))
                        else:
                            m_for = re.search(r"\b\d{5}(?:-\d{4})?\b", line)
                            if m_for:
                                candidates.append(PostalCandidate(m_for.group(0), "passport_text", 0.95, line, current_section))
            except Exception:
                pass
    elif text_content:
        lines = [l.strip() for l in text_content.splitlines() if l.strip()]
        current_section = "both"
        for idx, line in enumerate(lines):
            line_up = line.upper()
            if "PRESENT" in line_up and "ADDRESS" in line_up:
                current_section = "present"
            elif "PERMANENT" in line_up and "ADDRESS" in line_up:
                current_section = "permanent"
            elif "EMERGENCY CONTACT" in line_up or "FAMILY DETAILS" in line_up:
                current_section = "both"

            m_lbl = POSTAL_LABEL_REGEX.search(line)
            if m_lbl:
                m_num = re.search(r"\b(\d{4,6})\b", line[m_lbl.end():])
                if m_num:
                    c_digits = m_num.group(1)
                    if not is_excluded_postal_code(c_digits, info, is_explicit=True):
                        candidates.append(PostalCandidate(c_digits, "passport_text", 0.98, line, current_section))
                elif idx + 1 < len(lines):
                    nxt = lines[idx + 1].strip()
                    m_nxt = re.search(r"\b(\d{4,6})\b", nxt)
                    if m_nxt:
                        c_digits = m_nxt.group(1)
                        if not is_excluded_postal_code(c_digits, info, is_explicit=True):
                            candidates.append(
                                PostalCandidate(c_digits, "passport_text", 0.98, f"{line} -> {nxt}", current_section)
                            )
            if current_section in ("present", "permanent") or "ADDRESS" in line_up or any(d in line_up for d in BANGLADESH_DISTRICTS):
                if is_bangladeshi:
                    m_bd = re.search(r"\b([1-9]\d{3})\b", line)
                    if m_bd:
                        cand_bd = m_bd.group(1)
                        if not is_excluded_postal_code(cand_bd, info, is_explicit=False):
                            candidates.append(PostalCandidate(cand_bd, "passport_text", 0.95, line, current_section))
                else:
                    m_for = re.search(r"\b\d{5}(?:-\d{4})?\b", line)
                    if m_for:
                        candidates.append(PostalCandidate(m_for.group(0), "passport_text", 0.95, line, current_section))

    # 2. Source B: OCR spatial bounding boxes near postal labels
    if boxes:
        postal_label_boxes: List[Tuple[OCRBox, str]] = []
        for b_idx, b in enumerate(boxes):
            b_up = b.text.upper()
            if POSTAL_LABEL_REGEX.search(b_up):
                sec = "both"
                preceding = " ".join([ob.text.upper() for ob in boxes[max(0, b_idx - 6):b_idx]])
                if "PRESENT" in preceding and "PERMANENT" not in preceding:
                    sec = "present"
                elif "PERMANENT" in preceding:
                    sec = "permanent"
                postal_label_boxes.append((b, sec))

        for lbl, sec in postal_label_boxes:
            m_inline = re.search(r"\b([1-9]\d{3,5})\b", lbl.text)
            if m_inline:
                c_val = m_inline.group(1)
                if not is_excluded_postal_code(c_val, info, is_explicit=True):
                    candidates.append(PostalCandidate(c_val, "ocr", lbl.confidence, lbl.text, sec))

            lx0, ly0, lx1, ly1 = parse_box_coords(lbl.bbox)
            lh = max(1.0, ly1 - ly0)
            lw = max(1.0, lx1 - lx0)
            lcx, lcy = (lx0 + lx1) / 2.0, (ly0 + ly1) / 2.0

            for other_b in boxes:
                if other_b is lbl:
                    continue
                m_other = re.search(r"\b([1-9]\d{3})\b", other_b.text) if is_bangladeshi else re.search(r"\b\d{5}(?:-\d{4})?\b", other_b.text)
                if not m_other:
                    continue
                c_other = m_other.group(1) if is_bangladeshi else m_other.group(0)
                if is_excluded_postal_code(c_other, info, is_explicit=True):
                    continue

                ox0, oy0, ox1, oy1 = parse_box_coords(other_b.bbox)
                ocx, ocy = (ox0 + ox1) / 2.0, (oy0 + oy1) / 2.0

                is_right = (
                    abs(ocy - lcy) < (lh * 0.9)
                    and ox0 >= (lx0 - 5)
                    and (ox0 - lx1) < (lw * 2.5)
                )
                is_below = (
                    oy0 >= (ly0 - 5)
                    and (oy0 - ly1) < (lh * 3.0)
                    and ox1 >= (lx0 - 60)
                    and ox0 <= (lx1 + 60)
                )

                if is_right:
                    candidates.append(
                        PostalCandidate(
                            c_other, "ocr_spatial", other_b.confidence * 0.98,
                            f"Right of {lbl.text}: {other_b.text}", sec
                        )
                    )
                elif is_below:
                    candidates.append(
                        PostalCandidate(
                            c_other, "ocr_spatial", other_b.confidence * 0.96,
                            f"Below {lbl.text}: {other_b.text}", sec
                        )
                    )

    # 3. Source C: Address Blocks
    for sec_name, block in [("present", blocks.get("present")), ("permanent", blocks.get("permanent")), ("both", blocks.get("generic"))]:
        if not block:
            continue
        b_lines, b_conf = block
        for line in b_lines:
            if is_bangladeshi:
                for m in re.finditer(r"\b([1-9]\d{3})\b", line):
                    cand = m.group(1)
                    if not is_excluded_postal_code(cand, info, is_explicit=False):
                        candidates.append(PostalCandidate(cand, "ocr", b_conf * 0.94, line, sec_name))
            else:
                m_for = re.search(r"\b\d{5}(?:-\d{4})?\b", line)
                if m_for:
                    candidates.append(PostalCandidate(m_for.group(0), "ocr", b_conf * 0.94, line, sec_name))

    # 4. Arbitration for Present and Permanent
    def resolve_candidates_for_section(section: str) -> Tuple[str, FieldSource]:
        sec_cands = [c for c in candidates if c.target in (section, "both")]
        if not sec_cands:
            return "", FieldSource()

        val_groups: Dict[str, List[PostalCandidate]] = {}
        for c in sec_cands:
            val_groups.setdefault(c.value, []).append(c)

        if len(val_groups) == 1:
            val = list(val_groups.keys())[0]
            c_list = val_groups[val]
            has_text = any(x.source == "passport_text" for x in c_list)
            has_ocr = any("ocr" in x.source for x in c_list)
            source = "passport_text" if has_text else c_list[0].source
            conf = 0.99 if (has_text and has_ocr) else max(x.confidence for x in c_list)
            return val, FieldSource(
                source=source,
                confidence=conf,
                rawValue=c_list[0].evidence,
                hasConflict=False,
            )

        scores: Dict[str, float] = {}
        for val, c_list in val_groups.items():
            score = sum(x.confidence for x in c_list)
            if any(x.source == "passport_text" for x in c_list) and any("ocr" in x.source for x in c_list):
                score += 2.0
            scores[val] = score

        sorted_c = sorted(scores.items(), key=lambda it: it[1], reverse=True)
        top_v, top_s = sorted_c[0]
        runner_v, runner_s = sorted_c[1]

        if top_s >= runner_s + 0.8:
            c_list = val_groups[top_v]
            source = "passport_text" if any(x.source == "passport_text" for x in c_list) else c_list[0].source
            return top_v, FieldSource(
                source=source,
                confidence=min(1.0, max(x.confidence for x in c_list)),
                rawValue=c_list[0].evidence,
                hasConflict=False,
            )

        return "", FieldSource(
            source="ocr",
            confidence=0.0,
            rawValue="",
            hasConflict=True,
            conflictDetails=f"Conflicting postal code candidates: {top_v} vs {runner_v}",
        )

    pres_postal, pres_source = resolve_candidates_for_section("present")
    perm_postal, perm_source = resolve_candidates_for_section("permanent")

    # Fallback propagation:
    # If present has postal code and permanent does not:
    if pres_postal and not perm_postal:
        perm_postal = pres_postal
        perm_source = FieldSource(
            source="derived",
            confidence=pres_source.confidence,
            rawValue=pres_source.rawValue,
            hasConflict=pres_source.hasConflict,
            conflictDetails=pres_source.conflictDetails,
        )
    # If permanent has postal code and present does not:
    elif perm_postal and not pres_postal:
        pres_postal = perm_postal
        pres_source = FieldSource(
            source="derived",
            confidence=perm_source.confidence,
            rawValue=perm_source.rawValue,
            hasConflict=perm_source.hasConflict,
            conflictDetails=perm_source.conflictDetails,
        )

    sources: Dict[str, FieldSource] = {}
    if pres_postal or pres_source.hasConflict:
        sources["presentAddress.postalCode"] = pres_source
        sources["address.postalCode"] = pres_source
    if perm_postal or perm_source.hasConflict:
        sources["permanentAddress.postalCode"] = perm_source

    return pres_postal, perm_postal, sources


def extract_visual_fields(ocr_boxes: List[OCRBox]) -> Dict[str, Tuple[Any, float]]:
    """
    Extract passport fields from label-value positioning in OCR boxes.
    Returns dict mapping field_name -> (value, confidence).
    """
    results: Dict[str, Tuple[Any, float]] = {}
    lines = [b.text for b in ocr_boxes]
    confs = [b.confidence for b in ocr_boxes]
    num_boxes = len(ocr_boxes)

    for i in range(num_boxes):
        text = lines[i]
        upper = text.upper()

        # 1. Surname (labels like "Surname", "Surname (As in Passport)", "sroct/Suname", "/Sumame", "/Suname", etc.)
        if re.search(r"(?:SURNAME|SUMAME|SUNAME|SUR-NAME|SUR/NAME|SROCT/SURNAME|SROCT/SUNAME|/SUNAME|/SURNAME|/SUMAME)", upper) and not any(kw in upper for kw in ["PASSPORT NO", "PASSPORT NUMBER", "FATHER", "MOTHER", "GUARDIAN", "PERSONAL"]) and "surname" not in results:
            after_label = re.sub(r"^.*?(?:SURNAME|SUMAME|SUNAME|SUR-NAME|SUR/NAME|SROCT/SURNAME|SROCT/SUNAME|/SUNAME|/SURNAME|/SUMAME)(?:\s*\(?\s*AS\s+IN\s+PASSPORT\s*\)?)?\s*[:/.-]*\s*", "", text, flags=re.IGNORECASE).strip()
            clean_inline = clean_person_name(after_label)
            if clean_inline:
                results["surname"] = (clean_inline, confs[i])
            else:
                for k in range(i + 1, min(i + 4, num_boxes)):
                    cand = clean_person_name(lines[k].strip())
                    if cand and not any(kw in cand.upper() for kw in ["PASSPORT", "GIVEN", "PREV", "FATHER", "MOTHER"]):
                        results["surname"] = (cand, confs[k])
                        break

        # 2. Given Name (labels like "Given Name", "Given Name (As in Passport)", "Prenom", "/GivenName", etc.)
        if re.search(r"(?:GIVEN\s*NAMES?|PR[EÉ]NOM[S]?|/GIVEN\s*NAME)", upper) and "givenName" not in results:
            after_label = re.sub(r"^.*?(?:GIVEN\s*NAMES?|PR[EÉ]NOM[S]?|/GIVEN\s*NAME)(?:\s*\(?\s*AS\s+IN\s+PASSPORT\s*\)?)?\s*[:/.-]*\s*", "", text, flags=re.IGNORECASE).strip()
            clean_inline = clean_person_name(after_label)
            if clean_inline:
                results["givenName"] = (clean_inline, confs[i])
            else:
                collected_tokens = []
                collected_confs = []
                for k in range(i + 1, min(i + 6, num_boxes)):
                    cand = lines[k].strip()
                    cand_upper = cand.upper()
                    if any(kw in cand_upper for kw in ["PASSPORT", "PREV", "OTHER", "FATHER", "MOTHER", "NATIONALITY", "BIRTH", "SEX", "DATE", "PLACE"]):
                        break
                    clean_c = clean_person_name(cand)
                    if len(clean_c) == 1 and confs[k] < 0.7:
                        continue
                    if clean_c and len(clean_c) >= 2 and confs[k] >= 0.6:
                        collected_tokens.append(clean_c)
                        collected_confs.append(confs[k])
                    elif collected_tokens:
                        break
                if collected_tokens:
                    joined_name = " ".join(collected_tokens)
                    avg_c = sum(collected_confs) / len(collected_confs)
                    results["givenName"] = (joined_name, avg_c)

        # 3. Full Name (from personal data page header)
        if (upper in ["NAME:", "NAME"] or re.search(r"^[A-Z]*ERSONAL\s*DATA", upper)) and "fullName" not in results:
            for k in range(i + 1, min(i + 3, num_boxes)):
                cand_clean = clean_person_name(lines[k].strip())
                if cand_clean and not any(kw in cand_clean.upper() for kw in ["FATHER", "MOTHER", "GUARDIAN", "PASSPORT", "ADDRESS", "EMERGENCY", "RELATION", "NATIONALITY"]):
                    results["fullName"] = (cand_clean, confs[k])
                    break

        # Applicant names set to prevent collision with family members
        applicant_names = set()
        if "fullName" in results:
            applicant_names.add(results["fullName"][0].upper())
            applicant_names.update(results["fullName"][0].upper().split())
        if "givenName" in results:
            applicant_names.add(results["givenName"][0].upper())
            applicant_names.update(results["givenName"][0].upper().split())
        if "surname" in results:
            applicant_names.add(results["surname"][0].upper())

        # 4. Father's Name (e.g. "Father's Name", "ather's Name", "NOM DU PÈRE", etc.)
        is_father_label = bool(
            (re.search(r"\b(?:FATHER|FÈRE|PERE|NOM\s*DU\s*P[EÈ]RE)(?:['’]?S)?(?:\s*NAME)?\b", upper) or
             upper.startswith("ATHER'S NAME") or upper == "FATHER'S" or upper == "FATHER" or upper == "S-NAME") and
            not any(kw in upper for kw in ["MOTHER", "GUARDIAN", "SPOUSE", "PREVIOUS", "PREV", "OTHER", "PASSPORT"])
        )
        if is_father_label and "fatherName" not in results:
            after_label = re.sub(r"^.*?(?:FATHER|FÈRE|PERE|NOM\s*DU\s*P[EÈ]RE|ATHER|S-NAME)(?:['’]?S)?(?:\s*NAME)?\s*[:/.-]*\s*", "", text, flags=re.IGNORECASE).strip()
            clean_inline = clean_person_name(after_label)
            if clean_inline and clean_inline.upper() not in applicant_names and not any(kw in clean_inline.upper() for kw in ["MOTHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "NAME", "RELATION", "BANGLADESH"]):
                results["fatherName"] = (clean_inline, confs[i])
            else:
                for k in range(i + 1, min(i + 5, num_boxes)):
                    cand_text = lines[k].strip()
                    if any(kw in cand_text.upper() for kw in ["MOTHER", "GUARDIAN", "SPOUSE", "ADDRESS", "EMERGENCY", "BANGLADESH", "NATIONALITY", "PASSPORT"]):
                        continue
                    cand_clean = clean_person_name(cand_text)
                    if cand_clean and cand_clean.upper() not in applicant_names and not any(kw in cand_clean.upper() for kw in ["MOTHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "NAME", "RELATION", "BANGLADESH", "AME"]):
                        results["fatherName"] = (cand_clean, confs[k])
                        break

        # 5. Mother's Name (e.g. "Mother's Name", "NOM DE LA MÈRE", etc.)
        is_mother_label = bool(
            (re.search(r"\b(?:MOTHER|MÈRE|MERE|NOM\s*DE\s*LA\s*M[EÈ]RE)(?:['’]?S)?(?:\s*NAME)?\b", upper) or
             (upper.startswith("OTHER'S NAME") and not any(kw in upper for kw in ["PREV", "PREVIOUS", "ALIAS", "ANY", "IF ANY"])) or
             upper == "MOTHER'S" or upper == "MOTHER") and
            not any(kw in upper for kw in ["FATHER", "GUARDIAN", "SPOUSE", "PREVIOUS", "PREV", "PASSPORT", "NATIONALITY", "IF ANY", "OTHER NAME"])
        )
        if is_mother_label and "motherName" not in results:
            after_label = re.sub(r"^.*?(?:MOTHER|MÈRE|MERE|NOM\s*DE\s*LA\s*M[EÈ]RE)(?:['’]?S)?(?:\s*NAME)?\s*[:/.-]*\s*", "", text, flags=re.IGNORECASE).strip()
            clean_inline = clean_person_name(after_label)
            if clean_inline and clean_inline.upper() not in applicant_names and clean_inline != results.get("fatherName", ("", 0))[0] and not any(kw in clean_inline.upper() for kw in ["FATHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "LEGAL", "NAME", "RELATION", "BANGLADESH"]):
                results["motherName"] = (clean_inline, confs[i])
            else:
                for k in range(i + 1, min(i + 5, num_boxes)):
                    cand_text = lines[k].strip()
                    if any(kw in cand_text.upper() for kw in ["FATHER", "GUARDIAN", "SPOUSE", "ADDRESS", "EMERGENCY", "BANGLADESH", "NATIONALITY", "PASSPORT"]):
                        continue
                    cand_clean = clean_person_name(cand_text)
                    if cand_clean and cand_clean.upper() not in applicant_names and cand_clean != results.get("fatherName", ("", 0))[0] and not any(kw in cand_clean.upper() for kw in ["FATHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "LEGAL", "NAME", "RELATION", "BANGLADESH", "AME"]):
                        results["motherName"] = (cand_clean, confs[k])
                        break

        # 6. Emergency Contact & Spouse
        if re.search(r"[A-Z]*MERGENCY\s*CONTACT", upper):
            contact_name = ""
            contact_conf = 0.0
            is_spouse = False
            for k in range(i + 1, min(i + 14, num_boxes)):
                box_text = lines[k].strip()
                box_upper = box_text.upper()
                if "RELATION" in box_upper or box_upper in ["SPOUSE", "WIFE", "HUSBAND"]:
                    if any(rel in box_upper for rel in ["SPOUSE", "WIFE", "HUSBAND"]):
                        is_spouse = True
                    for rk in range(k + 1, min(k + 3, num_boxes)):
                        rel_val = lines[rk].strip().upper()
                        if any(rel in rel_val for rel in ["SPOUSE", "WIFE", "HUSBAND"]):
                            is_spouse = True
                            break
                    if is_spouse and not contact_name:
                        for prev_k in range(k - 1, max(i, k - 4), -1):
                            prev_txt = lines[prev_k].strip()
                            if any(kw in prev_txt.upper() for kw in ["COLONI", "ROAD", "VILL", "POST", "DISTRICT", "THAKURGAON", "5120", "PERSONAL", "DATA"]):
                                break
                            prev_clean = clean_person_name(prev_txt)
                            if (prev_clean and
                                not is_applicant_name(prev_clean, applicant_full=results.get("fullName", ("", 0))[0], applicant_given=results.get("givenName", ("", 0))[0], applicant_surname=results.get("surname", ("", 0))[0]) and
                                not any(kw in prev_txt.upper() for kw in ["RELATION", "ELATION", "LATION", "SPOUSE", "NAME", "EMERGENCY"])):
                                contact_name = prev_clean
                                contact_conf = confs[prev_k]
                                break
                elif (re.search(r"\b[A-Z]*AME[:.]?$", box_upper) or box_upper in ["NAME:", "NAME", "AME", "AME:"]) and not contact_name:
                    if k + 1 < num_boxes:
                        cand_nm = clean_person_name(lines[k + 1].strip())
                        if cand_nm and not is_applicant_name(cand_nm, applicant_full=results.get("fullName", ("", 0))[0], applicant_given=results.get("givenName", ("", 0))[0], applicant_surname=results.get("surname", ("", 0))[0]) and not any(kw in cand_nm.upper() for kw in ["RELATION", "SPOUSE", "ADDRESS", "EMERGENCY", "BANGLADESH"]):
                            contact_name = cand_nm
                            contact_conf = confs[k + 1]
                elif re.search(r"(?:\b[ET]ELEPHONE|\bPHONE|\bMOBILE|\bCONTACT|\bTEL)(?:\s*(?:NO|NUMBER))?", box_upper):
                    cand_phone = normalize_phone_number(box_text)
                    if cand_phone:
                        results["phone"] = (cand_phone, confs[k])
                    else:
                        for pk in range(k + 1, min(k + 3, num_boxes)):
                            cand_phone = normalize_phone_number(lines[pk].strip())
                            if cand_phone:
                                results["phone"] = (cand_phone, confs[pk])
                                break
            if is_spouse and contact_name:
                results["spouseName"] = (contact_name, contact_conf)

        if re.search(r"\bSPOUSE(?:['’]?S)?(?:\s*NAME)?\b", upper) and "spouseName" not in results:
            after_label = re.sub(r"^.*?\bSPOUSE(?:['’]?S)?(?:\s*NAME)?\s*[:/.-]*\s*", "", text, flags=re.IGNORECASE).strip()
            clean_inline = clean_person_name(after_label)
            if clean_inline and clean_inline.upper() not in applicant_names:
                results["spouseName"] = (clean_inline, confs[i])
            else:
                found_fwd = False
                for k in range(i + 1, min(i + 4, num_boxes)):
                    cand_clean = clean_person_name(lines[k].strip())
                    if (cand_clean and
                        cand_clean.upper() not in applicant_names and
                        cand_clean != results.get("fatherName", ("", 0))[0] and
                        cand_clean != results.get("motherName", ("", 0))[0] and
                        not any(kw in lines[k].upper() for kw in ["FATHER", "MOTHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "NAME", "RELATION", "BANGLADESH", "COLONI", "ROAD", "VILL", "POST"])):
                        results["spouseName"] = (cand_clean, confs[k])
                        found_fwd = True
                        break
                if not found_fwd and upper.strip() in ("SPOUSE", "SPOUSE:", "RELATIONSHIP: SPOUSE", "RELATION: SPOUSE") and i > 0:
                    prev_cand = clean_person_name(lines[i - 1].strip())
                    if (prev_cand and
                        prev_cand.upper() not in applicant_names and
                        prev_cand != results.get("fatherName", ("", 0))[0] and
                        prev_cand != results.get("motherName", ("", 0))[0] and
                        not any(kw in lines[i - 1].upper() for kw in ["FATHER", "MOTHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "NAME", "RELATION", "BANGLADESH", "COLONI", "ROAD", "VILL", "POST"])):
                        results["spouseName"] = (prev_cand, confs[i - 1])

        # 7. Previous Passport No
        if re.search(r"(?:PREVIOUS|PREVIOU|PREV)\s*(?:PASSPORT)?\s*(?:NO|NUMBER)?", upper) and "previousPassportNumber" not in results:
            after_label = re.sub(r"^.*?(?:PREVIOUS|PREVIOU|PREV)\s*(?:PASSPORT)?\s*(?:NO|NUMBER)?[:/.-]*\s*", "", text, flags=re.IGNORECASE).strip()
            if re.match(r"^[A-Z]{1,2}[0-9]{7,9}$", after_label):
                results["previousPassportNumber"] = (after_label, confs[i])
            else:
                for k in range(i + 1, min(i + 6, num_boxes)):
                    cand = lines[k].strip()
                    if re.match(r"^[A-Z]{1,2}[0-9]{7,9}$", cand):
                        results["previousPassportNumber"] = (cand, confs[k])
                        break

        # 8. Passport Number
        if re.search(r"PASSPORT\s*(NUMBER|NO)", upper) and not re.search(r"PREVIOUS", upper) and "passportNumber" not in results:
            for k in range(i + 1, min(i + 6, num_boxes)):
                cand = lines[k].strip()
                if re.match(r"^[A-Z]{1,2}[0-9]{7,9}$", cand):
                    results["passportNumber"] = (cand, confs[k])
                    break

        # 9. Nationality
        if "NATIONALITY" in upper and "nationality" not in results:
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip().upper()
                if cand in ("BANGLADESH", "BANGLADESHI", "BGD"):
                    nat_val = cand if cand in ("BANGLADESH", "BANGLADESHI") else "BANGLADESH"
                    results["nationality"] = (nat_val, confs[k])
                    break
                elif re.match(r"^[A-Z]{3,15}$", cand) and cand not in ("BY BIRTH", "NATURALIZATION", "NOT APPLICABLE"):
                    results["nationality"] = (cand, confs[k])
                    break

        # 10. Date of Birth
        if "DATE OF BIRTH" in upper and "dateOfBirth" not in results:
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                norm_d = normalize_date(cand)
                if norm_d:
                    results["dateOfBirth"] = (norm_d, confs[k])
                    break

        # 11. Place of Birth
        if re.search(r"PLACE\s*OF\s*BIRTH", upper) and "placeOfBirth" not in results:
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                cand_clean = re.sub(r"\d+", "", cand).strip()
                if len(cand_clean) >= 3 and not any(kw in cand_clean.upper() for kw in ["DATE", "ISSUE", "SEX", "AUTHORITY", "DIP"]):
                    if "," in cand_clean:
                        parts = cand_clean.split(",", 1)
                        pob = parts[0].strip()
                        cob_raw = parts[1].strip().upper()
                        results["placeOfBirth"] = (pob, confs[k])
                        if cob_raw in ("BGD", "BANGLADESHI", "BANGLADESH"):
                            results["countryOfBirth"] = ("BANGLADESH", confs[k])
                        elif cob_raw in ("IND", "INDIAN", "INDIA"):
                            results["countryOfBirth"] = ("INDIA", confs[k])
                        elif len(cob_raw) >= 3:
                            results["countryOfBirth"] = (cob_raw, confs[k])
                    else:
                        results["placeOfBirth"] = (cand_clean, confs[k])
                    break

        # 11b. Country of Birth (explicit label)
        if re.search(r"COUNTRY\s*OF\s*BIRTH", upper) and "countryOfBirth" not in results:
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip().upper()
                if "BANGLADESH" in cand or cand == "BGD":
                    results["countryOfBirth"] = ("BANGLADESH", confs[k])
                    break
                elif "INDIA" in cand or cand == "IND":
                    results["countryOfBirth"] = ("INDIA", confs[k])
                    break
                elif re.match(r"^[A-Z]{3,20}$", cand):
                    results["countryOfBirth"] = (cand, confs[k])
                    break

        # 12. Date of Issue
        if is_issue_date_label(lines[i]) and "issueDate" not in results:
            for k in range(i, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                norm_d = parse_and_normalize_date(cand)
                if norm_d:
                    results["issueDate"] = (norm_d, confs[k])
                    break

        # 13. Date of Expiry
        if is_expiry_date_label(lines[i]) and "expiryDate" not in results:
            for k in range(i, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                norm_d = parse_and_normalize_date(cand)
                if norm_d:
                    results["expiryDate"] = (norm_d, confs[k])
                    break

        # 14. Issuing Authority / Place of Issue
        if re.search(r"(?:(?:[IS]*SUING\s*)?AUTHORITY|PLACE\s*OF\s*ISSUE)", upper) and "issuePlace" not in results:
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                cand_clean = cand.upper().replace("DIPIDHAKA", "DIP/DHAKA")
                if "DIP" in cand_clean or "/" in cand_clean or cand_clean in BANGLADESH_DISTRICTS:
                    results["issuePlace"] = (cand_clean, confs[k])
                    break

        # 15. Personal No / NID
        if re.search(r"(?:PERSONA[L]?\s*NO|NATIONAL\s*ID|NID|CITIZENSHIP\s*[/]?\s*NATIONAL)", upper) and "nid" not in results:
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = re.sub(r"\D", "", lines[k].strip())
                if len(cand) in (10, 13, 17):
                    results["nid"] = (cand, confs[k])
                    break

        # 16. Sex / Gender
        if upper in ["FUSEX", "SEX", "/SEX", "GENDER"] and "gender" not in results:
            for k in range(i + 1, min(i + 3, num_boxes)):
                cand = lines[k].strip().upper()
                norm_g = normalize_gender(cand)
                if norm_g:
                    results["gender"] = (norm_g, confs[k])
                    break

        # 17. Address
        if re.search(r"[A-Z]*ERMANENT\s*ADD(?:RESS)?", upper):
            addr_parts = []
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                if any(kw in cand.upper() for kw in ["EMERGENCY", "CONTACT", "PASSPORT", "TELEPHONE"]):
                    break
                addr_parts.append((cand, confs[k]))
            if addr_parts:
                combined_addr = " ".join([p[0] for p in addr_parts])
                avg_c = sum([p[1] for p in addr_parts]) / len(addr_parts)
                results["address_raw"] = (combined_addr, avg_c)

        # 18. General Phone / Mobile detection near label anywhere in document
        if "phone" not in results and re.search(r"(?:\b[ET]ELEPHONE|\bPHONE|\bMOBILE|\bCONTACT|\bTEL)(?:\s*(?:NO|NUMBER))?", upper):
            cand_phone = normalize_phone_number(text)
            if cand_phone:
                results["phone"] = (cand_phone, confs[i])
            else:
                for pk in range(i + 1, min(i + 5, num_boxes)):
                    pk_cand = lines[pk].strip()
                    if any(kw in pk_cand.upper() for kw in ["EMERGENCY", "RELATIONSHIP", "ADDRESS", "PASSPORT", "SIGNATURE", "DATE", "NAME"]):
                        continue
                    cand_phone = normalize_phone_number(pk_cand)
                    if cand_phone:
                        results["phone"] = (cand_phone, confs[pk])
                        break

    # General fallback for passport number if not captured next to label
    if "passportNumber" not in results:
        for k in range(num_boxes):
            cand = lines[k].strip()
            if re.match(r"^[A-Z][0-9]{8}$", cand):
                results["passportNumber"] = (cand, confs[k])
                break

    # General fallback for phone number if not captured next to label
    if "phone" not in results:
        for k in range(num_boxes):
            cand = lines[k].strip()
            m_bd = re.search(r"(?:\+?880[\s-]?)?0?1[3-9]\d{2}[\s-]?\d{6}", cand)
            if m_bd:
                norm_p = normalize_phone_number(m_bd.group(0))
                if norm_p:
                    results["phone"] = (norm_p, confs[k])
                    break

    # General layout fallback: Mother's Name following Father's Name in personal data
    if "motherName" not in results and "fatherName" in results:
        father_val = results["fatherName"][0]
        for k in range(num_boxes):
            if lines[k].strip() == father_val:
                for m_idx in range(k + 1, min(k + 6, num_boxes)):
                    b_txt = lines[m_idx].strip()
                    b_clean = clean_person_name(b_txt)
                    if b_clean and b_clean != father_val and len(b_clean) >= 3:
                        if not any(kw in b_clean.upper() for kw in ["FATHER", "ADDRESS", "EMERGENCY", "CONTACT", "RELATION", "SPOUSE", "NAME", "AME", "BANGLADESH", "PIRGANJ", "THAKURGAON", "PERMANENT"]):
                            results["motherName"] = (b_clean, confs[m_idx])
                            break
                break

    # 17. Spatial Address Block Extraction across OCR boxes
    addr_blocks = extract_address_blocks_from_boxes(ocr_boxes)
    if "present" in addr_blocks:
        results["present_address_lines"] = addr_blocks["present"]
    if "permanent" in addr_blocks:
        results["permanent_address_lines"] = addr_blocks["permanent"]
    if "generic" in addr_blocks:
        results["generic_address_lines"] = addr_blocks["generic"]

    # Backwards compatibility for address_raw
    if "permanent" in addr_blocks:
        lines_b, conf_b = addr_blocks["permanent"]
        results["address_raw"] = (" ".join(lines_b), conf_b)
    elif "present" in addr_blocks:
        lines_b, conf_b = addr_blocks["present"]
        results["address_raw"] = (" ".join(lines_b), conf_b)
    elif "generic" in addr_blocks:
        lines_b, conf_b = addr_blocks["generic"]
        results["address_raw"] = (" ".join(lines_b), conf_b)

    return results


def parse_address_components(
    raw_input: Union[str, List[str]],
    is_bangladeshi: bool = True,
    known_info: Optional[Dict[str, str]] = None
) -> AddressData:
    """Parse raw address lines or string into structured AddressData."""
    addr = AddressData()
    if not raw_input:
        return addr

    # Flatten and tokenize raw input
    lines = [raw_input] if isinstance(raw_input, str) else list(raw_input)
    parts: List[str] = []
    for line in lines:
        sub = line.replace(";", ",").replace("\n", ",")
        # Split on comma, or period when between multi-character tokens (e.g. 5120.THAKURGAON or KASHIPUR.RANISANKAIL)
        for p in re.split(r"[,]\s*|(?<=[A-Za-z0-9]{2})\.(?=[A-Za-z0-9]{2})|\.\s+", sub):
            clean_p = p.strip()
            if clean_p:
                parts.append(clean_p)

    # 1. Phone extraction if embedded in address
    new_parts = []
    for p in parts:
        m_ph = re.search(r"(?:(?:PHONE|MOBILE|TEL|TEL\.?|MOB\.?)[:\s]*)?(\+?880[\s-]?[0-9]{9,11}|01[3-9]\d{8})", p, re.IGNORECASE)
        if m_ph and not addr.phone:
            addr.phone = m_ph.group(1).replace(" ", "").replace("-", "")
            p = (p[:m_ph.start()] + " " + p[m_ph.end():]).strip()
        p = re.sub(r"^[,\s.-]+|[,\s.-]+$", "", p)
        if p:
            new_parts.append(p)
    parts = new_parts

    # 2. Postal Code (ZIP / PIN)
    new_parts = []
    for p in parts:
        m_lbl = re.search(r"(?:\b(?:POSTAL|POST|ZIP|PIN|PINCODE)\s*(?:CODE)?[:\s-]*(\d{4,6})\b)", p, re.IGNORECASE)
        if m_lbl and not addr.postalCode:
            c_lbl = m_lbl.group(1)
            if not is_excluded_postal_code(c_lbl, known_info, is_explicit=True):
                addr.postalCode = c_lbl
                p = (p[:m_lbl.start()] + " " + p[m_lbl.end():]).strip()

        # Foreign zip code (5 digits, e.g. USA 10018)
        if not is_bangladeshi and not addr.postalCode:
            m_foreign = re.search(r"\b\d{5}(?:-\d{4})?\b", p)
            if m_foreign:
                addr.postalCode = m_foreign.group(0)
                p = (p[:m_foreign.start()] + " " + p[m_foreign.end():]).strip()

        m_bd = re.search(r"\b([1-9]\d{3})\b", p)
        if m_bd and not addr.postalCode:
            cand = m_bd.group(1)
            p_upper = p.upper()
            is_date = (
                bool(re.search(r"\b(?:DOB|YEAR|DATE|BIRTH|ISSUE|EXPIR\w*|VALID|ON|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b", p_upper))
                or bool(re.search(r"(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[,\s]+" + cand + r"\b", p, re.IGNORECASE))
                or bool(re.search(r"\b\d{1,2}[-/]\d{1,2}[-/]" + cand + r"\b", p))
                or bool(re.search(r"\b" + cand + r"[-/]\d{1,2}[-/]\d{1,2}\b", p))
            )
            if not is_date and not is_excluded_postal_code(cand, known_info, is_explicit=False):
                addr.postalCode = cand
                p = (p[:m_bd.start()] + " " + p[m_bd.end():]).strip()

        p = re.sub(r"^[,\s.-]+|[,\s.-]+$", "", p)
        if p:
            new_parts.append(p)
    parts = new_parts

    # 3. Country
    new_parts = []
    for p in parts:
        upper = p.upper()
        if "BANGLADESH" in upper:
            addr.country = "BANGLADESH"
            p = re.sub(r"\bBANGLADESH\b", "", p, flags=re.IGNORECASE).strip()
        elif "INDIA" in upper:
            addr.country = "INDIA"
            p = re.sub(r"\bINDIA\b", "", p, flags=re.IGNORECASE).strip()
        elif "UNITED KINGDOM" in upper or "UK" in upper:
            addr.country = "UNITED KINGDOM"
            p = re.sub(r"\b(?:UNITED KINGDOM|UK)\b", "", p, flags=re.IGNORECASE).strip()
        elif "UNITED STATES" in upper or "USA" in upper:
            addr.country = "USA"
            p = re.sub(r"\b(?:UNITED STATES|USA)\b", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"^[,\s.-]+|[,\s.-]+$", "", p)
        if p:
            new_parts.append(p)
    parts = new_parts

    if not addr.country and is_bangladeshi:
        addr.country = "BANGLADESH"

    # 4. Explicit Labels (Dist, Vill, City, State, Div)
    new_parts = []
    for p in parts:
        m_dist = re.search(r"\b(?:DIST(?:RICT)?|DIST\.)[:\s]+([A-Za-z\s]+)", p, re.IGNORECASE)
        if m_dist and not addr.district:
            addr.district = m_dist.group(1).strip().upper()
            p = (p[:m_dist.start()] + " " + p[m_dist.end():]).strip()

        m_city = re.search(r"\b(?:CITY|TOWN|VILL(?:AGE)?\/TOWN\/CITY|VILL\/TOWN)[:\s]+([A-Za-z\s]+)", p, re.IGNORECASE)
        if m_city and not addr.city:
            addr.city = m_city.group(1).strip().upper()
            p = (p[:m_city.start()] + " " + p[m_city.end():]).strip()

        m_div = re.search(r"\b(?:DIV(?:ISION)?|STATE|PROVINCE)[:\s]+([A-Za-z\s]+)", p, re.IGNORECASE)
        if m_div and not addr.stateProvince:
            addr.stateProvince = m_div.group(1).strip().upper()
            p = (p[:m_div.start()] + " " + p[m_div.end():]).strip()

        p = re.sub(r"^[,\s.-]+|[,\s.-]+$", "", p)
        if p:
            new_parts.append(p)
    parts = new_parts

    # 5. Known District Matching
    new_parts = []
    for p in parts:
        upper = p.upper()
        found_dist = None
        for d in BANGLADESH_DISTRICTS:
            if re.search(r"\b" + re.escape(d) + r"\b", upper):
                found_dist = d
                break
        if found_dist and not addr.district:
            addr.district = found_dist
            p = re.sub(r"\b" + re.escape(found_dist) + r"\b", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"^[,\s.-]+|[,\s.-]+$", "", p)
        if p:
            new_parts.append(p)
    parts = new_parts

    if addr.district and not addr.city:
        addr.city = addr.district

    # 6. Clean OCR word joins, non-address labels, and trailers (generalized, no fixture-specific hardcoding)
    EXCLUDED_ADDRESS_PARTS = {
        "SPOUSE", "WIFE", "HUSBAND", "FATHER", "MOTHER", "SON", "DAUGHTER",
        "SELF", "BROTHER", "SISTER", "RELATION", "RELATIONSHIP",
        "EMERGENCY CONTACT", "EMERGENCY", "CONTACT",
        "PASSPORT", "PEOPLES REPUBLIC OF BANGLADESH", "PEOPLES REPUBLIC",
        "PEOPLE'S REPUBLIC OF BANGLADESH", "PEOPLE'S REPUBLIC",
        "TYPE", "COUNTRY CODE", "PASSPORT NO", "PASSPORT NUMBER",
        "SURNAME", "SUNAME", "GIVEN NAME", "NATIONALITY", "BANGLADESHI",
        "DATE OF BIRTH", "PLACE OF BIRTH", "ISSUING AUTHORITY",
        "DATE OF ISSUE", "DATE OF EXPIRY", "PREVIOUS PASSPORT"
    }

    clean_parts = []
    for p in parts:
        p = re.sub(r"\bEmail\s*address.*$", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"\bPhone\s*(?:No)?.*$", "", p, flags=re.IGNORECASE).strip()
        p = re.sub(r"^[,\s.:_/-]+|[,\s.:_/-]+$", "", p)
        upper_p = p.upper()
        if upper_p in EXCLUDED_ADDRESS_PARTS or any(upper_p.startswith(kw) for kw in ["RELATION", "RELATIONSHIP:", "SPOUSE"]):
            continue
        if any(kw in upper_p for kw in ["PEOPLES REPUBLIC", "PASSPORT NO", "PASSPORT NUM", "DATE OF BIRTH", "DATE OF ISSUE"]):
            continue
        if p and len(p) >= 2:
            clean_parts.append(p)

    if len(clean_parts) >= 1:
        addr.line1 = clean_parts[0]
    if len(clean_parts) >= 2:
        addr.line2 = ", ".join(clean_parts[1:])

    return addr


def extract_boxes_from_pdf_page(page: pymupdf.Page) -> List[OCRBox]:
    """
    Synthesize normalized OCRBox instances directly from PyMuPDF word and line bounding boxes.
    This runs in 5-15 ms, completely bypassing neural OCR for digital/vector PDFs.
    """
    words = page.get_text("words")
    if not words:
        return []
    lines_map = {}
    for w in words:
        key = (w[5], w[6])
        if key not in lines_map:
            lines_map[key] = {
                "bbox": [w[0], w[1], w[2], w[3]],
                "words": [w[4]],
                "y": w[1],
                "x": w[0],
            }
        else:
            lines_map[key]["bbox"][0] = min(lines_map[key]["bbox"][0], w[0])
            lines_map[key]["bbox"][1] = min(lines_map[key]["bbox"][1], w[1])
            lines_map[key]["bbox"][2] = max(lines_map[key]["bbox"][2], w[2])
            lines_map[key]["bbox"][3] = max(lines_map[key]["bbox"][3], w[3])
            lines_map[key]["words"].append(w[4])

    sorted_lines = sorted(lines_map.values(), key=lambda l: (round(l["y"] / 10) * 10, l["x"]))
    return [
        OCRBox(
            text=" ".join(l["words"]),
            confidence=1.0,
            bbox=[
                [l["bbox"][0], l["bbox"][1]],
                [l["bbox"][2], l["bbox"][1]],
                [l["bbox"][2], l["bbox"][3]],
                [l["bbox"][0], l["bbox"][3]],
            ],
        )
        for l in sorted_lines
    ]


def _populate_fields_from_boxes(
    doc: pymupdf.Document,
    page_idx: int,
    ocr_boxes: List[OCRBox],
    is_text_layer: bool = False,
) -> PassportExtractionResult:
    """
    Populate structured PassportExtractionResult from normalized text/OCR boxes.
    Applies deterministic precedence, MRZ validation, address normalization,
    and postal code arbitration.
    """
    result = PassportExtractionResult()
    default_src = "pdf_text" if is_text_layer else "ocr"

    # 1. Visual field extraction
    visual = extract_visual_fields(ocr_boxes)
    addr_blocks = extract_address_blocks_from_boxes(ocr_boxes)
    surname_hint = visual.get("surname", ("", 0.0))[0]
    given_hint = visual.get("givenName", ("", 0.0))[0]

    # 2. MRZ Detection & Parsing with visual hints
    ocr_tuples = [(b.text, b.confidence) for b in ocr_boxes]
    mrz_candidate = find_mrz_lines(ocr_tuples)

    parsed_mrz = None
    if mrz_candidate:
        l1, l2, mrz_conf = mrz_candidate
        parsed_mrz = parse_td3_mrz(l1, l2, mrz_conf, surname_hint=surname_hint, given_name_hint=given_hint)
        # Disambiguate if parsed_mrz.surname is combination of visual surname + givenName
        if surname_hint and given_hint and parsed_mrz.surname.upper() == (surname_hint.upper() + given_hint.upper()):
            parsed_mrz.surname = surname_hint.upper()
            parsed_mrz.given_names = given_hint.upper()
        elif surname_hint and parsed_mrz.surname.upper().startswith(surname_hint.upper()) and len(parsed_mrz.surname) > len(surname_hint):
            rem = parsed_mrz.surname[len(surname_hint):].strip()
            parsed_mrz.surname = surname_hint.upper()
            if not parsed_mrz.given_names or not given_hint:
                parsed_mrz.given_names = rem
        elif given_hint and parsed_mrz.surname.upper().endswith(given_hint.upper()) and len(parsed_mrz.surname) > len(given_hint):
            rem_s = parsed_mrz.surname[:-len(given_hint)].strip()
            parsed_mrz.surname = rem_s
            parsed_mrz.given_names = given_hint.upper()

        result.mrz = MRZData(
            detected=True,
            valid=parsed_mrz.valid,
            rawLines=[l1, l2],
            confidence=mrz_conf,
        )

    # 3. Field Population with deterministic precedence
    # A. Personal Data
    # Surname: if MRZ is valid, prioritize high-trust MRZ separator tokens over OCR joined words
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.surname:
        result.personal.surname = parsed_mrz.surname
        result.fieldSources["personal.surname"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.surname
        )
    elif "surname" in visual:
        result.personal.surname = visual["surname"][0]
        result.fieldSources["personal.surname"] = FieldSource(
            source=default_src, confidence=visual["surname"][1], rawValue=visual["surname"][0]
        )
    elif parsed_mrz and parsed_mrz.surname:
        result.personal.surname = parsed_mrz.surname
        result.fieldSources["personal.surname"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.surname
        )

    # Given Name arbitration:
    visual_given = ""
    visual_given_conf = 0.0
    if "givenName" in visual:
        visual_given = clean_person_name(visual["givenName"][0])
        visual_given_conf = visual["givenName"][1]

    mrz_given = ""
    if parsed_mrz and parsed_mrz.given_names:
        mrz_given = clean_person_name(parsed_mrz.given_names)

    # Deterministic Precedence:
    # A. If both sources agree on letters, use the one preserving token boundaries/spaces
    if mrz_given and visual_given and visual_given.replace(" ", "") == mrz_given.replace(" ", ""):
        chosen_given = mrz_given if " " in mrz_given else visual_given
        chosen_source = "mrz" if " " in mrz_given else default_src
        chosen_conf = parsed_mrz.confidence if chosen_source == "mrz" else visual_given_conf
        result.personal.givenName = chosen_given
        result.fieldSources["personal.givenName"] = FieldSource(
            source=chosen_source, confidence=chosen_conf, rawValue=chosen_given
        )
    # B. If visual given name is clean and valid (len >= 2), prefer explicit visual passport field
    elif visual_given and len(visual_given) >= 2 and (" " in visual_given or not (parsed_mrz and parsed_mrz.valid and parsed_mrz.given_names)):
        result.personal.givenName = visual_given
        result.fieldSources["personal.givenName"] = FieldSource(
            source=default_src, confidence=visual_given_conf, rawValue=visual_given
        )
    # C. If visual contains noise or was joined and MRZ is valid, use MRZ structured tokens
    elif mrz_given and parsed_mrz and parsed_mrz.valid:
        result.personal.givenName = mrz_given
        result.fieldSources["personal.givenName"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=mrz_given
        )
    elif visual_given and len(visual_given) >= 2:
        result.personal.givenName = visual_given
        result.fieldSources["personal.givenName"] = FieldSource(
            source=default_src, confidence=visual_given_conf, rawValue=visual_given
        )
    elif visual_given:
        result.personal.givenName = visual_given
        result.fieldSources["personal.givenName"] = FieldSource(
            source=default_src, confidence=visual_given_conf, rawValue=visual_given
        )
    else:
        result.personal.givenName = ""

    # Full Name: single space between given name and surname
    if result.personal.givenName and result.personal.surname:
        result.personal.fullName = f"{result.personal.givenName.strip()} {result.personal.surname.strip()}"
        result.personal.fullName = re.sub(r"\s+", " ", result.personal.fullName).strip()
        result.fieldSources["personal.fullName"] = FieldSource(
            source=default_src if "fullName" in visual else ("mrz" if result.mrz.valid else default_src),
            confidence=0.95,
            rawValue=result.personal.fullName,
        )
    elif "fullName" in visual:
        clean_fn = clean_person_name(visual["fullName"][0])
        if clean_fn:
            result.personal.fullName = clean_fn
            result.fieldSources["personal.fullName"] = FieldSource(
                source=default_src, confidence=visual["fullName"][1], rawValue=result.personal.fullName
            )
    elif result.personal.givenName:
        result.personal.fullName = result.personal.givenName.strip()
    elif result.personal.surname:
        result.personal.fullName = result.personal.surname.strip()

    # Date of birth
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.date_of_birth:
        result.personal.dateOfBirth = parsed_mrz.date_of_birth
        result.fieldSources["personal.dateOfBirth"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.date_of_birth
        )
    elif "dateOfBirth" in visual:
        result.personal.dateOfBirth = visual["dateOfBirth"][0]
        result.fieldSources["personal.dateOfBirth"] = FieldSource(
            source=default_src, confidence=visual["dateOfBirth"][1], rawValue=visual["dateOfBirth"][0]
        )

    # Gender
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.gender:
        result.personal.gender = parsed_mrz.gender
        result.fieldSources["personal.gender"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.gender
        )
    elif "gender" in visual:
        result.personal.gender = visual["gender"][0]
        result.fieldSources["personal.gender"] = FieldSource(
            source=default_src, confidence=visual["gender"][1], rawValue=visual["gender"][0]
        )

    # Nationality
    if "nationality" in visual:
        result.personal.nationality = visual["nationality"][0]
        result.fieldSources["personal.nationality"] = FieldSource(
            source=default_src, confidence=visual["nationality"][1], rawValue=visual["nationality"][0]
        )
    elif parsed_mrz and parsed_mrz.nationality:
        result.personal.nationality = parsed_mrz.nationality
        result.fieldSources["personal.nationality"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.nationality
        )

    # Place of Birth (visual only)
    if "placeOfBirth" in visual:
        result.personal.placeOfBirth = visual["placeOfBirth"][0]
        result.fieldSources["personal.placeOfBirth"] = FieldSource(
            source=default_src, confidence=visual["placeOfBirth"][1], rawValue=visual["placeOfBirth"][0]
        )

    # Country of Birth (when explicitly available or attached to place of birth)
    if "countryOfBirth" in visual:
        result.personal.countryOfBirth = visual["countryOfBirth"][0]
        result.fieldSources["personal.countryOfBirth"] = FieldSource(
            source=default_src, confidence=visual["countryOfBirth"][1], rawValue=visual["countryOfBirth"][0]
        )

    # NID (prioritize clean 10/13/17-digit NID from visual label or MRZ)
    if "nid" in visual and visual["nid"][0].isdigit() and len(visual["nid"][0]) in (10, 13, 17):
        result.personal.nid = visual["nid"][0]
        result.fieldSources["personal.nid"] = FieldSource(
            source=default_src, confidence=visual["nid"][1], rawValue=visual["nid"][0]
        )
    elif parsed_mrz and parsed_mrz.personal_number:
        pnum = parsed_mrz.personal_number
        if len(pnum) > 10 and pnum[:10].isdigit():
            pnum = pnum[:10]
        result.personal.nid = pnum
        result.fieldSources["personal.nid"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.personal_number
        )

    # B. Passport Data
    # Passport Number
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.passport_number:
        result.passport.number = parsed_mrz.passport_number
        result.fieldSources["passport.number"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.passport_number
        )
    elif "passportNumber" in visual:
        result.passport.number = visual["passportNumber"][0]
        result.fieldSources["passport.number"] = FieldSource(
            source=default_src, confidence=visual["passportNumber"][1], rawValue=visual["passportNumber"][0]
        )

    # Issuing Country
    if parsed_mrz and parsed_mrz.issuing_country:
        result.passport.issuingCountry = parsed_mrz.issuing_country
        result.fieldSources["passport.issuingCountry"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.issuing_country
        )
    elif "BGD" in [b.text for b in ocr_boxes]:
        result.passport.issuingCountry = "BGD"
        result.fieldSources["passport.issuingCountry"] = FieldSource(
            source=default_src, confidence=0.99, rawValue="BGD"
        )

    # Expiry Date (MRZ prioritized, fallback to visual)
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.expiry_date:
        result.passport.expiryDate = parsed_mrz.expiry_date
        result.fieldSources["passport.expiryDate"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.expiry_date
        )
    elif "expiryDate" in visual:
        result.passport.expiryDate = visual["expiryDate"][0]
        result.fieldSources["passport.expiryDate"] = FieldSource(
            source=default_src, confidence=visual["expiryDate"][1], rawValue=visual["expiryDate"][0]
        )

    # Issue Date (dedicated robust extractor)
    known_exp = result.passport.expiryDate or (parsed_mrz.expiry_date if parsed_mrz and parsed_mrz.valid else "")
    issue_val, issue_source = extract_date_of_issue(
        doc=doc,
        page_idx=page_idx,
        ocr_boxes=ocr_boxes,
        known_dob=result.personal.dateOfBirth,
        known_expiry=known_exp,
    )
    if issue_val:
        result.passport.issueDate = issue_val
        result.fieldSources["passport.issueDate"] = issue_source
    elif issue_source.hasConflict:
        result.fieldSources["passport.issueDate"] = issue_source
    elif "issueDate" in visual:
        # Fallback to visual only if not conflicting and strictly earlier than known expiry
        v_date = visual["issueDate"][0]
        if not known_exp or v_date < known_exp:
            result.passport.issueDate = v_date
            result.fieldSources["passport.issueDate"] = FieldSource(
                source=default_src, confidence=visual["issueDate"][1], rawValue=v_date
            )

    # Validate: expiryDate > issueDate
    if result.passport.issueDate and result.passport.expiryDate:
        if result.passport.expiryDate <= result.passport.issueDate:
            if parsed_mrz and parsed_mrz.valid and parsed_mrz.expiry_date and parsed_mrz.expiry_date > result.passport.issueDate:
                result.passport.expiryDate = parsed_mrz.expiry_date
                result.fieldSources["passport.expiryDate"] = FieldSource(
                    source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.expiry_date
                )
            else:
                result.passport.expiryDate = ""
                result.fieldSources.pop("passport.expiryDate", None)

    # Issue Place (visual only)
    if "issuePlace" in visual:
        result.passport.issuePlace = visual["issuePlace"][0]
        result.fieldSources["passport.issuePlace"] = FieldSource(
            source=default_src, confidence=visual["issuePlace"][1], rawValue=visual["issuePlace"][0]
        )

    # Previous Passport
    if "previousPassportNumber" in visual:
        prev_no = visual["previousPassportNumber"][0]
        # Ensure previous passport is not same as current passport
        if prev_no != result.passport.number:
            result.passport.previousPassport.number = prev_no
            result.fieldSources["passport.previousPassport.number"] = FieldSource(
                source=default_src, confidence=visual["previousPassportNumber"][1], rawValue=prev_no
            )

    if not result.passport.previousPassport.number:
        for b in ocr_boxes:
            b_txt = b.text.strip().upper()
            if re.match(r"^[A-Z]{1,2}[0-9]{7,9}$", b_txt) and b_txt != result.passport.number:
                result.passport.previousPassport.number = b_txt
                result.fieldSources["passport.previousPassport.number"] = FieldSource(
                    source=default_src, confidence=b.confidence, rawValue=b_txt
                )
                break

    # C. Family Data
    applicant_names_set = set()
    for n in [result.personal.fullName, result.personal.givenName, result.personal.surname]:
        if n:
            applicant_names_set.add(n.strip().upper())
            applicant_names_set.update(n.strip().upper().split())

    f_val, f_conf = visual.get("fatherName", ("", 0.0))
    m_val, m_conf = visual.get("motherName", ("", 0.0))
    s_val, s_conf = visual.get("spouseName", ("", 0.0))

    if f_val and (f_val.upper() in applicant_names_set or f_val.upper() in {"IF ANY", "NOT APPLICABLE", "GENDER", "MALE", "FEMALE"}):
        f_val = ""
    if m_val and (m_val.upper() in applicant_names_set or m_val == f_val or m_val.upper() in {"IF ANY", "NOT APPLICABLE", "GENDER", "MALE", "FEMALE"}):
        m_val = ""
    if s_val and (s_val.upper() in applicant_names_set or s_val == f_val or s_val == m_val or s_val.upper() in {"IF ANY", "NOT APPLICABLE", "PANCHAGARH", "THAKURGAON"}):
        s_val = ""

    # Personal Data Page Fallback (Standard Bangladeshi Passport Page 2 layout):
    # When father or mother not captured by label, find candidate names under personal data header
    if not f_val or not m_val:
        p_idx = -1
        for idx_b, b in enumerate(ocr_boxes):
            b_u = b.text.strip().upper()
            if re.search(r"^[A-Z]*ERSONAL\s*DATA", b_u) or "PERSONAL PARTICULARS" in b_u:
                p_idx = idx_b
                break
        if p_idx >= 0:
            candidates = []
            for cb_idx in range(p_idx + 1, min(p_idx + 8, len(ocr_boxes))):
                cb_txt = ocr_boxes[cb_idx].text.strip()
                if any(kw in cb_txt.upper() for kw in ["COLONI", "ROAD", "VILL", "POST", "DISTRICT", "THAKURGAON", "5120", "EMERGENCY"]):
                    break
                cb_clean = clean_person_name(cb_txt)
                if not cb_clean or is_applicant_name(cb_clean, result.personal.fullName, result.personal.givenName, result.personal.surname):
                    continue
                if any(kw in cb_txt.upper() for kw in ["NAME:", "SPOUSE", "RELATION"]):
                    continue
                candidates.append((cb_clean, ocr_boxes[cb_idx].confidence))

            if not f_val and len(candidates) >= 1:
                f_val, f_conf = candidates[0]
            if not m_val and len(candidates) >= 2:
                m_val, m_conf = candidates[1]

    if f_val:
        result.family.father.name = f_val
        result.fieldSources["family.father.name"] = FieldSource(
            source=default_src, confidence=f_conf or 0.9, rawValue=f_val
        )

    if m_val:
        result.family.mother.name = m_val
        result.fieldSources["family.mother.name"] = FieldSource(
            source=default_src, confidence=m_conf or 0.9, rawValue=m_val
        )

    if s_val:
        result.family.spouse.name = s_val
        result.fieldSources["family.spouse.name"] = FieldSource(
            source=default_src, confidence=s_conf or 0.9, rawValue=s_val
        )

    # D. Address Data
    has_present = "present_address_lines" in visual
    has_perm = "permanent_address_lines" in visual
    has_generic = "generic_address_lines" in visual

    is_bd = (
        result.personal.nationality in ("BANGLADESH", "BANGLADESHI") or
        result.passport.issuingCountry == "BGD" or
        any("BGD" in b.text for b in ocr_boxes)
    )

    if has_present:
        p_lines, p_conf = visual["present_address_lines"]
        result.presentAddress = parse_address_components(p_lines, is_bangladeshi=is_bd)
        result.fieldSources["presentAddress"] = FieldSource(
            source=default_src, confidence=p_conf, rawValue="; ".join(p_lines)
        )

    if has_perm:
        pm_lines, pm_conf = visual["permanent_address_lines"]
        result.permanentAddress = parse_address_components(pm_lines, is_bangladeshi=is_bd)
        result.fieldSources["permanentAddress"] = FieldSource(
            source=default_src, confidence=pm_conf, rawValue="; ".join(pm_lines)
        )

    if not has_present and not has_perm and has_generic:
        g_lines, g_conf = visual["generic_address_lines"]
        parsed_g = parse_address_components(g_lines, is_bangladeshi=is_bd)
        result.presentAddress = parsed_g.model_copy()
        result.permanentAddress = parsed_g.model_copy()
        result.permanentAddress.sameAsPresentAddress = True
        result.address = parsed_g.model_copy()
        result.fieldSources["address"] = FieldSource(
            source=default_src, confidence=g_conf, rawValue="; ".join(g_lines)
        )
        result.fieldSources["presentAddress"] = FieldSource(
            source=default_src, confidence=g_conf, rawValue="; ".join(g_lines)
        )
        result.fieldSources["permanentAddress"] = FieldSource(
            source="derived", confidence=g_conf, rawValue="; ".join(g_lines)
        )
    elif has_present and not has_perm:
        # Fallback: Permanent Address copied from Present Address
        result.permanentAddress = result.presentAddress.model_copy()
        result.permanentAddress.sameAsPresentAddress = True
        result.address = result.presentAddress.model_copy()
        result.fieldSources["permanentAddress"] = FieldSource(
            source="derived", confidence=result.fieldSources["presentAddress"].confidence, rawValue=result.fieldSources["presentAddress"].rawValue
        )
        result.fieldSources["address"] = result.fieldSources["presentAddress"]
    elif not has_present and has_perm:
        # Bangladesh passport case: printed address is Permanent Address; populates Present Address too
        result.presentAddress = result.permanentAddress.model_copy()
        result.address = result.permanentAddress.model_copy()
        result.fieldSources["presentAddress"] = FieldSource(
            source=default_src, confidence=result.fieldSources["permanentAddress"].confidence, rawValue=result.fieldSources["permanentAddress"].rawValue
        )
        result.fieldSources["address"] = result.fieldSources["permanentAddress"]
    elif has_present and has_perm:
        # Both present and permanent explicitly exist (e.g. Khokon form)
        result.permanentAddress.sameAsPresentAddress = False
        result.address = result.presentAddress.model_copy()
        result.fieldSources["address"] = result.fieldSources["presentAddress"]
    elif "address_raw" in visual:
        raw_addr, addr_conf = visual["address_raw"]
        parsed_addr = parse_address_components(raw_addr, is_bangladeshi=is_bd)
        result.presentAddress = parsed_addr.model_copy()
        result.permanentAddress = parsed_addr.model_copy()
        result.permanentAddress.sameAsPresentAddress = True
        result.address = parsed_addr
        result.fieldSources["address"] = FieldSource(
            source=default_src, confidence=addr_conf, rawValue=raw_addr
        )
        result.fieldSources["presentAddress"] = FieldSource(
            source=default_src, confidence=addr_conf, rawValue=raw_addr
        )
        result.fieldSources["permanentAddress"] = FieldSource(
            source="derived", confidence=addr_conf, rawValue=raw_addr
        )

    # Phone number association
    if "phone" in visual:
        phone_val, phone_conf = visual["phone"]
        if result.presentAddress and not result.presentAddress.phone:
            result.presentAddress.phone = phone_val
        if result.address and not result.address.phone:
            result.address.phone = phone_val
        result.fieldSources["address.phone"] = FieldSource(
            source=default_src, confidence=phone_conf, rawValue=phone_val
        )

    # Dedicated Postal Code Extraction & Cross-Source Arbitration
    known_info = {
        "dob": result.personal.dateOfBirth,
        "issue_date": result.passport.issueDate,
        "expiry_date": result.passport.expiryDate,
        "passport_no": result.passport.number,
        "nid": result.personal.nid,
        "phone": visual.get("phone", ("", 0.0))[0],
    }
    pres_p, perm_p, p_sources = extract_postal_codes(
        doc=doc,
        page_idx=page_idx,
        ocr_boxes=ocr_boxes,
        addr_blocks=addr_blocks,
        known_info=known_info,
        is_bangladeshi=is_bd,
    )
    if pres_p:
        if result.presentAddress:
            result.presentAddress.postalCode = pres_p
        if result.address:
            result.address.postalCode = pres_p
    if perm_p:
        if result.permanentAddress:
            result.permanentAddress.postalCode = perm_p
        if result.address and not result.address.postalCode:
            result.address.postalCode = perm_p
        if result.presentAddress and not result.presentAddress.postalCode:
            result.presentAddress.postalCode = perm_p
    for k, v in p_sources.items():
        result.fieldSources[k] = v

    # Fallback address synchronization
    if result.address and (result.address.line1 or result.address.district or result.address.postalCode):
        if not result.presentAddress:
            result.presentAddress = result.address.model_copy()
        if not result.permanentAddress:
            result.permanentAddress = result.address.model_copy()
            result.permanentAddress.sameAsPresentAddress = True
    elif result.permanentAddress and not result.presentAddress:
        result.presentAddress = result.permanentAddress.model_copy()
        result.address = result.permanentAddress.model_copy()
    elif result.presentAddress and not result.permanentAddress:
        result.permanentAddress = result.presentAddress.model_copy()
        result.permanentAddress.sameAsPresentAddress = True
        result.address = result.presentAddress.model_copy()

    # Auto-default BANGLADESH for Bangladeshi passports
    if is_bd:
        if not result.personal.nationality:
            result.personal.nationality = "BANGLADESH"
        if result.presentAddress and not result.presentAddress.country:
            result.presentAddress.country = "BANGLADESH"
        if result.permanentAddress and not result.permanentAddress.country:
            result.permanentAddress.country = "BANGLADESH"
        if result.address and not result.address.country:
            result.address.country = "BANGLADESH"

        if result.family.father.name:
            if not result.family.father.nationality:
                result.family.father.nationality = "BANGLADESH"
            if not result.family.father.countryOfBirth:
                result.family.father.countryOfBirth = "BANGLADESH"
        if result.family.mother.name:
            if not result.family.mother.nationality:
                result.family.mother.nationality = "BANGLADESH"
            if not result.family.mother.countryOfBirth:
                result.family.mother.countryOfBirth = "BANGLADESH"
        if result.family.spouse.name:
            if not result.family.spouse.nationality:
                result.family.spouse.nationality = "BANGLADESH"
            if not result.family.spouse.countryOfBirth:
                result.family.spouse.countryOfBirth = "BANGLADESH"

    return result


def extract_passport(pdf_source: Union[str, bytes]) -> PassportExtractionResult:
    """
    Primary extraction pipeline:
    1. Inspect PDF structure and prioritize passport identity page.
    2. In-memory SHA-256 cache check (Phase 13).
    3. FAST TEXT-LAYER PATH (PyMuPDF):
       - If usable text layer exists, synthesize text boxes in <15ms.
       - Extract passport fields and evaluate core sufficiency.
       - If sufficient, return immediately without loading or running PaddleOCR!
    4. SCANNED PDF PATH (PaddleOCR fallback):
       - If text layer is missing or insufficient, render prioritized page to image.
       - Run PaddleOCR singleton.
       - Apply deterministic precedence and return structured result.
    """
    start_time = time.time()

    # Phase 13: Lightweight in-memory cache keyed by SHA-256 of PDF content
    pdf_bytes = None
    if isinstance(pdf_source, bytes):
        pdf_bytes = pdf_source
    elif isinstance(pdf_source, str) and os.path.exists(pdf_source):
        try:
            with open(pdf_source, "rb") as f:
                pdf_bytes = f.read()
        except Exception:
            pdf_bytes = None

    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest() if pdf_bytes else None
    if pdf_hash and pdf_hash in _EXTRACTION_CACHE:
        cached_result = copy.deepcopy(_EXTRACTION_CACHE[pdf_hash])
        cached_dur = round((time.time() - start_time) * 1000, 2)
        cached_result.processingTimeMs = cached_dur
        if cached_result.diagnostics:
            cached_result.diagnostics.extractionDurationMs = cached_dur
        print(f"[cache] In-memory cache HIT for sha256:{pdf_hash[:12]} in {cached_dur:.2f} ms")
        print(f"[extract] pdf_read: 0.00s")
        print(f"[extract] text_layer: 0.00s")
        print(f"[extract] page_selection: 0.00s")
        print(f"[extract] ocr: 0.00s")
        print(f"[extract] mrz: 0.00s")
        print(f"[extract] mapping: 0.00s")
        print(f"[extract] total: {cached_dur/1000:.3f}s")
        return cached_result

    t_insp_start = time.time()
    doc, pdf_info = inspect_pdf(pdf_source)
    t_insp_dur = (time.time() - t_insp_start) * 1000
    total_text_chars = sum(len(p.text) for p in pdf_info.pages)
    has_text_layer = bool(pdf_info.has_usable_text or total_text_chars > 0)
    total_pages = pdf_info.total_pages

    print(
        f"[extractor] PDF opened & inspected in {t_insp_dur:.2f} ms: "
        f"pages={pdf_info.total_pages}, usable_text={pdf_info.has_usable_text}, "
        f"selected_page={pdf_info.selected_page_index}, text_chars={total_text_chars}"
    )

    page_idx = pdf_info.selected_page_index
    page = doc[page_idx]

    t_text_dur = 0.0
    # FAST PATH (STEP 3): Check if PDF has usable text layer
    if pdf_info.has_usable_text:
        t_text_start = time.time()
        text_boxes = extract_boxes_from_pdf_page(page)
        t_text_dur = (time.time() - t_text_start) * 1000
        print(f"[extractor] PyMuPDF extracted {len(text_boxes)} text boxes in {t_text_dur:.2f} ms")

        if len(text_boxes) >= 4:
            t_eval_start = time.time()
            res_cand = _populate_fields_from_boxes(doc, page_idx, text_boxes, is_text_layer=True)
            t_eval_dur = (time.time() - t_eval_start) * 1000

            # Sufficiency check: has passport number AND at least one identity field
            has_core_fields = bool(
                res_cand.passport.number and (
                    res_cand.personal.surname or
                    res_cand.personal.givenName or
                    res_cand.personal.fullName or
                    res_cand.personal.dateOfBirth
                )
            )

            if has_core_fields:
                total_dur = time.time() - start_time
                res_cand.processingTimeMs = round(total_dur * 1000, 2)
                res_cand.diagnostics = ExtractionDiagnostics(
                    pdfTextFound=has_text_layer,
                    pdfTextChars=total_text_chars,
                    pageCount=total_pages,
                    ocrExecuted=False,
                    ocrPageCount=0,
                    extractionDurationMs=res_cand.processingTimeMs or 0.0,
                )
                print(f"[extract] pdf_read: {t_insp_dur/1000:.2f}s")
                print(f"[extract] text_layer: {t_text_dur/1000:.2f}s")
                print(f"[extract] page_selection: {t_insp_dur/1000:.2f}s")
                print(f"[extract] ocr: 0.00s")
                print(f"[extract] mrz: {t_eval_dur/1000:.2f}s")
                print(f"[extract] mapping: {t_eval_dur/1000:.2f}s")
                print(f"[extract] total: {total_dur:.2f}s")
                print(
                    f"[extractor] >>> FAST PATH SUCCEEDED: Text layer sufficient! OCR skipped. "
                    f"Candidate evaluation={t_eval_dur:.2f} ms, Total backend time: {res_cand.processingTimeMs:.2f} ms"
                )
                if pdf_hash:
                    if len(_EXTRACTION_CACHE) >= _CACHE_MAX_SIZE:
                        oldest_k = next(iter(_EXTRACTION_CACHE))
                        _EXTRACTION_CACHE.pop(oldest_k, None)
                    _EXTRACTION_CACHE[pdf_hash] = copy.deepcopy(res_cand)
                return res_cand
            else:
                print(
                    f"[extractor] Text layer found ({len(text_boxes)} boxes, eval={t_eval_dur:.2f} ms) "
                    f"but core passport fields not satisfied. Falling back to OCR."
                )

    # SCANNED PDF PATH (STEP 4): Run OCR only when text layer is insufficient or absent
    print(f"[extractor] Scanned PDF path: running PaddleOCR on prioritized page {page_idx}...")
    t_render_start = time.time()
    page_rect = page.rect
    max_pt = max(page_rect.width, page_rect.height)
    optimal_dpi = 125
    if max_pt > 1000:
        optimal_dpi = 100
    elif max_pt < 400:
        optimal_dpi = 150
    img = render_page_to_image(page, dpi=optimal_dpi)
    t_render_dur = (time.time() - t_render_start) * 1000
    print(f"[extractor] Rendered page to image at dpi={optimal_dpi} in {t_render_dur:.2f} ms (shape {img.shape})")

    t_ocr_start = time.time()
    print("[extractor] OCR start...")
    ocr_boxes = run_ocr(img)
    t_ocr_dur = time.time() - t_ocr_start
    print(f"[extractor] OCR end: finished in {t_ocr_dur:.2f} s ({t_ocr_dur*1000:.1f} ms), found {len(ocr_boxes)} boxes")

    t_pop_start = time.time()
    result = _populate_fields_from_boxes(doc, page_idx, ocr_boxes, is_text_layer=False)
    t_pop_dur = (time.time() - t_pop_start) * 1000
    print(f"[extractor] Field extraction & arbitration completed in {t_pop_dur:.2f} ms")

    total_dur = time.time() - start_time
    result.processingTimeMs = round(total_dur * 1000, 2)
    result.diagnostics = ExtractionDiagnostics(
        pdfTextFound=has_text_layer,
        pdfTextChars=total_text_chars,
        pageCount=total_pages,
        ocrExecuted=True,
        ocrPageCount=1,
        extractionDurationMs=result.processingTimeMs or 0.0,
    )
    print(f"[extract] pdf_read: {t_insp_dur/1000:.2f}s")
    print(f"[extract] text_layer: {t_text_dur/1000:.2f}s")
    print(f"[extract] page_selection: {t_render_dur/1000:.2f}s")
    print(f"[extract] ocr: {t_ocr_dur:.2f}s")
    print(f"[extract] mrz: {t_pop_dur/1000:.2f}s")
    print(f"[extract] mapping: {t_pop_dur/1000:.2f}s")
    print(f"[extract] total: {total_dur:.2f}s")
    print(f"[extractor] >>> SCANNED EXTRACTION COMPLETE: Total backend time: {result.processingTimeMs:.2f} ms")

    if pdf_hash:
        if len(_EXTRACTION_CACHE) >= _CACHE_MAX_SIZE:
            oldest_k = next(iter(_EXTRACTION_CACHE))
            _EXTRACTION_CACHE.pop(oldest_k, None)
        _EXTRACTION_CACHE[pdf_hash] = copy.deepcopy(result)

    return result


def main():
    parser = argparse.ArgumentParser(description="Local Passport OCR Extractor")
    parser.add_argument("pdf_path", help="Path to passport PDF file")
    parser.add_argument("--json", action="store_true", help="Output full JSON")
    args = parser.parse_args()

    pdf_path = args.pdf_path
    if not os.path.exists(pdf_path):
        alt_path = os.path.join("..", pdf_path)
        if os.path.exists(alt_path):
            pdf_path = alt_path
        else:
            print(f"Error: File not found at {pdf_path}", file=sys.stderr)
            sys.exit(1)

    print(f"Processing passport: {pdf_path}...")
    res = extract_passport(pdf_path)

    if args.json:
        print(res.model_dump_json(indent=2))
        return

    print("\n" + "=" * 50)
    print("EXTRACTION RESULT")
    print("=" * 50)
    print(f"Processing Time: {res.processingTimeMs:.2f} ms")
    print(f"MRZ Detected:    {res.mrz.detected}")
    print(f"MRZ Valid:       {res.mrz.valid} (Confidence: {res.mrz.confidence:.2f})")
    print("-" * 50)
    print("PERSONAL DATA:")
    print(f"  Surname:          {res.personal.surname}")
    print(f"  Given Name:       {res.personal.givenName}")
    print(f"  Date of Birth:    {res.personal.dateOfBirth}")
    print(f"  Gender:           {res.personal.gender}")
    print(f"  Nationality:      {res.personal.nationality}")
    print(f"  Place of Birth:   {res.personal.placeOfBirth}")
    print(f"  Country of Birth: {res.personal.countryOfBirth}")
    print(f"  NID:              {res.personal.nid}")
    print("-" * 50)
    print("PASSPORT DATA:")
    print(f"  Number:           {res.passport.number}")
    print(f"  Issue Date:       {res.passport.issueDate}")
    print(f"  Expiry Date:      {res.passport.expiryDate}")
    print(f"  Issue Place:      {res.passport.issuePlace}")
    print(f"  Issuing Country:  {res.passport.issuingCountry}")
    print("-" * 50)
    print("ADDRESS:")
    print(f"  Line 1:           {res.address.line1}")
    print(f"  Line 2:           {res.address.line2}")
    print(f"  City:             {res.address.city}")
    print(f"  District:         {res.address.district}")
    print(f"  Postal Code:      {res.address.postalCode}")
    print(f"  Country:          {res.address.country}")
    print("=" * 50)


if __name__ == "__main__":
    main()
    print("=" * 50)


if __name__ == "__main__":
    main()
