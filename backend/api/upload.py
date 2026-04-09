from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from lib import parser_pipeline, ai_engine, db
import asyncio

app = FastAPI()

@app.post("/api/upload")
async def upload_resume(
    job_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        
        # 1. Pipeline Parsing
        text = await parser_pipeline.parse_resume(file.filename, content)
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract text from resume")
            
        # 2. profile Extraction
        profile = await ai_engine.extract_profile(text)
        
        # 3. Save to DB
        res = await db.save_resume(job_id, file.filename, text, profile)
        
        return {
            "success": True, 
            "resume_id": res.data[0]["id"],
            "filename": file.filename,
            "profile": profile
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
