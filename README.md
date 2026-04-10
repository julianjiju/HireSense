# 🚀 HireSense – AI-Powered Semantic Hiring Platform

HireSense is a **next-generation AI Applicant Tracking System (ATS)** that uses **semantic understanding (not just keywords)** to evaluate and rank candidates against job descriptions.

Unlike traditional ATS systems, HireSense leverages **LLM-based reasoning (Gemini)** to provide **intelligent scoring, contextual matching, and human-like explanations**.

---

## ✨ Key Features

### 🧠 AI-Powered Candidate Matching
- Uses **Gemini-based semantic analysis**
- Understands **meaning and context**, not just keywords
- Provides **accurate fit scoring**

### 📊 Intelligent Candidate Ranking
- Automatically ranks candidates based on job relevance
- Highlights **top candidates instantly**

### 💡 AI Reasoning & Insights
- Generates **human-readable explanations**
- Explains *why* a candidate is a good or bad fit

### 📄 Multi-Format Resume Support
- PDF (including **2-column parsing**)
- DOCX files
- Image-based resumes using **OCR (Tesseract)**

### ⚡ Resilient AI Pipeline
- Built-in fallback logic for stable AI responses
- Handles edge cases gracefully

### 🗄️ Local Data Persistence
- SQLite database using **SQLAlchemy**
- Stores candidate data and analysis results

### 🎨 Modern UI Dashboard
- Built with **React + TypeScript + Vite**
- Clean and responsive interface
- Real-time analysis display

---

## 🏗️ Overall Architecture

Frontend (React)  
↓  
Backend API (FastAPI)  
↓  
AI Engine (Semantic + Gemini)  
↓  
Database (SQLite)  

### Flow:
1. Upload resumes and enter Job Description  
2. Backend parses documents (PDF, DOCX, OCR)  
3. AI performs semantic matching, skill extraction, and scoring  
4. Results stored in database  
5. Frontend displays ranked candidates with insights  

---

## 👤 User Requirements

- Screen large volumes of resumes quickly  
- Identify best-fit candidates automatically  
- Understand AI reasoning behind decisions  
- Support multiple resume formats  
- Reduce manual effort and bias  

---

## 🎨 System Design

### Design Principles
- **Resilience** → Works even if AI fails  
- **Explainability** → Transparent decision-making  
- **Modularity** → Easy to extend  

### Core Components
- Resume Parser  
- NLP Engine  
- AI Reasoning Layer  
- Ranking Engine  
- Frontend Dashboard  

---

## ⚙️ Software Design

### 🔹 API Layer
- `POST /upload` → Upload & parse resumes  
- `POST /rank` → Rank candidates  

### 🔹 Service Layer
- Resume parsing (PDF, DOCX, OCR)  
- NLP processing (semantic similarity + skill extraction)  
- Scoring engine (hybrid logic)  
- AI integration (Gemini fallback chain)  

### 🔹 Frontend Layer
- Dashboard UI  
- Candidate ranking view  
- Resume preview panel  
- Analytics display  

---

## 🧪 Test Cases

### Functional Tests
- Upload valid resumes → Parsed correctly  
- Upload image resumes → OCR extracts text  
- Submit job description → Returns ranked candidates  
- Invalid input → Handled gracefully  

### Edge Cases
- Empty resumes  
- Poorly formatted PDFs  
- No matching skills  
- AI failure → fallback triggers  

---

## 🧪 Unit Testing

### Backend
- Resume parsing  
- Skill extraction  
- Scoring logic  
- API endpoints  

### Frontend
- UI rendering  
- Component interactions  
- API integration  

Tools:
- pytest  
- React Testing Library  

---

## ⚙️ Configuration

```env
GEMINI_API_KEY=your_api_key_here
DATABASE_URL=sqlite:///hiresense.db
