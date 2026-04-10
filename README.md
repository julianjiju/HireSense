<img width="1918" height="1056" alt="image" src="https://github.com/user-attachments/assets/0545c66f-c3b9-46a9-9d54-3b8d733411ef" /># 🚀 HireSense – AI-Powered Semantic Hiring Platform

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

👉 *(Add your Loom / video link here)*

---

## 📸 Screenshots

<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/29e1094e-da95-4c54-ab86-a6d68ded1eda" />
<img width="1918" height="1078" alt="image" src="https://github.com/user-attachments/assets/a525a124-cd61-46ae-ae7d-66581f5f75eb" />
<img width="1918" height="1056" alt="image" src="https://github.com/user-attachments/assets/cfe27a09-427b-47b9-a7a9-0263cb9222da" />
<img width="1917" height="963" alt="image" src="https://github.com/user-attachments/assets/c9cb1ad3-7aa2-44f2-9c84-cda2a5037742" />
<img width="1917" height="1075" alt="image" src="https://github.com/user-attachments/assets/d4defd45-6e12-4694-8cdf-8abc489223dd" />
<img width="1918" height="1017" alt="image" src="https://github.com/user-attachments/assets/4b72ad2c-e1bc-4447-aa5e-aeb43cfd5c13" />



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
