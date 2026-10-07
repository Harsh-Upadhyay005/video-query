"""
Share Service - Handles public share links for video and document analyses.
Supports memory cache with Supabase persistence, view counting, and slug generation.
"""

import secrets
import time
from typing import Optional, Dict, Any, List
from threading import Lock
from dataclasses import dataclass, field, asdict

from core.logger import get_logger
from core.supabase_client import is_supabase_configured, get_supabase_client

logger = get_logger(__name__)


def generate_slug(length: int = 8) -> str:
    """Generate a URL-safe short slug."""
    # token_urlsafe(6) produces ~8 chars
    slug = secrets.token_urlsafe(length)[:length].replace("-", "").replace("_", "")
    while len(slug) < length:
        slug += secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789")
    return slug


@dataclass
class SharedAnalysis:
    """Shared analysis record."""
    slug: str
    title: str
    created_by: str = "guest"
    analysis_id: Optional[str] = None
    job_id: Optional[str] = None
    summary: Optional[str] = None
    action_items: Optional[Any] = None
    key_decisions: Optional[str] = None
    open_questions: Optional[str] = None
    transcript: Optional[str] = None
    segments: Optional[List[Dict[str, Any]]] = None
    transcript_source: Optional[str] = None
    source_type: str = "video"
    video_id: Optional[str] = None
    views_count: int = 0
    is_public: bool = True
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ShareService:
    """Service to create, retrieve, and manage shared analysis links."""

    def __init__(self):
        self._shares: Dict[str, SharedAnalysis] = {}
        self._lock = Lock()
        logger.info("[ShareService] Initialized")

    def create_share(
        self,
        analysis_data: Dict[str, Any],
        user_id: str = "guest",
        custom_slug: Optional[str] = None
    ) -> SharedAnalysis:
        """
        Create a new share link for an analysis.

        Args:
            analysis_data: Dictionary with analysis fields (title, summary, transcript, etc.)
            user_id: ID of the user creating the share
            custom_slug: Optional preferred slug

        Returns:
            SharedAnalysis object
        """
        slug = custom_slug.strip() if custom_slug else generate_slug(8)

        # Ensure slug is unique in memory
        with self._lock:
            while slug in self._shares:
                slug = generate_slug(8)

            shared = SharedAnalysis(
                slug=slug,
                title=analysis_data.get("title") or "Untitled Analysis",
                created_by=user_id,
                analysis_id=analysis_data.get("analysis_id"),
                job_id=analysis_data.get("job_id"),
                summary=analysis_data.get("summary"),
                action_items=analysis_data.get("action_items"),
                key_decisions=analysis_data.get("key_decisions"),
                open_questions=analysis_data.get("open_questions"),
                transcript=analysis_data.get("transcript"),
                segments=analysis_data.get("segments") or [],
                transcript_source=analysis_data.get("transcript_source"),
                source_type=analysis_data.get("source_type") or analysis_data.get("type") or "video",
                video_id=analysis_data.get("video_id"),
                views_count=0,
                is_public=True
            )
            self._shares[slug] = shared

        logger.info(f"[ShareService] Created share: slug={slug}, title={shared.title}")

        # Persist to Supabase if configured
        self._save_to_supabase(shared)

        return shared

    def get_share(self, slug: str, increment_views: bool = True) -> Optional[SharedAnalysis]:
        """
        Fetch a shared analysis by its slug.

        Args:
            slug: URL slug
            increment_views: Whether to increment the view counter

        Returns:
            SharedAnalysis or None
        """
        # 1. Check in-memory store
        with self._lock:
            if slug in self._shares:
                shared = self._shares[slug]
                if increment_views:
                    shared.views_count += 1
                return shared

        # 2. Check Supabase
        shared = self._load_from_supabase(slug)
        if shared:
            with self._lock:
                if increment_views:
                    shared.views_count += 1
                self._shares[slug] = shared
            if increment_views:
                self._increment_supabase_views(slug)
            return shared

        return None

    def list_user_shares(self, user_id: str) -> List[SharedAnalysis]:
        """List all shares created by a user."""
        shares = []
        with self._lock:
            for s in self._shares.values():
                if s.created_by == user_id:
                    shares.append(s)

        # Also query Supabase if available
        if is_supabase_configured():
            try:
                db = get_supabase_client().get_database()
                res = db.table("shares").select("*").eq("created_by", user_id).order("created_at", desc=True).execute()
                if res.data:
                    existing_slugs = {s.slug for s in shares}
                    for row in res.data:
                        if row.get("slug") not in existing_slugs:
                            shares.append(self._row_to_shared(row))
            except Exception as e:
                logger.warning(f"[ShareService] Failed to list user shares from Supabase: {e}")

        return shares

    def delete_share(self, slug: str, user_id: str) -> bool:
        """Revoke a share link."""
        with self._lock:
            shared = self._shares.get(slug)
            if shared and (shared.created_by == user_id or user_id == "admin"):
                del self._shares[slug]

        if is_supabase_configured():
            try:
                db = get_supabase_client().get_database()
                db.table("shares").delete().eq("slug", slug).eq("created_by", user_id).execute()
                return True
            except Exception as e:
                logger.warning(f"[ShareService] Failed to delete share from Supabase: {e}")

        return True

    def _save_to_supabase(self, shared: SharedAnalysis) -> None:
        """Persist share row to Supabase."""
        if not is_supabase_configured():
            return
        try:
            db = get_supabase_client().get_database()
            data = {
                "slug": shared.slug,
                "title": shared.title,
                "created_by": shared.created_by,
                "analysis_id": shared.analysis_id,
                "job_id": shared.job_id,
                "summary": shared.summary,
                "action_items": shared.action_items,
                "key_decisions": shared.key_decisions,
                "open_questions": shared.open_questions,
                "transcript": shared.transcript,
                "segments": shared.segments,
                "transcript_source": shared.transcript_source,
                "source_type": shared.source_type,
                "video_id": shared.video_id,
                "views_count": shared.views_count,
                "is_public": shared.is_public
            }
            db.table("shares").insert(data).execute()
            logger.info(f"[ShareService] Persisted share to Supabase: {shared.slug}")
        except Exception as e:
            logger.warning(f"[ShareService] Failed to save share to Supabase: {e}")

    def _load_from_supabase(self, slug: str) -> Optional[SharedAnalysis]:
        """Fetch share row from Supabase."""
        if not is_supabase_configured():
            return None
        try:
            db = get_supabase_client().get_database()
            res = db.table("shares").select("*").eq("slug", slug).eq("is_public", True).limit(1).execute()
            if res.data:
                return self._row_to_shared(res.data[0])
            return None
        except Exception as e:
            logger.warning(f"[ShareService] Supabase lookup failed: {e}")
            return None

    def _increment_supabase_views(self, slug: str) -> None:
        """Increment views count in Supabase using an RPC call."""
        if not is_supabase_configured():
            return
        try:
            db = get_supabase_client().get_database()
            db.rpc("increment_share_views", {"share_slug": slug}).execute()
        except Exception:
            # RPC may not exist; fall back to a read-then-write
            try:
                db = get_supabase_client().get_database()
                res = db.table("shares").select("views_count").eq("slug", slug).limit(1).execute()
                if res.data:
                    current = res.data[0].get("views_count", 0) or 0
                    db.table("shares").update({"views_count": current + 1}).eq("slug", slug).execute()
            except Exception:
                pass

    def _row_to_shared(self, row: Dict[str, Any]) -> SharedAnalysis:
        """Convert a Supabase row to SharedAnalysis dataclass."""
        return SharedAnalysis(
            slug=row.get("slug", ""),
            title=row.get("title", ""),
            created_by=row.get("created_by", "guest"),
            analysis_id=row.get("analysis_id"),
            job_id=row.get("job_id"),
            summary=row.get("summary"),
            action_items=row.get("action_items"),
            key_decisions=row.get("key_decisions"),
            open_questions=row.get("open_questions"),
            transcript=row.get("transcript"),
            segments=row.get("segments") or [],
            transcript_source=row.get("transcript_source"),
            source_type=row.get("source_type", "video"),
            video_id=row.get("video_id"),
            views_count=row.get("views_count", 0),
            is_public=row.get("is_public", True)
        )


_share_service_instance: Optional[ShareService] = None


def get_share_service() -> ShareService:
    """Get singleton ShareService instance."""
    global _share_service_instance
    if _share_service_instance is None:
        _share_service_instance = ShareService()
    return _share_service_instance
