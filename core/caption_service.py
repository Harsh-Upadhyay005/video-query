"""
Caption Service - Fast, free transcript extraction from YouTube captions.

Fetches captions via youtube-transcript-api as the first branch of the pipeline:
1. VideoCache lookup (instant if anyone has processed this video_id before)
2. Manual captions in requested language
3. Auto-generated captions in requested language
4. Fallback languages
5. Quality gate (is_caption_usable) to reject silent/music-only/corrupt captions

If captions are unavailable or fail the quality gate, falls back to Whisper/Sarvam STT.
"""

import re
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field

from core.logger import get_logger
from core.video_cache import get_video_cache, CachedTranscript, parse_video_id

logger = get_logger(__name__)


@dataclass
class CaptionResult:
    """Result of caption extraction."""
    video_id: str
    segments: List[Dict[str, Any]]  # [{text, start, end}]
    flat_text: str
    language: str
    is_generated: bool
    source: str = "captions"  # 'captions'
    duration_seconds: Optional[float] = None
    from_cache: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "segments": self.segments,
            "flat_text": self.flat_text,
            "language": self.language,
            "is_generated": self.is_generated,
            "source": self.source,
            "duration_seconds": self.duration_seconds,
            "from_cache": self.from_cache,
        }


class CaptionService:
    """Service to fetch and validate YouTube captions."""

    def __init__(self):
        self.video_cache = get_video_cache()
        logger.info("[CaptionService] Initialized")

    def fetch_transcript(
        self,
        source: str,
        language: str = "english",
        check_cache: bool = True
    ) -> Optional[CaptionResult]:
        """
        Attempt to fetch captions for a YouTube video.

        Args:
            source: YouTube URL or video ID
            language: Desired language ('english', 'hinglish', 'hindi')
            check_cache: Whether to check video cache first

        Returns:
            CaptionResult if usable captions found, else None
        """
        video_id = parse_video_id(source)
        if not video_id:
            logger.debug(f"[CaptionService] Source is not a YouTube URL/ID: {source}")
            return None

        # 1. Check video cache
        if check_cache:
            cached = self.video_cache.get(video_id)
            if cached:
                logger.info(f"[CaptionService] Cache hit for video_id={video_id} (source={cached.transcript_source})")
                return CaptionResult(
                    video_id=cached.video_id,
                    segments=cached.segments,
                    flat_text=cached.flat_text,
                    language=cached.language,
                    is_generated=cached.is_generated or False,
                    source=cached.transcript_source,
                    duration_seconds=cached.duration_seconds,
                    from_cache=True
                )

        # 2. Try fetching captions via youtube-transcript-api
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from youtube_transcript_api._errors import (
                TranscriptsDisabled,
                NoTranscriptFound,
                VideoUnavailable
            )
        except ImportError:
            logger.warning("[CaptionService] youtube-transcript-api not installed; skipping caption fetch")
            return None

        # Determine language codes to look for
        language_lower = language.lower()
        if "hin" in language_lower:
            lang_codes = ["hi", "hi-Latn", "en", "en-US", "en-GB"]
        else:
            lang_codes = ["en", "en-US", "en-GB", "en-CA", "en-AU", "hi"]

        try:
            ytt = YouTubeTranscriptApi()
            transcript_list = ytt.list(video_id)
            
            selected_transcript = None
            is_generated = False
            chosen_lang = language

            # Priority 1: Manual transcript matching requested language
            try:
                selected_transcript = transcript_list.find_manually_created_transcript(lang_codes)
                is_generated = False
                logger.info(f"[CaptionService] Found manual transcript: {selected_transcript.language_code}")
            except Exception:
                selected_transcript = None

            # Priority 2: Generated transcript matching requested language
            if not selected_transcript:
                try:
                    selected_transcript = transcript_list.find_generated_transcript(lang_codes)
                    is_generated = True
                    logger.info(f"[CaptionService] Found generated transcript: {selected_transcript.language_code}")
                except Exception:
                    selected_transcript = None

            # Priority 3: Any manual transcript
            if not selected_transcript:
                try:
                    for t in transcript_list:
                        if not t.is_generated:
                            selected_transcript = t
                            is_generated = False
                            logger.info(f"[CaptionService] Fallback to manual transcript: {t.language_code}")
                            break
                except Exception:
                    selected_transcript = None

            # Priority 4: Any generated transcript
            if not selected_transcript:
                try:
                    for t in transcript_list:
                        selected_transcript = t
                        is_generated = t.is_generated
                        logger.info(f"[CaptionService] Fallback to any transcript: {t.language_code}")
                        break
                except Exception:
                    selected_transcript = None

            if not selected_transcript:
                logger.info(f"[CaptionService] No transcripts found for video_id={video_id}")
                return None

            chosen_lang = getattr(selected_transcript, "language", language)
            raw_data = selected_transcript.fetch()

            # Format segments and raw text
            segments = []
            flat_parts = []
            max_end = 0.0

            for snippet in raw_data:
                # snippet can be a FetchedTranscriptSnippet or dict
                if hasattr(snippet, "text"):
                    text = snippet.text
                    start = float(snippet.start)
                    duration = float(getattr(snippet, "duration", 0.0))
                else:
                    text = snippet.get("text", "")
                    start = float(snippet.get("start", 0.0))
                    duration = float(snippet.get("duration", 0.0))

                cleaned_line = self._clean_text(text)
                if cleaned_line:
                    end = round(start + duration, 2)
                    segments.append({
                        "text": cleaned_line,
                        "start": round(start, 2),
                        "end": end
                    })
                    flat_parts.append(cleaned_line)
                    if end > max_end:
                        max_end = end

            flat_text = " ".join(flat_parts)

            # 3. Quality gate
            is_usable, reason = self.is_caption_usable(segments, flat_text)
            if not is_usable:
                logger.warning(
                    f"[CaptionService] Captions rejected by quality gate for video_id={video_id}: {reason}. "
                    "Falling back to audio STT pipeline."
                )
                return None

            result = CaptionResult(
                video_id=video_id,
                segments=segments,
                flat_text=flat_text,
                language=chosen_lang,
                is_generated=is_generated,
                source="captions",
                duration_seconds=max_end,
                from_cache=False
            )

            # 4. Save to video cache
            cached_item = CachedTranscript(
                video_id=video_id,
                segments=segments,
                flat_text=flat_text,
                transcript_source="captions",
                language=chosen_lang,
                duration_seconds=max_end,
                is_generated=is_generated
            )
            self.video_cache.put(cached_item)

            logger.info(
                f"[CaptionService] Successfully retrieved usable captions for {video_id}: "
                f"{len(segments)} segments, {len(flat_text)} chars, is_generated={is_generated}"
            )
            return result

        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
            logger.info(f"[CaptionService] YouTube caption unavailable ({type(e).__name__}): {e}")
            return None
        except Exception as e:
            logger.warning(f"[CaptionService] Unexpected error fetching captions for {video_id}: {e}")
            return None

    def is_caption_usable(
        self,
        segments: List[Dict[str, Any]],
        flat_text: str
    ) -> Tuple[bool, str]:
        """
        Quality gate for caption usability.

        Rejects:
        - Empty or too few segments (< 3)
        - Very short transcripts (< 50 chars)
        - Mostly music/applause annotations (e.g. [Music], [Applause])
        - Low information density

        Returns:
            (is_usable: bool, reason: str)
        """
        if not segments or len(segments) < 3:
            return False, f"Too few segments ({len(segments)} < 3)"

        stripped = flat_text.strip()
        if len(stripped) < 50:
            return False, f"Total text too short ({len(stripped)} chars < 50)"

        # Check for music/applause tags
        # Replace bracketed cues like [Music], [Applause], (Music), etc.
        speech_text = re.sub(r'\[.*?\]|\(.*?\)', '', stripped)
        speech_text = re.sub(r'\s+', ' ', speech_text).strip()

        if len(speech_text) < 30:
            return False, "Captions consist almost entirely of non-speech annotations ([Music], etc.)"

        speech_ratio = len(speech_text) / max(len(stripped), 1)
        if speech_ratio < 0.4:
            return False, f"Non-speech tags dominate transcript (speech ratio: {speech_ratio:.2f} < 0.4)"

        words = stripped.split()
        if len(words) < 10:
            return False, f"Too few words ({len(words)} < 10)"

        return True, "Quality checks passed"

    def _clean_text(self, text: str) -> str:
        """Clean individual caption segment text."""
        if not text:
            return ""
        # Remove line breaks inside segment
        cleaned = text.replace("\n", " ").strip()
        # Collapse multiple spaces
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned


# Global singleton instance
_caption_service: Optional[CaptionService] = None


def get_caption_service() -> CaptionService:
    """Get or create singleton CaptionService."""
    global _caption_service
    if _caption_service is None:
        _caption_service = CaptionService()
    return _caption_service
