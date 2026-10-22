"""
Configuration management for the AI Video Agent application.
Centralizes all configuration settings and supports multiple environments.
"""

import os
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from dotenv import load_dotenv
from core.exceptions import ConfigurationError
from core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class AudioConfig:
    """Audio processing configuration."""
    download_dir: str = "downloads"
    chunk_minutes: int = 10
    sample_rate: int = 16000
    channels: int = 1
    max_file_size_mb: int = 500
    
    def __post_init__(self):
        """Ensure download directory exists."""
        Path(self.download_dir).mkdir(parents=True, exist_ok=True)


@dataclass
class WhisperConfig:
    """Whisper transcription configuration."""
    model_name: str = "small"  # tiny, base, small, medium, large
    device: str = "cpu"  # cpu or cuda
    compute_type: str = "int8"  # int8, float16, float32
    
    @property
    def valid_models(self):
        return ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"]
    
    def __post_init__(self):
        if self.model_name not in self.valid_models:
            raise ConfigurationError(
                f"Invalid Whisper model: {self.model_name}. "
                f"Valid options: {', '.join(self.valid_models)}"
            )


@dataclass
class SarvamConfig:
    """Sarvam AI API configuration."""
    api_key: str
    base_url: str = "https://api.sarvam.ai"
    stt_translate_endpoint: str = "/speech-to-text-translate"
    model: str = "saaras:v2.5"
    piece_seconds: int = 25  # Max audio length per API call
    timeout: int = 120
    max_retries: int = 3
    
    def __post_init__(self):
        if not self.api_key or self.api_key == "":
            raise ConfigurationError("SARVAM_API_KEY is required but not set")


@dataclass
class MistralConfig:
    """Mistral AI API configuration."""
    api_key: str
    model: str = "mistral-small-latest"
    temperature: float = 0.3
    max_tokens: int = 4096
    timeout: int = 60
    max_retries: int = 3
    
    def __post_init__(self):
        if not self.api_key or self.api_key == "":
            raise ConfigurationError("MISTRAL_API_KEY is required but not set")
        if not 0.0 <= self.temperature <= 1.0:
            raise ConfigurationError(
                f"Temperature must be between 0.0 and 1.0, got {self.temperature}"
            )


@dataclass
class VectorStoreConfig:
    """Vector store configuration."""
    persist_directory: str = "vector_db"
    collection_name: str = "meeting_transcript"
    embedding_model: str = "all-MiniLM-L6-v2"
    chunk_size: int = 500
    chunk_overlap: int = 50
    retriever_k: int = 4  # Number of documents to retrieve
    device: str = "cpu"
    
    def __post_init__(self):
        """Ensure vector store directory exists."""
        Path(self.persist_directory).mkdir(parents=True, exist_ok=True)


@dataclass
class LoggingConfig:
    """Logging configuration."""
    level: str = "INFO"
    log_dir: str = "logs"
    max_file_size_mb: int = 10
    backup_count: int = 5
    
    @property
    def max_bytes(self):
        return self.max_file_size_mb * 1024 * 1024
    
    def __post_init__(self):
        """Ensure log directory exists."""
        Path(self.log_dir).mkdir(parents=True, exist_ok=True)
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if self.level.upper() not in valid_levels:
            raise ConfigurationError(
                f"Invalid log level: {self.level}. Valid options: {', '.join(valid_levels)}"
            )


@dataclass
class AppConfig:
    """Main application configuration."""
    environment: str = "development"  # development, staging, production
    debug: bool = False
    audio: AudioConfig = field(default_factory=AudioConfig)
    whisper: WhisperConfig = field(default_factory=WhisperConfig)
    sarvam: Optional[SarvamConfig] = None
    mistral: Optional[MistralConfig] = None
    groq_llm_model: str = "openai/gpt-oss-20b"
    vector_store: VectorStoreConfig = field(default_factory=VectorStoreConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    
    # Supported languages
    supported_languages: list = field(default_factory=lambda: ["english", "hinglish"])
    
    def __post_init__(self):
        """Validate environment."""
        valid_envs = ["development", "staging", "production"]
        if self.environment not in valid_envs:
            raise ConfigurationError(
                f"Invalid environment: {self.environment}. Valid options: {', '.join(valid_envs)}"
            )
        
        # Set debug based on environment
        if self.environment == "production":
            self.debug = False
    
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"
    
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"


class ConfigManager:
    """Singleton configuration manager."""
    
    _instance: Optional[AppConfig] = None
    _initialized: bool = False
    
    @classmethod
    def initialize(cls, env_file: str = ".env") -> AppConfig:
        """
        Initialize configuration from environment variables.
        
        Args:
            env_file: Path to .env file
            
        Returns:
            Initialized AppConfig instance
            
        Raises:
            ConfigurationError: If required configuration is missing or invalid
        """
        if cls._initialized:
            logger.warning("ConfigManager already initialized, returning existing instance")
            return cls._instance
        
        # Load environment variables
        env_path = Path(env_file)
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"Loaded environment variables from {env_file}")
        else:
            logger.warning(f"Environment file {env_file} not found, using system environment variables")
        
        try:
            # Get environment
            environment = os.getenv("ENVIRONMENT", "development").lower()
            debug = os.getenv("DEBUG", "false").lower() in ["true", "1", "yes"]
            
            # Audio config
            audio = AudioConfig(
                download_dir=os.getenv("DOWNLOAD_DIR", "downloads"),
                chunk_minutes=int(os.getenv("CHUNK_MINUTES", "10")),
                sample_rate=int(os.getenv("AUDIO_SAMPLE_RATE", "16000")),
                channels=int(os.getenv("AUDIO_CHANNELS", "1")),
                max_file_size_mb=int(os.getenv("MAX_FILE_SIZE_MB", "500"))
            )
            
            # Whisper config
            whisper = WhisperConfig(
                model_name=os.getenv("WHISPER_MODEL", "small"),
                device=os.getenv("WHISPER_DEVICE", "cpu"),
                compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8")
            )
            
            # Sarvam config (optional, only needed for hinglish)
            sarvam = None
            sarvam_api_key = os.getenv("SARVAM_API_KEY")
            if sarvam_api_key:
                sarvam = SarvamConfig(
                    api_key=sarvam_api_key,
                    model=os.getenv("SARVAM_STT_MODEL", "saaras:v2.5"),
                    timeout=int(os.getenv("SARVAM_TIMEOUT", "120")),
                    max_retries=int(os.getenv("SARVAM_MAX_RETRIES", "3"))
                )
                logger.info("Sarvam AI configuration loaded")
            else:
                logger.warning("SARVAM_API_KEY not set - Hinglish transcription will not be available")
            
            # Mistral config (required when LLM_PROVIDER is mistral or unset;
            # optional fallback when LLM_PROVIDER is groq)
            llm_provider = os.getenv("LLM_PROVIDER", "mistral").lower()
            mistral_api_key = os.getenv("MISTRAL_API_KEY")
            mistral = None
            if llm_provider != "groq":
                if not mistral_api_key:
                    raise ConfigurationError(
                        "MISTRAL_API_KEY is required. Please set it in your .env file or environment."
                    )
                mistral = MistralConfig(
                    api_key=mistral_api_key,
                    model=os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
                    temperature=float(os.getenv("MISTRAL_TEMPERATURE", "0.3")),
                    max_tokens=int(os.getenv("MISTRAL_MAX_TOKENS", "4096")),
                    timeout=int(os.getenv("MISTRAL_TIMEOUT", "60")),
                    max_retries=int(os.getenv("MISTRAL_MAX_RETRIES", "3"))
                )
            else:
                # Groq is the primary LLM; keep Mistral as a fallback only if configured
                if mistral_api_key:
                    mistral = MistralConfig(
                        api_key=mistral_api_key,
                        model=os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
                        temperature=float(os.getenv("MISTRAL_TEMPERATURE", "0.3")),
                        max_tokens=int(os.getenv("MISTRAL_MAX_TOKENS", "4096")),
                        timeout=int(os.getenv("MISTRAL_TIMEOUT", "60")),
                        max_retries=int(os.getenv("MISTRAL_MAX_RETRIES", "3"))
                    )
                else:
                    logger.info(
                        "LLM_PROVIDER=groq: MISTRAL_API_KEY not set; "
                        "Mistral fallback disabled"
                    )

            # Groq LLM model name (used by core.groq_llm_client via env, mirrored here)
            groq_llm_model = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-20b")
            
            # Vector store config
            vector_store = VectorStoreConfig(
                persist_directory=os.getenv("VECTOR_DB_DIR", "vector_db"),
                collection_name=os.getenv("VECTOR_COLLECTION_NAME", "meeting_transcript"),
                embedding_model=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
                chunk_size=int(os.getenv("VECTOR_CHUNK_SIZE", "500")),
                chunk_overlap=int(os.getenv("VECTOR_CHUNK_OVERLAP", "50")),
                retriever_k=int(os.getenv("VECTOR_RETRIEVER_K", "4")),
                device=os.getenv("EMBEDDING_DEVICE", "cpu")
            )
            
            # Logging config
            logging_config = LoggingConfig(
                level=os.getenv("LOG_LEVEL", "INFO"),
                log_dir=os.getenv("LOG_DIR", "logs"),
                max_file_size_mb=int(os.getenv("LOG_MAX_FILE_SIZE_MB", "10")),
                backup_count=int(os.getenv("LOG_BACKUP_COUNT", "5"))
            )
            
            # Create main config
            cls._instance = AppConfig(
                environment=environment,
                debug=debug,
                audio=audio,
                whisper=whisper,
                sarvam=sarvam,
                mistral=mistral,
                groq_llm_model=groq_llm_model,
                vector_store=vector_store,
                logging=logging_config
            )
            
            cls._initialized = True
            logger.info(f"Configuration initialized for {environment} environment")
            
            return cls._instance
            
        except Exception as e:
            logger.error(f"Failed to initialize configuration: {str(e)}")
            raise ConfigurationError(f"Configuration initialization failed: {str(e)}")
    
    @classmethod
    def get_config(cls) -> AppConfig:
        """
        Get the current configuration instance.
        
        Returns:
            Current AppConfig instance
            
        Raises:
            ConfigurationError: If configuration hasn't been initialized
        """
        if not cls._initialized or cls._instance is None:
            raise ConfigurationError(
                "Configuration not initialized. Call ConfigManager.initialize() first."
            )
        return cls._instance
    
    @classmethod
    def reset(cls):
        """Reset configuration (useful for testing)."""
        cls._instance = None
        cls._initialized = False
        logger.info("Configuration reset")


# Convenience function
def get_config() -> AppConfig:
    """Get the application configuration."""
    return ConfigManager.get_config()
