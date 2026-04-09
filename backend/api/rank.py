from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from lib import ai_engine, db
import asyncio

app = FastAPI()

class RankSpec(BaseModel):
    job_id: str
    job_description: str

@app.post("/api/rank")
async def rank_candidates(spec: RankSpec):
    try:
        # 1. Get all resumes for this job
        resumes = await db.get_resumes_by_job(spec.job_id)
        if not resumes.data:
            return {"success": True, "results": [], "message": "No resumes found for this job"}
            
        # 2. Match each candidate concurrently
        async def process_match(resume):
            match_data = await ai_engine.match_candidate(
                resume["extracted_text"], 
                spec.job_description
            )
            # Save to DB
            await db.save_match_result(
                spec.job_id,
                resume["id"],
                match_data["score"],
                match_data["justification"],
                match_data["breakdown"],
                match_data["source"]
            )
            return {
                "resume_id": resume["id"],
                "filename": resume["filename"],
                "match": match_data
            }
            
        results = await asyncio.gather(*(process_match(r) for r in resumes.data))
        
        # Sort results by score
        results.sort(key=lambda x: x["match"]["score"], reverse=True)
        
        return {"success": True, "results": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
