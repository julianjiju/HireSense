import re
from typing import Iterable


_SKILL_SYNONYMS = {
    "javascript": {"js", "ecmascript", "javascript"},
    "typescript": {"ts", "typescript"},
    "python": {"python", "py"},
    "java": {"java"},
    "jvm": {"jvm", "jre", "jdk"},
    "kotlin": {"kotlin", "kt"},
    "scala": {"scala"},
    "spring": {"spring", "spring boot", "springboot"},
    "react": {"react", "reactjs", "react.js"},
    "vue": {"vue", "vue.js", "vuejs"},
    "angular": {"angular", "angularjs"},
    "node.js": {"node", "nodejs", "node.js"},
    "machine learning": {"ml", "machine learning", "supervised learning", "unsupervised learning"},
    "deep learning": {"dl", "deep learning", "neural networks"},
    "pytorch": {"pytorch", "torch"},
    "tensorflow": {"tensorflow", "tf"},
    "frontend": {"frontend", "front-end", "ui", "client-side"},
    "backend": {"backend", "back-end", "server-side"},
    "sql": {"sql", "postgresql", "postgres", "mysql", "sqlite", "mssql"},
    "docker": {"docker", "containerization"},
    "kubernetes": {"kubernetes", "k8s"},
    "aws": {"aws", "amazon web services"},
    "azure": {"azure", "microsoft azure"},
    "gcp": {"gcp", "google cloud"},
}

_SKILL_PARENTS = {
    "pytorch": ["machine learning", "deep learning"],
    "tensorflow": ["machine learning", "deep learning"],
    "react": ["frontend", "javascript"],
    "vue": ["frontend", "javascript"],
    "angular": ["frontend", "typescript"],
    "typescript": ["javascript"],
    "node.js": ["backend", "javascript"],
    "spring": ["java", "backend"],
    "kotlin": ["jvm", "backend"],
    "scala": ["jvm", "backend"],
    "java": ["jvm", "backend"],
    "docker": ["backend"],
    "kubernetes": ["backend", "docker"],
}


def extract_years_number(value: str | int | float | None) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return max(0, int(value))
    nums = re.findall(r"\d+", str(value))
    return int(nums[0]) if nums else 0


def canonicalize_skill(skill: str) -> str:
    s = skill.strip().lower()
    if not s:
        return s
    for canonical, values in _SKILL_SYNONYMS.items():
        if s in values:
            return canonical
    return s


def normalize_skills(skills: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw in skills:
        s = canonicalize_skill(raw)
        if not s:
            continue
        if s not in seen:
            seen.add(s)
            normalized.append(s)
        for parent in _SKILL_PARENTS.get(s, []):
            if parent not in seen:
                seen.add(parent)
                normalized.append(parent)
    return normalized


def infer_experience_sections(text: str) -> dict:
    lower = text.lower()
    return {
        "professional_experience": bool(
            re.search(r"\b(work experience|professional experience|employment|employment history|career history)\b", lower)
        ),
        "academic_projects": bool(
            re.search(r"\b(academic projects?|projects?:|capstone|thesis|course project)\b", lower)
        ),
        "certifications": bool(
            re.search(r"\b(certification|certifications|certified|license|licence|pmp|cpa)\b", lower)
        ),
        "education_section": bool(
            re.search(r"\b(education|academic background|qualifications|university|college degree)\b", lower)
        ),
    }
