"""
Share routes for public analysis links.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from core.logger import get_logger
from core.share_service import get_share_service, SharedAnalysis
from core.auth_middleware import get_current_user, get_current_user_optional, AuthUser

logger = get_logger(__name__)

router = APIRouter()


class CreateShareRequest(BaseModel):
    """Payload to create a shared analysis link."""
    job_id: Optional[str] = Field(None, description="Job ID to share from current session")
    analysis_id: Optional[str] = Field(None, description="Analysis database ID")
    title: Optional[str] = None
    summary: Optional[str] = None
    action_items: Optional[Any] = None
    key_decisions: Optional[str] = None
    open_questions: Optional[str] = None
    transcript: Optional[str] = None
    segments: Optional[List[Dict[str, Any]]] = None
    transcript_source: Optional[str] = None
    source_type: Optional[str] = "video"
    video_id: Optional[str] = None
    custom_slug: Optional[str] = None


class ShareResponse(BaseModel):
    """Response containing share metadata."""
    slug: str
    share_url: str
    title: str
    created_at: float
    views_count: int


@router.post("/shares", response_model=ShareResponse)
async def create_share_link(
    req: CreateShareRequest,
    request: Request,
    current_user: Optional[AuthUser] = Depends(get_current_user_optional)
):
    """
    Create a public share link for an analysis.
    Works for both logged-in users and guests.
    """
    user_id = current_user.id if current_user else "guest"
    share_service = get_share_service()

    # Collect analysis data: from request or from active progress_store
    data = req.dict(exclude_none=True)

    if req.job_id:
        try:
            from api.routes.analysis import progress_store
            if req.job_id in progress_store:
                job_data = progress_store[req.job_id]
                if job_data.get("result"):
                    res = job_data["result"]
                    for key in ["title", "summary", "action_items", "key_decisions", "open_questions", "transcript", "segments", "transcript_source", "source_type", "video_id"]:
                        if key not in data or not data[key]:
                            data[key] = res.get(key)
        except Exception:
            pass

    if not data.get("title") and not data.get("summary") and not data.get("transcript"):
        raise HTTPException(status_code=400, detail="Cannot share empty analysis data")

    try:
        shared = share_service.create_share(
            analysis_data=data,
            user_id=user_id,
            custom_slug=req.custom_slug
        )

        # Build absolute share URL based on request headers / origin
        origin = request.headers.get("origin") or "http://localhost:5173"
        share_url = f"{origin}/#/share/{shared.slug}"

        return ShareResponse(
            slug=shared.slug,
            share_url=share_url,
            title=shared.title,
            created_at=shared.created_at,
            views_count=shared.views_count
        )
    except Exception as e:
        logger.error(f"Failed to create share link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate share link: {str(e)}")


@router.get("/shares/{slug}")
async def get_shared_analysis(slug: str):
    """
    Retrieve shared analysis by slug.
    Public endpoint: No authentication required.
    """
    share_service = get_share_service()
    shared = share_service.get_share(slug, increment_views=True)

    if not shared or not shared.is_public:
        raise HTTPException(status_code=404, detail="Shared analysis not found or no longer available")

    return shared.to_dict()


@router.get("/shares/user/me")
async def list_my_shares(current_user: AuthUser = Depends(get_current_user)):
    """List all share links created by the current user."""
    share_service = get_share_service()
    shares = share_service.list_user_shares(current_user.id)
    return [s.to_dict() for s in shares]


@router.delete("/shares/{slug}")
async def revoke_share(slug: str, current_user: AuthUser = Depends(get_current_user)):
    """Delete / revoke a public share link."""
    share_service = get_share_service()
    success = share_service.delete_share(slug, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Share link not found or unauthorized")
    return {"status": "success", "message": "Share link revoked"}
