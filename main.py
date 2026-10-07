"""
AI Video Agent - Main Pipeline Orchestrator.

Refactored Architecture:
- PDF: Local extraction → RAG (NO LLM during ingestion)
- Audio/Video: STT → RAG (NO LLM during ingestion)
- Analysis: Optional, explicit user requests only (RAG → LLM)
- Chat: RAG retrieval → LLM answers

CRITICAL: LLM is ONLY used for:
1. Answering user questions (after RAG retrieval)
2. Explicit analysis requests (after RAG retrieval)

LLM is NEVER used during content ingestion.
"""

import os
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from dotenv import load_dotenv
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass
from enum import Enum

from core.source_types import SourceType, ProcessingMetadata, IngestionResult, PipelineMode
from core.pdf_pipeline import ingest_pdf_document
from core.audio_pipeline import ingest_audio_source
from core.rag_engine import build_rag_chain
from core.logger import get_logger

load_dotenv()

logger = get_logger(__name__)


class StageStatus(Enum):
    """Pipeline stage execution status."""
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    PARTIAL = "partial"


@dataclass
class StageResult:
    """Result of a pipeline stage."""
    stage: str
    status: StageStatus
    data: Any = None
    error: Optional[str] = None
    error_code: Optional[str] = None


class PipelineError(Exception):
    """Pipeline execution error with context."""
    def __init__(self, stage: str, message: str, error_code: str = None):
        self.stage = stage
        self.message = message
        self.error_code = error_code or "PIPELINE_ERROR"
        super().__init__(f"{stage}: {message}")


def run_pipeline(
    source: str, 
    language: str = "english",
    progress_callback: Optional[Callable[[str, str, Optional[int]], None]] = None,
    source_key: Optional[str] = None,
    mode: PipelineMode = PipelineMode.INGEST_ONLY
) -> dict:
    """
    Main pipeline for content ingestion.
    
    Refactored Architecture:
    - PDF: Extract → Index (no LLM)
    - Audio/Video: Download → STT → Index (no LLM)
    - Both create vector store for RAG queries
    
    Optional analysis can be requested separately via analysis API.
    
    Args:
        source: YouTube URL, audio/video file path, or PDF document path
        language: Language for STT (ignored for PDFs)
        progress_callback: Optional callback(stage, message, progress_percent)
        source_key: Optional unique key for RAG chain storage
        mode: Pipeline mode (INGEST_ONLY or INGEST_WITH_ANALYSIS)
    
    Returns:
        Dictionary with ingestion results and stage statuses
    """
    logger.info("=" * 80)
    logger.info("[Pipeline] AI Video Agent - Refactored Architecture")
    logger.info(f"[Pipeline] Source: {source}")
    logger.info(f"[Pipeline] Mode: {mode.value}")
    logger.info("=" * 80)
    
    stage_results = {}
    
    if progress_callback:
        progress_callback("initialization", "Initializing pipeline...", 5)
    
    # STEP 1: Determine source type
    logger.info("[Pipeline] STEP 1: Source Type Detection")
    
    try:
        source_type = SourceType.from_source(source)
        logger.info(f"[Pipeline]   Detected source type: {source_type.value}")
        
        stage_results['source_detection'] = StageResult(
            stage="source_detection",
            status=StageStatus.SUCCESS,
            data={'source_type': source_type.value}
        )
        
    except Exception as e:
        logger.error(f"[Pipeline] Source type detection failed: {e}")
        raise PipelineError("source_detection", str(e), "SOURCE_TYPE_ERROR")
    
    # STEP 2: Route to appropriate ingestion pipeline
    logger.info("[Pipeline] STEP 2: Content Ingestion")
    logger.info(f"[Pipeline] Routing to {source_type.value} pipeline")
    
    try:
        if source_type.is_document():
            # PDF PIPELINE: Local extraction only
            logger.info("[Pipeline] >>> PDF PIPELINE (Local extraction, no LLM)")
            
            ingestion_result = ingest_pdf_document(
                pdf_path=source,
                job_id=source_key,
                progress_callback=progress_callback
            )
            
            title = ingestion_result.title
            text = ingestion_result.text
            
            stage_results['ingestion'] = StageResult(
                stage="pdf_ingestion",
                status=StageStatus.SUCCESS,
                data=ingestion_result.to_dict()
            )
            
            logger.info("[Pipeline]   PDF ingestion complete (no LLM used)")
            
        elif source_type.requires_stt():
            # AUDIO/VIDEO PIPELINE: STT only
            logger.info("[Pipeline] >>> AUDIO/VIDEO PIPELINE (STT, no LLM analysis)")
            
            ingestion_result = ingest_audio_source(
                source=source,
                language=language,
                job_id=source_key,
                progress_callback=progress_callback
            )
            
            title = ingestion_result.title
            text = ingestion_result.text
            
            stage_results['ingestion'] = StageResult(
                stage="audio_ingestion",
                status=StageStatus.SUCCESS,
                data=ingestion_result.to_dict()
            )
            
            logger.info("[Pipeline]   Audio/video ingestion complete (STT used, no LLM analysis)")
            
        else:
            raise ValueError(f"Unsupported source type: {source_type}")
        
    except Exception as e:
        error_code = "PDF_INGESTION_ERROR" if source_type.is_document() else "AUDIO_INGESTION_ERROR"
        logger.error(f"[Pipeline] Ingestion failed: {e}", exc_info=True)
        raise PipelineError("ingestion", str(e), error_code)
    
    # STEP 3: Validate content
    logger.info("[Pipeline] STEP 3: Content Validation")
    
    if not text or not text.strip():
        raise PipelineError(
            "validation",
            "No content extracted - result is empty",
            "EMPTY_CONTENT"
        )
    
    logger.info(f"[Pipeline]   Content validated: {len(text)} characters")
    
    stage_results['validation'] = StageResult(
        stage="validation",
        status=StageStatus.SUCCESS,
        data={'char_count': len(text)}
    )
    
    # STEP 4: Build RAG vector store
    logger.info("[Pipeline] STEP 4: Building RAG Vector Store")
    logger.info("[Pipeline] Creating embeddings (local processing, no LLM)")
    
    if progress_callback:
        progress_callback("vector_indexing", "Building knowledge base...", 75)
    
    try:
        vector_store_key = source_key or ingestion_result.vector_store_key
        
        # Build vector store with metadata (NO LLM initialization)
        rag_chain = build_rag_chain(
            text=text,
            metadata=ingestion_result.metadata,
            video_id=vector_store_key
        )
        
        logger.info("[Pipeline]   RAG vector store created")
        logger.info("[Pipeline] Content is now indexed and ready for queries")
        logger.info("[Pipeline] LLM will be initialized ONLY when user asks a question")
        
        stage_results['vector_store_creation'] = StageResult(
            stage="vector_store_creation",
            status=StageStatus.SUCCESS,
            data={'vector_store_key': vector_store_key}
        )
        
        stage_results['rag_query_service'] = StageResult(
            stage="rag_query_service",
            status=StageStatus.SKIPPED,
            data={'reason': 'Deferred until first user query (lazy initialization)'}
        )
        
        # Store RAG chain for later use
        _store_rag_chain_internally(vector_store_key, rag_chain)
        
        if progress_callback:
            progress_callback("vector_indexing", "Knowledge base ready", 90)
        
    except Exception as e:
        logger.error(f"[Pipeline] Vector store creation failed: {e}", exc_info=True)
        stage_results['vector_store_creation'] = StageResult(
            stage="vector_store_creation",
            status=StageStatus.FAILED,
            error=str(e),
            error_code="VECTOR_STORE_ERROR"
        )
    
    # STEP 5: Optional Analysis (if requested)
    if mode == PipelineMode.INGEST_WITH_ANALYSIS:
        logger.info("[Pipeline] STEP 5: Optional Analysis (RAG-based)")
        logger.info("[Pipeline] This uses RAG retrieval → LLM")
        
        if progress_callback:
            progress_callback("analysis", "Generating analysis...", 92)
        
        try:
            from core.analysis_service import get_analysis_service
            
            from concurrent.futures import ThreadPoolExecutor
            
            # Execute RAG analysis tasks concurrently (cuts analysis time by ~75%)
            with ThreadPoolExecutor(max_workers=4) as executor:
                fut_summary = executor.submit(analysis_service.generate_summary, rag_chain.vector_store, 30)
                fut_actions = executor.submit(analysis_service.extract_action_items, rag_chain.vector_store, 20)
                fut_decisions = executor.submit(analysis_service.extract_key_decisions, rag_chain.vector_store, 20)
                fut_questions = executor.submit(analysis_service.extract_open_questions, rag_chain.vector_store, 20)
                
                summary = fut_summary.result()
                action_items = fut_actions.result()
                key_decisions = fut_decisions.result()
                open_questions = fut_questions.result()
            
            logger.info("[Pipeline]   Analysis complete (concurrent RAG retrieval was used)")
            
            stage_results['analysis'] = StageResult(
                stage="analysis",
                status=StageStatus.SUCCESS,
                data={
                    'summary': summary,
                    'action_items': action_items,
                    'key_decisions': key_decisions,
                    'open_questions': open_questions
                }
            )
            
        except Exception as e:
            logger.warning(f"[Pipeline] Optional analysis failed (non-critical): {e}")
            stage_results['analysis'] = StageResult(
                stage="analysis",
                status=StageStatus.FAILED,
                error=str(e),
                error_code="ANALYSIS_ERROR"
            )
            
            # Provide defaults for failed analysis
            summary = "Summary unavailable."
            action_items = "No action items extracted."
            key_decisions = "No key decisions extracted."
            open_questions = "No open questions extracted."
    else:
        # INGEST_ONLY mode - no analysis
        logger.info("[Pipeline] STEP 5: Analysis skipped (INGEST_ONLY mode)")
        logger.info("[Pipeline] Users can request analysis later via API")
        
        summary = ""
        action_items = ""
        key_decisions = ""
        open_questions = ""
        
        stage_results['analysis'] = StageResult(
            stage="analysis",
            status=StageStatus.SKIPPED,
            data={'reason': 'INGEST_ONLY mode'}
        )
    
    # COMPLETE
    if progress_callback:
        progress_callback("complete", "Ingestion complete!", 100)
    
    logger.info("=" * 80)
    logger.info("[Pipeline] INGESTION COMPLETE")
    logger.info(f"[Pipeline] Source type: {source_type.value}")
    logger.info(f"[Pipeline] Title: {title}")
    logger.info(f"[Pipeline] Content: {len(text)} characters")
    logger.info(f"[Pipeline] Vector store: Ready for RAG queries")
    logger.info("[Pipeline] LLM was NOT used during ingestion")
    logger.info("[Pipeline] LLM will be used ONLY when users ask questions")
    logger.info("=" * 80)
    
    # Log stage summary
    logger.info("[Pipeline] STAGE SUMMARY:")
    for stage_name, result in stage_results.items():
        status_symbol = {
            StageStatus.SUCCESS: " ",
            StageStatus.FAILED: "✗",
            StageStatus.SKIPPED: "○",
            StageStatus.PARTIAL: "◐"
        }.get(result.status, "?")
        logger.info(f"[Pipeline]   {status_symbol} {stage_name}: {result.status.value}")
    logger.info("=" * 80)
    
    # Build final result (JSON-serializable)
    return {
        "title": title,
        "transcript": text,  # Full text for backward compatibility
        "summary": summary,
        "action_items": action_items,
        "key_decisions": key_decisions,
        "open_questions": open_questions,
        "source_type": source_type.value,
        "ingestion_mode": mode.value,
        "segments": getattr(ingestion_result, 'segments', None) or [],
        "transcript_source": getattr(ingestion_result, 'transcript_source', None),
        "video_id": getattr(ingestion_result.metadata, 'video_id', None) if hasattr(ingestion_result, 'metadata') and ingestion_result.metadata else None,
        "duration_seconds": getattr(ingestion_result.metadata, 'duration', None) if hasattr(ingestion_result, 'metadata') and ingestion_result.metadata else None,
        # Include stage statuses for frontend
        "stage_statuses": {
            name: {
                "status": result.status.value,
                "error": result.error,
                "error_code": result.error_code
            }
            for name, result in stage_results.items()
        }
    }


#  ===============
# RAG Chain Storage - Now using persistent storage with Redis/in-memory fallback
#  ===============

from core.rag_storage import get_rag_storage


def _store_rag_chain_internally(source_key: str, rag_chain):
    """
    Store RAG chain with persistent storage.
    
    Uses Redis if available, falls back to in-memory dict.
    
    Args:
        source_key: Unique identifier for the source (job_id or session_id)
        rag_chain: The RAG chain instance
    """
    storage = get_rag_storage()
    success = storage.store_rag_chain(source_key, rag_chain)
    
    if success:
        logger.info(f"[Pipeline]   Stored RAG chain: {source_key}")
    else:
        logger.error(f"[Pipeline] ✗ Failed to store RAG chain: {source_key}")


def get_rag_chain_for_source(source_key: str):
    """
    Retrieve stored RAG chain for a given source.
    
    Looks up the live in-process chain first, then reconstructs from the
    persisted Chroma collection + BM25 documents.
    """
    if not source_key:
        return None
    
    storage = get_rag_storage()
    rag_chain = storage.get_rag_chain(source_key)
    
    if rag_chain:
        logger.info(f"[Pipeline]   Retrieved live RAG chain: {source_key}")
        return rag_chain
    
    from core.rag_engine import load_rag_chain
    rag_chain = load_rag_chain(source_key)
    
    if rag_chain:
        logger.info(f"[Pipeline]   Reconstructed RAG chain from disk: {source_key}")
        storage.store_rag_chain(source_key, rag_chain)
        return rag_chain
    
    logger.debug(f"[Pipeline] RAG chain not found: {source_key}")
    return None


def get_most_recent_rag_chain():
    """
    Get the most recently stored RAG chain.
    
    Returns:
        RAG chain instance or None
    """
    storage = get_rag_storage()
    session_id = storage.get_most_recent_session()
    
    if session_id:
        logger.info(f"[Pipeline] Most recent session: {session_id}")
        return get_rag_chain_for_source(session_id)
    
    return None


def list_all_rag_sessions():
    """
    List all stored RAG chain sessions.
    
    Returns:
        List of session IDs
    """
    storage = get_rag_storage()
    return storage.list_sessions()


if __name__ == "__main__":
    # CLI entry point
    import sys
    
    print("\nAI Video Agent - Refactored Architecture")
    print("=" * 60)
    print("PDF: Local extraction → RAG (no LLM during ingestion)")
    print("Audio/Video: STT → RAG (no LLM during ingestion)")
    print("Analysis: Optional, RAG-based (retrieve → LLM)")
    print("=" * 60)
    
    source = input("\nEnter YouTube URL, audio/video file, or PDF path: ").strip()
    
    if not source:
        print("Error: No source provided")
        sys.exit(1)
    
    # Determine if it's a PDF
    source_type = SourceType.from_source(source)
    
    if source_type.requires_stt():
        language = input("Language (english/hinglish): ").strip() or "english"
    else:
        language = "document"
    
    # Ask if user wants analysis
    analysis_choice = input("Generate analysis? (y/n): ").strip().lower()
    mode = PipelineMode.INGEST_WITH_ANALYSIS if analysis_choice == 'y' else PipelineMode.INGEST_ONLY
    
    try:
        result = run_pipeline(source, language, mode=mode)
        
        print("\n" + "=" * 60)
        print(f"  INGESTION COMPLETE")
        print("=" * 60)
        print(f"Title: {result['title']}")
        print(f"Source Type: {result['source_type']}")
        print(f"Content Length: {len(result['transcript'])} characters")
        
        if mode == PipelineMode.INGEST_WITH_ANALYSIS:
            print(f"\nSummary:\n{result['summary']}")
            print(f"\nAction Items:\n{result['action_items']}")
            print(f"\nKey Decisions:\n{result['key_decisions']}")
            print(f"\nOpen Questions:\n{result['open_questions']}")
        else:
            print("\nAnalysis skipped (use analysis API to generate)")
        
        print("=" * 60)
        
    except PipelineError as e:
        print(f"\n✗ ERROR [{e.error_code}] in {e.stage}:")
        print(f"  {e.message}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        sys.exit(1)
    
    # Phase 2: Chat with content via RAG
    print("\n" + "=" * 60)
    print("Chat with your content (type 'exit' to quit)")
    print("=" * 60)
    
    rag_chain = get_rag_chain_for_source(source)
    
    if rag_chain is None:
        print("RAG chain not available. Chat functionality disabled.")
    else:
        from core.rag_engine import ask_question
        
        while True:
            question = input("\nYou: ").strip()
            
            if question.lower() in ["exit", "quit", "q"]:
                print("Goodbye!")
                break
            
            if not question:
                continue
            
            try:
                answer = ask_question(rag_chain, question)
                print(f"\nAssistant: {answer}")
            except Exception as e:
                print(f"\nError: {e}")
