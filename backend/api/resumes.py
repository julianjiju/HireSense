from fastapi import FastAPI, HTTPException, Query
from lib import db

app = FastAPI()

@app.get("/api/resumes")
async def list_resumes(job_id: str = Query(...)):
    try:
        res = await db.get_resumes_by_job(job_id)
        return {"success": True, "resumes": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
