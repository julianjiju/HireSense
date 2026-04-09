from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from lib import db

app = FastAPI()

class JobSpec(BaseModel):
    title: str
    description: str = ""

# Note: Using full path to match Vercel routing and local mounting
@app.get("/api/jobs")
async def list_jobs():
    try:
        res = await db.get_jobs()
        return {"success": True, "jobs": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/jobs")
async def create_new_job(job: JobSpec):
    try:
        res = await db.create_job(job.title, job.description)
        return {"success": True, "job": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
