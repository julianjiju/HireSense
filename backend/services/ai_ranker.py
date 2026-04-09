import os
import json
import logging
import re
from google import genai
from google.genai import types

logger = logging.getLogger("hiresense.ai")

class AIRanker:
    def __init__(self):
        # Using Gemini 1.5 Flash for 100% Free Tier matching
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            logger.error("Missing GEMINI_API_KEY environment variable")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-1.5-flash"

    def _call_gemini(self, prompt: str) -> dict:
        """Helper to call Gemini and parse JSON."""
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini API Error: {e}")
            # Fallback JSON if parsing fails
            return {}

    async def parse_jd(self, jd_text: str) -> dict:
        """Step A: Parse Job Description."""
        prompt = f"""Parse this job description and return ONLY JSON:
{{
  "role": string,
  "required_skills": string[],
  "nice_to_have_skills": string[],
  "required_experience_years": number,
  "seniority": "intern" | "junior" | "mid" | "senior" | "lead",
  "domain": string
}}
Job Description: {jd_text}"""
        return self._call_gemini(prompt)

    async def parse_resume(self, resume_text: str) -> dict:
        """Step B: Parse Resume into Profile."""
        prompt = f"""Extract structured data from this resume and return ONLY JSON:
{{
  "name": string,
  "skills": string[],
  "years_of_experience": number,
  "experience_type": "professional" | "academic" | "mixed",
  "education": string,
  "seniority_level": "intern" | "junior" | "mid" | "senior" | "lead",
  "key_strengths": string[],
  "domain": string,
  "short_summary": string
}}
Resume text: {resume_text}"""
        return self._call_gemini(prompt)

    async def rank_candidate(self, parsed_jd: dict, parsed_resume: dict) -> dict:
        """Step C: Score candidate against JD."""
        prompt = f"""Compare this candidate profile against the job description and return ONLY JSON:
{{
  "match_score": number (0-100),
  "skill_match_analysis": string,
  "experience_match_analysis": string,
  "missing_skills": string[],
  "reasoning": string,
  "recommendation": "Strong Hire" | "Maybe" | "Reject"
}}

Job: {json.dumps(parsed_jd)}
Candidate: {json.dumps(parsed_resume)}

Scoring weights: technical skills match = 40%, experience depth = 30%, seniority match = 20%, domain fit = 10%.
Understand semantic equivalence."""
        return self._call_gemini(prompt)
