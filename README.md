# HireSense AI ATS

HireSense is a professional-grade recruitment assistant that uses Claude 3.5 Sonnet to rank candidates based on semantic match rather than simple keyword overlap.

## Features
- **AI Ranking**: Semantic analysis using Anthropic Claude Sonnet 3.5.
- **Multi-Format Ingestion**: Supports PDF (2-column aware), DOCX, and Image OCR.
- **SQLite Persistence**: Local database using SQLAlchemy.
- **Modern UI**: React TypeScript dashboard with real-time analysis.

## Setup

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. Create a `.env` file based on `.env.example` and add your `ANTHROPIC_API_KEY`.
4. Run the server: `python main.py` (Server will run on http://localhost:8000)

### Frontend
1. `cd frontend`
2. `npm install`
3. Run the development server: `npm run dev` (Frontend will run on http://localhost:5173)

## Requirements
- Python 3.9+
- Node.js 16+
- Tesseract OCR (for image processing - `apt install tesseract-ocr` or similar)
