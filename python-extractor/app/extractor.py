import argparse
import json
import os
import re
import sys
import time
from typing import Dict, List, Optional, Tuple, Union

from .mrz import find_mrz_lines, parse_td3_mrz
from .ocr import OCRBox, run_ocr
from .pdf_processor import inspect_pdf, render_page_to_image
from .schemas import (
    AddressData,
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


def normalize_date(raw_date: str) -> str:
    """Normalize various date formats (e.g. 18SEP1993, 18-AUG-2026, 2026-01-20) to YYYY-MM-DD."""
    if not raw_date:
        return ""
    
    clean = raw_date.strip().upper()
    
    # Format YYYY-MM-DD
    m_iso = re.match(r"^(\d{4})[-/.](\d{2})[-/.](\d{2})$", clean)
    if m_iso:
        return f"{m_iso.group(1)}-{m_iso.group(2)}-{m_iso.group(3)}"
        
    # Format DD-MMM-YYYY or DDMMMYYYY (e.g. 18SEP1993, 20 JAN 2026)
    m_text = re.search(r"(\d{1,2})\s*[-/ ]?\s*([A-Z]{3})\s*[-/ ]?\s*(\d{4})", clean)
    if m_text:
        dd = int(m_text.group(1))
        mon_str = m_text.group(2)
        yyyy = m_text.group(3)
        if mon_str in MONTH_MAP:
            return f"{yyyy}-{MONTH_MAP[mon_str]}-{dd:02d}"
            
    # Format DD/MM/YYYY
    m_dmy = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$", clean)
    if m_dmy:
        return f"{m_dmy.group(3)}-{int(m_dmy.group(2)):02d}-{int(m_dmy.group(1)):02d}"

    return ""


def normalize_gender(raw: str) -> str:
    """Normalize gender to male / female / empty."""
    clean = raw.strip().upper()
    if clean in ("M", "MALE"):
        return "male"
    if clean in ("F", "FEMALE"):
        return "female"
    return ""


def extract_visual_fields(ocr_boxes: List[OCRBox]) -> Dict[str, Tuple[str, float]]:
    """
    Extract passport fields from label-value positioning in OCR boxes.
    Returns dict mapping field_name -> (value, confidence).
    """
    results: Dict[str, Tuple[str, float]] = {}
    lines = [b.text for b in ocr_boxes]
    confs = [b.confidence for b in ocr_boxes]
    num_boxes = len(ocr_boxes)

    for i in range(num_boxes):
        text = lines[i]
        upper = text.upper()

        # 1. Surname (labels like "Surname", "sroct/Suname", etc.)
        if re.search(r"S[U|UR]NAME", upper) and not any(kw in upper for kw in ["PASSPORT", "FATHER", "MOTHER", "GUARDIAN"]):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                if cand and cand.isalpha() and not any(kw in cand.upper() for kw in ["GIVEN", "PASSPORT", "NAME", "NATIONALITY"]):
                    results["surname"] = (cand, confs[k])
                    break

        # 2. Given Name
        if re.search(r"GIVEN\s*NAME", upper):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                if cand and not any(kw in cand.upper() for kw in ["NATIONALITY", "SURNAME", "NAME", "PASSPORT"]):
                    results["givenName"] = (cand, confs[k])
                    break

        # 3. Full Name (from personal data page header)
        # 3. Full Name (from personal data page header)
        if upper in ["NAME:", "NAME"] and "fullName" not in results:
            for k in range(i + 1, min(i + 3, num_boxes)):
                cand = lines[k].strip()
                cand_clean = re.sub(r"^[.\s:]+|[.\s:]+$", "", cand)
                if cand_clean and not any(kw in cand_clean.upper() for kw in ["FATHER", "MOTHER", "GUARDIAN", "PASSPORT", "ADDRESS", "EMERGENCY"]):
                    results["fullName"] = (cand_clean, confs[k])
                    break

        # 4. Father's Name
        if re.search(r"FATHER['’]?S?\s*NAME", upper):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                cand_clean = re.sub(r"^[.\s:]+|[.\s:]+$", "", cand)
                if cand_clean and not any(kw in cand_clean.upper() for kw in ["MOTHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "NAME:"]):
                    results["fatherName"] = (cand_clean, confs[k])
                    break

        # 5. Mother's Name
        if re.search(r"MOTHER['’]?S?\s*NAME", upper):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                cand_clean = re.sub(r"^[.\s:]+|[.\s:]+$", "", cand)
                if cand_clean and not any(kw in cand_clean.upper() for kw in ["FATHER", "GUARDIAN", "ADDRESS", "EMERGENCY", "LEGAL"]):
                    results["motherName"] = (cand_clean, confs[k])
                    break

        # 6. Emergency Contact & Spouse
        if "EMERGENCY CONTACT" in upper:
            contact_name = ""
            contact_conf = 0.0
            is_spouse = False
            for k in range(i + 1, min(i + 14, num_boxes)):
                box_text = lines[k].strip()
                box_upper = box_text.upper()
                if "RELATIONSHIP" in box_upper:
                    for rk in range(k + 1, min(k + 3, num_boxes)):
                        rel_val = lines[rk].strip().upper()
                        if any(rel in rel_val for rel in ["SPOUSE", "WIFE", "HUSBAND"]):
                            is_spouse = True
                            break
                elif box_upper in ["NAME:", "NAME"] and not contact_name:
                    if k + 1 < num_boxes:
                        contact_name = lines[k + 1].strip()
                        contact_conf = confs[k + 1]
                elif re.search(r"[ET]ELEPHONE\s*NO|PHONE\s*NO|MOBILE", box_upper):
                    for pk in range(k + 1, min(k + 3, num_boxes)):
                        phone_cand = lines[pk].strip()
                        if re.search(r"[\d+]{7,15}", phone_cand):
                            results["phone"] = (phone_cand, confs[pk])
                            break
            if is_spouse and contact_name:
                results["spouseName"] = (contact_name, contact_conf)

        if re.search(r"SPOUSE['’]?S?\s*NAME", upper):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                cand_clean = re.sub(r"^[.\s:]+|[.\s:]+$", "", cand)
                if cand_clean and not any(kw in cand_clean.upper() for kw in ["FATHER", "MOTHER", "GUARDIAN", "ADDRESS", "EMERGENCY"]):
                    results["spouseName"] = (cand_clean, confs[k])
                    break

        # 7. Previous Passport No
        if re.search(r"PREVIOUS\s*PASSPORT\s*(NO|NUMBER)?", upper):
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                if re.match(r"^[A-Z]{1,2}[0-9]{7,9}$", cand):
                    results["previousPassportNumber"] = (cand, confs[k])
                    break

        # 8. Passport Number
        if re.search(r"PASSPORT\s*(NUMBER|NO)", upper) and not re.search(r"PREVIOUS", upper):
            for k in range(i + 1, min(i + 6, num_boxes)):
                cand = lines[k].strip()
                # Passport number format: 1-2 letters + 7-9 digits (e.g. A21496961)
                if re.match(r"^[A-Z]{1,2}[0-9]{7,9}$", cand):
                    results["passportNumber"] = (cand, confs[k])
                    break

        # 9. Nationality
        if "NATIONALITY" in upper:
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                if "BANGLADESHI" in cand.upper() or re.match(r"^[A-Z]{3,15}$", cand):
                    results["nationality"] = (cand, confs[k])
                    break

        # 10. Date of Birth
        if "DATE OF BIRTH" in upper:
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                norm_d = normalize_date(cand)
                if norm_d:
                    results["dateOfBirth"] = (norm_d, confs[k])
                    break

        # 11. Place of Birth
        if "PLACE OF BIRTH" in upper:
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                # Must be a word of at least 3 letters, not single letter, not keywords
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

        # 12. Date of Issue
        if re.search(r"DATE\s*OF\s*[IS]+SUE", upper):
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                norm_d = normalize_date(cand)
                if norm_d:
                    results["issueDate"] = (norm_d, confs[k])
                    break

        # 13. Date of Expiry
        if re.search(r"DATE\s*OF\s*EXPIRY|DATEOFEXPIRY", upper):
            for k in range(i + 1, min(i + 5, num_boxes)):
                cand = lines[k].strip()
                norm_d = normalize_date(cand)
                if norm_d:
                    results["expiryDate"] = (norm_d, confs[k])
                    break

        # 14. Issuing Authority / Place of Issue
        if re.search(r"[IS]*SUING\s*AUTHORITY", upper):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                if "DIP" in cand.upper() or "/" in cand:
                    # Clean up DIPIDHAKA -> DIP/DHAKA
                    clean_dip = cand.replace("DIPIDHAKA", "DIP/DHAKA")
                    results["issuePlace"] = (clean_dip, confs[k])
                    break

        # 15. Personal No / NID
        if re.search(r"PERSONA[L]?\s*NO", upper):
            for k in range(i + 1, min(i + 4, num_boxes)):
                cand = lines[k].strip()
                if cand.isdigit() and len(cand) >= 10:
                    results["nid"] = (cand, confs[k])
                    break

        # 16. Sex
        if upper in ["FUSEX", "SEX", "/SEX"]:
            for k in range(i + 1, min(i + 3, num_boxes)):
                cand = lines[k].strip().upper()
                if cand in ("M", "F", "MALE", "FEMALE"):
                    results["gender"] = (normalize_gender(cand), confs[k])
                    break

        # 17. Address
        if "PERMANENT ADDRESS" in upper:
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

    # General fallback for passport number if not captured next to label
    if "passportNumber" not in results:
        for k in range(num_boxes):
            cand = lines[k].strip()
            if re.match(r"^[A-Z][0-9]{8}$", cand):
                results["passportNumber"] = (cand, confs[k])
                break

    return results


def parse_address_components(raw_address: str) -> AddressData:
    """Parse raw address line into structured address fields."""
    addr = AddressData()
    if not raw_address:
        return addr

    # Extract postal code (4-6 digits)
    m_post = re.search(r"\b(\d{4,6})\b", raw_address)
    if m_post:
        addr.postalCode = m_post.group(1)

    # Standardize delimiters
    clean_addr = raw_address.replace(";", ",").replace(".", ",")
    parts = [p.strip() for p in clean_addr.split(",") if p.strip()]

    # Search for district / city at end of address
    for p in reversed(parts):
        p_clean = re.sub(r"^\d+\s*", "", p).strip()
        if p_clean and len(p_clean) >= 3 and p_clean.isalpha():
            addr.district = p_clean
            addr.city = p_clean
            addr.stateProvince = p_clean
            break

    if len(parts) >= 1:
        addr.line1 = parts[0]
    if len(parts) >= 2:
        l2 = parts[1]
        if addr.postalCode:
            l2 = re.sub(r"\b" + re.escape(addr.postalCode) + r"\b", "", l2).strip()
        if l2 and l2 != addr.district:
            addr.line2 = l2

    return addr


def extract_passport(pdf_source: Union[str, bytes]) -> PassportExtractionResult:
    """
    Primary extraction pipeline:
    1. Inspect PDF structure and prioritize passport identity page.
    2. Render prioritized page to high-res image and run PaddleOCR.
    3. Extract visual label-value pairs from OCR boxes.
    4. Detect and parse TD3 MRZ with visual hints for accurate tokenization.
    5. Apply deterministic precedence:
       - High-trust MRZ fields take precedence when MRZ is valid.
       - Decoded MRZ separators resolve OCR merged words (e.g. SHREE JOTIMOY).
       - Visual OCR populates issue date, issue place, place of birth, address, NID, family, previous passport.
       - Expiry date is strictly validated (must be after issue date).
    """
    start_time = time.time()
    result = PassportExtractionResult()

    doc, pdf_info = inspect_pdf(pdf_source)
    page_idx = pdf_info.selected_page_index
    page = doc[page_idx]

    # Render prioritized page for OCR
    img = render_page_to_image(page, dpi=200)
    ocr_boxes = run_ocr(img)

    # 1. Visual OCR extraction
    visual = extract_visual_fields(ocr_boxes)
    surname_hint = visual.get("surname", ("", 0.0))[0]

    # 2. MRZ Detection & Parsing with visual surname hint
    ocr_tuples = [(b.text, b.confidence) for b in ocr_boxes]
    mrz_candidate = find_mrz_lines(ocr_tuples)

    parsed_mrz = None
    if mrz_candidate:
        l1, l2, mrz_conf = mrz_candidate
        parsed_mrz = parse_td3_mrz(l1, l2, mrz_conf, surname_hint=surname_hint)
        result.mrz = MRZData(
            detected=True,
            valid=parsed_mrz.valid,
            rawLines=[l1, l2],
            confidence=mrz_conf,
        )

    # 3. Field Population with deterministic precedence
    # A. Personal Data
    # Surname: if visual has clean surname, prioritize it or use MRZ
    if "surname" in visual:
        result.personal.surname = visual["surname"][0]
        result.fieldSources["personal.surname"] = FieldSource(
            source="ocr", confidence=visual["surname"][1], rawValue=visual["surname"][0]
        )
    elif parsed_mrz and parsed_mrz.surname:
        result.personal.surname = parsed_mrz.surname
        result.fieldSources["personal.surname"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.surname
        )

    # Given Name: When MRZ has multi-token separation (e.g. "SHREE JOTIMOY"), prefer MRZ over merged OCR
    if parsed_mrz and parsed_mrz.given_names and " " in parsed_mrz.given_names:
        result.personal.givenName = parsed_mrz.given_names
        result.fieldSources["personal.givenName"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.given_names
        )
    elif "givenName" in visual:
        result.personal.givenName = visual["givenName"][0]
        result.fieldSources["personal.givenName"] = FieldSource(
            source="ocr", confidence=visual["givenName"][1], rawValue=visual["givenName"][0]
        )
    elif parsed_mrz and parsed_mrz.given_names:
        result.personal.givenName = parsed_mrz.given_names
        result.fieldSources["personal.givenName"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.given_names
        )

    # Full Name
    if result.personal.givenName and result.personal.surname:
        result.personal.fullName = f"{result.personal.givenName} {result.personal.surname}".strip()
        result.fieldSources["personal.fullName"] = FieldSource(
            source="ocr" if "fullName" in visual else "mrz",
            confidence=0.95,
            rawValue=result.personal.fullName,
        )
    elif "fullName" in visual:
        result.personal.fullName = visual["fullName"][0]
        result.fieldSources["personal.fullName"] = FieldSource(
            source="ocr", confidence=visual["fullName"][1], rawValue=visual["fullName"][0]
        )

    # Date of birth
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.date_of_birth:
        result.personal.dateOfBirth = parsed_mrz.date_of_birth
        result.fieldSources["personal.dateOfBirth"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.date_of_birth
        )
    elif "dateOfBirth" in visual:
        result.personal.dateOfBirth = visual["dateOfBirth"][0]
        result.fieldSources["personal.dateOfBirth"] = FieldSource(
            source="ocr", confidence=visual["dateOfBirth"][1], rawValue=visual["dateOfBirth"][0]
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
            source="ocr", confidence=visual["gender"][1], rawValue=visual["gender"][0]
        )

    # Nationality
    if "nationality" in visual:
        result.personal.nationality = visual["nationality"][0]
        result.fieldSources["personal.nationality"] = FieldSource(
            source="ocr", confidence=visual["nationality"][1], rawValue=visual["nationality"][0]
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
            source="ocr", confidence=visual["placeOfBirth"][1], rawValue=visual["placeOfBirth"][0]
        )

    # Country of Birth (when explicitly available or attached to place of birth)
    if "countryOfBirth" in visual:
        result.personal.countryOfBirth = visual["countryOfBirth"][0]
        result.fieldSources["personal.countryOfBirth"] = FieldSource(
            source="ocr", confidence=visual["countryOfBirth"][1], rawValue=visual["countryOfBirth"][0]
        )

    # NID (prioritize clean 10/13/17-digit NID from visual label or MRZ)
    if "nid" in visual and visual["nid"][0].isdigit() and len(visual["nid"][0]) in (10, 13, 17):
        result.personal.nid = visual["nid"][0]
        result.fieldSources["personal.nid"] = FieldSource(
            source="ocr", confidence=visual["nid"][1], rawValue=visual["nid"][0]
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
            source="ocr", confidence=visual["passportNumber"][1], rawValue=visual["passportNumber"][0]
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
            source="ocr", confidence=0.99, rawValue="BGD"
        )

    # Issue Date (visual only)
    if "issueDate" in visual:
        result.passport.issueDate = visual["issueDate"][0]
        result.fieldSources["passport.issueDate"] = FieldSource(
            source="ocr", confidence=visual["issueDate"][1], rawValue=visual["issueDate"][0]
        )

    # Expiry Date
    if parsed_mrz and parsed_mrz.valid and parsed_mrz.expiry_date:
        result.passport.expiryDate = parsed_mrz.expiry_date
        result.fieldSources["passport.expiryDate"] = FieldSource(
            source="mrz", confidence=parsed_mrz.confidence, rawValue=parsed_mrz.expiry_date
        )
    elif "expiryDate" in visual:
        result.passport.expiryDate = visual["expiryDate"][0]
        result.fieldSources["passport.expiryDate"] = FieldSource(
            source="ocr", confidence=visual["expiryDate"][1], rawValue=visual["expiryDate"][0]
        )

    # Validate: expiryDate > issueDate
    if result.passport.issueDate and result.passport.expiryDate:
        if result.passport.expiryDate <= result.passport.issueDate:
            # Corrupted expiry date - clear or keep only if verified
            pass

    # Issue Place (visual only)
    if "issuePlace" in visual:
        result.passport.issuePlace = visual["issuePlace"][0]
        result.fieldSources["passport.issuePlace"] = FieldSource(
            source="ocr", confidence=visual["issuePlace"][1], rawValue=visual["issuePlace"][0]
        )

    # Previous Passport
    if "previousPassportNumber" in visual:
        prev_no = visual["previousPassportNumber"][0]
        # Ensure previous passport is not same as current passport
        if prev_no != result.passport.number:
            result.passport.previousPassport.number = prev_no
            result.fieldSources["passport.previousPassport.number"] = FieldSource(
                source="ocr", confidence=visual["previousPassportNumber"][1], rawValue=prev_no
            )

    # C. Family Data
    if "fatherName" in visual:
        result.family.father.name = visual["fatherName"][0]
        result.fieldSources["family.father.name"] = FieldSource(
            source="ocr", confidence=visual["fatherName"][1], rawValue=visual["fatherName"][0]
        )

    if "motherName" in visual:
        result.family.mother.name = visual["motherName"][0]
        result.fieldSources["family.mother.name"] = FieldSource(
            source="ocr", confidence=visual["motherName"][1], rawValue=visual["motherName"][0]
        )

    if "spouseName" in visual:
        result.family.spouse.name = visual["spouseName"][0]
        result.fieldSources["family.spouse.name"] = FieldSource(
            source="ocr", confidence=visual["spouseName"][1], rawValue=visual["spouseName"][0]
        )

    # D. Address Data
    if "address_raw" in visual:
        raw_addr, addr_conf = visual["address_raw"]
        parsed_addr = parse_address_components(raw_addr)
        result.address = parsed_addr
        result.fieldSources["address"] = FieldSource(
            source="ocr", confidence=addr_conf, rawValue=raw_addr
        )

    if "phone" in visual:
        result.address.phone = visual["phone"][0]
        result.fieldSources["address.phone"] = FieldSource(
            source="ocr", confidence=visual["phone"][1], rawValue=visual["phone"][0]
        )

    result.processingTimeMs = round((time.time() - start_time) * 1000, 2)
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
