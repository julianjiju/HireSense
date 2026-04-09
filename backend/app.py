"""
HireSense v2 — Unified Local Dev Entrypoint.
This runner mounts the serverless functions as a unified FastAPI app for local development.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.jobs import app as jobs_app
from api.upload import app as upload_app
from api.resumes import app as resumes_app
from api.rank import app as rank_app

app = FastAPI(
    title="HireSense Production Dev",
    description="Local gateway for serverless functions",
    version="2.0.0",
)

# Global CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the serverless apps
app.mount("/", jobs_app)
app.mount("/", upload_app)
app.mount("/", resumes_app)
app.mount("/", rank_app)

@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "mode": "local_dev_gateway"}

if __name__ == "__main__":
    import uvicorn
    # Important: Run on port 5000 as configured in vite.config.ts proxy
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
