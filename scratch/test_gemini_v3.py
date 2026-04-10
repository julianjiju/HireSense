import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import ai_service
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

async def test():
    resume_text = """
    Alice Smith
    Senior Frontend Engineer
    10 years of experience with React, TypeScript, and modern CSS.
    """
    jd_text = """
    Senior Frontend Developer
    8+ years of experience.
    React, TypeScript.
    """
    
    print("Testing extract_resume_data...")
    # This should call Gemini (if it works) or fallback
    data = await ai_service.extract_resume_data(resume_text)
    print(f"Data: {data}")
    print(f"Source: {data.get('_source')}")

if __name__ == "__main__":
    asyncio.run(test())
