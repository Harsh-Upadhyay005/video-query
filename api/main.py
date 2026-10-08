"""
FastAPI main application for AI Video Agent.
Production-ready API with proper error handling, logging, and monitoring.
"""

import os
# Prevent OpenMP runtime conflict and tokenizer deadlocks on Windows/multi-threaded servers
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Optional, List, Tuple
import time
import uvicorn

from core.config import ConfigManager
from core.env_validator import validate_environment
from core.health_check import HealthCheck
from core.security import perform_security_check
from core.logger import get_logger
from core.exceptions import AIVideoAgentException
from core.resource_manager import cleanup_on_shutdown
from api.routes import analysis, health, chat, account, share

logger = get_logger(__name__)


def _cors_settings() -> Tuple[List[str], bool]:
    """Return allowed origins and whether credentials are allowed."""
    environment = os.getenv("ENVIRONMENT", "development").lower()
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    )
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]

    # Chrome extensions send "null" or "chrome-extension://<id>" as Origin.
    # FastAPI's CORSMiddleware doesn't support prefix matching, so we allow
    # all origins when any chrome-extension entry is listed, but only in
    # a controlled way — we add the special sentinel "*" only if explicitly
    # requested via CORS_ORIGINS=* or a chrome-extension:// entry is present.
    has_extension = any("chrome-extension" in o for o in origins)

    if environment == "production":
        origins = [o for o in origins if o != "*" and "chrome-extension" not in o]
        if not origins:
            origins = ["http://localhost:5173"]
            logger.warning(
                "CORS_ORIGINS is not set in production; defaulting to http://localhost:5173"
            )
        # Re-add wildcard only when the extension entry was present — this
        # tells FastAPI to allow any origin (the extension's random ID changes
        # per browser install, so we can't list it statically).
        if has_extension:
            origins = ["*"]

    allow_credentials = "*" not in origins
    return origins, allow_credentials


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    
    IMPORTANT: Startup errors are logged but never re-raised so that
    health / ping endpoints remain reachable even when configuration
    is incomplete (e.g. missing API keys on first deploy).
    """
    # Startup
    logger.info("=" * 80)
    logger.info("AI Video Agent API Starting...")
    logger.info("=" * 80)
    
    try:
        # Validate environment (non-strict so missing optional vars don't crash the app)
        logger.info("Validating environment variables...")
        try:
            validate_environment(strict=False)
        except Exception as env_err:
            logger.warning(f"Environment validation issue (non-fatal): {env_err}")
        
        # Initialize configuration
        logger.info("Initializing configuration...")
        try:
            config = ConfigManager.initialize()
            logger.info(f"Running in {config.environment} mode")
        except Exception as cfg_err:
            logger.error(f"Configuration initialization failed (non-fatal): {cfg_err}")
            logger.warning("Some features may be unavailable until configuration is fixed.")
        
        # Run security check - non-fatal, just log warnings
        logger.info("Running security check...")
        try:
            perform_security_check()
        except Exception as sec_err:
            logger.warning(f"Security check warning (non-fatal): {sec_err}")
        
        logger.info("=" * 80)
        logger.info("[OK] AI Video Agent API Ready")
        logger.info("=" * 80)
        
    except Exception as e:
        # Log but do NOT re-raise – this keeps the server alive so that
        # /health and /ping remain accessible for monitoring & debugging.
        logger.error(f"Startup encountered errors (non-fatal): {str(e)}")
        logger.warning("Server is running in degraded mode. Health endpoints are available.")
    
    yield
    
    # Shutdown
    logger.info("=" * 80)
    logger.info("[SHUTDOWN] AI Video Agent API Shutting Down...")
    logger.info("=" * 80)
    
    try:
        cleanup_on_shutdown()
        logger.info("[OK] Shutdown complete")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")


_IS_PRODUCTION = os.getenv("ENVIRONMENT", "development").lower() == "production"

# Create FastAPI application
app = FastAPI(
    title="AI Video Agent API",
    description="Production-ready API for video/audio transcription, summarization, and RAG-based chat",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
    openapi_url=None if _IS_PRODUCTION else "/openapi.json",
)


  
# Middleware Configuration
  

_CORS_ORIGINS, _CORS_CREDENTIALS = _cors_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=_CORS_CREDENTIALS,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# GZip Middleware for response compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests with timing."""
    start_time = time.time()
    
    # Log request
    logger.info(f" {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        logger.info(
            f" {request.method} {request.url.path} "
            f"Status: {response.status_code} "
            f"Duration: {process_time:.3f}s"
        )
        
        # Add timing header
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
        
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f" {request.method} {request.url.path} "
            f"Error: {str(e)} "
            f"Duration: {process_time:.3f}s"
        )
        raise


  
# Exception Handlers
  

@app.exception_handler(AIVideoAgentException)
async def custom_exception_handler(request: Request, exc: AIVideoAgentException):
    """Handle custom application exceptions."""
    logger.error(f"Application error: {exc.message}")
    return JSONResponse(
        status_code=400,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "message": exc.detail
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred. Please try again later."
        }
    )


  
# Include Routers
  

# Include health routes at multiple paths for compatibility
app.include_router(health.router, tags=["Health"])  # /health (root level)
app.include_router(health.router, prefix="/api", tags=["Health"])  # /api/health
app.include_router(health.router, prefix="/api/v1", tags=["Health"])  # /api/v1/health
app.include_router(analysis.router, prefix="/api/v1", tags=["Analysis"])
app.include_router(chat.router, prefix="/api/v1", tags=["Chat"])
app.include_router(account.router, prefix="/api/v1", tags=["Account"])
app.include_router(share.router, prefix="/api/v1", tags=["Share"])


  
# Root Endpoint
  

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "AI Video Agent API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def simple_health():
    """Simple health check endpoint at root level."""
    return {
        "status": "healthy",
        "service": "ai-video-agent",
        "version": "1.0.0"
    }


@app.get("/ping")
async def ping():
    """Simple ping endpoint for connectivity tests."""
    return {"status": "ok", "message": "pong"}


  
# Main Entry Point
  

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Set to True for development
        log_level="info",
        access_log=True
    )
