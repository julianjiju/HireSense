import fitz  # PyMuPDF
import re

def parse_pdf(file_stream) -> str:
    """
    Extract text from a PDF file stream using PyMuPDF.
    """
    try:
        # Open the PDF from byte stream
        doc = fitz.open(stream=file_stream, filetype="pdf")
        text = ""
        for page_num in range(len(doc)):
            page = doc[page_num]
            # Use "blocks" or "text" for better layout parsing
            text += page.get_text("text") + "\n"
        doc.close()
        return clean_text(text)
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        return ""

def clean_text(text: str) -> str:
    """
    Clean the extracted text by removing extra whitespaces, newlines, etc.
    """
    # Replace multiple spaces with a single space
    text = re.sub(r' {2,}', ' ', text)
    # Replace multiple line breaks with a single one (or double if preferred)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def split_into_sections(text: str):
    """
    (Optional) Basic heuristic to split resume text into sections.
    For this application, full semantic search usually works better
    if we just feed the whole text or chunks of it, but sectioning
    can help with targeted extraction.
    """
    # Just a placeholder for advanced sectioning
    return {
        "full_text": text
    }
