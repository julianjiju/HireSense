"""
HireSense v3 — Fault-Tolerant AI Service Layer
================================================
Architecture:
  TIER 1  → Gemini gemini-1.5-flash (primary)
  TIER 2  → Controlled retry (max 2 attempts, smart skip on quota/auth errors)
  TIER 3  → Rule-based fallback engine (always works, no network required)

All three public functions NEVER raise exceptions.
All return values conform to the Standard Output Contract.
"""

import os
import re
import json
import time
import hashlib
import asyncio
import logging
from functools import wraps

from dotenv import load_dotenv

load_dotenv()

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AI] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("hiresense.ai")

# ─── Gemini Client (lazy-initialised so import never crashes) ─────────────────

_gemini_client = None

def _get_client():
    """Lazy-init Gemini client. Returns None if key is missing/invalid."""
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        log.warning("GEMINI_API_KEY not set → fallback-only mode")
        return None
    try:
        from google import genai
        _gemini_client = genai.Client(api_key=api_key)
        return _gemini_client
    except Exception as exc:
        log.warning(f"Gemini client init failed: {exc} → fallback-only mode")
        return None


# ─── Error Classification ─────────────────────────────────────────────────────

# Errors that should NEVER be retried — go straight to fallback
_SKIP_RETRY_PATTERNS = (
    "429",
    "RESOURCE_EXHAUSTED",
    "quota",
    "rate limit",
    "400",
    "INVALID_ARGUMENT",
    "invalid api key",
    "api_key",
    "authentication",
    "permission denied",
    "403",
    "unauthorized",
)

def _should_skip_retry(error: Exception) -> bool:
    """Return True if this error class should bypass retries entirely."""
    msg = str(error).lower()
    return any(p.lower() in msg for p in _SKIP_RETRY_PATTERNS)


# ─── In-Memory Cache ──────────────────────────────────────────────────────────

_resume_cache: dict[str, dict] = {}   # hash(resume_text) → extraction result
_jd_cache:     dict[str, dict] = {}   # hash(jd_text)     → parsed JD result
_match_cache:  dict[str, dict] = {}   # hash(resume+jd)   → match result


def _hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8", errors="replace")).hexdigest()


# ─── JSON Safe Parser ─────────────────────────────────────────────────────────

def _safe_parse(text: str) -> dict:
    """Extract a JSON object from raw Gemini text, tolerating markdown fences."""
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip ```json ... ``` fences
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    # Last resort: grab first { ... } block
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


# ─── Gemini Wrapper with Retry ────────────────────────────────────────────────

def with_retry(delays=[2, 5]):
    """Generic decorator for retrying async functions with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            label = kwargs.get("label", "AI Task")
            last_exc = None
            for attempt in range(len(delays) + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if _should_skip_retry(exc):
                        raise exc
                    if attempt < len(delays):
                        delay = delays[attempt]
                        log.info(f"[{label}] Gemini failed → retrying in {delay}s (attempt {attempt + 2}/{len(delays)+1})")
                        await asyncio.sleep(delay)
            raise last_exc
        return wrapper
    return decorator


@with_retry(delays=[2, 5])
async def _raw_gemini_call(prompt: str, label: str) -> dict:
    """The actual network call, wrapped by retry decorator."""
    client = _get_client()
    if client is None:
        raise RuntimeError("No Gemini client available")

    response = await client.aio.models.generate_content(
        model="gemini-1.5-flash",
        contents=prompt,
        config={
            "temperature": 0.3,
            "max_output_tokens": 4096,
            "response_mime_type": "application/json",
        },
    )
    result = _safe_parse(response.text)
    if not result:
        raise ValueError("Empty or invalid JSON from Gemini")
    return result


async def _call_gemini(prompt: str, label: str) -> dict | None:
    """
    Public entry for Gemini calls.
    Orchestrates the decorated raw call and handles unrecoverable failures.
    """
    try:
        result = await _raw_gemini_call(prompt=prompt, label=label)
        log.info(f"[{label}] Gemini success")
        return result
    except Exception as exc:
        err_str = str(exc)
        if _should_skip_retry(exc):
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                log.warning(f"[{label}] quota exceeded → fallback used")
            elif any(k in err_str.lower() for k in ["api_key", "authentication", "unauthorized"]):
                log.warning(f"[{label}] invalid API key → fallback used")
            else:
                log.warning(f"[{label}] unretriable error ({exc}) → fallback used")
        else:
            log.warning(f"[{label}] all retries exhausted or fatal error → fallback used")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 3 — Rule-Based Fallback Engine
# ═══════════════════════════════════════════════════════════════════════════════

# Keyword sets for fallback scoring
_SKILL_KEYWORDS = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
    "kotlin", "swift", "ruby", "php", "scala", "r", "matlab",
    "react", "vue", "angular", "next.js", "nuxt", "svelte",
    "node.js", "express", "fastapi", "django", "flask", "spring", "laravel",
    "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
    "git", "ci/cd", "jenkins", "github actions", "linux",
    "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn",
    "pandas", "numpy", "spark", "kafka", "airflow",
    "rest", "graphql", "grpc", "microservices", "api",
    "agile", "scrum", "jira", "figma",
}

_EXPERIENCE_PATTERNS = [
    r"(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|exp)",
    r"(\d+)\s*\+?\s*yrs?\s+(?:of\s+)?(?:experience|exp)",
    r"experience\s*[:\-]?\s*(\d+)\s*\+?\s*years?",
    r"(\d{4})\s*[-–]\s*(?:present|current|now)",   # date ranges
]

_JOB_TITLE_KEYWORDS = [
    "engineer", "developer", "architect", "analyst", "manager", "lead",
    "designer", "scientist", "consultant", "intern", "director", "vp",
    "officer", "specialist", "coordinator", "associate",
]

_EDUCATION_KEYWORDS = {
    "phd": 20, "ph.d": 20, "doctorate": 20,
    "master": 18, "m.s": 18, "m.sc": 18, "mba": 18, "m.tech": 18,
    "bachelor": 15, "b.s": 15, "b.sc": 15, "b.tech": 15, "b.e": 15, "b.a": 14,
    "associate": 10, "diploma": 8, "certificate": 6, "bootcamp": 5,
}

_STRUCTURE_SIGNALS = [
    "experience", "education", "skills", "projects", "summary",
    "objective", "certifications", "achievements", "publications",
    "awards", "languages", "interests", "references",
]


def _fallback_extract_resume(text: str) -> dict:
    """Rule-based resume extraction — no AI required."""
    text_lower = text.lower()
    words = set(re.split(r'\W+', text_lower))

    # Skills: keyword intersection
    found_skills = sorted(_SKILL_KEYWORDS & words)

    # Years of experience
    years = 0
    for pat in _EXPERIENCE_PATTERNS:
        matches = re.findall(pat, text_lower)
        if matches:
            try:
                y = int(matches[0])
                # Handle year-range pattern (e.g., 2019)
                if y > 1990:
                    years = max(years, 2024 - y)
                else:
                    years = max(years, y)
            except ValueError:
                pass

    exp_str = f"{years}+ years" if years else "Not specified"

    # Education
    education = "Not specified"
    for deg, _ in sorted(_EDUCATION_KEYWORDS.items(), key=lambda x: -x[1]):
        if deg in text_lower:
            education = deg.upper()
            break

    # Seniority heuristic
    if years >= 8:
        seniority = "senior"
    elif years >= 5:
        seniority = "mid"
    elif years >= 2:
        seniority = "junior"
    elif years >= 0 and "intern" in text_lower:
        seniority = "intern"
    else:
        seniority = "mid"

    # Domain heuristic
    domain = "General Engineering"
    if any(k in text_lower for k in ["machine learning", "data science", "tensorflow", "pytorch", "nlp"]):
        domain = "Data Science / ML"
    elif any(k in text_lower for k in ["react", "vue", "angular", "css", "html", "frontend"]):
        domain = "Frontend"
    elif any(k in text_lower for k in ["devops", "kubernetes", "docker", "terraform", "ci/cd"]):
        domain = "DevOps / Cloud"
    elif any(k in text_lower for k in ["android", "ios", "swift", "kotlin", "flutter"]):
        domain = "Mobile"

    # Name — first non-empty line that looks like a name (title case, no symbols)
    name = ""
    for line in text.splitlines():
        line = line.strip()
        if line and re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', line):
            name = line
            break

    return {
        "name": name,
        "skills": found_skills[:15],
        "years_of_experience": exp_str,
        "education": education,
        "projects": [],
        "seniority_level": seniority,
        "key_strengths": found_skills[:3],
        "domain": domain,
        "short_summary": f"Candidate with {exp_str} experience in {domain}. Skills include: {', '.join(found_skills[:5]) or 'various technologies'}.",
    }


def _fallback_parse_jd(text: str) -> dict:
    """Rule-based JD parsing — no AI required."""
    text_lower = text.lower()
    words = set(re.split(r'\W+', text_lower))

    required_skills = sorted(_SKILL_KEYWORDS & words)

    # Experience requirement
    exp_req = "Not specified"
    for pat in _EXPERIENCE_PATTERNS:
        matches = re.findall(pat, text_lower)
        if matches:
            exp_req = f"{matches[0]}+ years"
            break

    # Role: look for capitalized title-like phrases at start of text
    role = "Software Engineer"
    for line in text.splitlines()[:10]:
        line = line.strip()
        if any(kw in line.lower() for kw in _JOB_TITLE_KEYWORDS) and len(line) < 80:
            role = line
            break

    # Seniority
    seniority = "mid"
    if "senior" in text_lower or "sr." in text_lower:
        seniority = "senior"
    elif "lead" in text_lower or "principal" in text_lower:
        seniority = "lead"
    elif "junior" in text_lower or "jr." in text_lower:
        seniority = "junior"
    elif "intern" in text_lower:
        seniority = "intern"

    return {
        "role": role,
        "required_skills": required_skills[:15],
        "required_experience": exp_req,
        "seniority_expectation": seniority,
    }


def _fallback_match(resume_data: dict, jd_data: dict) -> dict:
    """
    Rule-based matching with Standard Output Contract.
    Score breakdown:
      - skills  : 0–40  (keyword overlap)
      - experience: 0–30 (years heuristic)
      - education : 0–20 (degree detection)
      - format  : 0–10  (resume structure quality)
    """
    log.info("fallback engine executed")

    resume_text_hint = resume_data.get("short_summary", "") + " " + " ".join(resume_data.get("skills", []))
    resume_skills = set(s.lower() for s in resume_data.get("skills", []))
    jd_skills     = set(s.lower() for s in jd_data.get("required_skills", []))

    # ── Skills score (0–40) ──────────────────────────────────────────────────
    if jd_skills:
        overlap = resume_skills & jd_skills
        skill_score = int((len(overlap) / len(jd_skills)) * 40)
    else:
        skill_score = 20  # No JD skills → neutral
    skill_score = min(40, max(0, skill_score))

    # ── Experience score (0–30) ──────────────────────────────────────────────
    exp_str = resume_data.get("years_of_experience", "0")
    exp_nums = re.findall(r'\d+', exp_str)
    resume_years = int(exp_nums[0]) if exp_nums else 0

    req_str = jd_data.get("required_experience", "0")
    req_nums = re.findall(r'\d+', req_str)
    required_years = int(req_nums[0]) if req_nums else 0

    if required_years == 0:
        exp_score = 20
    elif resume_years >= required_years:
        exp_score = 30
    elif resume_years >= required_years * 0.7:
        exp_score = 20
    elif resume_years >= required_years * 0.4:
        exp_score = 10
    else:
        exp_score = 3
    exp_score = min(30, max(0, exp_score))

    # ── Education score (0–20) ────────────────────────────────────────────────
    edu = resume_data.get("education", "").lower()
    edu_score = 0
    for keyword, points in sorted(_EDUCATION_KEYWORDS.items(), key=lambda x: -x[1]):
        if keyword in edu:
            edu_score = min(20, points)
            break
    if edu_score == 0 and edu not in ("", "not specified", "unknown"):
        edu_score = 5  # Something is listed

    # ── Format / structure score (0–10) ──────────────────────────────────────
    format_score = 0
    if resume_data.get("name"):        format_score += 2
    if resume_data.get("skills"):      format_score += 2
    if resume_data.get("education"):   format_score += 2
    if resume_data.get("projects"):    format_score += 2
    if resume_data.get("short_summary"): format_score += 2
    format_score = min(10, format_score)

    # ── Aggregate ─────────────────────────────────────────────────────────────
    total = skill_score + exp_score + edu_score + format_score

    # Match text
    missing = sorted(jd_skills - resume_skills) if jd_skills else []
    matched = sorted(resume_skills & jd_skills)

    # Recommendation
    if total >= 75:
        recommendation = "Strong Hire"
    elif total >= 60:
        recommendation = "Hire"
    elif total >= 40:
        recommendation = "Maybe"
    elif total >= 25:
        recommendation = "Weak"
    else:
        recommendation = "Reject"

    analysis = (
        f"Rule-based assessment: {len(matched)} of {len(jd_skills)} required skills matched. "
        f"Candidate has {resume_years} years of experience; role requires {required_years}+ years. "
        f"Education: {resume_data.get('education', 'unknown')}."
    )

    return {
        "success": True,
        "source": "fallback",
        "score": total,
        "analysis": analysis,
        "breakdown": {
            "skills":     skill_score,
            "experience": exp_score,
            "education":  edu_score,
            "format":     format_score,
        },
        # Additional fields expected by routes.py CandidateResult
        "match_score":              total,
        "skill_match_analysis":     f"Matched skills: {', '.join(matched) or 'none'}.",
        "experience_match_analysis": f"Candidate: {resume_years} yrs | Required: {required_years}+ yrs.",
        "missing_skills":           missing[:10],
        "strengths":                list(matched)[:5],
        "reasoning":                analysis,
        "recommendation":           recommendation,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API — Three functions, zero exceptions
# ═══════════════════════════════════════════════════════════════════════════════

async def extract_resume_data(resume_text: str) -> dict:
    """
    Extract structured data from raw resume text.
    ALWAYS returns a dict — never raises.
    """
    cache_key = _hash(resume_text)
    if cache_key in _resume_cache:
        return _resume_cache[cache_key]

    prompt = f"""You are an expert HR analyst. Extract structured data from this resume.

Return ONLY a JSON object with these exact keys:
{{
  "name": "candidate's full name",
  "skills": ["list", "of", "technical", "and", "soft", "skills"],
  "years_of_experience": "e.g. '3 years' or '5+ years'",
  "education": "highest degree and institution",
  "projects": ["notable project 1", "notable project 2"],
  "seniority_level": "one of: intern, junior, mid, senior, lead",
  "key_strengths": ["strength 1", "strength 2", "strength 3"],
  "domain": "e.g. Frontend, Backend, Full Stack, Data Science, DevOps",
  "short_summary": "1-2 sentence professional summary"
}}

If a field cannot be determined, use reasonable defaults or empty values.
Be thorough — extract ALL skills mentioned.

RESUME TEXT:
{resume_text}"""

    result = await _call_gemini(prompt, "extract_resume")

    if result and isinstance(result, dict):
        log.info("Gemini success — resume extraction")
        result["_source"] = "gemini"
    else:
        result = _fallback_extract_resume(resume_text)
        result["_source"] = "fallback"

    _resume_cache[cache_key] = result
    return result


async def parse_job_description(jd_text: str) -> dict:
    """
    Parse a job description into structured requirements.
    ALWAYS returns a dict — never raises.
    """
    cache_key = _hash(jd_text)
    if cache_key in _jd_cache:
        return _jd_cache[cache_key]

    prompt = f"""You are a senior technical recruiter. Parse this job description into structured requirements.

Return ONLY a JSON object with these exact keys:
{{
  "role": "job title (e.g. Senior Frontend Developer)",
  "required_skills": ["skill1", "skill2", "skill3"],
  "required_experience": "e.g. '3+ years' or '5 years'",
  "seniority_expectation": "one of: intern, junior, mid, senior, lead, principal"
}}

Be thorough — extract ALL technical skills, frameworks, tools, and methodologies mentioned.

JOB DESCRIPTION:
{jd_text}"""

    result = await _call_gemini(prompt, "parse_jd")

    if result and isinstance(result, dict):
        log.info("Gemini success — JD parsing")
        result["_source"] = "gemini"
    else:
        result = _fallback_parse_jd(jd_text)
        result["_source"] = "fallback"

    _jd_cache[cache_key] = result
    return result


async def match_candidate(resume_data: dict, parsed_jd: dict) -> dict:
    """
    Evaluate candidate–JD fit.
    ALWAYS returns a Standard Output Contract dict — never raises.
    """
    cache_key = _hash(json.dumps(resume_data, sort_keys=True) + json.dumps(parsed_jd, sort_keys=True))
    if cache_key in _match_cache:
        return _match_cache[cache_key]

    prompt = f"""You are a world-class senior technical recruiter with 15 years of experience.

Evaluate this candidate against the job requirements.

CANDIDATE PROFILE:
{json.dumps(resume_data, indent=2)}

JOB REQUIREMENTS:
{json.dumps(parsed_jd, indent=2)}

Return ONLY a JSON object with these exact keys:
{{
  "match_score": <integer 0-100>,
  "skill_match_analysis": "2-3 sentences analyzing skill alignment",
  "experience_match_analysis": "2-3 sentences analyzing experience fit",
  "missing_skills": ["skills required by JD but absent in candidate"],
  "strengths": ["top 3-4 candidate strengths relevant to this role"],
  "reasoning": "3-4 sentences explaining the overall assessment",
  "recommendation": "one of: Strong Hire, Hire, Maybe, Weak, Reject"
}}

SCORING GUIDE:
- 85-100: Exceptional match, strong hire signal
- 70-84: Good match, worth interviewing
- 50-69: Partial match, consider if pipeline is thin
- 30-49: Weak match, significant gaps
- 0-29: Poor fit, do not proceed"""

    result = await _call_gemini(prompt, "match_candidate")

    if result and isinstance(result, dict) and "match_score" in result:
        log.info("Gemini success — candidate matching")
        score = int(result.get("match_score", 0))
        # Enrich with Standard Output Contract fields
        result.setdefault("skill_match_analysis", "")
        result.setdefault("experience_match_analysis", "")
        result.setdefault("missing_skills", [])
        result.setdefault("strengths", [])
        result.setdefault("reasoning", "")
        result.setdefault("recommendation", "Maybe")
        result.update({
            "success": True,
            "source": "gemini",
            "score": score,
            "analysis": result.get("reasoning", "Gemini AI evaluation."),
            "breakdown": {
                "skills":     min(40, int(score * 0.40)),
                "experience": min(30, int(score * 0.30)),
                "education":  min(20, int(score * 0.20)),
                "format":     min(10, int(score * 0.10)),
            },
        })
    else:
        result = _fallback_match(resume_data, parsed_jd)

    _match_cache[cache_key] = result
    return result
