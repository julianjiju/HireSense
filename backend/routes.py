"""
HireSense v3 — FastAPI Routes.
All AI calls go through ai_service.py ONLY.
Every endpoint is wrapped in global try/except — it will NEVER crash FastAPI.
"""
import uuid
import asyncio
import logging
from collections import Counter

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from typing import List

from parser import parse_pdf
import ai_service
from models import (
    UploadResponse, UploadedResume,
    RankRequest, RankResponse, CandidateResult,
    ParsedJD, AnalyticsData,
)

log = logging.getLogger("hiresense.routes")
router = APIRouter()

# In-memory storage: UUID → { name, text, ai_data }
uploaded_resumes: dict = {}


# ─── Error Response Helper ────────────────────────────────────────────────────

def _error_json(detail: str, status: int = 500) -> JSONResponse:
    """Always returns a valid JSON error — never raises."""
    return JSONResponse(
        status_code=status,
        content={"success": False, "error": detail, "source": "system"},
    )


# ─── Upload Endpoint ──────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_resumes(files: List[UploadFile] = File(...)):
    """
    Upload one or more PDF resumes.
    Uses ai_service for extraction — works even when Gemini is down.
    Always returns valid JSON.
    """
    try:
        if not files:
            return _error_json("No files provided.", 400)

        async def process_file(file: UploadFile):
            try:
                if not file.filename or not file.filename.lower().endswith(".pdf"):
                    log.info(f"Skipping non-PDF file: {file.filename}")
                    return None

                content = await file.read()
                text = parse_pdf(content)

                if not text.strip():
                    log.info(f"Empty PDF text for: {file.filename}")
                    return None

                # ai_service NEVER raises
                ai_data = await ai_service.extract_resume_data(text)
                c_id = str(uuid.uuid4())
                name = ai_data.get("name") or file.filename[:-4]
                return c_id, name, text, ai_data

            except Exception as exc:
                log.error(f"process_file error ({file.filename}): {exc}")
                return None

        results = await asyncio.gather(*(process_file(f) for f in files))

        parsed = []
        for res in results:
            if res:
                c_id, name, text, ai_data = res
                uploaded_resumes[c_id] = {"name": name, "text": text, "ai_data": ai_data}
                parsed.append(UploadedResume(id=c_id, name=name))

        source = "gemini" if any(
            uploaded_resumes.get(r.id, {}).get("ai_data", {}).get("_source") == "gemini"
            for r in parsed
        ) else "fallback"

        return UploadResponse(
            success=True,
            source=source,
            message=f"Processed {len(parsed)} resume(s) successfully.",
            resumes=parsed,
        )

    except Exception as exc:
        log.error(f"/upload unhandled: {exc}")
        return _error_json(f"Upload failed: {str(exc)}")


# ─── Rank Endpoint ────────────────────────────────────────────────────────────

@router.post("/rank")
async def rank_candidates(req: RankRequest):
    """
    Rank uploaded candidates against a job description.
    Works with any combination of Gemini / fallback results.
    Always returns valid JSON.
    """
    try:
        if not req.job_description.strip():
            return _error_json("Job description is required.", 400)

        ids_to_rank = req.resume_ids if req.resume_ids else list(uploaded_resumes.keys())

        if not ids_to_rank:
            return _error_json("No resumes uploaded yet. Please upload resumes first.", 400)

        # Step 1: Parse JD — ai_service NEVER raises
        jd_data = await ai_service.parse_job_description(req.job_description)

        try:
            parsed_jd = ParsedJD(**{
                k: v for k, v in jd_data.items()
                if k in ParsedJD.model_fields
            })
        except Exception:
            parsed_jd = ParsedJD()

        # Step 2: Match each candidate concurrently
        async def process_candidate(r_id: str):
            try:
                if r_id not in uploaded_resumes:
                    return None

                resume = uploaded_resumes[r_id]
                ai_data = resume.get("ai_data", {})

                # ai_service NEVER raises
                match_data = await ai_service.match_candidate(ai_data, jd_data)

                candidate = CandidateResult(
                    id=r_id,
                    candidate_name=resume["name"],
                    # AI extraction fields
                    skills=ai_data.get("skills", []),
                    seniority_level=ai_data.get("seniority_level", ""),
                    domain=ai_data.get("domain", ""),
                    short_summary=ai_data.get("short_summary", ""),
                    key_strengths=ai_data.get("key_strengths", []),
                    education=ai_data.get("education", ""),
                    years_of_experience=ai_data.get("years_of_experience", ""),
                    projects=ai_data.get("projects", []),
                    # Match fields
                    match_score=int(match_data.get("match_score", match_data.get("score", 0))),
                    skill_match_analysis=match_data.get("skill_match_analysis", ""),
                    experience_match_analysis=match_data.get("experience_match_analysis", ""),
                    missing_skills=match_data.get("missing_skills", []),
                    strengths=match_data.get("strengths", []),
                    reasoning=match_data.get("reasoning", ""),
                    recommendation=match_data.get("recommendation", "Maybe"),
                    # Standard contract
                    success=match_data.get("success", True),
                    source=match_data.get("source", "fallback"),
                    score=int(match_data.get("score", match_data.get("match_score", 0))),
                    analysis=match_data.get("analysis", match_data.get("reasoning", "")),
                    breakdown=match_data.get("breakdown", {
                        "skills": 0, "experience": 0, "education": 0, "format": 0
                    }),
                    resume_text=resume["text"],
                )
                return candidate, ai_data, match_data

            except Exception as exc:
                log.error(f"process_candidate error ({r_id}): {exc}")
                return None

        raw_results = await asyncio.gather(*(process_candidate(r_id) for r_id in ids_to_rank))

        results: list[CandidateResult] = []
        all_skills: list[str] = []
        all_missing: list[str] = []
        all_scores: list[int] = []

        for res in raw_results:
            if res:
                candidate, ai_data, match_data = res
                results.append(candidate)
                all_skills.extend(ai_data.get("skills", []))
                all_missing.extend(match_data.get("missing_skills", []))
                all_scores.append(candidate.match_score)

        # Sort by score descending
        results.sort(key=lambda c: c.match_score, reverse=True)

        best = results[0] if results else None
        total = len(results)
        avg_score = round(sum(all_scores) / total, 1) if total else 0

        skill_counts   = Counter(all_skills)
        missing_counts = Counter(all_missing)

        rare_threshold = max(1, int(total * 0.3))
        rare_skills    = [s for s, c in skill_counts.items() if c <= rare_threshold][:8]
        top_skills     = [s for s, _ in skill_counts.most_common(10)]
        common_missing = [s for s, _ in missing_counts.most_common(8)]

        confident_hires  = sum(1 for s in all_scores if s >= 60)
        hiring_confidence = round((confident_hires / total) * 100, 1) if total else 0

        jd_skills_set  = set(s.lower() for s in parsed_jd.required_skills)
        pool_skills_set = set(s.lower() for s in all_skills)
        coverage = round(
            (len(jd_skills_set & pool_skills_set) / max(len(jd_skills_set), 1)) * 100, 1
        )

        analytics = AnalyticsData(
            total_candidates=total,
            average_score=avg_score,
            hiring_confidence=hiring_confidence,
            top_skills=top_skills,
            rare_skills=rare_skills,
            missing_skills=common_missing,
            skill_coverage_score=coverage,
        )

        # Determine overall source
        sources = {c.source for c in results}
        overall_source = "gemini" if "gemini" in sources else "fallback"

        return RankResponse(
            success=True,
            source=overall_source,
            parsed_jd=parsed_jd,
            best_candidate=best,
            candidates=results,
            analytics=analytics,
        )

    except Exception as exc:
        log.error(f"/rank unhandled: {exc}")
        return _error_json(f"Ranking failed: {str(exc)}")


# ─── Evaluate Endpoint ────────────────────────────────────────────────────────

@router.post("/evaluate")
async def evaluate_single(req: RankRequest):
    """
    Evaluate a single candidate (first resume_id) against a job description.
    Thin wrapper around /rank for single-candidate use cases.
    Always returns valid JSON.
    """
    try:
        if not req.job_description.strip():
            return _error_json("Job description is required.", 400)

        ids = req.resume_ids or list(uploaded_resumes.keys())
        if not ids:
            return _error_json("No resumes available to evaluate.", 400)

        # Evaluate only the first candidate
        target_id = ids[0]
        if target_id not in uploaded_resumes:
            return _error_json(f"Resume ID {target_id!r} not found.", 404)

        resume = uploaded_resumes[target_id]
        ai_data = resume.get("ai_data", {})

        jd_data    = await ai_service.parse_job_description(req.job_description)
        match_data = await ai_service.match_candidate(ai_data, jd_data)

        return JSONResponse(content={
            "success":   match_data.get("success", True),
            "source":    match_data.get("source", "fallback"),
            "score":     match_data.get("score", match_data.get("match_score", 0)),
            "analysis":  match_data.get("analysis", match_data.get("reasoning", "")),
            "breakdown": match_data.get("breakdown", {
                "skills": 0, "experience": 0, "education": 0, "format": 0
            }),
            "candidate_name": resume["name"],
            "recommendation": match_data.get("recommendation", "Maybe"),
            "missing_skills": match_data.get("missing_skills", []),
            "strengths":      match_data.get("strengths", []),
        })

    except Exception as exc:
        log.error(f"/evaluate unhandled: {exc}")
        return _error_json(f"Evaluation failed: {str(exc)}")
