import os
import json
import re
import hashlib
import asyncio
import logging
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google import genai
from lib.db import check_cache, set_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hiresense.ai")

# ─── Fallback Engine (Tier 3) ──────────────────────────────────────────────────

_SKILL_KEYWORDS = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
    "react", "vue", "angular", "next.js", "node.js", "express", "fastapi",
    "sql", "postgresql", "mongodb", "aws", "azure", "docker", "kubernetes",
    "machine learning", "tensorflow", "pytorch", "nlp", "vision", "ci/cd"
}

def _fallback_score(resume_text: str, jd_text: str) -> dict:
    """
    Weighted Scoring Algorithm:
    - Experience: 40% (Years)
    - Skills: 30% (Keyword overlap)
    - Semantic Similarity: 20% (Cosine-ish similarity via words)
    - Profile Completeness: 10% (Structure indicators)
    """
    resume_lower = resume_text.lower()
    jd_lower = jd_text.lower()
    
    # 1. Experience (0-40 pts)
    exp_matches = re.findall(r"(\d+)\s*\+?\s*years?", resume_lower)
    resume_years = max([int(y) for y in exp_matches] + [0])
    req_matches = re.findall(r"(\d+)\s*\+?\s*years?", jd_lower)
    req_years = int(req_matches[0]) if req_matches else 3
    
    exp_score = min(40, (resume_years / max(req_years, 1)) * 40)
    
    # 2. Skills (0-30 pts)
    res_words = set(re.split(r'\W+', resume_lower))
    jd_words = set(re.split(r'\W+', jd_lower))
    res_skills = res_words & _SKILL_KEYWORDS
    jd_skills = jd_words & _SKILL_KEYWORDS
    
    if jd_skills:
        skill_score = min(30, (len(res_skills & jd_skills) / len(jd_skills)) * 30)
    else:
        skill_score = 15
        
    # 3. Semantic Similarity (0-20 pts)
    # Simple Jaccard similarity as a proxy for semantic similarity
    if jd_words:
        semantic_score = min(20, (len(res_words & jd_words) / len(jd_words)) * 20)
    else:
        semantic_score = 10
        
    # 4. Profile Completeness (0-10 pts)
    completeness = 0
    for keyword in ["education", "experience", "projects", "skills", "certifications"]:
        if keyword in resume_lower: completeness += 2
    
    total = round(exp_score + skill_score + semantic_score + completeness, 1)
    
    return {
        "match_score": total,
        "score": total,
        "source": "fallback",
        "reasoning": f"Rule-based assessment. Experience Match: {exp_score}/40. Skill Overlap: {skill_score}/30. Content Similarity: {semantic_score}/20.",
        "justification": f"Fallback Engine: Matches {len(res_skills & jd_skills)} target skills. Extracted {resume_years} years of relevant experience.",
        "missing_skills": list(jd_skills - res_skills),
        "recommendation": "Strong Hire" if total >= 80 else "Maybe" if total >= 50 else "Reject",
        "breakdown": {
            "experience": round(exp_score, 1),
            "skills": round(skill_score, 1),
            "semantic": round(semantic_score, 1),
            "completeness": round(completeness, 1)
        }
    }

# ─── Gemini Client (Tier 1 & 2) ────────────────────────────────────────────────

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True
)
async def _call_gemini_raw(prompt: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("Missing GEMINI_API_KEY")
        
    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model="gemini-1.5-flash",
        contents=prompt,
        config={"response_mime_type": "application/json"}
    )
    
    try:
        return json.loads(response.text)
    except Exception:
        # Try to find JSON in text if raw parse fails
        match = re.search(r"\{.*\}", response.text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise ValueError("Invalid JSON response from Gemini")

async def match_candidate(resume_text: str, jd_text: str) -> dict:
    """Master matching function with 3-tier reliability."""
    
    # 0. Check Cache (Safely)
    try:
        hash_key = hashlib.md5(f"{resume_text[:2000]}-{jd_text[:2000]}".encode()).hexdigest()
        cached = await check_cache(hash_key)
        if cached:
            logger.info("Cache hit for match results")
            return cached
    except Exception as e:
        logger.warning(f"Cache check failed (skipping): {e}")
        hash_key = None
    
    prompt = f"""Evaluate this resume against the following job description.
    
    RESUME: {resume_text[:5000]}
    
    JD: {jd_text[:3000]}
    
    Return ONLY a JSON object with:
    - match_score: integer 0-100
    - justification: 2-sentence summary of fit
    - strengths: list of 3 strings
    - missing_skills: list of missing keys
    - recommendation: "Strong Hire", "Maybe", or "Reject"
    """
    
    try:
        # Tier 1 & 2 (Gemini + Retry)
        result = await _call_gemini_raw(prompt)
        result["source"] = "gemini"
        result["score"] = result.get("match_score", 0)
        # Add artificial breakdown for consistency
        s = result["score"]
        result["breakdown"] = {
            "experience": round(s * 0.4, 1),
            "skills": round(s * 0.3, 1),
            "semantic": round(s * 0.2, 1),
            "completeness": round(s * 0.1, 1)
        }
    except Exception as e:
        # Tier 3 (Fallback)
        logger.warning(f"Tier 1/2 failed: {e}. Moving to Fallback Engine.")
        result = _fallback_score(resume_text, jd_text)
    
    # Save to Cache (Safely)
    if hash_key:
        try:
            await set_cache(hash_key, result)
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
            
    return result

async def extract_profile(resume_text: str) -> dict:
    """Extract structured profile from resume text."""
    prompt = f"""Extract professional profile from this resume.
    RESUME: {resume_text[:5000]}
    Return ONLY JSON: {{ "name": "...", "skills": [], "years_exp": 0, "education": "...", "role": "..." }}
    """
    try:
        return await _call_gemini_raw(prompt)
    except Exception:
        # Minimal fallback for profile extraction
        return {
            "name": "Candidate",
            "skills": list(_SKILL_KEYWORDS & set(resume_text.lower().split())),
            "years_exp": 0,
            "education": "Unknown",
            "role": "Software Professional"
        }
