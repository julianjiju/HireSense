# HireSense AI ATS

HireSense is a recruitment assistant that uses Gemini-based semantic matching to rank candidates against job requirements.

## Features
- **AI Ranking**: Semantic analysis using Gemini with resilient fallback logic.
- **Multi-Format Ingestion**: Supports PDF (2-column aware), DOCX, and Image OCR.
- **SQLite Persistence**: Local database using SQLAlchemy.
- **Modern UI**: React TypeScript dashboard with real-time analysis.

## Setup

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. Create a `.env` file based on `.env.example` and add your `GEMINI_API_KEY`.
4. Run the server: `python main.py` or `uvicorn app:app --reload --host 0.0.0.0 --port 8000`

### Frontend
1. `cd frontend`
2. `npm install`
3. (Optional) Copy `.env.example` to `.env`
4. Run the development server: `npm run dev` (Frontend will run on http://localhost:5173)

## Requirements
- Python 3.9+
- Node.js 16+
- Tesseract OCR (for image processing - `apt install tesseract-ocr` or similar)
