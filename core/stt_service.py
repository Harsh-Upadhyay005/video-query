"""
Speech-to-Text Service Abstraction.
Separates STT (audio → text) from LLM (text → reasoning).

This module handles audio transcription using configured STT providers:
- Whisper (local, open-source)
- Sarvam (API, Hindi/Hinglish support)
- Mistral (API, if they offer STT)

IMPORTANT: This is NOT the same as Mistral LLM.
STT converts speech to text.
LLM generates reasoning/answers from text.
"""

import os
from typing import List, Optional, Callable, Protocol, Dict, Any, Tuple
from abc import ABC, abstractmethod
from pathlib import Path
from dataclasses import dataclass, field

from core.logger import get_logger
from core.config import ConfigManager


@dataclass
class STTResult:
    """
    Return type for segment-aware transcription.

    text     — flat joined transcript (backward-compatible)
    segments — [{text, start, end}] timestamped chunks.
               Empty list when the provider does not support timestamps
               (Groq text-only mode, Sarvam).
    """
    text: str
    segments: List[Dict[str, Any]] = field(default_factory=list)

logger = get_logger(__name__)


class STTProvider(Protocol):
    """Protocol for speech-to-text providers."""
    
    def transcribe(self, audio_path: str, language: str = "english") -> str:
        """
        Transcribe audio file to text.
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'english', 'hinglish')
            
        Returns:
            Transcribed text
        """
        ...


class WhisperSTTProvider:
    """
    Whisper-based STT provider (local, high performance).
    Uses faster-whisper (CTranslate2) with int8 quantization and VAD filtering,
    falling back to OpenAI's Whisper if faster-whisper is unavailable.
    """
    
    def __init__(self, model: str = "small"):
        """
        Initialize Whisper STT provider.
        
        Args:
            model: Whisper model size (tiny, base, small, medium, large)
        """
        self.model = model
        self._faster_model = None
        self._legacy_whisper = None
        self._engine = None
        logger.info(f"[WhisperSTT] Initialized with model: {model}")
    
    def _load_model(self):
        """Lazy load high-performance faster-whisper or fallback model."""
        if self._faster_model is not None or self._legacy_whisper is not None:
            return
            
        device = os.getenv("WHISPER_DEVICE", "auto").lower()
        if device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except Exception:
                device = "cpu"
        
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8") if device == "cpu" else "float16"
        threads = min(4, os.cpu_count() or 4)

        # 1. Try faster-whisper (4x-8x faster CTranslate2 engine)
        try:
            from faster_whisper import WhisperModel
            logger.info(
                f"[WhisperSTT] Loading faster-whisper model: {self.model} "
                f"(device={device}, compute_type={compute_type}, threads={threads})"
            )
            self._faster_model = WhisperModel(
                self.model,
                device=device,
                compute_type=compute_type,
                cpu_threads=threads
            )
            self._engine = "faster-whisper"
            logger.info("[WhisperSTT] faster-whisper model loaded successfully")
            return
        except ImportError:
            logger.warning("[WhisperSTT] faster-whisper not installed; falling back to openai-whisper")
        except Exception as e:
            logger.warning(f"[WhisperSTT] faster-whisper initialization failed: {e}; falling back to openai-whisper")

        # 2. Fallback to standard OpenAI Whisper
        try:
            import whisper
            logger.info(f"[WhisperSTT] Loading standard Whisper model: {self.model} on {device}")
            self._legacy_whisper = whisper.load_model(self.model, device=device)
            self._engine = "whisper"
            logger.info("[WhisperSTT] Standard Whisper model loaded successfully")
        except ImportError:
            raise ImportError(
                "Neither faster-whisper nor openai-whisper is installed. "
                "Install with: pip install faster-whisper"
            )
        except Exception as e:
            raise Exception(f"Failed to load Whisper model: {e}")
    
    def transcribe(self, audio_path: str, language: str = "english") -> str:
        """
        Transcribe audio using the fastest available Whisper engine.
        
        Args:
            audio_path: Path to audio file
            language: Language code ('english', 'hinglish', or auto-detect)
            
        Returns:
            Transcribed text
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        logger.info(f"[WhisperSTT] Transcribing: {Path(audio_path).name}")
        self._load_model()
        
        lang_code = "en" if language.lower() == "english" else None

        try:
            if self._engine == "faster-whisper" and self._faster_model is not None:
                # Use faster-whisper with VAD filter to strip silent audio chunks
                segments, info = self._faster_model.transcribe(
                    audio_path,
                    beam_size=1,  # Greedy decoding: 2x faster with minimal accuracy change
                    vad_filter=True,  # Filter out silence before transcription
                    vad_parameters=dict(min_silence_duration_ms=500),
                    language=lang_code
                )
                text = " ".join(seg.text for seg in segments).strip()
            else:
                # Legacy openai-whisper
                options = {"fp16": False} if getattr(self._legacy_whisper, "device", None) == "cpu" else {}
                if lang_code:
                    options["language"] = lang_code
                result = self._legacy_whisper.transcribe(audio_path, **options)
                text = result["text"].strip()
            
            logger.info(f"[WhisperSTT] Transcribed {len(text)} characters ({self._engine})")
            return text
            
        except Exception as e:
            logger.error(f"[WhisperSTT] Transcription failed: {e}")
            raise Exception(f"Whisper transcription failed: {e}")

    def transcribe_with_segments(self, audio_path: str, language: str = "english") -> STTResult:
        """
        Transcribe audio and return both flat text and timestamped segments.

        Only faster-whisper produces real timestamps.
        Legacy openai-whisper falls back to a single segment spanning the whole clip.

        Args:
            audio_path: Path to audio file
            language:   Language hint ('english', 'hinglish', …)

        Returns:
            STTResult with .text and .segments [{text, start, end}]
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info(f"[WhisperSTT] Transcribing with segments: {Path(audio_path).name}")
        self._load_model()

        lang_code = "en" if language.lower() == "english" else None

        try:
            if self._engine == "faster-whisper" and self._faster_model is not None:
                raw_segments, info = self._faster_model.transcribe(
                    audio_path,
                    beam_size=1,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                    language=lang_code,
                )
                seg_dicts = []
                text_parts = []
                for seg in raw_segments:
                    cleaned = seg.text.strip()
                    if cleaned:
                        seg_dicts.append({
                            "text": cleaned,
                            "start": round(float(seg.start), 2),
                            "end": round(float(seg.end), 2),
                        })
                        text_parts.append(cleaned)
                text = " ".join(text_parts)
                logger.info(
                    f"[WhisperSTT] Transcribed {len(text)} chars, "
                    f"{len(seg_dicts)} segments (faster-whisper)"
                )
                return STTResult(text=text, segments=seg_dicts)

            else:
                # Legacy openai-whisper — has segment-level output too
                options: Dict[str, Any] = {"fp16": False} if getattr(self._legacy_whisper, "device", None) == "cpu" else {}
                if lang_code:
                    options["language"] = lang_code
                result = self._legacy_whisper.transcribe(audio_path, **options)
                text = result["text"].strip()
                seg_dicts = []
                for seg in result.get("segments", []):
                    cleaned = seg.get("text", "").strip()
                    if cleaned:
                        seg_dicts.append({
                            "text": cleaned,
                            "start": round(float(seg.get("start", 0.0)), 2),
                            "end": round(float(seg.get("end", 0.0)), 2),
                        })
                if not seg_dicts and text:
                    seg_dicts = [{"text": text, "start": 0.0, "end": 0.0}]
                logger.info(
                    f"[WhisperSTT] Transcribed {len(text)} chars, "
                    f"{len(seg_dicts)} segments (openai-whisper)"
                )
                return STTResult(text=text, segments=seg_dicts)

        except Exception as e:
            logger.error(f"[WhisperSTT] Segment transcription failed: {e}")
            raise Exception(f"Whisper transcription failed: {e}")


class SarvamSTTProvider:
    """
    Sarvam AI STT provider (API-based, Hindi/Hinglish support).
    """
    
    def __init__(self, api_key: str = None, model: str = None):
        """
        Initialize Sarvam STT provider.
        
        Args:
            api_key: Sarvam API key (defaults to env SARVAM_API_KEY)
            model: Sarvam model (defaults to env SARVAM_STT_MODEL)
        """
        self.api_key = api_key or os.getenv("SARVAM_API_KEY")
        self.model = model or os.getenv("SARVAM_STT_MODEL", "saaras:v3")
        
        if not self.api_key:
            raise ValueError(
                "SARVAM_API_KEY not found. Set it in .env file for Hindi/Hinglish support."
            )
        
        logger.info(f"[SarvamSTT] Initialized with model: {self.model}")
    
    def transcribe(self, audio_path: str, language: str = "hinglish") -> str:
        """
        Transcribe audio using Sarvam API.
        
        Args:
            audio_path: Path to audio file
            language: Language code ('hinglish' for Sarvam)
            
        Returns:
            Transcribed text
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        logger.info(f"[SarvamSTT] Transcribing: {Path(audio_path).name}")
        
        try:
            import requests
            
            url = "https://api.sarvam.ai/speech-to-text"
            
            with open(audio_path, 'rb') as audio_file:
                files = {'file': audio_file}
                headers = {'api-subscription-key': self.api_key}
                data = {'model': self.model}
                
                response = requests.post(url, files=files, headers=headers, data=data)
                response.raise_for_status()
                
                result = response.json()
                text = result.get('transcript', '').strip()
                
                logger.info(f"[SarvamSTT] Transcribed {len(text)} characters")
                return text
                
        except ImportError:
            raise ImportError("requests library required. Install with: pip install requests")
        except Exception as e:
            logger.error(f"[SarvamSTT] Transcription failed: {e}")
            raise Exception(f"Sarvam transcription failed: {e}")


class GroqSTTProvider:
    """
    Groq Whisper STT provider (API-based, ultra-fast Whisper Large v3-turbo).
    Uses Groq's cloud infrastructure for blazing-fast transcription.
    """
    
    def __init__(self, api_key: str = None, model: str = None):
        """
        Initialize Groq STT provider.
        
        Args:
            api_key: Groq API key (defaults to env GROQ_API_KEY)
            model: Groq Whisper model (defaults to whisper-large-v3-turbo)
        """
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model or os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
        
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY not found. Set it in .env file for Groq Whisper support."
            )
        
        logger.info(f"[GroqSTT] Initialized with model: {self.model}")
    
    GROQ_MAX_FILE_BYTES = 24 * 1024 * 1024  # 24 MB (Groq limit is 25 MB)

    def transcribe(self, audio_path: str, language: str = "en") -> str:
        """
        Transcribe audio using Groq Whisper API.
        Automatically splits files >24 MB into smaller chunks.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        file_size = os.path.getsize(audio_path)
        logger.info(
            f"[GroqSTT] Transcribing with {self.model}: "
            f"{Path(audio_path).name} ({file_size / 1024 / 1024:.1f} MB)"
        )

        if file_size > self.GROQ_MAX_FILE_BYTES:
            logger.info(
                f"[GroqSTT] File exceeds 24 MB — splitting into chunks before sending to Groq"
            )
            return self._transcribe_large_file(audio_path, language)

        return self._transcribe_single(audio_path, language)

    def _transcribe_single(self, audio_path: str, language: str) -> str:
        """Send one file to Groq and return the transcript text."""
        try:
            from groq import Groq

            client = Groq(api_key=self.api_key)
            with open(audio_path, "rb") as f:
                transcription = client.audio.transcriptions.create(
                    file=(Path(audio_path).name, f.read()),
                    model=self.model,
                    language=language if language != "english" else "en",
                    response_format="text",
                    temperature=0.0,
                )
            text = transcription.strip() if isinstance(transcription, str) else transcription.text.strip()
            logger.info(f"[GroqSTT] Transcribed {len(text)} characters")
            return text

        except ImportError:
            raise ImportError("groq library required. Install with: pip install groq")
        except Exception as e:
            logger.error(f"[GroqSTT] Transcription failed: {e}")
            raise Exception(f"Groq Whisper transcription failed: {e}")

    def _transcribe_large_file(self, audio_path: str, language: str) -> str:
        """Split a large audio file into ≤24 MB WAV chunks and transcribe each."""
        import tempfile
        import math

        try:
            from pydub import AudioSegment
        except ImportError:
            logger.warning("[GroqSTT] pydub not available — falling back to single-file transcription")
            return self._transcribe_single(audio_path, language)

        audio = AudioSegment.from_file(audio_path)
        total_ms = len(audio)
        file_size = os.path.getsize(audio_path)

        # Calculate chunk duration so each chunk stays under 24 MB
        bytes_per_ms = file_size / total_ms
        chunk_ms = int((self.GROQ_MAX_FILE_BYTES / bytes_per_ms) * 0.9)  # 10% safety margin
        chunk_ms = max(chunk_ms, 30_000)  # minimum 30 seconds per chunk

        num_chunks = math.ceil(total_ms / chunk_ms)
        logger.info(f"[GroqSTT] Splitting into {num_chunks} chunks of ~{chunk_ms // 1000}s each")

        transcripts = []
        with tempfile.TemporaryDirectory() as tmp:
            for i in range(num_chunks):
                start = i * chunk_ms
                end = min(start + chunk_ms, total_ms)
                chunk = audio[start:end]

                chunk_path = os.path.join(tmp, f"chunk_{i}.wav")
                chunk.export(chunk_path, format="wav",
                             parameters=["-ar", "16000", "-ac", "1"])

                logger.info(f"[GroqSTT] Transcribing chunk {i + 1}/{num_chunks}")
                text = self._transcribe_single(chunk_path, language)
                if text:
                    transcripts.append(text)

        return " ".join(transcripts)


class STTService:
    """
    Unified Speech-to-Text service.
    Routes to appropriate provider based on language and configuration.
    """
    
    def __init__(self):
        """Initialize STT service with configured providers."""
        try:
            from core.config import get_config
            self.config = get_config()
        except Exception:
            # If config not initialized, it's okay - providers will handle their own config
            self.config = None
        
        # Initialize providers
        self.whisper_provider = None
        self.sarvam_provider = None
        self.groq_provider = None
        
        # Check which STT provider to use (priority: Groq > Whisper > Sarvam)
        self.stt_provider_type = os.getenv("STT_PROVIDER", "whisper").lower()
        
        logger.info(f"[STTService] Initialized with provider: {self.stt_provider_type}")
    
    def _get_whisper_provider(self) -> WhisperSTTProvider:
        """Lazy initialize Whisper provider."""
        if self.whisper_provider is None:
            model = os.getenv("WHISPER_MODEL", "small")
            self.whisper_provider = WhisperSTTProvider(model=model)
        return self.whisper_provider
    
    def _get_sarvam_provider(self) -> SarvamSTTProvider:
        """Lazy initialize Sarvam provider."""
        if self.sarvam_provider is None:
            self.sarvam_provider = SarvamSTTProvider()
        return self.sarvam_provider
    
    def _get_groq_provider(self) -> GroqSTTProvider:
        """Lazy initialize Groq provider."""
        if self.groq_provider is None:
            self.groq_provider = GroqSTTProvider()
        return self.groq_provider
    
    def transcribe(
        self, 
        audio_path: str, 
        language: str = "english",
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> str:
        """
        Transcribe audio file to text using appropriate provider.
        Returns flat text string (backward-compatible).
        For timestamped segments use transcribe_with_segments().
        """
        return self.transcribe_with_segments(audio_path, language, progress_callback).text

    def transcribe_with_segments(
        self,
        audio_path: str,
        language: str = "english",
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> STTResult:
        """
        Transcribe audio and return STTResult with .text and .segments.

        Segments are [{text, start, end}] when the provider supports timestamps
        (local faster-whisper / openai-whisper).  Groq and Sarvam return an
        empty segments list because their API responses are text-only.

        Args:
            audio_path: Path to audio file
            language:   Language ('english', 'hinglish', etc.)
            progress_callback: Optional callback(stage, message)

        Returns:
            STTResult
        """
        logger.info(f"[STTService] Transcribing audio: language={language}, provider={self.stt_provider_type}")

        if progress_callback:
            progress_callback("stt", f"Transcribing audio ({language})...")

        # Groq — text-only, no segment timestamps
        if self.stt_provider_type == "groq":
            try:
                provider = self._get_groq_provider()
                lang_code = "en" if language.lower() == "english" else language[:2]
                text = provider.transcribe(audio_path, lang_code)
                if progress_callback:
                    progress_callback("stt", "Transcription complete (Groq Whisper)")
                return STTResult(text=text, segments=[])
            except Exception as e:
                logger.warning(f"[STTService] Groq failed, falling back to Whisper: {e}")
                provider = self._get_whisper_provider()
                result = provider.transcribe_with_segments(audio_path, language)
                if progress_callback:
                    progress_callback("stt", "Transcription complete (Whisper fallback)")
                return result

        # Hindi / Hinglish → Sarvam (text-only, no timestamps)
        if language.lower() in ['hinglish', 'hindi']:
            try:
                provider = self._get_sarvam_provider()
                text = provider.transcribe(audio_path, language)
                if progress_callback:
                    progress_callback("stt", "Transcription complete (Sarvam)")
                return STTResult(text=text, segments=[])
            except Exception as e:
                logger.warning(f"[STTService] Sarvam failed, falling back to Whisper: {e}")
                provider = self._get_whisper_provider()
                result = provider.transcribe_with_segments(audio_path, language)
                if progress_callback:
                    progress_callback("stt", "Transcription complete (Whisper fallback)")
                return result

        # Default → local Whisper (produces timestamps)
        provider = self._get_whisper_provider()
        result = provider.transcribe_with_segments(audio_path, language)
        if progress_callback:
            progress_callback("stt", "Transcription complete (Whisper)")
        return result
    
    def transcribe_multiple(
        self,
        audio_paths: List[str],
        language: str = "english",
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> str:
        """Transcribe multiple chunks and return combined flat text (backward-compatible)."""
        return self.transcribe_multiple_with_segments(audio_paths, language, progress_callback).text

    def transcribe_multiple_with_segments(
        self,
        audio_paths: List[str],
        language: str = "english",
        progress_callback: Optional[Callable[[str, str], None]] = None
    ) -> STTResult:
        """
        Transcribe multiple audio chunks in parallel and return STTResult.

        Segments from each chunk are offset-adjusted so their timestamps
        are relative to the beginning of the full audio, not each chunk.
        Offset is estimated from the cumulative character count (approximate)
        unless the provider returns real timestamps, in which case the real
        end-time of the previous chunk is used.

        Args:
            audio_paths: Ordered list of audio chunk file paths
            language:    Language for transcription
            progress_callback: Optional callback(stage, message)

        Returns:
            STTResult with merged text and offset-corrected segments
        """
        if not audio_paths:
            return STTResult(text="", segments=[])

        if len(audio_paths) == 1:
            return self.transcribe_with_segments(audio_paths[0], language, progress_callback)

        total = len(audio_paths)
        logger.info(f"[STTService] Transcribing {total} audio chunks (with segments)")

        # Pre-load model before spawning threads
        if self.stt_provider_type == "groq":
            self._get_groq_provider()
        elif language.lower() not in ['hinglish', 'hindi']:
            provider = self._get_whisper_provider()
            provider._load_model()

        import threading
        from concurrent.futures import ThreadPoolExecutor, as_completed

        completed_count = [0]
        lock = threading.Lock()
        results: Dict[int, STTResult] = {}

        def _transcribe_indexed(idx: int, path: str) -> None:
            res = self.transcribe_with_segments(path, language, progress_callback=None)
            with lock:
                results[idx] = res
                completed_count[0] += 1
                if progress_callback:
                    progress_callback("stt", f"Transcribing chunk {completed_count[0]}/{total}...")

        with ThreadPoolExecutor(max_workers=min(3, total)) as executor:
            futures = [executor.submit(_transcribe_indexed, i, p) for i, p in enumerate(audio_paths)]
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    logger.error(f"[STTService] Chunk transcription failed: {e}")

        # Merge in order, adjusting segment timestamps per chunk
        all_segments: List[Dict[str, Any]] = []
        text_parts: List[str] = []
        time_offset = 0.0

        for i in range(total):
            if i not in results or not results[i].text:
                continue
            chunk = results[i]
            text_parts.append(chunk.text)

            if chunk.segments:
                for seg in chunk.segments:
                    all_segments.append({
                        "text": seg["text"],
                        "start": round(seg["start"] + time_offset, 2),
                        "end":   round(seg["end"]   + time_offset, 2),
                    })
                # Advance offset by actual last segment end time
                time_offset = all_segments[-1]["end"] if all_segments else time_offset
            else:
                # No timestamps — leave segments empty for this chunk
                time_offset = 0.0  # can't accumulate without real times

        combined_text = "\n\n".join(text_parts)
        logger.info(
            f"[STTService] Combined: {len(combined_text)} chars, "
            f"{len(all_segments)} segments ({total} chunks)"
        )

        if progress_callback:
            progress_callback("stt", f"Transcription complete ({total} chunks)")

        return STTResult(text=combined_text, segments=all_segments)


# Singleton instance
_stt_service_instance = None


def get_stt_service() -> STTService:
    """
    Get singleton STT service instance.
    
    Returns:
        STTService instance
    """
    global _stt_service_instance
    
    if _stt_service_instance is None:
        _stt_service_instance = STTService()
    
    return _stt_service_instance
