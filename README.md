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

## 🏗️ Tech Stack

| Layer        | Technology |
|-------------|-----------|
| Frontend     | React, TypeScript, Vite |
| Backend      | FastAPI / Python |
| AI Engine    | Gemini API (Google) |
| Database     | SQLite + SQLAlchemy |
| OCR          | Tesseract |

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

## ⚙️ Local Setup Guide

### 🔹 Prerequisites
- Python 3.9+
- Node.js 16+
- Tesseract OCR

Install Tesseract (Linux):
```bash
sudo apt install tesseract-ocr
```

---

### 🔹 Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
```

Run the backend:
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

---

### 🔹 Frontend Setup

```bash
cd frontend
npm install
```

(Optional)
```bash
cp .env.example .env
```

Run the frontend:
```bash
npm run dev
```

Frontend will be available at:
👉 http://localhost:5173

---

## 🧪 How It Works

1. Upload resumes (PDF, DOCX, or Images)
2. Enter job description
3. AI processes candidates using semantic matching
4. System outputs:
   - 📊 Fit Score
   - 🧠 AI Reasoning
   - 🏆 Ranked Candidates

---

## 🎥 Demo

👉 https://drive.google.com/drive/folders/18GOKgWAaU4QxPTC3P3PcmDbjAlNTgSDd?usp=drive_link 

---

## 📸 Screenshots

<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/3e8d6f70-93a1-4a26-bd14-dcae4ebe6a15" />
<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/c3e47b3e-8dfe-4c39-8623-e8bdd06fbe4f" />
<img width="1917" height="1078" alt="image" src="https://github.com/user-attachments/assets/cfa0a62f-561a-4371-a74c-cff1ab3e9d40" />
<img width="1917" height="1078" alt="image" src="https://github.com/user-attachments/assets/764a815e-9067-4bfa-884c-71387f309d94" />
<img width="1917" height="1078" alt="image" src="https://github.com/user-attachments/assets/f3bcee49-a647-49e8-8e6d-6e968c73f536" />
<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/3cc6ca9d-6331-4ca0-87b2-2c3dda0ef509" />





---

## 🚀 Unique Highlights

- ❌ Not keyword-based → ✅ **Semantic AI matching**
- ❌ Black-box scoring → ✅ **Explainable AI reasoning**
- ❌ Static ranking → ✅ **Dynamic AI evaluation**

---

## 🔮 Future Improvements

- Multi-job comparison dashboard
- Bias detection in hiring decisions
- Interview question generation
- Integration with real ATS platforms
- Cloud deployment & scalability

---

## 👨‍💻 Author

**Julian Jiju**
