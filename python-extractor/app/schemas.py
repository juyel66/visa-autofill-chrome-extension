from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class PersonalData(BaseModel):
    surname: str = ""
    givenName: str = ""
    fullName: str = ""
    dateOfBirth: str = ""
    gender: str = ""
    nationality: str = ""
    placeOfBirth: str = ""
    countryOfBirth: str = ""
    nid: str = ""


class PreviousPassportData(BaseModel):
    number: str = ""
    issueDate: str = ""
    issuePlace: str = ""
    issuingCountry: str = ""


class PassportData(BaseModel):
    number: str = ""
    issueDate: str = ""
    expiryDate: str = ""
    issuePlace: str = ""
    issuingCountry: str = ""
    previousPassport: PreviousPassportData = Field(default_factory=PreviousPassportData)


class AddressData(BaseModel):
    line1: str = ""
    line2: str = ""
    city: str = ""
    district: str = ""
    stateProvince: str = ""
    postalCode: str = ""
    country: str = ""
    phone: str = ""


class PersonInfo(BaseModel):
    name: str = ""
    nationality: str = ""
    placeOfBirth: str = ""
    countryOfBirth: str = ""


class FamilyData(BaseModel):
    father: PersonInfo = Field(default_factory=PersonInfo)
    mother: PersonInfo = Field(default_factory=PersonInfo)
    spouse: PersonInfo = Field(default_factory=PersonInfo)


class MRZData(BaseModel):
    detected: bool = False
    valid: bool = False
    rawLines: List[str] = Field(default_factory=list)
    confidence: float = 0.0


class FieldSource(BaseModel):
    source: str = ""  # "pdf_text" | "ocr" | "mrz"
    confidence: float = 0.0
    rawValue: str = ""


class PassportExtractionResult(BaseModel):
    personal: PersonalData = Field(default_factory=PersonalData)
    passport: PassportData = Field(default_factory=PassportData)
    address: AddressData = Field(default_factory=AddressData)
    family: FamilyData = Field(default_factory=FamilyData)
    mrz: MRZData = Field(default_factory=MRZData)
    fieldSources: Dict[str, FieldSource] = Field(default_factory=dict)
    processingTimeMs: Optional[float] = None

