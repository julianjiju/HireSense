import io
import fitz  # PyMuPDF
import pdfplumber
import docx
import re
from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()

def extract_text_pdf(content: bytes) -> str:
    """Extract text using pdfplumber for better layout handling, fallback to PyMuPDF."""
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    except Exception:
        # Fallback to PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        for page in doc:
            text += page.get_text()
        doc.close()
    return clean_text(text)

def extract_text_docx(content: bytes) -> str:
    """Extract text from Word .docx files."""
    doc = docx.Document(io.BytesIO(content))
    text = "\n".join([para.text for para in doc.paragraphs])
    return clean_text(text)

async def extract_text_image_vision(content: bytes) -> str:
    """Use Gemini Vision API to 'read' the resume if it's an image or extraction fails."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return ""
    
    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model="gemini-1.5-flash",
        contents=[
            types.Part.from_bytes(data=content, mime_type="image/png"), # Simplified, handled by caller
            "You are a senior HR specialist. Read this resume and extract the full text content accurately. Maintain the layout context if possible."
        ]
    )
    return clean_text(response.text)

def clean_text(text: str) -> str:
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

async def parse_resume(filename: str, content: bytes) -> str:
    """Master pipeline for resume extraction based on file extension."""
    ext = filename.lower().split(".")[-1]
    
    if ext == "pdf":
        return extract_text_pdf(content)
    elif ext in ["docx", "doc"]:
        return extract_text_docx(content)
    elif ext in ["jpg", "jpeg", "png"]:
        return await extract_text_image_vision(content)
    else:
        return ""
