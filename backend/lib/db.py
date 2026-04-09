import os
import httpx
import json
from dotenv import load_dotenv
from typing import Optional, List, Any

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", ""))

# Validation
if not SUPABASE_URL or not SUPABASE_KEY:
    # We allow the import but functions will fail if not set
    print("WARNING: SUPABASE_URL and SUPABASE_KEY not found in environment.")

# ─── Internal Helper ──────────────────────────────────────────────────────────

async def _request(method: str, path: str, data: Any = None, params: dict = None, single: bool = False):
    """Internal helper for Supabase REST API (PostgREST)."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" + (",minimal=false" if not single else ",representation=true,return=representation")
    }
    
    if not SUPABASE_URL or not SUPABASE_URL.startswith("http"):
        raise Exception("Supabase Error: SUPABASE_URL is missing or invalid in .env")

    url = f"{SUPABASE_URL}/rest/v1/{path}"
    
    async with httpx.AsyncClient() as client:
        try:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method == "PATCH":
                response = await client.patch(url, headers=headers, json=data, params=params)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers, params=params)
            
            response.raise_for_status()
            res_data = response.json()
            
            if single:
                return res_data[0] if res_data else None
            return res_data
            
        except httpx.HTTPStatusError as e:
            print(f"DB Error: {e.response.text}")
            raise Exception(f"Database error: {e.response.status_code}")
        except Exception as e:
            print(f"Network Error: {e}")
            raise Exception(f"Database connection error: {str(e)}")

# ─── Public API ───────────────────────────────────────────────────────────────

class DbResponse:
    """Mock structure to maintain compatibility with existing logic."""
    def __init__(self, data):
        self.data = data

async def create_job(title: str, description: str = ""):
    data = await _request("POST", "jobs", {"title": title, "description": description})
    return DbResponse(data)

async def get_jobs():
    data = await _request("GET", "jobs?select=*&order=created_at.desc")
    return DbResponse(data)

async def save_resume(job_id: str, filename: str, text: str, profile: dict):
    data = await _request("POST", "resumes", {
        "job_id": job_id,
        "filename": filename,
        "extracted_text": text,
        "parsed_profile": profile
    })
    return DbResponse(data)

async def get_resumes_by_job(job_id: str):
    data = await _request("GET", f"resumes?select=*&job_id=eq.{job_id}")
    return DbResponse(data)

async def save_match_result(job_id: str, resume_id: str, score: float, justification: str, breakdown: dict, source: str = "gemini"):
    # First check if exists
    existing = await _request("GET", f"match_results?select=id&job_id=eq.{job_id}&resume_id=eq.{resume_id}")
    
    payload = {
        "job_id": job_id,
        "resume_id": resume_id,
        "score": score,
        "justification": justification,
        "breakdown": breakdown,
        "source": source
    }
    
    if existing:
        # Update
        data = await _request("PATCH", f"match_results?job_id=eq.{job_id}&resume_id=eq.{resume_id}", payload)
    else:
        # Insert
        data = await _request("POST", "match_results", payload)
        
    return DbResponse(data)

async def get_results_by_job(job_id: str):
    # Relational join in PostgREST: table_name(column_names)
    data = await _request("GET", f"match_results?select=*,resumes(*)&job_id=eq.{job_id}")
    return DbResponse(data)

async def check_cache(hash_key: str):
    data = await _request("GET", f"ai_cache?select=response_data&hash_key=eq.{hash_key}")
    return data[0]["response_data"] if data else None

async def set_cache(hash_key: str, response_data: dict):
    # PostgREST Upsert using 'resolution=merge-duplicates' via header is complex, 
    # simple check+insert/patch is safer
    existing = await _request("GET", f"ai_cache?select=hash_key&hash_key=eq.{hash_key}")
    if existing:
        await _request("PATCH", f"ai_cache?hash_key=eq.{hash_key}", {"response_data": response_data})
    else:
        await _request("POST", "ai_cache", {"hash_key": hash_key, "response_data": response_data})
