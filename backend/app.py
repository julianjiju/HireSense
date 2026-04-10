import os
import json
import logging
from pathlib import Path
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
import asyncio
import uuid

from database import init_db, get_db, JobRole, Resume, Ranking
from lib.parser_pipeline import parse_resume as parse_resume_pipeline
from lib.file_validation import validate_resume_file
import ai_service

# Load environment variables
load_dotenv()

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hiresense.main")

# Initialize FastAPI
app = FastAPI(title="HireSense AI ATS")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # More permissive for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Storage configuration
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Initialize Database on Startup
@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("Database initialized.")

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class JobRoleCreate(BaseModel):
    title: str
    description: str

class JobRoleResponse(BaseModel):
    id: str
    title: str
    description: str
    created_at: str
    resume_count: int

    class Config:
        from_attributes = True


class ResumeListItem(BaseModel):
    id: str
    filename: str
    batch_label: str
    upload_date: str
    status: str
    candidate_name_preview: str


class ResumePreviewResponse(BaseModel):
    filename: str
    raw_text: str


_GENERIC_CANDIDATE_NAMES = frozenset({
    "", "unknown", "candidate", "resume", "cv", "curriculum vitae", "document", "profile",
    "my resume", "n/a", "none", "na", "not specified",
})


def humanize_candidate_name(extracted_name: str, filename: str) -> str:
    """Avoid showing generic labels like 'Resume' when the file is Resume.pdf."""
    cand = (extracted_name or "").strip()
    if cand and cand.lower() not in _GENERIC_CANDIDATE_NAMES:
        return cand
    stem = Path(filename or "").stem
    stem_clean = stem.replace("_", " ").replace("-", " ").strip()
    if stem_clean and stem_clean.lower() not in _GENERIC_CANDIDATE_NAMES:
        return stem_clean.title()
    return "Candidate"


def compute_weighted_compatibility_score(raw_semantic: int, resume_profile: dict) -> int:
    """
    Weighted ranking: emphasize sustained experience depth; down-rank project-only surface signals.
    """
    years = int(resume_profile.get("years_of_experience_number") or 0)
    secs = resume_profile.get("experience_sections") or {}
    prof = bool(secs.get("professional_experience"))
    projects_only = bool(secs.get("academic_projects")) and not prof
    depth_pts = min(20, int((min(max(years, 0), 12) / 12) * 20))
    penalty = 12 if projects_only else 0
    core = raw_semantic * 0.74 + depth_pts - penalty
    return int(max(0, min(100, round(core))))

# ─── Job Role Routes ──────────────────────────────────────────────────────────

@app.post("/api/job-roles", response_model=JobRoleResponse)
def create_job_role(job: JobRoleCreate, db: Session = Depends(get_db)):
    try:
        new_role = JobRole(title=job.title, description=job.description)
        db.add(new_role)
        db.commit()
        db.refresh(new_role)
        
        return JobRoleResponse(
            id=new_role.id,
            title=new_role.title,
            description=new_role.description,
            created_at=new_role.created_at.isoformat(),
            resume_count=new_role.resume_count
        )
    except Exception as e:
        logger.error(f"Error creating job role: {e}")
        raise HTTPException(status_code=500, detail="Failed to create job role")

@app.get("/api/job-roles", response_model=List[JobRoleResponse])
def get_job_roles(db: Session = Depends(get_db)):
    roles = db.query(JobRole).order_by(JobRole.created_at.desc()).all()
    return [
        JobRoleResponse(
            id=r.id,
            title=r.title,
            description=r.description,
            created_at=r.created_at.isoformat(),
            resume_count=r.resume_count
        ) for r in roles
    ]

@app.delete("/api/job-roles/{job_id}")
def delete_job_role(job_id: str, db: Session = Depends(get_db)):
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    db.delete(role)
    db.commit()
    return {"success": True, "message": "Job role deleted"}

# ─── Resume & Ranking Routes ──────────────────────────────────────────────────

async def _process_single_resume(
    file: UploadFile,
    job_id: str,
    batch: str,
    semaphore: asyncio.Semaphore
):
    """Worker task to process one resume with concurrency control."""
    async with semaphore:
        try:
            # We don't read content all at once in the main task to save memory
            content = await file.read()
            ok, vcode = validate_resume_file(file.filename or "", content)
            if not ok:
                return {"filename": file.filename, "status": "error", "error": vcode, "error_code": vcode}

            parsed_text = await parse_resume_pipeline(file.filename, content)
            if not parsed_text or len(parsed_text.strip()) < 20:
                return {
                    "filename": file.filename,
                    "status": "error",
                    "error": "extraction_failed_or_empty",
                    "error_code": "extraction_failed_or_empty",
                }

            # Save file to disk
            safe_filename = f"{uuid.uuid4()}_{file.filename}"
            file_path = UPLOAD_DIR / safe_filename
            with open(file_path, "wb") as f:
                f.write(content)

            profile = await ai_service.extract_resume_data(parsed_text)
            profile_store = {
                "schema_version": 1,
                "filename": file.filename,
                "batch_label": batch,
                "profile": {k: v for k, v in profile.items() if not str(k).startswith("_")},
            }
            # Construct model
            return Resume(
                job_role_id=job_id,
                filename=file.filename,
                raw_text=parsed_text,
                parsed_json=json.dumps(profile_store, ensure_ascii=False),
                batch_label=batch,
                status="success",
                storage_path=str(file_path)
            )
        except Exception as e:
            logger.error(f"Error processing {file.filename}: {e}")
            return {
                "filename": file.filename,
                "status": "error",
                "error": str(e),
                "error_code": "internal_server_error",
            }


@app.post("/api/job-roles/{job_id}/resumes")
async def upload_resumes(
    job_id: str,
    files: List[UploadFile] = File(...),
    batch_label: str = Form(""),
    db: Session = Depends(get_db),
):
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Job role not found")

    batch = (batch_label or "").strip()[:256]
    
    # Use a Semaphore to limit concurrency (e.g. max 10 Gemini calls at once)
    semaphore = asyncio.Semaphore(10)
    
    tasks = [
        _process_single_resume(file, job_id, batch, semaphore)
        for file in files
    ]
    
    # Process all in parallel
    processed_results = await asyncio.gather(*tasks)
    
    results = []
    resumes_to_add = []
    
    for res in processed_results:
        if isinstance(res, Resume):
            resumes_to_add.append(res)
            results.append({"filename": res.filename, "status": "success"})
        else:
            # It's an error dict
            results.append(res)

    if resumes_to_add:
        try:
            db.add_all(resumes_to_add)
            db.commit()
            
            # Update resume count once
            role.resume_count = db.query(Resume).filter(Resume.job_role_id == job_id).count()
            db.commit()
        except Exception as e:
            logger.error(f"Database batch insert failed: {e}")
            db.rollback()
            # Try to report error back to user
            return {"results": [{"filename": "batch", "status": "error", "error": "db_commit_failed"}]}

    return {"results": results}


@app.get("/api/job-roles/{job_id}/resumes", response_model=List[ResumeListItem])
def list_job_resumes(job_id: str, db: Session = Depends(get_db)):
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Job role not found")
    rows = db.query(Resume).filter(Resume.job_role_id == job_id).order_by(Resume.upload_date.desc()).all()
    out: List[ResumeListItem] = []
    for r in rows:
        preview = ""
        try:
            data = json.loads(r.parsed_json or "{}")
            preview = (data.get("profile") or {}).get("name") or ""
        except Exception:
            pass
        out.append(
            ResumeListItem(
                id=r.id,
                filename=r.filename,
                batch_label=r.batch_label or "",
                upload_date=r.upload_date.isoformat() if r.upload_date else "",
                status=r.status or "success",
                candidate_name_preview=preview or "—",
            )
        )
    return out


@app.get("/api/job-roles/{job_id}/resumes/{resume_id}", response_model=ResumePreviewResponse)
def get_resume_preview(job_id: str, resume_id: str, db: Session = Depends(get_db)):
    logger.info(f"PREVIEW: Fetching resume {resume_id} for job {job_id}")
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    if not role:
        logger.warning(f"PREVIEW ERROR: Job role {job_id} not found")
        raise HTTPException(status_code=404, detail="Job role not found")
    res = db.query(Resume).filter(Resume.id == resume_id, Resume.job_role_id == job_id).first()
    if not res:
        logger.warning(f"PREVIEW ERROR: Resume {resume_id} NOT found for job {job_id}")
        raise HTTPException(status_code=404, detail="Resume not found")
    return ResumePreviewResponse(filename=res.filename, raw_text=res.raw_text or "")


@app.get("/api/resumes/{resume_id}/file")
def get_resume_file(resume_id: str, db: Session = Depends(get_db)):
    res = db.query(Resume).filter(Resume.id == resume_id).first()
    if not res or not res.storage_path:
        raise HTTPException(status_code=404, detail="Original resume file not found")
    
    path = Path(res.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing from storage")
    
    # Determine media type based on extension
    ext = path.suffix.lower()
    media_type = "application/octet-stream"
    if ext == ".pdf":
        media_type = "application/pdf"
    elif ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif ext == ".png":
        media_type = "image/png"
    elif ext == ".docx":
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return FileResponse(path, media_type=media_type, filename=res.filename)


@app.post("/api/resumes/{resume_id}/open-native")
def open_resume_native(resume_id: str, db: Session = Depends(get_db)):
    """Triggers the system's default application to open the resume file."""
    res = db.query(Resume).filter(Resume.id == resume_id).first()
    if not res or not res.storage_path:
        logger.warning(f"NATIVE OPEN ERROR: Resume {resume_id} not found or has no storage path")
        raise HTTPException(status_code=404, detail="Original file not found for this resume")
    
    path = Path(res.storage_path)
    if not path.exists():
        logger.warning(f"NATIVE OPEN ERROR: File {path} missing from disk")
        raise HTTPException(status_code=404, detail="File missing from storage")

    try:
        # Use absolute path to ensure OS can find it
        abs_path = str(path.absolute())
        logger.info(f"NATIVE OPEN: Triggering startfile for {abs_path}")
        
        # Windows-specific opening
        if os.name == 'nt':
            os.startfile(abs_path)
        else:
            # Fallback for Mac/Linux if someone runs it there
            import subprocess
            import sys
            opener = "open" if sys.platform == "darwin" else "xdg-open"
            subprocess.call([opener, abs_path])
            
        return {"status": "success", "message": f"Opened {res.filename} in system viewer"}
    except Exception as e:
        logger.error(f"NATIVE OPEN CRITICAL ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to open system viewer: {str(e)}")


@app.post("/api/job-roles/{job_id}/rank")
async def rank_job_role(job_id: str, db: Session = Depends(get_db)):
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    resumes = db.query(Resume).filter(Resume.job_role_id == job_id).all()
    
    if not role:
        logger.error(f"Ranking failed: Job role {job_id} NOT found in database.")
        raise HTTPException(status_code=400, detail=f"Job role {job_id} missing")
    
    if not resumes:
        logger.warning(f"Ranking called for role {job_id} but NO resumes were uploaded yet.")
        raise HTTPException(status_code=400, detail=f"No resumes found for role {role.title}. Please upload some first.")

    logger.info(f"Starting ranking for role: {role.title} ({len(resumes)} resumes)")

    try:
        # Step 1: Parse JD
        jd_data = await ai_service.parse_job_description(role.description)
        
        results = []
        for res in resumes:
            # 2. Extract Profile
            resume_profile = await ai_service.extract_resume_data(res.raw_text)
            
            # 3. Match Candidate against JD
            match_result = await ai_service.match_candidate(resume_profile, jd_data)
            
            candidate_name = humanize_candidate_name(resume_profile.get("name") or "", res.filename)

            # Rigid mapping with defaults
            match_data = match_result.get("match", {}) if "match" in match_result else match_result
            score = match_data.get("match_score", match_data.get("score", 0))
            if score is None:
                score = 0
            raw_semantic = int(score)
            weighted = compute_weighted_compatibility_score(raw_semantic, resume_profile)

            results.append({
                "job_role_id": job_id,
                "resume_id": res.id,
                "filename": res.filename,
                "candidate_name": candidate_name,
                "years_of_experience_number": resume_profile.get("years_of_experience_number", 0),
                "top_skills": resume_profile.get("top_skills", []),
                "experience_sections": resume_profile.get("experience_sections", {}),
                "education": resume_profile.get("education", ""),
                "compatibility_score": weighted,
                "semantic_match_score": raw_semantic,
                "structured_profile": {k: v for k, v in resume_profile.items() if not str(k).startswith("_")},
                "match": {
                    "match_score": weighted,
                    "semantic_match_score": raw_semantic,
                    "skill_match_analysis": match_data.get("skill_match_analysis", "Analysis pending..."),
                    "experience_match_analysis": match_data.get("experience_match_analysis", ""),
                    "missing_skills": match_data.get("missing_skills", []),
                    "reasoning": match_data.get("reasoning", match_data.get("analysis", "")),
                    "recommendation": match_data.get("recommendation", "Maybe"),
                    "fit_summary_2_sentences": match_data.get(
                        "fit_summary_2_sentences",
                        f"{candidate_name} is a potential fit for this role based on extracted skills and experience."
                    )
                }
            })
        results.sort(key=lambda c: c["match"]["match_score"], reverse=True)
        for row in results[:5]:
            summary = await ai_service.generate_top_five_fit_summary(row, jd_data, role.title)
            row["match"]["fit_summary_2_sentences"] = summary
        new_ranking = Ranking(job_role_id=job_id, results_json=json.dumps(results))
        db.add(new_ranking)
        db.commit()
        return {"success": True, "candidates": results}
    except Exception as e:
        logger.error(f"Resilient Ranking Engine Error: {e}")
        raise HTTPException(status_code=500, detail="Ranking pipeline failed")

@app.get("/api/job-roles/{job_id}/rankings")
def get_rankings(job_id: str, db: Session = Depends(get_db)):
    ranking = db.query(Ranking).filter(Ranking.job_role_id == job_id).order_by(Ranking.ran_at.desc()).first()
    if not ranking:
        return {"candidates": []}
    return {"candidates": json.loads(ranking.results_json)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
