"""
Pydantic models for HireSense v2 — request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ─── AI Extraction Models ────────────────────────────────────────────────────

class ResumeData(BaseModel):
    name: str = ""
    skills: list[str] = []
    years_of_experience: str = ""
    education: str = ""
    projects: list[str] = []
    seniority_level: str = ""
    key_strengths: list[str] = []
    domain: str = ""
    short_summary: str = ""


class ParsedJD(BaseModel):
    role: str = ""
    required_skills: list[str] = []
    required_experience: str = ""
    seniority_expectation: str = ""


class CandidateMatch(BaseModel):
    match_score: int = 0
    skill_match_analysis: str = ""
    experience_match_analysis: str = ""
    missing_skills: list[str] = []
    strengths: list[str] = []
    reasoning: str = ""
    recommendation: str = ""  # "Strong Hire" / "Maybe" / "Reject"
    # Metadata for fallback tracking
    success: bool = True
    source: str = "gemini"
    score: int = 0
    analysis: str = ""
    breakdown: dict = {}


# ─── API Response Models ─────────────────────────────────────────────────────

class UploadedResume(BaseModel):
    id: str
    name: str


class UploadResponse(BaseModel):
    success: bool = True
    source: str = "gemini"
    message: str
    resumes: list[UploadedResume]


class CandidateResult(BaseModel):
    id: str
    candidate_name: str
    # AI extraction
    skills: list[str] = []
    seniority_level: str = ""
    domain: str = ""
    short_summary: str = ""
    key_strengths: list[str] = []
    education: str = ""
    years_of_experience: str = ""
    projects: list[str] = []
    # AI matching
    match_score: int = 0
    skill_match_analysis: str = ""
    experience_match_analysis: str = ""
    missing_skills: list[str] = []
    strengths: list[str] = []
    reasoning: str = ""
    recommendation: str = ""
    # Metadata for fallback tracking
    success: bool = True
    source: str = "gemini"
    score: int = 0
    analysis: str = ""
    breakdown: dict = {}
    # Raw text for preview
    resume_text: str = ""


class AnalyticsData(BaseModel):
    total_candidates: int = 0
    average_score: float = 0
    hiring_confidence: float = 0
    top_skills: list[str] = []
    rare_skills: list[str] = []
    missing_skills: list[str] = []
    skill_coverage_score: float = 0


class RankRequest(BaseModel):
    job_description: str
    resume_ids: list[str] = []


class RankResponse(BaseModel):
    success: bool = True
    source: str = "gemini"
    parsed_jd: ParsedJD
    best_candidate: Optional[CandidateResult] = None
    candidates: list[CandidateResult] = []
    analytics: AnalyticsData
