"""
Video/Audio analysis endpoints.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any
from enum import Enum
import asyncio
import json
import uuid

from core.validators import InputValidator
from core.logger import get_logger
from core.exceptions import ValidationError
from core.auth_middleware import get_current_user, get_current_user_optional, AuthUser
from main import run_pipeline, get_rag_chain_for_source
from utils.file_manager import get_file_manager

logger = get_logger(__name__)

router = APIRouter()

# Store for progress updates (in production, use Redis or database)
progress_store = {}


class LanguageEnum(str, Enum):
    """Supported languages."""
    english = "english"
    hinglish = "hinglish"


class AnalysisRequest(BaseModel):
    """Request model for video/audio analysis."""
    source: str = Field(..., description="YouTube URL or local file path", min_length=1)
    language: LanguageEnum = Field(default=LanguageEnum.english, description="Language for transcription")
    
    class Config:
        json_schema_extra = {
            "example": {
                "source": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "language": "english"
            }
        }


class AnalysisResponse(BaseModel):
    """Response model for video/audio analysis."""
    job_id: str
    status: str
    message: str


class AnalysisResult(BaseModel):
    """Analysis result model."""
    title: str
    transcript: str
    summary: str
    action_items: str
    key_decisions: str
    open_questions: str
    segments: Optional[list] = None
    transcript_source: Optional[str] = None
    video_id: Optional[str] = None
    duration_seconds: Optional[float] = None


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_video(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Analyze a video or audio file asynchronously with real-time progress.
    
    - **source**: YouTube URL or local file path
    - **language**: Language for transcription (english or hinglish)
    
    Returns a job ID. Use /progress/{job_id} to get real-time progress updates.
    """
    try:
        # Validate source input
        validated_source, source_type = InputValidator.validate_source_input(request.source)
        language = InputValidator.validate_language(request.language.value)
        
        logger.info(f"Starting analysis for user {current_user.id}: source_type={source_type}, language={language}")
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Initialize progress
        progress_store[job_id] = {
            "status": "starting",
            "stage": "initialization",
            "progress": 0,
            "message": "Starting analysis...",
            "result": None,
            "error": None
        }
        
        user_id = current_user.id if current_user else "guest"

        # Start processing in background
        background_tasks.add_task(process_analysis_with_progress, job_id, validated_source, language, user_id)
        
        return {
            "job_id": job_id,
            "status": "processing",
            "message": f"Analysis started. Stream progress at /progress/{job_id}"
        }
        
    except ValidationError as e:
        logger.error(f"Validation error: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start analysis")


async def process_analysis_with_progress(job_id: str, source: str, language: str, user_id: str = "guest"):
    """
    NOTE: This runs as a BackgroundTask. Heavy pipeline work is offloaded
    to a thread via asyncio.to_thread to avoid blocking the event loop.

    Process the analysis with real-time progress updates and enhanced error handling.
    
    Args:
        job_id: Unique job identifier
        source: Validated source path/URL
        language: Validated language
        user_id: Authenticated user ID or 'guest'
    """
    def update_progress(stage: str, message: str, progress: int = None):
        """Update progress in store."""
        if job_id in progress_store:
            progress_store[job_id].update({
                "stage": stage,
                "message": message,
                "status": "processing"
            })
            if progress is not None:
                progress_store[job_id]["progress"] = progress
    
    try:
        logger.info(f"[Job {job_id}] Processing: source={source}, language={language}")
        
        # Import PipelineError for structured error handling
        from main import PipelineError
        
        # Run the pipeline with progress callback
        result = await asyncio.to_thread(
            run_pipeline, source, language,
            progress_callback=update_progress, source_key=job_id
        )
        
        # Check for stage failures
        stage_statuses = result.get("stage_statuses", {})
        has_critical_failure = False
        failed_stages = []
        
        for stage_name, stage_info in stage_statuses.items():
            if stage_info['status'] == 'failed' and stage_name in ['audio_processing', 'transcription', 'pdf_extraction']:
                has_critical_failure = True
                failed_stages.append(stage_name)
        
        # Build JSON-safe result
        source_type = result.get("source_type", "video") or "video"
        ui_type = "pdf" if source_type == "pdf" else ("audio" if source_type == "audio" else "video")
        
        json_safe_result = {
            "title": result.get("title", ""),
            "transcript": result.get("transcript", ""),
            "summary": result.get("summary", ""),
            "action_items": result.get("action_items", ""),
            "key_decisions": result.get("key_decisions", ""),
            "open_questions": result.get("open_questions", ""),
            "job_id": job_id,
            "type": ui_type,
            "source_type": source_type,
            "stage_statuses": stage_statuses,
            "segments": result.get("segments", []),
            "transcript_source": result.get("transcript_source"),
            "video_id": result.get("video_id"),
            "duration_seconds": result.get("duration_seconds")
        }
        
        # Determine final status
        if has_critical_failure:
            # Critical stage failed - mark as failed but include partial results
            progress_store[job_id].update({
                "status": "failed",
                "stage": failed_stages[0] if failed_stages else "unknown",
                "progress": 0,
                "message": f"Critical error in {', '.join(failed_stages)}",
                "error": f"Pipeline failed at: {', '.join(failed_stages)}",
                "error_code": stage_statuses[failed_stages[0]].get('error_code', 'PIPELINE_ERROR'),
                "result": json_safe_result  # Include partial results
            })
        else:
            # Success (possibly with non-critical warnings)
            progress_store[job_id].update({
                "status": "completed",
                "stage": "done",
                "progress": 100,
                "message": "Analysis complete!",
                "result": json_safe_result
            })
        
        # Persist analysis to Supabase if configured
        try:
            from core.supabase_database import get_database_manager
            from core.supabase_client import is_supabase_configured
            
            if is_supabase_configured():
                db_manager = get_database_manager()
                db_manager.save_analysis({
                    "user_id": user_id,
                    "source_type": source_type,
                    "source_ref": source,
                    "video_id": result.get("video_id"),
                    "title": result.get("title"),
                    "transcript": result.get("segments") or result.get("transcript"),
                    "transcript_source": result.get("transcript_source"),
                    "summary": result.get("summary"),
                    "action_items": result.get("action_items"),
                    "key_decisions": result.get("key_decisions"),
                    "open_questions": result.get("open_questions"),
                    "status": "failed" if has_critical_failure else "completed",
                    "language": language,
                    "duration_seconds": result.get("duration_seconds"),
                    "job_id": job_id,
                })
        except Exception as e:
            logger.warning(f"Failed to persist analysis to Supabase: {e}")
        
        logger.info(f"[Job {job_id}] Completed")
        
    except Exception as e:
        # Check if it's a structured pipeline error
        error_stage = "unknown"
        error_code = "UNKNOWN_ERROR"
        error_message = str(e)
        
        # Try to extract structured error information
        if hasattr(e, 'stage'):
            error_stage = e.stage
        if hasattr(e, 'error_code'):
            error_code = e.error_code
        if hasattr(e, 'message'):
            error_message = e.message
        
        # Map error types to user-friendly messages
        if "YouTube" in error_message or "youtube" in error_message:
            error_code = "YOUTUBE_DOWNLOAD_ERROR"
            if "cookie" in error_message.lower():
                error_code = "YOUTUBE_COOKIE_ERROR"
                error_message = (
                    "YouTube download failed due to authentication issues. "
                    "The video may require login or your browser's cookies are locked. "
                    "Please try: 1) Using a different video, or 2) Uploading the file directly."
                )
        elif "rate limit" in error_message.lower() or "429" in error_message:
            error_code = "MISTRAL_RATE_LIMIT"
            error_message = (
                "AI service rate limit exceeded. The document was processed but some analysis "
                "features are unavailable. Please wait a few minutes and try again, or use the "
                "RAG chat feature to ask specific questions about the content."
            )
        elif "PDF" in error_message or "pdf" in error_message:
            error_code = "PDF_PROCESSING_ERROR"
        elif "transcription" in error_message.lower():
            error_code = "TRANSCRIPTION_ERROR"
        
        logger.error(f"[Job {job_id}] Failed: [{error_code}] {error_message}", exc_info=True)
        
        progress_store[job_id].update({
            "status": "failed",
            "stage": error_stage,
            "progress": 0,
            "message": error_message,
            "error": error_message,
            "error_code": error_code
        })



@router.get("/progress/{job_id}")
async def stream_progress(job_id: str):
    """
    Stream real-time progress updates for an analysis job using Server-Sent Events (SSE).
    
    - **job_id**: The job ID returned from /analyze endpoint
    
    Returns a stream of progress updates.
    """
    async def event_generator():
        """Generate SSE events."""
        if job_id not in progress_store:
            yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
            return
        
        last_progress = -1
        
        while True:
            if job_id not in progress_store:
                break
            
            progress_data = progress_store[job_id]
            current_progress = progress_data.get("progress", 0)
            
            # Send update if progress changed or status is completed/failed
            if current_progress != last_progress or progress_data["status"] in ["completed", "failed"]:
                # progress_data contains only JSON-serializable fields:
                # - status (str)
                # - stage (str)
                # - progress (int)
                # - message (str)
                # - result (dict with strings only, no LangChain objects)
                # - error (str or None)
                yield f"data: {json.dumps(progress_data)}\n\n"
                last_progress = current_progress
            
            # Stop streaming if completed or failed
            if progress_data["status"] in ["completed", "failed"]:
                break
            
            await asyncio.sleep(0.5)  # Poll every 500ms
        
        # Clean up after completion
        if job_id in progress_store and progress_store[job_id]["status"] in ["completed", "failed"]:
            await asyncio.sleep(5)  # Keep result for 5 seconds
            progress_store.pop(job_id, None)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/status/{job_id}")
async def get_analysis_status(job_id: str):
    """
    Get the status of an analysis job.
    
    - **job_id**: The job ID returned from /analyze endpoint
    
    Returns the current status and result (if completed).
    """
    if job_id not in progress_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    progress_data = progress_store[job_id]
    return {
        "job_id": job_id,
        "status": progress_data.get("status", "unknown"),
        "stage": progress_data.get("stage", "unknown"),
        "progress": progress_data.get("progress", 0),
        "message": progress_data.get("message", ""),
        "result": progress_data.get("result") if progress_data.get("status") == "completed" else None,
        "error": progress_data.get("error") if progress_data.get("status") == "failed" else None
    }


@router.post("/analyze/sync", response_model=AnalysisResult)
async def analyze_video_sync(
    request: AnalysisRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Synchronously analyze a video or audio file.
    
      WARNING: This endpoint blocks until analysis is complete.
    Only use for turbo files or testing. Use /analyze for production.
    
    - **source**: YouTube URL or local file path
    - **language**: Language for transcription (english or hinglish)
    
    Returns the complete analysis result.
    """
    try:
        # Validate source input
        validated_source, source_type = InputValidator.validate_source_input(request.source)
        language = InputValidator.validate_language(request.language.value)
        
        logger.info(f"Starting synchronous analysis: source_type={source_type}, language={language}")
        
        # Run the pipeline
        result = run_pipeline(validated_source, language)
        
        return {
            "title": result["title"],
            "transcript": result["transcript"],
            "summary": result["summary"],
            "action_items": result["action_items"],
            "key_decisions": result["key_decisions"],
            "open_questions": result["open_questions"]
        }
        
    except ValidationError as e:
        logger.error(f"Validation error: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed")


@router.post("/upload", response_model=AnalysisResponse)
async def upload_and_analyze(
    file: UploadFile = File(..., description="Audio or video file (MP3, MP4, etc.)"),
    language: str = Form(default="english", description="Language for transcription"),
    background_tasks: BackgroundTasks = None,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Upload an audio/video file and analyze it asynchronously.
    
    Supported formats:
    - Audio: MP3, WAV, M4A, FLAC, OGG, AAC
    - Video: MP4, AVI, MOV, MKV, WebM, FLV
    - Documents: PDF
    
    - **file**: Audio, video, or PDF file to analyze
    - **language**: Language for transcription (english or hinglish)
    
    Returns a job ID. Use /progress/{job_id} to get real-time progress updates.
    
    Maximum file size: Configured via MAX_UPLOAD_SIZE_MB environment variable (default: 500MB)
    """
    try:
        # Validate language
        validated_language = InputValidator.validate_language(language)
        
        logger.info(f"Processing file upload for user {current_user.id}: {file.filename}, language={validated_language}")
        
        # Get file manager
        file_manager = get_file_manager()
        
        # Save and validate uploaded file (fast local storage, non-blocking)
        job_id, file_path, file_size, supabase_info = await file_manager.save_upload(
            file=file,
            language=validated_language,
            upload_to_supabase=False  # Do not block upload endpoint on cloud storage
        )
        
        logger.info(
            f"File uploaded successfully: job_id={job_id}, "
            f"path={file_path}, size={file_size / (1024 * 1024):.2f}MB, "
            f"supabase={supabase_info.get('uploaded', False)}"
        )
        
        # Initialize progress
        progress_store[job_id] = {
            "status": "starting",
            "stage": "upload_complete",
            "progress": 5,
            "message": "File uploaded successfully",
            "result": None,
            "error": None
        }
        
        user_id = current_user.id if current_user else "guest"

        # Start processing in background
        background_tasks.add_task(
            process_uploaded_file_with_progress,
            job_id,
            file_path,
            validated_language,
            file_manager,
            user_id
        )
        
        return {
            "job_id": job_id,
            "status": "processing",
            "message": f"Upload successful. Processing started. Stream progress at /progress/{job_id}"
        }
        
    except ValidationError as e:
        logger.error(f"Upload validation error: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process upload")


async def process_uploaded_file_with_progress(
    job_id: str,
    file_path: str,
    language: str,
    file_manager,
    user_id: str = "guest"
):
    """
    Process uploaded file with real-time progress updates.
    
    Args:
        job_id: Unique job identifier
        file_path: Path to uploaded file
        language: Validated language
        file_manager: FileManager instance for cleanup
        user_id: Authenticated user ID or 'guest'
    """
    def update_progress(stage: str, message: str, progress: int = None):
        """Update progress in store."""
        if job_id in progress_store:
            progress_store[job_id].update({
                "stage": stage,
                "message": message,
                "status": "processing"
            })
            if progress is not None:
                progress_store[job_id]["progress"] = progress
    
    try:
        logger.info(f"Processing uploaded file job {job_id}: file={file_path}, language={language}")
        
        update_progress("processing", "Processing uploaded file...", 10)
        
        from core.source_types import PipelineMode
        is_pdf_upload = file_path.lower().endswith(".pdf")
        pipeline_mode = PipelineMode.INGEST_WITH_ANALYSIS if is_pdf_upload else PipelineMode.INGEST_ONLY

        # Run the pipeline in a thread to avoid blocking the event loop
        result = await asyncio.to_thread(
            run_pipeline, file_path, language,
            progress_callback=update_progress, source_key=job_id,
            mode=pipeline_mode
        )
        
        # Ensure result contains only JSON-serializable data
        source_type = result.get("source_type", "video") or "video"
        ui_type = "pdf" if source_type == "pdf" else ("audio" if source_type == "audio" else "video")
        
        json_safe_result = {
            "title": result.get("title", ""),
            "transcript": result.get("transcript", ""),
            "summary": result.get("summary", ""),
            "action_items": result.get("action_items", ""),
            "key_decisions": result.get("key_decisions", ""),
            "open_questions": result.get("open_questions", ""),
            "job_id": job_id,
            "type": ui_type,
            "source_type": source_type,
            "segments": result.get("segments", []),
            "transcript_source": result.get("transcript_source"),
            "video_id": result.get("video_id"),
            "duration_seconds": result.get("duration_seconds")
        }
        
        # Store result
        progress_store[job_id].update({
            "status": "completed",
            "stage": "done",
            "progress": 100,
            "message": "Analysis complete!",
            "result": json_safe_result
        })
        
        logger.info(f"Job {job_id} completed successfully")
        
        # Save results to Supabase if configured
        try:
            from core.supabase_database import get_database_manager
            from core.supabase_client import is_supabase_configured
            
            if is_supabase_configured():
                logger.info(f"Saving results to Supabase: {job_id}")
                db_manager = get_database_manager()
                db_manager.save_processing_result(job_id, json_safe_result)
                db_manager.save_analysis({
                    "user_id": user_id,
                    "source_type": source_type,
                    "source_ref": file_path,
                    "title": result.get("title"),
                    "transcript": result.get("segments") or result.get("transcript"),
                    "transcript_source": result.get("transcript_source"),
                    "summary": result.get("summary"),
                    "action_items": result.get("action_items"),
                    "key_decisions": result.get("key_decisions"),
                    "open_questions": result.get("open_questions"),
                    "status": "completed",
                    "language": language,
                    "duration_seconds": result.get("duration_seconds"),
                    "job_id": job_id,
                })
        except Exception as e:
            logger.warning(f"Failed to save results to Supabase: {e}")
        
        # Clean up uploaded file after successful processing
        file_manager.cleanup_job(job_id)
        
    except ValueError as e:
        logger.error(f"Job {job_id} validation failed: {str(e)}", exc_info=True)
        progress_store[job_id].update({
            "status": "failed",
            "stage": "error",
            "progress": 0,
            "message": str(e),
            "error": str(e)
        })
        # Clean up on error
        file_manager.cleanup_job(job_id)
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {str(e)}", exc_info=True)
        progress_store[job_id].update({
            "status": "failed",
            "stage": "error",
            "message": str(e),
            "error": str(e)
        })
        # Clean up on error
        file_manager.cleanup_job(job_id)


