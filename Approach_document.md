# 📄 HireSense – Approach Document

## 1. Problem Statement

Traditional Applicant Tracking Systems (ATS) rely heavily on **keyword matching** to filter and rank candidates. This approach has major limitations:

- Ignores context and semantic meaning
- Misses strong candidates who use different wording
- Produces inaccurate rankings
- Lacks transparency in decision-making

There is a need for a system that can **understand resumes like a human recruiter**, focusing on meaning rather than exact keyword matches.

---

## 2. Proposed Solution

HireSense is an **AI-powered semantic hiring platform** that evaluates candidates using **LLM-based understanding (Gemini)**.

Instead of simple keyword matching, the system:
- Interprets **context and intent** in resumes
- Compares candidates with job descriptions semantically
- Generates **fit scores based on meaning**
- Provides **AI-generated reasoning** for decisions

This results in **more accurate, explainable, and fair candidate evaluation**.

---

## 3. System Architecture

### 🔹 High-Level Flow

```
Resume Upload → Text Extraction → AI Processing → Ranking Engine → UI Dashboard
```

### 🔹 Detailed Workflow

1. **Resume Ingestion**
   - Accepts PDF, DOCX, and image formats
   - Uses OCR (Tesseract) for image-based resumes

2. **Text Extraction**
   - Parses structured and unstructured resume content
   - Handles multi-column PDFs

3. **AI Processing**
   - Sends extracted content + job description to Gemini API
   - Performs semantic comparison

4. **Scoring & Ranking**
   - Generates:
     - Fit Score
     - AI Reasoning
   - Ranks candidates based on relevance

5. **Frontend Display**
   - Displays ranked candidates in a clean dashboard
   - Shows insights in real-time

---

## 4. Tech Stack & Rationale

### 🔹 Frontend
- **React + TypeScript + Vite**
- Chosen for fast development, scalability, and modern UI capabilities

### 🔹 Backend
- **FastAPI (Python)**
- Lightweight, fast, and ideal for AI-based APIs

### 🔹 AI Engine
- **Google Gemini API**
- Strong semantic understanding and natural language reasoning capabilities

### 🔹 Database
- **SQLite + SQLAlchemy**
- Simple and effective for local persistence and rapid prototyping

### 🔹 OCR
- **Tesseract OCR**
- Enables support for image-based resumes

---

## 5. Key Design Decisions

- **Semantic Matching over Keyword Matching**
  → Improves accuracy and candidate discovery

- **Explainable AI Outputs**
  → Builds trust by showing reasoning behind scores

- **Multi-format Support**
  → Ensures usability across different resume types

- **Modular Architecture**
  → Easy to extend and scale in the future

---

## 6. Unique Contributions

- AI-based **context-aware candidate evaluation**
- **Human-like reasoning** for hiring decisions
- Support for **multi-format resume ingestion**
- Clean and intuitive **UI for recruiters**

---

## 7. Limitations

- Dependent on external AI API (Gemini)
- May have latency due to AI processing
- Currently optimized for small-scale/local usage

---

## 8. Future Improvements

- Integration with real-world ATS platforms
- Batch processing for large-scale hiring
- Bias detection and fairness analysis
- Interview question generation based on resumes
- Cloud deployment and scalability (AWS / Vercel)

---

## 9. Conclusion

HireSense demonstrates how AI can transform recruitment by moving from **keyword-based filtering** to **semantic understanding and explainable decision-making**.

The system provides a strong foundation for building **intelligent, scalable, and fair hiring solutions**.
