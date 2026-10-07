"""
Source Type Definitions for Pipeline Routing.
Clearly separates PDF/document processing from audio/video transcription.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List


class SourceType(Enum):
    """
    Source type determines processing pipeline.
    
    PDF: Local text extraction → RAG (no LLM during ingestion)
    AUDIO: STT → RAG (STT converts speech to text)
    VIDEO: STT → RAG (extract audio first)
    YOUTUBE: Download → STT → RAG (or captions → RAG)
    MEETING: STT → structured minutes → RAG
    """
    PDF = "pdf"
    AUDIO = "audio"
    VIDEO = "video"
    YOUTUBE = "youtube"
    MEETING = "meeting"
    
    @classmethod
    def from_source(cls, source: str) -> 'SourceType':
        """
        Determine source type from source string.
        
        Args:
            source: URL or file path
            
        Returns:
            SourceType enum value
        """
        source_lower = source.lower()
        
        # Check for YouTube URLs
        if source.startswith("http://") or source.startswith("https://"):
            if "youtube.com" in source_lower or "youtu.be" in source_lower:
                return cls.YOUTUBE
            # Other URLs treated as potential video/audio sources
            return cls.VIDEO
        
        # Check file extensions
        if source_lower.endswith('.pdf'):
            return cls.PDF
        elif source_lower.endswith(('.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma')):
            return cls.AUDIO
        elif source_lower.endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv')):
            return cls.VIDEO
        
        # Default based on context
        # If it's a local file, try to detect from extension
        import os
        if os.path.exists(source):
            _, ext = os.path.splitext(source)
            ext_lower = ext.lower()
            if ext_lower == '.pdf':
                return cls.PDF
            elif ext_lower in ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg']:
                return cls.AUDIO
            elif ext_lower in ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv']:
                return cls.VIDEO
        
        # Default to VIDEO for unknown types
        return cls.VIDEO
    
    def requires_stt(self) -> bool:
        """Check if this source type requires speech-to-text."""
        return self in [SourceType.AUDIO, SourceType.VIDEO, SourceType.YOUTUBE, SourceType.MEETING]
    
    def is_document(self) -> bool:
        """Check if this is a document type (already contains text)."""
        return self == SourceType.PDF
    
    def requires_download(self) -> bool:
        """Check if this source requires downloading."""
        return self == SourceType.YOUTUBE


@dataclass
class ProcessingMetadata:
    """
    Metadata for processing job.
    Passed through the pipeline to track source and processing info.
    """
    source_type: SourceType
    source: str
    job_id: Optional[str] = None
    language: Optional[str] = None
    
    # Document-specific metadata
    page_count: Optional[int] = None
    file_name: Optional[str] = None
    
    # Audio/Video-specific metadata
    duration: Optional[float] = None
    audio_chunks: Optional[int] = None
    
    # Processing results
    char_count: Optional[int] = None
    chunk_count: Optional[int] = None
    
    # Transcript source tracking (captions, whisper, sarvam)
    transcript_source: Optional[str] = None
    
    # YouTube-specific
    video_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'source_type': self.source_type.value,
            'source': self.source,
            'job_id': self.job_id,
            'language': self.language,
            'page_count': self.page_count,
            'file_name': self.file_name,
            'duration': self.duration,
            'audio_chunks': self.audio_chunks,
            'char_count': self.char_count,
            'chunk_count': self.chunk_count,
            'transcript_source': self.transcript_source,
            'video_id': self.video_id,
        }


@dataclass
class IngestionResult:
    """
    Result of content ingestion (PDF extraction or audio transcription).
    Contains text content and metadata, ready for RAG indexing.
    """
    text: str
    metadata: ProcessingMetadata
    title: str
    
    # RAG-specific info (populated after vector store creation)
    vector_store_key: Optional[str] = None
    indexed: bool = False
    
    # Timestamped segments: [{text, start, end}]
    # Used for click-to-seek, subtitle export, and citations
    segments: Optional[List[Dict[str, Any]]] = None
    
    # Source of the transcript (captions, whisper, sarvam)
    transcript_source: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'text_length': len(self.text),
            'metadata': self.metadata.to_dict(),
            'title': self.title,
            'vector_store_key': self.vector_store_key,
            'indexed': self.indexed,
            'has_segments': self.segments is not None and len(self.segments) > 0,
            'segment_count': len(self.segments) if self.segments else 0,
            'transcript_source': self.transcript_source,
        }


class PipelineMode(Enum):
    """
    Pipeline processing mode.
    
    INGEST_ONLY: Just index content into RAG, no LLM analysis
    INGEST_WITH_ANALYSIS: Index + optional LLM-based analysis (summary, extraction)
    """
    INGEST_ONLY = "ingest_only"
    INGEST_WITH_ANALYSIS = "ingest_with_analysis"
