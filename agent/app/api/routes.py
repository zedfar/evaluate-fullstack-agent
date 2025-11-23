import os
import shutil
import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas import (
    ChatRequest,
    FileUploadResponse,
    FileDeleteRequest,
    FileDeleteResponse,
    CollectionStatsResponse,
)
from app.services.chat_service import chat_service
from app.services.rag_service import rag_service
from app.services.file_validator import file_validator
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat")
async def chat(request: ChatRequest):
    """Stream chat responses using SSE."""
    return StreamingResponse(
        chat_service.stream_chat(request),
        media_type="text/event-stream",
    )


@router.post("/chat/tools")
async def chat_with_tools(request: ChatRequest):
    """Stream chat responses with tool execution."""
    return StreamingResponse(
        chat_service.stream_chat_with_tools(request),
        media_type="text/event-stream",
    )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: str = Form(...),
    file_id: str = Form(...),
):
    """
    Upload and process a file for RAG.

    Args:
        file: The file to upload
        conversation_id: ID of the conversation
        file_id: Unique identifier for this file

    Returns:
        FileUploadResponse with processing results
    """
    logger.info(
        f"File upload started: {file.filename} (conversation: {conversation_id}, file_id: {file_id})"
    )
    file_path = None  # Initialize to avoid UnboundLocalError

    try:
        # Validate file type
        file_ext = Path(file.filename).suffix.lower().lstrip(".")
        allowed_types = settings.ALLOWED_FILE_TYPES.split(",")

        if file_ext not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file_ext}' not allowed. Allowed types: {', '.join(allowed_types)}",
            )

        # Sanitize filename to prevent path traversal
        safe_filename = Path(file.filename).name

        # Create upload directory if not exists
        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Save file temporarily
        file_path = upload_dir / f"{file_id}_{safe_filename}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size > settings.MAX_FILE_SIZE:
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_FILE_SIZE / 1024 / 1024}MB",
            )

        # SECURITY VALIDATIONS
        validation_result = file_validator.validate_all(
            str(file_path), file_ext, settings.MAX_FILE_SIZE
        )

        if not validation_result['valid']:
            os.remove(file_path)
            logger.warning(f"File validation failed: {validation_result['error']}")
            raise HTTPException(
                status_code=400,
                detail=validation_result['error'],
            )

        # Process and index the file
        chunks_count = rag_service.index_document(
            file_path=str(file_path),
            file_type=file_ext,
            conversation_id=conversation_id,
            file_id=file_id,
            metadata={
                "file_name": file.filename,
                "file_size": file_size,
            },
        )

        # Delete temporary file
        os.remove(file_path)

        logger.info(
            f"File upload successful: {file.filename} - {chunks_count} chunks indexed"
        )

        return FileUploadResponse(
            success=True,
            file_id=file_id,
            chunks_count=chunks_count,
            message=f"File processed successfully. {chunks_count} chunks indexed.",
        )

    except HTTPException:
        logger.warning(f"File upload validation error: {file.filename}")
        raise
    except Exception as e:
        # Clean up on error
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        logger.error(f"File upload failed: {file.filename} - {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}",
        )


@router.post("/delete-file", response_model=FileDeleteResponse)
async def delete_file(request: FileDeleteRequest):
    """
    Delete a file's vectors from the vector store.

    Args:
        request: FileDeleteRequest with conversation_id and file_id

    Returns:
        FileDeleteResponse with success status
    """
    try:
        success = rag_service.delete_file_vectors(
            conversation_id=request.conversation_id,
            file_id=request.file_id,
        )

        if success:
            return FileDeleteResponse(
                success=True,
                message="File vectors deleted successfully",
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete file vectors",
            )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting file: {str(e)}",
        )


@router.get("/collection-stats/{conversation_id}", response_model=CollectionStatsResponse)
async def get_collection_stats(conversation_id: str):
    """
    Get statistics about a conversation's vector collection.

    Args:
        conversation_id: ID of the conversation

    Returns:
        CollectionStatsResponse with collection statistics
    """
    try:
        stats = rag_service.get_collection_stats(conversation_id)

        if not stats:
            raise HTTPException(
                status_code=404,
                detail="Collection not found",
            )

        return CollectionStatsResponse(**stats)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting collection stats: {str(e)}",
        )
