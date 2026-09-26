import json
import pytest
from app.schemas import (
    AddressData,
    FieldSource,
    MRZData,
    PassportData,
    PassportExtractionResult,
    PersonalData,
)


def test_schema_defaults_are_empty_strings():
    result = PassportExtractionResult()
    
    # Personal
    assert result.personal.surname == ""
    assert result.personal.givenName == ""
    assert result.personal.dateOfBirth == ""
    assert result.personal.gender == ""
    assert result.personal.nationality == ""
    assert result.personal.placeOfBirth == ""
    assert result.personal.countryOfBirth == ""
    assert result.personal.nid == ""

    # Passport
    assert result.passport.number == ""
    assert result.passport.issueDate == ""
    assert result.passport.expiryDate == ""
    assert result.passport.issuePlace == ""
    assert result.passport.issuingCountry == ""

    # Address
    assert result.address.line1 == ""
    assert result.address.line2 == ""
    assert result.address.city == ""
    assert result.address.district == ""
    assert result.address.stateProvince == ""
    assert result.address.postalCode == ""
    assert result.address.country == ""
    assert result.address.phone == ""

    # Family
    assert result.family.father.name == ""
    assert result.family.mother.name == ""
    assert result.family.spouse.name == ""

    # Previous Passport
    assert result.passport.previousPassport.number == ""

    # MRZ
    assert result.mrz.detected is False
    assert result.mrz.valid is False
    assert result.mrz.rawLines == []
    assert result.mrz.confidence == 0.0


def test_schema_serialization():
    result = PassportExtractionResult(
        personal=PersonalData(surname="DOE", givenName="JOHN", gender="male"),
        passport=PassportData(number="A12345678", issuingCountry="BGD"),
        mrz=MRZData(detected=True, valid=True, confidence=0.98),
        fieldSources={
            "personal.surname": FieldSource(source="mrz", confidence=0.98, rawValue="DOE")
        },
    )

    data = result.model_dump()
    assert data["personal"]["surname"] == "DOE"
    assert data["passport"]["number"] == "A12345678"
    assert data["mrz"]["valid"] is True
    assert data["fieldSources"]["personal.surname"]["source"] == "mrz"

    # JSON serialization
    json_str = result.model_dump_json()
    parsed = json.loads(json_str)
    assert parsed["personal"]["surname"] == "DOE"
