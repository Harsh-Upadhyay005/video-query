"""
Supabase Database Manager for Metadata Storage.
Handles file metadata and processing results in Supabase Database.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime

from core.supabase_client import get_supabase_client
from core.logger import get_logger

logger = get_logger(__name__)


class SupabaseDatabaseManager:
    """
    Manages database operations with Supabase.
    Stores file metadata and processing results.
    """
    
    def __init__(self):
        """Initialize database manager."""
        self.client = get_supabase_client()
        
        if not self.client.is_available:
            logger.warning("Supabase not configured. Database operations will fail.")
    
    def save_file_metadata(self, metadata: Dict[str, Any]) -> bool:
        """
        Save file metadata to database.
        
        Args:
            metadata: Dictionary with file metadata
                Required fields: job_id, file_name, file_type, file_size, storage_path
                Optional: language, status, title, summary, duration
                
        Returns:
            True if successful, False otherwise
        """
        if not self.client.is_available:
            logger.warning("Supabase not available, skipping metadata save")
            return False
        
        try:
            # Prepare data
            data = {
                "job_id": metadata["job_id"],
                "file_name": metadata["file_name"],
                "file_type": metadata["file_type"],
                "file_size": metadata["file_size"],
                "storage_path": metadata["storage_path"],
                "language": metadata.get("language"),
                "status": metadata.get("status", "processing"),
                "title": metadata.get("title"),
                "summary": metadata.get("summary"),
                "duration": metadata.get("duration"),
                "created_at": datetime.now().isoformat()
            }
            
            logger.info(f"Saving file metadata to Supabase: {data['job_id']}")
            
            # Insert into database
            db = self.client.get_database()
            response = db.table("file_metadata").insert(data).execute()
            
            logger.info(f"File metadata saved successfully: {data['job_id']}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save file metadata: {e}")
            return False
    
    def update_file_metadata(self, job_id: str, updates: Dict[str, Any]) -> bool:
        """
        Update file metadata in database.
        
        Args:
            job_id: Job identifier
            updates: Dictionary with fields to update
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client.is_available:
            logger.warning("Supabase not available, skipping metadata update")
            return False
        
        try:
            logger.info(f"Updating file metadata: {job_id}")
            
            db = self.client.get_database()
            response = db.table("file_metadata").update(updates).eq("job_id", job_id).execute()
            
            logger.info(f"File metadata updated successfully: {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update file metadata: {e}")
            return False
    
    def save_processing_result(self, job_id: str, result: Dict[str, Any]) -> bool:
        """
        Save processing result to database.
        
        Args:
            job_id: Job identifier
            result: Dictionary with processing results
                Fields: transcript, action_items, key_decisions, open_questions
                
        Returns:
            True if successful, False otherwise
        """
        if not self.client.is_available:
            logger.warning("Supabase not available, skipping result save")
            return False
        
        try:
            data = {
                "job_id": job_id,
                "transcript": result.get("transcript"),
                "action_items": result.get("action_items"),
                "key_decisions": result.get("key_decisions"),
                "open_questions": result.get("open_questions"),
                "created_at": datetime.now().isoformat()
            }
            
            logger.info(f"Saving processing result to Supabase: {job_id}")
            
            db = self.client.get_database()
            response = db.table("processing_results").insert(data).execute()
            
            # Update file metadata status
            self.update_file_metadata(job_id, {
                "status": "completed",
                "processed_at": datetime.now().isoformat()
            })
            
            logger.info(f"Processing result saved successfully: {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save processing result: {e}")
            return False
    
    def get_file_metadata(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve file metadata from database.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Metadata dictionary or None if not found
        """
        if not self.client.is_available:
            return None
        
        try:
            db = self.client.get_database()
            response = db.table("file_metadata").select("*").eq("job_id", job_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get file metadata: {e}")
            return None
    
    def get_processing_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve processing result from database.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Result dictionary or None if not found
        """
        if not self.client.is_available:
            return None
        
        try:
            db = self.client.get_database()
            response = db.table("processing_results").select("*").eq("job_id", job_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get processing result: {e}")
            return None
    
    def list_all_files(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        List all processed files.
        
        Args:
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of file metadata dictionaries
        """
        if not self.client.is_available:
            return []
        
        try:
            db = self.client.get_database()
            response = (
                db.table("file_metadata")
                .select("*")
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            return []
    
    def delete_file_data(self, job_id: str) -> bool:
        """
        Delete all data for a job (metadata and results).
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if successful, False otherwise
        """
        if not self.client.is_available:
            return False
        
        try:
            logger.info(f"Deleting file data: {job_id}")
            
            db = self.client.get_database()
            
            # Delete processing results
            db.table("processing_results").delete().eq("job_id", job_id).execute()
            
            # Delete file metadata
            db.table("file_metadata").delete().eq("job_id", job_id).execute()
            
            logger.info(f"File data deleted successfully: {job_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete file data: {e}")
            return False
    
    def mark_as_failed(self, job_id: str, error_message: str) -> bool:
        """
        Mark a job as failed with error message.
        
        Args:
            job_id: Job identifier
            error_message: Error description
            
        Returns:
            True if successful, False otherwise
        """
        return self.update_file_metadata(job_id, {
            "status": "failed",
            "error": error_message,
            "processed_at": datetime.now().isoformat()
        })

    def save_analysis(self, analysis_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Save or update an analysis record in the analyses table.
        
        Args:
            analysis_data: Dictionary matching analyses table columns
            
        Returns:
            Inserted/updated row dictionary if successful, None otherwise
        """
        if not self.client.is_available:
            return None
        
        try:
            db = self.client.get_database()
            data = {
                "user_id": analysis_data.get("user_id", "guest"),
                "source_type": analysis_data.get("source_type", "youtube"),
                "source_ref": analysis_data.get("source_ref"),
                "video_id": analysis_data.get("video_id"),
                "title": analysis_data.get("title"),
                "transcript": analysis_data.get("transcript"),
                "transcript_source": analysis_data.get("transcript_source"),
                "summary": analysis_data.get("summary"),
                "action_items": analysis_data.get("action_items"),
                "key_decisions": analysis_data.get("key_decisions"),
                "open_questions": analysis_data.get("open_questions"),
                "status": analysis_data.get("status", "completed"),
                "language": analysis_data.get("language", "english"),
                "duration_seconds": analysis_data.get("duration_seconds"),
                "job_id": analysis_data.get("job_id"),
                "updated_at": datetime.now().isoformat()
            }
            if "id" in analysis_data:
                data["id"] = analysis_data["id"]
                
            response = db.table("analyses").upsert(data, on_conflict="job_id").execute()
            if response.data:
                logger.info(f"Saved analysis record for job {analysis_data.get('job_id')}")
                return response.data[0]
            return None
        except Exception as e:
            logger.warning(f"Failed to save analysis record in Supabase: {e}")
            return None

    def get_analysis_by_id(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve an analysis by its UUID."""
        if not self.client.is_available:
            return None
        try:
            db = self.client.get_database()
            response = db.table("analyses").select("*").eq("id", analysis_id).limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.warning(f"Failed to fetch analysis {analysis_id}: {e}")
            return None

    def get_analysis_by_job_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve an analysis by its job_id."""
        if not self.client.is_available:
            return None
        try:
            db = self.client.get_database()
            response = db.table("analyses").select("*").eq("job_id", job_id).limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            logger.warning(f"Failed to fetch analysis for job {job_id}: {e}")
            return None

    def list_user_analyses(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """List analyses for a specific user."""
        if not self.client.is_available:
            return []
        try:
            db = self.client.get_database()
            response = (
                db.table("analyses")
                .select("id, user_id, source_type, source_ref, video_id, title, summary, status, created_at, duration_seconds")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return response.data or []
        except Exception as e:
            logger.warning(f"Failed to list analyses for user {user_id}: {e}")
            return []


# Global instance
_database_manager: Optional[SupabaseDatabaseManager] = None


def get_database_manager() -> SupabaseDatabaseManager:
    """
    Get singleton database manager instance.
    
    Returns:
        SupabaseDatabaseManager instance
    """
    global _database_manager
    if _database_manager is None:
        _database_manager = SupabaseDatabaseManager()
    return _database_manager
