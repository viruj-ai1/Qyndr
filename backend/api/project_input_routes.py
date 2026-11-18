"""
backend/api/project_input_routes.py
API endpoints for project input data alignment and document text extraction.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import io
import time
import logging

from api.auth import get_current_user
from services.input_alignment_service import (
    align_project_input,
    MAX_RAW_TEXT_LEN
)

logger = logging.getLogger("project_input_routes")

router = APIRouter(prefix="/api/project-input", tags=["Project Input Templates"])

VALID_FIELDS = {"project_name", "compound_api", "primary_objective", "project_description", "all"}


class AlignRequest(BaseModel):
    field: str = Field(..., description="Target field: 'project_name', 'compound_api', 'primary_objective', 'project_description', or 'all'")
    raw_text: str = Field(..., description="Unstructured user notes, batch record text, or spec sheet")


class AlignResponse(BaseModel):
    aligned: Dict[str, str]
    missing: Dict[str, List[str]]
    warnings: List[str]


class ExtractResponse(BaseModel):
    filename: str
    extracted_text: str
    char_count: int


@router.post("/align", response_model=AlignResponse)
def align_input(
    req: AlignRequest,
    user = Depends(get_current_user)
):
    """
    Auto-align rough text or notes into structured QbD project template fields.
    """
    field_lower = req.field.strip().lower()
    if field_lower not in VALID_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid field '{req.field}'. Must be one of: {', '.join(sorted(VALID_FIELDS))}"
        )

    if len(req.raw_text) > MAX_RAW_TEXT_LEN:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Input text exceeds maximum allowed length of {MAX_RAW_TEXT_LEN:,} characters (received {len(req.raw_text):,} characters)."
        )

    try:
        result = align_project_input(field=field_lower, raw_text=req.raw_text)
        return result
    except ValueError as e:
        logger.error("Alignment service value error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI alignment failed to produce structured JSON: {str(e)}"
        )
    except Exception as e:
        logger.exception("Unexpected error during input alignment")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Alignment processing error: {str(e)}"
        )


@router.post("/extract", response_model=ExtractResponse)
async def extract_document_text(
    file: UploadFile = File(...),
    user = Depends(get_current_user)
):
    """
    Extract plain text from uploaded .txt, .docx, .pdf, or .xlsx/.csv files.
    """
    filename = file.filename or "uploaded_file"
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    content_bytes = await file.read()
    if len(content_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded file exceeds maximum limit of 10 MB."
        )

    extracted_text = ""

    try:
        if ext in ("txt", "csv"):
            try:
                extracted_text = content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                extracted_text = content_bytes.decode("latin-1", errors="replace")

        elif ext == "docx":
            import docx
            doc = docx.Document(io.BytesIO(content_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_cells:
                        paragraphs.append(" | ".join(row_cells))
            extracted_text = "\n\n".join(paragraphs)

        elif ext == "pdf":
            import fitz  # PyMuPDF
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            pages_text = []
            for page in doc:
                text = page.get_text()
                if text.strip():
                    pages_text.append(text.strip())
            extracted_text = "\n\n".join(pages_text)

        elif ext in ("xlsx", "xls"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
            sheet_texts = []
            for sheetname in wb.sheetnames:
                sheet = wb[sheetname]
                rows_text = []
                for row in sheet.iter_rows(values_only=True):
                    row_vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
                    if row_vals:
                        rows_text.append(" | ".join(row_vals))
                if rows_text:
                    sheet_texts.append(f"--- Sheet: {sheetname} ---\n" + "\n".join(rows_text))
            extracted_text = "\n\n".join(sheet_texts)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '.{ext}'. Supported types: .txt, .docx, .pdf, .xlsx, .csv"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed extracting text from file %s", filename)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from file: {str(e)}"
        )

    return {
        "filename": filename,
        "extracted_text": extracted_text[:MAX_RAW_TEXT_LEN],
        "char_count": len(extracted_text)
    }
