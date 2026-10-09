"""
Audio/Video Ingestion Pipeline - STT + Indexing Only.

Audio/Video Processing videoQuery:
Audio/YouTube → Extract audio → STT → Transcript → Chunk → Embed → Vector store → Ready for RAG

STT is used (audio → text conversion):
- Whisper for English
- Sarvam for Hindi/Hinglish

NO automatic LLM analysis during ingestion:
- No automatic summarization
- No automatic key decision extraction
- No automatic question extraction
- No global analysis

The transcript is created via STT and indexed for RAG.
LLM is ONLY used later when user asks questions.
"""

import os
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List

from core.source_types import SourceType, ProcessingMetadata, IngestionResult
from core.stt_service import get_stt_service
from core.caption_service import get_caption_service
from core.video_cache import get_video_cache, parse_video_id, CachedTranscript
from core.logger import get_logger
from utils.audio_processor import process_input, download_youtube_audio

logger = get_logger(__name__)


class AudioPipeline:
    """
    Audio/Video ingestion pipeline - STT, Captions and indexing only.
    
    CRITICAL: This pipeline uses Captions / STT (audio → text) but does NOT use LLM (text → reasoning).
    Audio/video does not contain text, so we convert speech to text via Captions or STT.
    Then we index the transcript for RAG.
    """
    
    def __init__(self):
        """Initialize audio pipeline."""
        self.stt_service = get_stt_service()
        self.caption_service = get_caption_service()
        self.video_cache = get_video_cache()
        logger.info("[AudioPipeline] Initialized - Caption-first + STT + indexing (no LLM analysis)")
    
    def ingest_audio(
        self,
        source: str,
        source_type: SourceType,
        language: str = "english",
        job_id: Optional[str] = None,
        progress_callback: Optional[Callable[[str, str, Optional[int]], None]] = None
    ) -> IngestionResult:
        """
        Ingest audio/video using STT.
        
        Pipeline:
        1. Download/extract audio (if YouTube/video)
        2. Speech-to-text using configured STT provider
        3. Clean transcript
        4. Create metadata
        5. Return result ready for vector indexing
        
        STT IS USED (audio → text).
        LLM IS NOT USED (no automatic analysis).
        
        Args:
            source: YouTube URL or audio/video file path
            source_type: SourceType enum value
            language: Language for STT (english, hinglish, etc.)
            job_id: Optional unique job identifier
            progress_callback: Optional callback(stage, message, progress_percent)
            
        Returns:
            IngestionResult with transcript and metadata
        """
        logger.info("=" * 80)
        logger.info("[AudioPipeline] Starting audio/video ingestion")
        logger.info(f"[AudioPipeline] Source: {source}")
        logger.info(f"[AudioPipeline] Type: {source_type.value}")
        logger.info(f"[AudioPipeline] Language: {language}")
        logger.info("[AudioPipeline] STT will be used (audio → text)")
        logger.info("[AudioPipeline] LLM will NOT be used during ingestion")
        logger.info("=" * 80)
        
        if progress_callback:
            progress_callback("audio_processing", "Starting audio processing...", 5)
        
        video_id = parse_video_id(source) if source_type == SourceType.YOUTUBE else None

        # FAST PATH: Caption-first retrieval for YouTube videos
        if source_type == SourceType.YOUTUBE and video_id and self.stt_service.stt_provider_type != "groq":
            logger.info(f"[AudioPipeline] Checking caption-first path for YouTube video_id={video_id}")
            if progress_callback:
                progress_callback("captions", "Checking for captions and cached transcript...", 8)
            
            caption_res = self.caption_service.fetch_transcript(source, language=language)
            if caption_res:
                logger.info(
                    f"[AudioPipeline] Fast path SUCCESS: Using captions "
                    f"(from_cache={caption_res.from_cache}, source={caption_res.source}, "
                    f"segments={len(caption_res.segments)})"
                )
                if progress_callback:
                    msg = "Loaded transcript from cache" if caption_res.from_cache else "Extracted YouTube captions"
                    progress_callback("captions", msg, 65)
                
                title = self._generate_title_from_source(source, source_type)
                metadata = ProcessingMetadata(
                    source_type=source_type,
                    source=source,
                    job_id=job_id,
                    language=caption_res.language,
                    duration=caption_res.duration_seconds,
                    char_count=len(caption_res.flat_text),
                    transcript_source=caption_res.source,
                    video_id=caption_res.video_id
                )
                
                result = IngestionResult(
                    text=caption_res.flat_text,
                    metadata=metadata,
                    title=title,
                    vector_store_key=job_id or self._generate_vector_key(source, source_type),
                    indexed=False,
                    segments=caption_res.segments,
                    transcript_source=caption_res.source
                )
                return result
            else:
                logger.info("[AudioPipeline] Captions unavailable or low quality. Proceeding to audio download + STT fallback.")
                if progress_callback:
                    progress_callback("audio_processing", "Captions unavailable. Falling back to audio download...", 12)
        elif source_type == SourceType.YOUTUBE and video_id:
            logger.info("[AudioPipeline] Skipping caption-first path: Groq STT is configured")
        
        # STEP 1: Download/extract audio
        logger.info("[AudioPipeline] STEP 1: Audio extraction")
        
        if source_type == SourceType.YOUTUBE:
            logger.info("[AudioPipeline] Downloading from YouTube...")
            
            if progress_callback:
                progress_callback("youtube_download", "Downloading from YouTube...", 15)
            
            try:
                audio_chunks = process_input(source)
                logger.info(f"[AudioPipeline]   Downloaded: {len(audio_chunks)} chunks")
                
            except Exception as e:
                logger.error(f"[AudioPipeline] YouTube download failed: {e}")
                raise Exception(f"Failed to download YouTube video: {e}")
                
        elif source_type in [SourceType.VIDEO, SourceType.AUDIO]:
            logger.info("[AudioPipeline] Processing local audio/video file...")
            
            if progress_callback:
                progress_callback("audio_processing", "Processing audio file...", 10)
            
            try:
                audio_chunks = process_input(source)
                logger.info(f"[AudioPipeline]   Processed: {len(audio_chunks)} chunks")
                
            except Exception as e:
                logger.error(f"[AudioPipeline] Audio processing failed: {e}")
                raise Exception(f"Failed to process audio/video: {e}")
        else:
            raise ValueError(f"Unsupported source type for audio pipeline: {source_type}")
        
        if progress_callback:
            progress_callback("audio_processing", "Audio extraction complete", 20)
        
        # STEP 2: Speech-to-text (STT)
        logger.info("[AudioPipeline] STEP 2: Speech-to-text transcription")
        logger.info(f"[AudioPipeline] Using STT service for {language} language")
        
        if progress_callback:
            progress_callback("transcription", f"Transcribing audio ({language})...", 30)
        
        def stt_progress(stage: str, message: str):
            """Forward progress from STT service."""
            if progress_callback:
                # Map to progress percentages
                progress_map = {
                    "stt": 50
                }
                progress_callback(stage, message, progress_map.get(stage, 40))
        
        try:
            # Use STT service — returns STTResult with .text and .segments
            stt_result = self.stt_service.transcribe_multiple_with_segments(
                audio_paths=audio_chunks,
                language=language,
                progress_callback=stt_progress
            )
            transcript = stt_result.text
            stt_segments = stt_result.segments

            logger.info(
                f"[AudioPipeline]   Transcribed: {len(transcript)} characters, "
                f"{len(stt_segments)} timestamped segments"
            )

        except Exception as e:
            logger.error(f"[AudioPipeline] Transcription failed: {e}", exc_info=True)
            raise Exception(f"Speech-to-text transcription failed: {e}")
        
        if progress_callback:
            progress_callback("transcription", "Transcription complete", 60)
        
        # STEP 3: Validate transcript
        logger.info("[AudioPipeline] STEP 3: Transcript validation")
        
        if not transcript or not transcript.strip():
            raise ValueError(
                "Transcription returned empty result. "
                "Audio may not contain speech or may be silent."
            )
        
        logger.info("[AudioPipeline]   Transcript validated")
        
        # STEP 4: Clean transcript (local processing)
        logger.info("[AudioPipeline] STEP 4: Transcript cleaning")
        
        cleaned_transcript = self._clean_transcript(transcript)
        
        logger.info(f"[AudioPipeline]   Transcript cleaned: {len(cleaned_transcript)} characters")
        
        if progress_callback:
            progress_callback("audio_processing", "Transcript processing complete", 65)
        
        # STEP 5: Generate title from source (no LLM)
        logger.info("[AudioPipeline] STEP 5: Title generation (from source)")
        
        title = self._generate_title_from_source(source, source_type)
        stt_source_name = stt_result.source or ("sarvam" if "hin" in language.lower() else "whisper")
        logger.info(f"[AudioPipeline]   Title: {title} (STT source: {stt_source_name})")

        # Save to video cache if YouTube
        if source_type == SourceType.YOUTUBE and video_id:
            try:
                self.video_cache.put(CachedTranscript(
                    video_id=video_id,
                    segments=stt_segments,
                    flat_text=cleaned_transcript,
                    transcript_source=stt_source_name,
                    language=language,
                    title=title
                ))
            except Exception as e:
                logger.warning(f"[AudioPipeline] Failed to cache STT transcript: {e}")
        
        # STEP 6: Create metadata
        logger.info("[AudioPipeline] STEP 6: Metadata creation")
        
        metadata = ProcessingMetadata(
            source_type=source_type,
            source=source,
            job_id=job_id,
            language=language,
            audio_chunks=len(audio_chunks),
            char_count=len(cleaned_transcript),
            transcript_source=stt_source_name,
            video_id=video_id
        )
        
        logger.info("[AudioPipeline]   Metadata created")
        
        if progress_callback:
            progress_callback("audio_processing", "Audio processing complete", 70)
        
        # STEP 7: Create ingestion result
        result = IngestionResult(
            text=cleaned_transcript,
            metadata=metadata,
            title=title,
            vector_store_key=job_id or self._generate_vector_key(source, source_type),
            indexed=False,
            segments=stt_segments,
            transcript_source=stt_source_name
        )
        
        logger.info("=" * 80)
        logger.info("[AudioPipeline] AUDIO/VIDEO INGESTION COMPLETE")
        logger.info(f"[AudioPipeline] Chunks: {len(audio_chunks)}")
        logger.info(f"[AudioPipeline] Characters: {len(cleaned_transcript)}")
        logger.info(f"[AudioPipeline] Title: {title}")
        logger.info(f"[AudioPipeline] Transcript source: {stt_source_name}")
        logger.info("[AudioPipeline] Ready for vector indexing")
        logger.info("[AudioPipeline] STT was used (audio → text)")
        logger.info("[AudioPipeline] LLM was NOT used during ingestion")
        logger.info("=" * 80)
        
        return result
    
    def _clean_transcript(self, transcript: str) -> str:
        """
        Clean and normalize transcript.
        
        Local processing only:
        - Remove excessive whitespace
        - Normalize line breaks
        - Remove filler words if needed
        
        Args:
            transcript: Raw transcript from STT
            
        Returns:
            Cleaned transcript
        """
        import re
        
        # Remove excessive blank lines
        transcript = re.sub(r'\n{3,}', '\n\n', transcript)
        
        # Remove excessive spaces
        transcript = re.sub(r' {2,}', ' ', transcript)
        
        # Normalize unicode
        transcript = transcript.strip()
        
        return transcript
    
    def _generate_title_from_source(self, source: str, source_type: SourceType) -> str:
        """
        Generate title from source.
        
        Local processing only - no LLM.
        
        Args:
            source: Source URL or path
            source_type: Type of source
            
        Returns:
            Formatted title
        """
        if source_type == SourceType.YOUTUBE:
            # Try to extract video ID
            import re
            match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', source)
            if match:
                video_id = match.group(1)
                return f"YouTube Video {video_id}"
            return "YouTube Video"
        
        else:
            # Use filename for local files
            file_name = Path(source).stem
            title = file_name.replace('_', ' ').replace('-', ' ').title()
            return title
    
    def _generate_vector_key(self, source: str, source_type: SourceType) -> str:
        """
        Generate vector store key.
        
        Args:
            source: Source URL or path
            source_type: Type of source
            
        Returns:
            Vector store key
        """
        import hashlib
        
        # Use hash of source as key
        source_hash = hashlib.md5(source.encode()).hexdigest()[:12]
        
        return f"{source_type.value}_{source_hash}"


def ingest_audio_source(
    source: str,
    language: str = "english",
    job_id: Optional[str] = None,
    progress_callback: Optional[Callable[[str, str, Optional[int]], None]] = None
) -> IngestionResult:
    """
    Convenience function to ingest audio/video source.
    
    This performs STT (audio → text) but NO LLM analysis.
    
    Pipeline:
    Audio → STT → Transcript → Ready for RAG
    
    Args:
        source: YouTube URL or audio/video file path
        language: Language for STT
        job_id: Optional job ID
        progress_callback: Optional progress callback
        
    Returns:
        IngestionResult ready for vector indexing
    """
    # Determine source type
    source_type = SourceType.from_source(source)
    
    # Create pipeline and ingest
    pipeline = AudioPipeline()
    return pipeline.ingest_audio(
        source=source,
        source_type=source_type,
        language=language,
        job_id=job_id,
        progress_callback=progress_callback
    )
