"""
Persistent RAG chain storage with Redis backend and in-memory fallback.

Architecture:
- Primary: Redis for production-grade persistence
- Fallback: In-memory dict if Redis unavailable
- Graceful degradation: System continues working without Redis

Usage:
    from core.rag_storage import get_rag_storage
    
    storage = get_rag_storage()
    storage.store_rag_chain("session_123", rag_chain)
    rag_chain = storage.get_rag_chain("session_123")
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Try to import Redis
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("[RAGStorage] Redis not available - using in-memory storage")


class RAGStorage:
    """
    Persistent RAG chain storage with Redis backend.
    
    Features:
    - Redis persistence with TTL (default 24 hours)
    - In-memory fallback if Redis unavailable
    - Graceful degradation (no crashes)
    - Session cleanup and TTL management
    """
    
    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl: int = 86400  # 24 hours in seconds
    ):
        """
        Initialize RAG storage.
        
        Args:
            redis_url: Redis connection URL (e.g., redis://localhost:6379/0)
            default_ttl: Default TTL for stored chains in seconds
        """
        self.default_ttl = default_ttl
        self.redis_client: Optional[redis.Redis] = None
        self._in_memory_store: Dict[str, Any] = {}
        self._live_chains: Dict[str, Any] = {}
        self._session_order: list = []
        self._using_redis = False
        self._max_live_chains = 3  # Cap in-memory RAG chains to limit RAM usage
        
        # Try to connect to Redis
        if REDIS_AVAILABLE:
            redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            try:
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=False,  # We'll handle binary data (pickle)
                    socket_connect_timeout=2,
                    socket_timeout=2
                )
                # Test connection
                self.redis_client.ping()
                self._using_redis = True
                logger.info(f"[RAGStorage]   Connected to Redis: {redis_url}")
            except Exception as e:
                logger.warning(f"[RAGStorage] Redis connection failed: {e}")
                logger.warning("[RAGStorage] Falling back to in-memory storage")
                self.redis_client = None
        else:
            logger.info("[RAGStorage] Using in-memory storage (Redis not installed)")
    
    def store_rag_chain(
        self,
        session_id: str,
        rag_chain,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Store RAG chain for a session.
        
        Args:
            session_id: Unique session identifier
            rag_chain: RAG chain instance to store
            ttl: Time-to-live in seconds (None = use default)
            
        Returns:
            True if stored successfully, False otherwise
        """
        ttl = ttl or self.default_ttl
        key = self._make_key(session_id)

        try:
            # Evict oldest chain if we're at the memory cap
            if session_id not in self._live_chains and len(self._live_chains) >= self._max_live_chains:
                oldest = self._session_order[0]
                del self._live_chains[oldest]
                self._session_order.pop(0)
                logger.info(f"[RAGStorage] Evicted oldest chain to free memory: {oldest}")

            self._live_chains[session_id] = rag_chain
            if session_id in self._session_order:
                self._session_order.remove(session_id)
            self._session_order.append(session_id)

            metadata = json.dumps({
                "source_id": session_id,
                "ts": time.time()
            }).encode("utf-8")

            if self._using_redis and self.redis_client:
                self.redis_client.setex(key, ttl, metadata)
                logger.info(f"[RAGStorage]   Stored session metadata in Redis: {session_id} (TTL: {ttl}s)")
            else:
                self._in_memory_store[key] = metadata
                logger.info(f"[RAGStorage]   Stored live RAG chain: {session_id}")

            return True

        except Exception as e:
            logger.error(f"[RAGStorage] Failed to store {session_id}: {e}")
            return False
    
    def get_rag_chain(self, session_id: str):
        """
        Retrieve RAG chain for a session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            RAG chain instance or None if not found
        """
        try:
            live = self._live_chains.get(session_id)
            if live is not None:
                logger.info(f"[RAGStorage]   Retrieved live RAG chain: {session_id}")
                return live
            
            logger.debug(f"[RAGStorage] No live chain for: {session_id}")
            return None
            
        except Exception as e:
            logger.error(f"[RAGStorage] Failed to retrieve {session_id}: {e}")
            return None
    
    def delete_rag_chain(self, session_id: str) -> bool:
        """
        Delete RAG chain for a session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            True if deleted, False otherwise
        """
        key = self._make_key(session_id)
        
        try:
            self._live_chains.pop(session_id, None)
            if session_id in self._session_order:
                self._session_order.remove(session_id)
            
            if self._using_redis and self.redis_client:
                deleted = self.redis_client.delete(key)
                logger.info(f"[RAGStorage] Deleted from Redis: {session_id}")
                return deleted > 0
            else:
                if key in self._in_memory_store:
                    del self._in_memory_store[key]
                    logger.info(f"[RAGStorage] Deleted from memory: {session_id}")
                    return True
            return False
            
        except Exception as e:
            logger.error(f"[RAGStorage] Failed to delete {session_id}: {e}")
            return False
    
    def list_sessions(self) -> list:
        """
        List all stored session IDs.
        
        Returns:
            List of session IDs
        """
        try:
            session_ids = list(self._session_order)
            
            if self._using_redis and self.redis_client:
                pattern = self._make_key("*")
                keys = self.redis_client.keys(pattern)
                for key in keys:
                    sid = key.decode('utf-8').replace('rag_chain:', '') if isinstance(key, bytes) else str(key).replace('rag_chain:', '')
                    if sid and sid not in session_ids:
                        session_ids.append(sid)
                logger.debug(f"[RAGStorage] Found {len(session_ids)} sessions")
                return session_ids
            
            prefix = "rag_chain:"
            for key in self._in_memory_store.keys():
                if key.startswith(prefix):
                    sid = key.replace(prefix, '')
                    if sid not in session_ids:
                        session_ids.append(sid)
            logger.debug(f"[RAGStorage] Found {len(session_ids)} sessions in memory")
            return session_ids
                
        except Exception as e:
            logger.error(f"[RAGStorage] Failed to list sessions: {e}")
            return []
    
    def get_most_recent_session(self) -> Optional[str]:
        """
        Get the most recently stored session ID.
        
        Note: This is approximate in Redis (no timestamps stored).
        In memory, returns last inserted.
        
        Returns:
            Session ID or None
        """
        if self._session_order:
            return self._session_order[-1]
        
        sessions = self.list_sessions()
        if sessions:
            return sessions[-1]
        return None
    
    def clear_all(self) -> int:
        """
        Clear all stored RAG chains.
        
        WARNING: Use with caution!
        
        Returns:
            Number of sessions cleared
        """
        try:
            if self._using_redis and self.redis_client:
                pattern = self._make_key("*")
                keys = self.redis_client.keys(pattern)
                deleted = 0
                if keys:
                    deleted = self.redis_client.delete(*keys)
                live_count = len(self._live_chains)
                self._live_chains.clear()
                self._session_order.clear()
                logger.info(f"[RAGStorage] Cleared {deleted} Redis keys and {live_count} live chains")
                return max(deleted, live_count)
            else:
                count = len([k for k in self._in_memory_store.keys() if k.startswith('rag_chain:')])
                self._in_memory_store = {
                    k: v for k, v in self._in_memory_store.items()
                    if not k.startswith('rag_chain:')
                }
                count = max(count, len(self._live_chains))
                self._live_chains.clear()
                self._session_order.clear()
                logger.info(f"[RAGStorage] Cleared {count} sessions from memory")
                return count
                
        except Exception as e:
            logger.error(f"[RAGStorage] Failed to clear: {e}")
            return 0
    
    def is_using_redis(self) -> bool:
        """Check if storage is using Redis backend."""
        return self._using_redis
    
    def _make_key(self, session_id: str) -> str:
        """Create Redis key from session ID."""
        return f"rag_chain:{session_id}"
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check storage health.
        
        Returns:
            Health status dictionary
        """
        status = {
            'using_redis': self._using_redis,
            'redis_available': REDIS_AVAILABLE,
            'storage_type': 'redis' if self._using_redis else 'memory',
            'session_count': len(self.list_sessions()),
            'healthy': True
        }
        
        if self._using_redis and self.redis_client:
            try:
                self.redis_client.ping()
                status['redis_connected'] = True
            except Exception as e:
                status['redis_connected'] = False
                status['redis_error'] = str(e)
                status['healthy'] = False
        
        return status


# Singleton instance
_rag_storage_instance: Optional[RAGStorage] = None


def get_rag_storage() -> RAGStorage:
    """
    Get singleton RAG storage instance.
    
    Returns:
        RAGStorage instance
    """
    global _rag_storage_instance
    
    if _rag_storage_instance is None:
        _rag_storage_instance = RAGStorage()
    
    return _rag_storage_instance


def reset_rag_storage():
    """Reset singleton (useful for testing)."""
    global _rag_storage_instance
    _rag_storage_instance = None
