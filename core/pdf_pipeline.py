"""
PDF Ingestion Pipeline - Local Processing Only.

PDF Processing videoQuery:
PDF → Extract text locally → Chunk → Embed → Vector store → Ready for RAG

NO LLM calls during ingestion:
- No automatic summarization
- No automatic key decision extraction
- No automatic question extraction
- No global analysis

The PDF text is processed locally and indexed for RAG.
LLM is ONLY used later when user asks questions.
"""

import os
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from core.source_types import SourceType, ProcessingMetadata, IngestionResult
from core.logger import get_logger
from utils.pdf_processor import process_pdf_document, extract_text_from_pdf

logger = get_logger(__name__)


class PDFPipeline:
    """
    PDF ingestion pipeline - local extraction and indexing only.
    
    CRITICAL: This pipeline does NOT call LLM services.
    PDFs already contain text, so we just extract and index.
    """
    
    def __init__(self):
        """Initialize PDF pipeline."""
        logger.info("[PDFPipeline] Initialized - Local extraction only (no LLM)")
    
    def ingest_pdf(
        self,
        pdf_path: str,
        job_id: Optional[str] = None,
        progress_callback: Optional[Callable[[str, str, Optional[int]], None]] = None
    ) -> IngestionResult:
        """
        Ingest PDF document using local extraction only.
        
        Pipeline:
        1. Extract text from PDF (local, using PyPDF2)
        2. Clean and normalize text
        3. Create metadata
        4. Return result ready for vector indexing
        
        NO LLM CALLS DURING THIS PROCESS.
        
        Args:
            pdf_path: Path to PDF file
            job_id: Optional unique job identifier
            progress_callback: Optional callback(stage, message, progress_percent)
            
        Returns:
            IngestionResult with extracted text and metadata
        """
        logger.info("=" * 80)
        logger.info("[PDFPipeline] Starting PDF ingestion (local extraction only)")
        logger.info(f"[PDFPipeline] Source: {pdf_path}")
        logger.info(f"[PDFPipeline] No LLM required for PDF ingestion")
        logger.info("=" * 80)
        
        if progress_callback:
            progress_callback("pdf_extraction", "Starting PDF processing...", 5)
        
        # Validate PDF exists
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        # STEP 1: Extract text locally (no LLM)
        logger.info("[PDFPipeline] STEP 1: Local text extraction")
        
        if progress_callback:
            progress_callback("pdf_extraction", "Extracting text from PDF...", 10)
        
        def extraction_progress(stage: str, message: str):
            """Forward progress from PDF processor."""
            if progress_callback:
                # Map to progress percentages
                progress_map = {
                    "pdf_extraction": 30
                }
                progress_callback(stage, message, progress_map.get(stage, 20))
        
        try:
            pdf_data = process_pdf_document(pdf_path, progress_callback=extraction_progress)
            
            text = pdf_data["text"]
            page_count = pdf_data["page_count"]
            file_name = pdf_data["file_name"]
            char_count = pdf_data["char_count"]
            
            logger.info(f"[PDFPipeline]   Extracted {char_count} characters from {page_count} pages")
            
        except Exception as e:
            logger.error(f"[PDFPipeline] Text extraction failed: {e}", exc_info=True)
            raise Exception(f"Failed to extract text from PDF: {e}")
        
        if progress_callback:
            progress_callback("pdf_extraction", "Text extraction complete", 40)
        
        # STEP 2: Validate content
        logger.info("[PDFPipeline] STEP 2: Content validation")
        
        if not text or not text.strip():
            raise ValueError(
                "PDF appears to be empty or contains no extractable text. "
                "It may be an image-based PDF requiring OCR."
            )
        
        logger.info("[PDFPipeline]   Content validated")
        
        if progress_callback:
            progress_callback("pdf_processing", "Processing document structure...", 50)
        
        # STEP 3: Clean and normalize text (local processing)
        logger.info("[PDFPipeline] STEP 3: Text cleaning")
        
        cleaned_text = self._clean_text(text)
        
        logger.info(f"[PDFPipeline]   Text cleaned: {len(cleaned_text)} characters")
        
        if progress_callback:
            progress_callback("pdf_processing", "Text processing complete", 60)
        
        # STEP 4: Generate title from filename (no LLM)
        logger.info("[PDFPipeline] STEP 4: Title generation (from filename)")
        
        title = self._generate_title_from_filename(file_name)
        
        logger.info(f"[PDFPipeline]   Title: {title}")
        
        # STEP 5: Create metadata
        logger.info("[PDFPipeline] STEP 5: Metadata creation")
        
        metadata = ProcessingMetadata(
            source_type=SourceType.PDF,
            source=pdf_path,
            job_id=job_id,
            language="document",  # Not applicable for PDFs
            page_count=page_count,
            file_name=file_name,
            char_count=len(cleaned_text)
        )
        
        logger.info("[PDFPipeline]   Metadata created")
        
        if progress_callback:
            progress_callback("pdf_processing", "PDF processing complete", 70)
        
        # STEP 6: Create ingestion result
        result = IngestionResult(
            text=cleaned_text,
            metadata=metadata,
            title=title,
            vector_store_key=job_id or self._generate_vector_key(pdf_path),
            indexed=False  # Will be set to True after vector indexing
        )
        
        logger.info("=" * 80)
        logger.info("[PDFPipeline] PDF INGESTION COMPLETE")
        logger.info(f"[PDFPipeline] Pages: {page_count}")
        logger.info(f"[PDFPipeline] Characters: {len(cleaned_text)}")
        logger.info(f"[PDFPipeline] Title: {title}")
        logger.info("[PDFPipeline] Ready for vector indexing")
        logger.info("[PDFPipeline] No LLM calls were made during PDF ingestion")
        logger.info("=" * 80)
        
        return result
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text.
        
        Local processing:
        - Reassemble vertical single-character sequences from stylized PDF text
        - Fix hyphenated line wraps
        - De-duplicate repetitive headers
        - Remove excessive whitespace and normalize line breaks
        
        Args:
            text: Raw extracted text
            
        Returns:
            Cleaned text
        """
        import re
        if not text:
            return ""

        # Normalize newlines
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        # Fix hyphenated words split across lines
        text = re.sub(r'([A-Za-z]+)-\n([A-Za-z]+)', r'\1\2', text)

        # Reassemble vertical single-character lines (common in styled book titles / drop caps)
        raw_lines = text.split('\n')
        processed_lines = []
        single_chars = []

        def flush_chars():
            nonlocal single_chars
            if single_chars:
                reconstructed = ''.join(single_chars).strip()
                if reconstructed:
                    processed_lines.append(reconstructed)
                single_chars = []

        for line in raw_lines:
            trimmed = line.strip()
            if len(trimmed) == 1 and not re.match(r'^\[\d+\]$', trimmed):
                single_chars.append(trimmed)
            elif len(trimmed) == 0:
                if len(single_chars) >= 2:
                    single_chars.append(' ')
                else:
                    flush_chars()
                    processed_lines.append('')
            else:
                flush_chars()
                # De-duplicate repeated headers (e.g., "TitleTitle" -> "Title")
                if len(trimmed) >= 8 and len(trimmed) % 2 == 0:
                    half = len(trimmed) // 2
                    if trimmed[:half] == trimmed[half:]:
                        line = trimmed[:half]
                processed_lines.append(line)
        flush_chars()

        text = '\n'.join(processed_lines)

        # Remove excessive blank lines (more than 2 consecutive)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove excessive spaces
        text = re.sub(r' {2,}', ' ', text)
        
        return text.strip()
    
    def _generate_title_from_filename(self, file_name: str) -> str:
        """
        Generate document title from filename.
        
        Local processing only - no LLM.
        
        Args:
            file_name: Original PDF filename
            
        Returns:
            Formatted title
        """
        # Remove extension
        title = Path(file_name).stem
        
        # Replace underscores and dashes with spaces
        title = title.replace('_', ' ').replace('-', ' ')
        
        # Title case
        title = title.title()
        
        return title
    
    def _generate_vector_key(self, pdf_path: str) -> str:
        """
        Generate vector store key from PDF path.
        
        Args:
            pdf_path: Path to PDF
            
        Returns:
            Vector store key
        """
        import hashlib
        
        # Use hash of path as key
        path_hash = hashlib.md5(pdf_path.encode()).hexdigest()[:12]
        file_name = Path(pdf_path).stem
        
        return f"pdf_{file_name}_{path_hash}"


def ingest_pdf_document(
    pdf_path: str,
    job_id: Optional[str] = None,
    progress_callback: Optional[Callable[[str, str, Optional[int]], None]] = None
) -> IngestionResult:
    """
    Convenience function to ingest PDF document.
    
    This performs LOCAL EXTRACTION ONLY - no LLM calls.
    
    Pipeline:
    PDF → Extract text → Clean → Metadata → Ready for RAG
    
    Args:
        pdf_path: Path to PDF file
        job_id: Optional job ID
        progress_callback: Optional progress callback
        
    Returns:
        IngestionResult ready for vector indexing
    """
    pipeline = PDFPipeline()
    return pipeline.ingest_pdf(pdf_path, job_id, progress_callback)
