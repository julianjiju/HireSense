import os
import json
import logging
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv

from database import init_db, get_db, JobRole, Resume, Ranking
from services.resume_parser import parse_resume
from services.ai_ranker import AIRanker

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

# Initialize AI Ranker
ai_ranker = AIRanker()

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

@app.post("/api/job-roles/{job_id}/resumes")
async def upload_resumes(job_id: str, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Job role not found")
    
    results = []
    for file in files:
        content = await file.read()
        parsed = parse_resume(file.filename, content)
        
        if "error" in parsed:
            results.append({"filename": file.filename, "status": "error", "error": parsed["error"]})
            continue
        
        new_resume = Resume(
            job_role_id=job_id,
            filename=file.filename,
            raw_text=parsed["text"],
            parsed_json=json.dumps({"filename": file.filename}),
            status="success"
        )
        db.add(new_resume)
        results.append({"filename": file.filename, "status": "success"})
    
    role.resume_count = db.query(Resume).filter(Resume.job_role_id == job_id).count()
    db.commit()
    return {"results": results}

@app.post("/api/job-roles/{job_id}/rank")
async def rank_job_role(job_id: str, db: Session = Depends(get_db)):
    role = db.query(JobRole).filter(JobRole.id == job_id).first()
    resumes = db.query(Resume).filter(Resume.job_role_id == job_id).all()
    
    if not role or not resumes:
        raise HTTPException(status_code=400, detail="Job role or resumes missing")

    try:
        jd_profile = await ai_ranker.parse_jd(role.description)
        results = []
        for res in resumes:
            resume_profile = await ai_ranker.parse_resume(res.raw_text)
            match_result = await ai_ranker.rank_candidate(jd_profile, resume_profile)
            results.append({
                "resume_id": res.id,
                "filename": res.filename,
                "candidate_name": resume_profile.get("name", "Unknown"),
                "match": match_result
            })
        
        new_ranking = Ranking(job_role_id=job_id, results_json=json.dumps(results))
        db.add(new_ranking)
        db.commit()
        return {"success": True, "candidates": results}
    except Exception as e:
        logger.error(f"Ranking Engine Error: {e}")
        raise HTTPException(status_code=500, detail="AI Ranking pipeline failed")

@app.get("/api/job-roles/{job_id}/rankings")
def get_rankings(job_id: str, db: Session = Depends(get_db)):
    ranking = db.query(Ranking).filter(Ranking.job_role_id == job_id).order_by(Ranking.ran_at.desc()).first()
    if not ranking:
        return {"candidates": []}
    return {"candidates": json.loads(ranking.results_json)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
