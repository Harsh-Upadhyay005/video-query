"""
Global Video Cache - Keyed by YouTube video_id.

Transcripts of public YouTube videos aren't user-specific.
If anyone has already processed a video, reuse the transcript and
vector index instead of redoing the work.

This is the biggest cost and speed win:
- Skip download + Whisper for repeat requests
- Skip embedding for repeat requests
- Return instantly from cache

Storage layers (checked in order):
1. In-memory dict (fastest, lost on restart)
2. Supabase analyses table (persistent, keyed by video_id)
"""

import re
import time
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict
from threading import Lock

from core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class TranscriptSegment:
    """A single timestamped transcript segment."""
    text: str
    start: float  # seconds
    end: float    # seconds


@dataclass
class CachedTranscript:
    """Cached transcript data for a video."""
    video_id: str
    segments: List[Dict[str, Any]]  # [{text, start, end}]
    flat_text: str                   # joined text for backward compat
    transcript_source: str           # 'captions' | 'whisper' | 'sarvam'
    language: str
    title: Optional[str] = None
    duration_seconds: Optional[float] = None
    is_generated: Optional[bool] = None  # True if auto-generated captions
    cached_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-safe dict."""
        return asdict(self)


class VideoCache:
    """
    Global cache for video transcripts, keyed by video_id.
    Thread-safe in-memory cache with optional Supabase persistence.
    """

    def __init__(self):
        self._cache: Dict[str, CachedTranscript] = {}
        self._lock = Lock()
        self._hits = 0
        self._misses = 0
        logger.info("[VideoCache] Initialized")

    def get(self, video_id: str) -> Optional[CachedTranscript]:
        """
        Look up a cached transcript by video_id.

        Checks:
        1. In-memory cache
        2. Supabase analyses table (if configured)

        Args:
            video_id: YouTube video ID (11 chars)

        Returns:
            CachedTranscript or None
        """
        if not video_id:
            return None

        # Check in-memory cache first
        with self._lock:
            if video_id in self._cache:
                self._hits += 1
                logger.info(
                    f"[VideoCache] HIT (memory): {video_id} "
                    f"(hits={self._hits}, misses={self._misses})"
                )
                return self._cache[video_id]

        # Check Supabase
        cached = self._load_from_supabase(video_id)
        if cached:
            # Store in memory for next time
            with self._lock:
                self._cache[video_id] = cached
                self._hits += 1
            logger.info(
                f"[VideoCache] HIT (supabase): {video_id} "
                f"(hits={self._hits}, misses={self._misses})"
            )
            return cached

        with self._lock:
            self._misses += 1
        logger.debug(
            f"[VideoCache] MISS: {video_id} "
            f"(hits={self._hits}, misses={self._misses})"
        )
        return None

    def put(self, cached: CachedTranscript) -> None:
        """
        Store a transcript in the cache.

        Args:
            cached: CachedTranscript to store
        """
        if not cached or not cached.video_id:
            return

        with self._lock:
            self._cache[cached.video_id] = cached

        logger.info(
            f"[VideoCache] STORED: {cached.video_id} "
            f"({len(cached.segments)} segments, "
            f"source={cached.transcript_source})"
        )

        # Persist to Supabase in background (non-blocking)
        self._save_to_supabase(cached)

    def invalidate(self, video_id: str) -> None:
        """Remove a video from the cache."""
        with self._lock:
            self._cache.pop(video_id, None)
        logger.info(f"[VideoCache] INVALIDATED: {video_id}")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            return {
                "size": len(self._cache),
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": (
                    self._hits / (self._hits + self._misses)
                    if (self._hits + self._misses) > 0
                    else 0.0
                ),
            }

    def _load_from_supabase(self, video_id: str) -> Optional[CachedTranscript]:
        """Load cached transcript from Supabase analyses table."""
        try:
            from core.supabase_client import is_supabase_configured, get_supabase_client

            if not is_supabase_configured():
                return None

            client = get_supabase_client()
            db = client.get_database()

            response = (
                db.table("analyses")
                .select("*")
                .eq("video_id", video_id)
                .eq("status", "completed")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            if not response.data:
                return None

            row = response.data[0]
            segments = row.get("transcript") or []

            # If transcript is stored as flat text (legacy), wrap it
            if isinstance(segments, str):
                segments = [{"text": segments, "start": 0.0, "end": 0.0}]

            flat_text = " ".join(seg.get("text", "") for seg in segments)

            return CachedTranscript(
                video_id=video_id,
                segments=segments,
                flat_text=flat_text,
                transcript_source=row.get("transcript_source", "unknown"),
                language=row.get("language", "english"),
                title=row.get("title"),
                duration_seconds=row.get("duration_seconds"),
            )

        except Exception as e:
            logger.debug(f"[VideoCache] Supabase lookup failed: {e}")
            return None

    def _save_to_supabase(self, cached: CachedTranscript) -> None:
        """Persist cached transcript to Supabase analyses table."""
        try:
            from core.supabase_client import is_supabase_configured, get_supabase_client

            if not is_supabase_configured():
                return

            client = get_supabase_client()
            db = client.get_database()

            # Upsert based on video_id (use the most recent entry)
            data = {
                "video_id": cached.video_id,
                "source_type": "youtube",
                "source_ref": f"https://www.youtube.com/watch?v={cached.video_id}",
                "title": cached.title,
                "transcript": cached.segments,
                "transcript_source": cached.transcript_source,
                "language": cached.language,
                "duration_seconds": cached.duration_seconds,
                "status": "completed",
                "user_id": "cache",  # Special user for global cache entries
            }

            db.table("analyses").upsert(
                data, on_conflict="video_id"
            ).execute()

            logger.debug(f"[VideoCache] Saved to Supabase: {cached.video_id}")

        except Exception as e:
            logger.debug(f"[VideoCache] Supabase save failed (non-critical): {e}")


def parse_video_id(url: str) -> Optional[str]:
    """
    Extract YouTube video ID from various URL formats.

    Supports:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube.com/v/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID

    Args:
        url: YouTube URL

    Returns:
        11-character video ID or None
    """
    if not url:
        return None

    patterns = [
        r'(?:v=|/v/|/embed/|/shorts/|youtu\.be/)([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    return None


# Singleton instance
_video_cache: Optional[VideoCache] = None


def get_video_cache() -> VideoCache:
    """Get singleton video cache instance."""
    global _video_cache
    if _video_cache is None:
        _video_cache = VideoCache()
    return _video_cache
