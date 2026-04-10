import asyncio
import os
import sys

# Add backend and backend/lib to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from lib.ai_engine import match_candidate, extract_profile
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

async def test():
    resume_text = """
    John Doe
    Software Engineer with 5 years of experience in Python and React.
    Education: Bachelor of Science in Computer Science.
    Skills: Python, JavaScript, React, SQL, Docker.
    """
    jd_text = """
    We are looking for a Python Developer with 3+ years of experience.
    Skills required: Python, SQL, Docker.
    """
    
    print("Testing extract_profile...")
    profile = await extract_profile(resume_text)
    print(f"Profile: {profile}")
    
    print("\nTesting match_candidate...")
    match = await match_candidate(resume_text, jd_text)
    print(f"Match: {match}")

if __name__ == "__main__":
    asyncio.run(test())
