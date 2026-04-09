import numpy as np
import re

# We will try to load models, handling missing dependencies gracefully 
# so the backend can still start if pip install failed for large models.
try:
    print("Loading SentenceTransformer...")
    from sentence_transformers import SentenceTransformer, util
    st_model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Failed to load sentence-transformers: {e}")
    st_model = None
    util = None

try:
    print("Loading spaCy en_core_web_sm...")
    import spacy
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    print(f"Failed to load spaCy model: {e}")
    nlp = None

# Pre-defined database for skill matching
SKILL_DB = {
    "react", "javascript", "typescript", "python", "flask", "django", 
    "docker", "kubernetes", "aws", "gcp", "azure", "machine learning",
    "deep learning", "nlp", "sql", "nosql", "mongodb", "postgresql",
    "git", "agile", "scrum", "html", "css", "tailwind", "node", "express",
    "java", "c++", "c#", "golang", "ruby", "php", "rest api"
}

def extract_skills(text: str) -> list:
    """Hybrid approach: keyword matching + robust scanning"""
    extracted = set()
    text_lower = text.lower()
    
    # Keyword matching
    for skill in SKILL_DB:
        # regex boundary matched
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            extracted.add(skill)
            
    return list(extracted)

def calculate_experience_score(resume_text: str, jd_text: str) -> float:
    """Heuristic to simulate experience matching (returns 0 to 1 value)"""
    return 0.85  # Placeholder for complex parsing

def score_candidate(resume_text: str, jd_text: str):
    """
    Returns dict with scores and explanation.
    Score = (0.5 * semantic) + (0.3 * skill) + (0.2 * exp)
    """
    # 1. Semantic Similarity
    if st_model and util is not None:
        resume_emb = st_model.encode(resume_text, convert_to_tensor=True)
        jd_emb = st_model.encode(jd_text, convert_to_tensor=True)
        sem_score = util.pytorch_cos_sim(resume_emb, jd_emb).item()
        sem_score = max(0.0, min(sem_score, 1.0))
    else:
        # Fallback pseudo-score based on word overlap if models aren't present
        r_words = set(resume_text.lower().split())
        j_words = set(jd_text.lower().split())
        override_score = len(r_words.intersection(j_words)) / max(len(j_words), 1)
        sem_score = max(0.0, min(override_score, 1.0))

    # 2. Skill extraction match
    jd_skills = extract_skills(jd_text)
    resume_skills = extract_skills(resume_text)
    
    if jd_skills:
        matched_skills = set(jd_skills).intersection(set(resume_skills))
        skill_score = len(matched_skills) / len(jd_skills)
    else:
        skill_score = 1.0 if resume_skills else 0.5
        
    # 3. Experience Score (dummy proxy)
    exp_score = calculate_experience_score(resume_text, jd_text)
    
    # Weighted final score (0 - 100)
    final_score = ((0.5 * sem_score) + (0.3 * skill_score) + (0.2 * exp_score)) * 100
    
    # Generate Explanation
    explanation_parts = []
    if final_score >= 80:
        explanation_parts.append("Exceptional match.")
    elif final_score >= 50:
        explanation_parts.append("Moderate match.")
    else:
        explanation_parts.append("Weak match. Lacks core requirements.")
        
    if jd_skills:
        num_matched = len(set(jd_skills).intersection(set(resume_skills)))
        explanation_parts.append(f"Candidate covers {num_matched} of {len(jd_skills)} key skills identified in the JD.")
        
    explanation = " ".join(explanation_parts)
    
    return {
        "final_score": round(final_score, 1),
        "semantic_score": round(sem_score * 100, 1),
        "skill_score": round(skill_score * 100, 1),
        "experience_score": round(exp_score * 100, 1),
        "extracted_skills": resume_skills,
        "explanation": explanation
    }

