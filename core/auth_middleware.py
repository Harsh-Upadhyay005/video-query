"""
Authentication Middleware for FastAPI
Validates Supabase JWT tokens and extracts user information
"""

import os
from typing import Optional
from fastapi import Header
from jose import jwt, JWTError
from dotenv import load_dotenv

from core.logger import get_logger

logger = get_logger(__name__)

load_dotenv()

# Get Supabase JWT secret from environment
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")


class AuthUser:
    """Represents an authenticated user from JWT token"""
    
    def __init__(self, user_id: str, email: Optional[str] = None, role: str = "authenticated"):
        self.id = user_id
        self.email = email
        self.role = role
    
    def __repr__(self):
        return f"AuthUser(id={self.id}, email={self.email}, role={self.role})"


def get_current_user_optional(
    authorization: Optional[str] = Header(None)
) -> Optional[AuthUser]:
    """
    Extract user from JWT token if present.
    Returns None if no token or invalid token.
    Use this for endpoints that work with or without authentication.
    """
    if not authorization:
        return None
    
    if not SUPABASE_JWT_SECRET:
        logger.warning("SUPABASE_JWT_SECRET not configured. Auth validation disabled.")
        return None
    
    try:
        # Extract token from "Bearer <token>" format
        if not authorization.startswith("Bearer "):
            logger.debug("Authorization header doesn't start with 'Bearer '")
            return None
        
        token = authorization.replace("Bearer ", "")
        
        # Decode and validate JWT
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256", "HS384", "HS512"],
            options={"verify_aud": False}  # Supabase tokens vary in audience claim
        )
        
        # Extract user information
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role", "authenticated")
        
        if not user_id:
            logger.warning("JWT token missing 'sub' claim")
            return None
        
        logger.debug(f"Authenticated user: {user_id} ({email})")
        return AuthUser(user_id=user_id, email=email, role=role)
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Error validating JWT: {e}")
        return None


def get_current_user(
    authorization: Optional[str] = Header(None)
) -> AuthUser:
    """
    Authentication is optional. Requests without a token run as a guest user
    so analysis and chat stay available without a login videoQuery.
    """
    optional = get_current_user_optional(authorization)
    if optional:
        return optional
    return AuthUser(user_id="guest", email=None, role="anonymous")


def verify_supabase_config() -> bool:
    """
    Verify Supabase authentication is properly configured.
    Returns True if configured, False otherwise.
    """
    if not SUPABASE_JWT_SECRET:
        logger.warning(
            "SUPABASE_JWT_SECRET not set. "
            "Authentication will not work. "
            "Please set SUPABASE_JWT_SECRET in .env file."
        )
        return False
    
    if not SUPABASE_URL:
        logger.warning("SUPABASE_URL not set in environment")
        return False
    
    logger.info("Supabase authentication configured successfully")
    return True
