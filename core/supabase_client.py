"""
Supabase Client Configuration and Initialization.
Provides centralized Supabase client for storage and database operations.
"""

import os
from typing import Optional, Any
from dotenv import load_dotenv

from core.logger import get_logger

logger = get_logger(__name__)

# Load environment variables
load_dotenv()

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = Any
    create_client = None
    logger.warning("[Supabase] supabase-py not installed. Install with: pip install supabase")


class SupabaseClient:
    """
    Singleton Supabase client manager.
    Provides access to Supabase storage and database with proper validation.
    """
    
    _instance: Optional['SupabaseClient'] = None
    _client: Optional[Client] = None
    _initialized: bool = False
    _initialization_error: Optional[str] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize Supabase client (only once)."""
        if not self._initialized:
            self._initialize_client()
            self._initialized = True
    
    def _initialize_client(self):
        """Initialize Supabase client with credentials from environment."""
        if not SUPABASE_AVAILABLE:
            self._initialization_error = "Supabase SDK not installed"
            logger.warning(
                "[Supabase] SDK not available. "
                "Install with: pip install supabase"
            )
            return
        
        # Get credentials from environment
        # Check common variations
        supabase_url = (
            os.getenv("SUPABASE_URL") or 
            os.getenv("SUPABASE_PROJECT_URL")
        )
        supabase_key = (
            os.getenv("SUPABASE_ANON_KEY") or 
            os.getenv("SUPABASE_KEY") or
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        
        # Validate credentials
        url_configured = bool(supabase_url and supabase_url.strip())
        key_configured = bool(supabase_key and supabase_key.strip())
        
        logger.info(f"[Supabase] Configuration check:")
        logger.info(f"  - URL configured: {'Yes' if url_configured else 'No'}")
        logger.info(f"  - API key configured: {'Yes' if key_configured else 'No'}")
        
        if not url_configured or not key_configured:
            missing = []
            if not url_configured:
                missing.append("SUPABASE_URL")
            if not key_configured:
                missing.append("SUPABASE_ANON_KEY")
            
            self._initialization_error = f"Missing credentials: {', '.join(missing)}"
            logger.warning(
                f"[Supabase] Configuration incomplete: {', '.join(missing)} not set in .env"
            )
            logger.info("[Supabase] Supabase features will be disabled")
            logger.info("[Supabase] System will use local file storage as fallback")
            return
        
        # Additional validation
        if not supabase_url.startswith(('http://', 'https://')):
            self._initialization_error = "Invalid URL format"
            logger.error(f"[Supabase] Invalid URL format: must start with http:// or https://")
            return
        
        if len(supabase_key) < 20:
            self._initialization_error = "Invalid API key (too short)"
            logger.error(f"[Supabase] Invalid API key: key appears too short (got {len(supabase_key)} chars, expected 100+)")
            logger.error(f"[Supabase] Please check your SUPABASE_ANON_KEY in .env file")
            logger.error(f"[Supabase] It should be a long JWT token starting with 'eyJ...'")
            return
        
        # Try to initialize client
        try:
            self._client = create_client(supabase_url, supabase_key)
            
            # Log only safe information
            # Mask the URL to show just the project ID
            masked_url = supabase_url
            if 'supabase.co' in supabase_url:
                parts = supabase_url.split('/')
                for i, part in enumerate(parts):
                    if 'supabase.co' in part:
                        project_id = part.split('.')[0].replace('https://', '').replace('http://', '')
                        masked_url = f"https://{project_id[:4]}******.supabase.co"
                        break
            
            logger.info(f"[Supabase] Client initialized successfully")
            logger.info(f"  - Project: {masked_url}")
            logger.info(f"  - Features: Storage, Database, Realtime")
            
        except Exception as e:
            self._initialization_error = str(e)
            error_msg = str(e).lower()
            
            # Provide specific error guidance
            if "invalid api key" in error_msg or "401" in error_msg:
                logger.error(
                    "[Supabase] Invalid API key. "
                    "Please check SUPABASE_ANON_KEY in your .env file"
                )
            elif "not found" in error_msg or "404" in error_msg:
                logger.error(
                    "[Supabase] Project not found. "
                    "Please check SUPABASE_URL in your .env file"
                )
            elif "network" in error_msg or "connection" in error_msg:
                logger.error(
                    "[Supabase] Network error. "
                    "Please check your internet connection"
                )
            else:
                logger.error(f"[Supabase] Failed to initialize: {e}")
            
            self._client = None
    
    @property
    def client(self) -> Optional[Client]:
        """Get Supabase client instance."""
        return self._client
    
    @property
    def is_available(self) -> bool:
        """Check if Supabase client is available and configured."""
        return self._client is not None
    
    @property
    def initialization_error(self) -> Optional[str]:
        """Get initialization error if any."""
        return self._initialization_error
    
    def get_storage(self):
        """Get Supabase storage client."""
        if not self.is_available:
            raise RuntimeError(
                f"Supabase not available: {self._initialization_error or 'Not configured'}"
            )
        return self._client.storage
    
    def get_database(self):
        """Get Supabase database client."""
        if not self.is_available:
            raise RuntimeError(
                f"Supabase not available: {self._initialization_error or 'Not configured'}"
            )
        return self._client


# Global instance
_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """
    Get singleton Supabase client instance.
    
    Returns:
        SupabaseClient instance
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client


def is_supabase_configured() -> bool:
    """
    Check if Supabase is configured and available.
    
    Returns:
        True if Supabase is configured and ready, False otherwise
    """
    client = get_supabase_client()
    return client.is_available


def get_supabase_status() -> dict:
    """
    Get detailed Supabase configuration status.
    
    Returns:
        Dictionary with status information
    """
    client = get_supabase_client()
    
    return {
        "available": client.is_available,
        "sdk_installed": SUPABASE_AVAILABLE,
        "error": client.initialization_error,
        "url_configured": bool(os.getenv("SUPABASE_URL")),
        "key_configured": bool(
            os.getenv("SUPABASE_ANON_KEY") or 
            os.getenv("SUPABASE_KEY") or
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
    }

