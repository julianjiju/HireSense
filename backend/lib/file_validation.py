"""Validate upload bytes (magic numbers) and size before parsing."""

import os
from typing import Literal

AllowedExt = Literal["pdf", "docx", "doc", "jpg", "jpeg", "png"]


def max_upload_bytes() -> int:
    mb = int(os.getenv("MAX_FILE_SIZE_MB", "25"))
    return max(1, mb) * 1024 * 1024


def extension_for(filename: str) -> str:
    return filename.lower().rsplit(".", 1)[-1] if "." in filename else ""


def validate_resume_file(filename: str, content: bytes) -> tuple[bool, str]:
    if not filename or not content:
        return False, "corrupt_or_empty"
    if len(content) > max_upload_bytes():
        return False, "file_too_large"
    ext = extension_for(filename)
    allowed = {"pdf", "docx", "doc", "jpg", "jpeg", "png"}
    if ext not in allowed:
        return False, "unsupported_format"
    if ext == "pdf":
        if not content.startswith(b"%PDF"):
            return False, "corrupt_or_invalid_pdf"
    elif ext in ("jpg", "jpeg"):
        if not (content.startswith(b"\xff\xd8\xff")):
            return False, "corrupt_or_invalid_image"
    elif ext == "png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            return False, "corrupt_or_invalid_image"
    elif ext == "docx":
        if not (content.startswith(b"PK\x03\x04")):
            return False, "corrupt_or_invalid_docx"
    elif ext == "doc":
        if not (content.startswith(b"\xd0\xcf\x11\xe0")):
            return False, "legacy_doc_not_supported"
    return True, "ok"
