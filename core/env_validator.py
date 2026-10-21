"""
Environment variable validation utility.
Validates all required environment variables on application startup.
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dotenv import load_dotenv
from core.exceptions import ConfigurationError
from core.logger import get_logger

logger = get_logger(__name__)


class EnvValidator:
    """Validates environment variables before application starts."""
    
    # Required environment variables for all configurations
    REQUIRED_VARS = {
        "MISTRAL_API_KEY": {
            "description": "Mistral AI API key for LLM operations",
            "validation": lambda v: len(v) > 10,
            "error": "Must be a valid API key (length > 10 characters)"
        }
    }
    
    # Optional but recommended environment variables
    OPTIONAL_VARS = {
        "SARVAM_API_KEY": {
            "description": "Sarvam AI API key for Hinglish transcription",
            "validation": lambda v: len(v) > 10,
            "error": "Must be a valid API key (length > 10 characters)"
        },
        "ENVIRONMENT": {
            "description": "Application environment (development/staging/production)",
            "validation": lambda v: v.lower() in ["development", "staging", "production"],
            "error": "Must be one of: development, staging, production",
            "default": "development"
        },
        "LOG_LEVEL": {
            "description": "Logging level",
            "validation": lambda v: v.upper() in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
            "error": "Must be one of: DEBUG, INFO, WARNING, ERROR, CRITICAL",
            "default": "INFO"
        },
        "WHISPER_MODEL": {
            "description": "Whisper model size",
            "validation": lambda v: v in ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
            "error": "Must be one of: tiny, base, small, medium, large, large-v2, large-v3",
            "default": "large-v3"
        },
        "GROQ_LLM_MODEL": {
            "description": "Groq chat model name (used when LLM_PROVIDER=groq)",
            "validation": lambda v: len(v) > 0,
            "error": "Must be a non-empty model name",
            "default": "llama-3.3-70b-versatile"
        }
    }
    
    # Numeric environment variables with ranges
    NUMERIC_VARS = {
        "CHUNK_MINUTES": {
            "description": "Audio chunk size in minutes",
            "min": 1,
            "max": 30,
            "default": 10
        },
        "AUDIO_SAMPLE_RATE": {
            "description": "Audio sample rate in Hz",
            "min": 8000,
            "max": 48000,
            "default": 16000
        },
        "AUDIO_CHANNELS": {
            "description": "Number of audio channels",
            "min": 1,
            "max": 2,
            "default": 1
        },
        "MAX_FILE_SIZE_MB": {
            "description": "Maximum file size in MB",
            "min": 1,
            "max": 2000,
            "default": 500
        },
        "MISTRAL_TIMEOUT": {
            "description": "Mistral API timeout in seconds",
            "min": 10,
            "max": 300,
            "default": 60
        },
        "MISTRAL_MAX_RETRIES": {
            "description": "Maximum retries for Mistral API",
            "min": 0,
            "max": 10,
            "default": 3
        },
        "SARVAM_TIMEOUT": {
            "description": "Sarvam API timeout in seconds",
            "min": 10,
            "max": 300,
            "default": 120
        },
        "SARVAM_MAX_RETRIES": {
            "description": "Maximum retries for Sarvam API",
            "min": 0,
            "max": 10,
            "default": 3
        },
        "VECTOR_CHUNK_SIZE": {
            "description": "Vector store chunk size",
            "min": 100,
            "max": 8000,
            "default": 3000
        },
        "VECTOR_CHUNK_OVERLAP": {
            "description": "Vector store chunk overlap",
            "min": 0,
            "max": 1000,
            "default": 300
        },
        "VECTOR_RETRIEVER_K": {
            "description": "Number of documents to retrieve",
            "min": 1,
            "max": 50,
            "default": 20
        },
        "LOG_MAX_FILE_SIZE_MB": {
            "description": "Maximum log file size in MB",
            "min": 1,
            "max": 100,
            "default": 10
        },
        "LOG_BACKUP_COUNT": {
            "description": "Number of log backup files",
            "min": 1,
            "max": 20,
            "default": 5
        }
    }
    
    @staticmethod
    def load_env_file(env_file: str = ".env") -> bool:
        """
        Load environment variables from .env file.
        
        Args:
            env_file: Path to .env file
            
        Returns:
            True if file was loaded, False otherwise
        """
        env_path = Path(env_file)
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"Loaded environment variables from {env_file}")
            return True
        else:
            logger.warning(f"Environment file {env_file} not found")
            return False
    
    @staticmethod
    def validate_required_vars() -> Tuple[bool, List[str]]:
        """
        Validate all required environment variables.
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        # MISTRAL_API_KEY is only required when the LLM provider is Mistral
        # (or unset). When LLM_PROVIDER=groq, Mistral is an optional fallback.
        llm_provider = os.getenv("LLM_PROVIDER", "mistral").lower()

        for var_name, config in EnvValidator.REQUIRED_VARS.items():
            if var_name == "MISTRAL_API_KEY" and llm_provider == "groq":
                continue

            value = os.getenv(var_name)
            
            if not value:
                errors.append(
                    f" {var_name}: REQUIRED but not set\n"
                    f"   Description: {config['description']}"
                )
                continue
            
            # Validate value
            if "validation" in config:
                try:
                    if not config["validation"](value):
                        errors.append(
                            f" {var_name}: Invalid value\n"
                            f"   Error: {config['error']}"
                        )
                except Exception as e:
                    errors.append(
                        f" {var_name}: Validation failed\n"
                        f"   Error: {str(e)}"
                    )
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_optional_vars() -> List[str]:
        """
        Validate optional environment variables and return warnings.
        
        Returns:
            List of warning messages
        """
        warnings = []
        
        for var_name, config in EnvValidator.OPTIONAL_VARS.items():
            value = os.getenv(var_name)
            
            if not value:
                if "default" in config:
                    warnings.append(
                        f"  {var_name}: Not set, using default '{config['default']}'\n"
                        f"   Description: {config['description']}"
                    )
                else:
                    warnings.append(
                        f"  {var_name}: Not set (optional)\n"
                        f"   Description: {config['description']}"
                    )
                continue
            
            # Validate value if present
            if "validation" in config:
                try:
                    if not config["validation"](value):
                        warnings.append(
                            f"  {var_name}: Invalid value '{value}'\n"
                            f"   Error: {config['error']}"
                        )
                except Exception as e:
                    warnings.append(
                        f"  {var_name}: Validation failed\n"
                        f"   Error: {str(e)}"
                    )
        
        return warnings
    
    @staticmethod
    def validate_numeric_vars() -> List[str]:
        """
        Validate numeric environment variables.
        
        Returns:
            List of warning messages
        """
        warnings = []
        
        for var_name, config in EnvValidator.NUMERIC_VARS.items():
            value = os.getenv(var_name)
            
            if not value:
                warnings.append(
                    f"{var_name}: Not set, using default {config['default']}\n"
                    f"   Description: {config['description']}"
                )
                continue
            
            # Try to parse as integer
            try:
                int_value = int(value)
                
                if int_value < config["min"] or int_value > config["max"]:
                    warnings.append(
                        f" {var_name}: Value {int_value} out of range\n"
                        f"   Valid range: {config['min']} - {config['max']}\n"
                        f"   Using default: {config['default']}"
                    )
            except ValueError:
                warnings.append(
                    f"  {var_name}: Invalid integer value '{value}'\n"
                    f"   Using default: {config['default']}"
                )
        
        return warnings
    
    @staticmethod
    def validate_all(env_file: str = ".env", strict: bool = True) -> bool:
        """
        Perform complete environment validation.
        
        Args:
            env_file: Path to .env file
            strict: If True, exit on validation errors; if False, only log
            
        Returns:
            True if all validations passed
            
        Raises:
            ConfigurationError: If strict=True and validation fails
        """
        print("\n" + "=" * 80)
        print(" AI Video Agent - Environment Validation")
        print("=" * 80 + "\n")
        
        # Load .env file
        env_loaded = EnvValidator.load_env_file(env_file)
        if not env_loaded:
            print(f" No .env file found. Using system environment variables.\n")
            print(f" Tip: Copy .env.example to .env and configure your settings.\n")
        
        # Validate required variables
        print(" Validating Required Variables...")
        is_valid, errors = EnvValidator.validate_required_vars()
        
        if errors:
            print("\n" + "\n\n".join(errors) + "\n")
            if strict:
                print("=" * 80)
                print(" Validation Failed: Required environment variables are missing or invalid.")
                print("=" * 80 + "\n")
                raise ConfigurationError(
                    "Required environment variables validation failed. "
                    "Please check your .env file or environment configuration."
                )
        else:
            print("All required variables are set and valid\n")
        
        # Validate optional variables
        print(" Validating Optional Variables...")
        opt_warnings = EnvValidator.validate_optional_vars()
        if opt_warnings:
            print("\n" + "\n\n".join(opt_warnings) + "\n")
        else:
            print("All optional variables are properly configured\n")
        
        # Validate numeric variables
        print(" Validating Numeric Variables...")
        num_warnings = EnvValidator.validate_numeric_vars()
        if num_warnings:
            print("\n" + "\n\n".join(num_warnings) + "\n")
        else:
            print(" All numeric variables are within valid ranges\n")
        
        print("=" * 80)
        if is_valid:
            print(" Environment Validation Complete - Ready to Start")
        else:
            print("  Environment Validation Complete - Some warnings present")
        print("=" * 80 + "\n")
        
        return is_valid
    
    @staticmethod
    def print_env_summary():
        """Print a summary of current environment configuration (without sensitive data)."""
        print("\n" + "=" * 80)
        print(" Current Environment Configuration")
        print("=" * 80)
        
        safe_vars = {
            "ENVIRONMENT": os.getenv("ENVIRONMENT", "development"),
            "LLM_PROVIDER": os.getenv("LLM_PROVIDER", "mistral"),
            "GROQ_LLM_MODEL": os.getenv("GROQ_LLM_MODEL", "llama-3.3-70b-versatile"),
            "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
            "WHISPER_MODEL": os.getenv("WHISPER_MODEL", "small"),
            "WHISPER_DEVICE": os.getenv("WHISPER_DEVICE", "cpu"),
            "MISTRAL_MODEL": os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
            "EMBEDDING_MODEL": os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
            "CHUNK_MINUTES": os.getenv("CHUNK_MINUTES", "10"),
            "SARVAM_API_KEY": "***SET***" if os.getenv("SARVAM_API_KEY") else "NOT SET",
            "MISTRAL_API_KEY": "***SET***" if os.getenv("MISTRAL_API_KEY") else "NOT SET",
        }
        
        for key, value in safe_vars.items():
            print(f"  {key:25} = {value}")
        
        print("=" * 80 + "\n")


def validate_environment(env_file: str = ".env", strict: bool = True) -> bool:
    """
    Convenience function to validate environment.
    
    Args:
        env_file: Path to .env file
        strict: If True, exit on errors
        
    Returns:
        True if validation passed
    """
    return EnvValidator.validate_all(env_file, strict)


