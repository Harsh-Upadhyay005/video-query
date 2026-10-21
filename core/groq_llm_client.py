"""
Groq LLM Client — mirrors core/mistral_client.py for the chat/RAG path.

Uses langchain-groq ChatGroq for text generation.
This file handles LLM (text → reasoning). Groq Whisper STT is in stt_service.py.
"""

import os
import time
import random
from typing import Optional, Any

try:
    from langchain_groq import ChatGroq
    GROQ_AVAILABLE = True
    _GROQ_IMPORT_ERROR = None
except ImportError as e:
    ChatGroq = None
    GROQ_AVAILABLE = False
    _GROQ_IMPORT_ERROR = e

try:
    from groq import RateLimitError as _GroqSDKRateLimitError
except ImportError:
    _GroqSDKRateLimitError = None

from core.logger import get_logger

logger = get_logger(__name__)


class GroqRateLimitError(Exception):
    """Raised when Groq API rate limit is exceeded after all retries."""
    pass


class GroqClient:
    """
    Wrapper for Groq LLM (ChatGroq) with automatic rate limiting and retry logic.
    Mirrors MistralClient interface so it can be used as a drop-in replacement.
    """

    def __init__(
        self,
        model: str = "llama-3.3-70b-versatile",
        temperature: float = 0.3,
        max_retries: int = 5,
        initial_retry_delay: float = 2.0,
        max_retry_delay: float = 60.0,
        timeout: int = 120,
    ):
        if not GROQ_AVAILABLE:
            raise ImportError(
                f"langchain-groq is not installed: {_GROQ_IMPORT_ERROR}. "
                "Install with: pip install langchain-groq==0.1.10"
            )

        self.model = model
        self.temperature = temperature
        self.max_retries = max_retries
        self.initial_retry_delay = initial_retry_delay
        self.max_retry_delay = max_retry_delay
        self.timeout = timeout

        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY not found in environment. "
                "Please set it in your .env file or Render environment."
            )

        logger.info(
            f"[GroqClient] Initialized: model={model}, temp={temperature}, "
            f"max_retries={max_retries}"
        )

    def _get_llm(self, **kwargs) -> "ChatGroq":
        """Create ChatGroq instance with configured parameters."""
        params = {
            "model": self.model,
            "groq_api_key": self.api_key,
            "temperature": self.temperature,
            "timeout": self.timeout,
            "max_retries": 0,  # We handle retries ourselves
        }
        params.update(kwargs)
        return ChatGroq(**params)

    def _calculate_retry_delay(self, attempt: int, retry_after: Optional[float] = None) -> float:
        if retry_after:
            delay = retry_after
        else:
            delay = self.initial_retry_delay * (2 ** attempt)
        delay = min(delay, self.max_retry_delay)
        jitter = delay * 0.25 * (random.random() * 2 - 1)
        return max(0.1, delay + jitter)

    def _is_retryable_error(self, error: Exception) -> bool:
        error_str = str(error).lower()

        non_retryable = ["401", "unauthorized", "403", "forbidden",
                         "invalid api key", "400", "bad request", "invalid_request"]
        for pattern in non_retryable:
            if pattern in error_str:
                return False

        retryable = ["429", "rate limit", "rate_limited", "timeout", "timed out",
                     "503", "service unavailable", "500", "internal server error",
                     "connection", "network"]
        for pattern in retryable:
            if pattern in error_str:
                return True

        if getattr(error, "status_code", None) in (429, 500, 503):
            return True
        if _GroqSDKRateLimitError and isinstance(error, _GroqSDKRateLimitError):
            return True

        return True

    def _extract_retry_after(self, error: Exception) -> Optional[float]:
        response = getattr(error, "response", None)
        if response is not None:
            headers = getattr(response, "headers", {}) or {}
            val = headers.get("Retry-After") or headers.get("retry-after")
            if val:
                try:
                    return float(val)
                except (ValueError, TypeError):
                    pass
        return None

    def invoke_with_retry(
        self,
        chain: Any,
        input_data: Any,
        operation_name: str = "LLM operation",
    ) -> Any:
        """
        Invoke a LangChain chain with automatic retry and backoff.
        Raises GroqRateLimitError after exhausting retries on 429s.
        """
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                if attempt == 0:
                    logger.debug(f"[Groq] {operation_name}: Starting")
                else:
                    logger.info(f"[Groq] {operation_name}: Retry {attempt}/{self.max_retries}")

                result = chain.invoke(input_data)

                if attempt > 0:
                    logger.info(f"[Groq] {operation_name}: Succeeded after {attempt} retries")
                return result

            except Exception as e:
                last_error = e
                error_str = str(e)
                is_retryable = self._is_retryable_error(e)
                is_rate_limit = (
                    "429" in error_str
                    or "rate limit" in error_str.lower()
                    or (_GroqSDKRateLimitError and isinstance(e, _GroqSDKRateLimitError))
                )

                if not is_retryable:
                    logger.error(f"[Groq] {operation_name}: Non-retryable error: {error_str}")
                    raise

                if attempt >= self.max_retries:
                    if is_rate_limit:
                        logger.error(
                            f"[Groq] {operation_name}: Rate limit exceeded after "
                            f"{self.max_retries} retries"
                        )
                        raise GroqRateLimitError(
                            f"Groq API rate limit exceeded after {self.max_retries} retries. "
                            "Please wait a minute and try again."
                        ) from e
                    else:
                        logger.error(
                            f"[Groq] {operation_name}: Failed after {self.max_retries} "
                            f"retries: {error_str}"
                        )
                        raise

                retry_after = self._extract_retry_after(e)
                delay = self._calculate_retry_delay(attempt, retry_after)

                if is_rate_limit:
                    logger.warning(
                        f"[Groq] {operation_name}: Rate limit hit (429). "
                        f"Waiting {delay:.1f}s before retry {attempt + 1}/{self.max_retries}"
                    )
                else:
                    logger.warning(
                        f"[Groq] {operation_name}: Error: {error_str}. "
                        f"Waiting {delay:.1f}s before retry {attempt + 1}/{self.max_retries}"
                    )

                time.sleep(delay)

        raise last_error


# Module-level singleton
_groq_client: Optional[GroqClient] = None


def get_groq_client(
    model: Optional[str] = None,
    temperature: float = 0.3,
    **kwargs,
) -> GroqClient:
    """Get or create the global GroqClient instance."""
    global _groq_client

    if _groq_client is None:
        resolved_model = model or os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile")
        _groq_client = GroqClient(model=resolved_model, temperature=temperature, **kwargs)

    return _groq_client


def get_llm(model: Optional[str] = None, temperature: float = 0.3, **kwargs):
    """Get a ChatGroq instance (parallel to mistral_client.get_llm)."""
    if not GROQ_AVAILABLE:
        return None
    client = get_groq_client(model=model, temperature=temperature, **kwargs)
    return client._get_llm()
