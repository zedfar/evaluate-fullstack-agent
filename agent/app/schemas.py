from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(BaseModel):
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    model_config = {"protected_namespaces": ()}  # Allow 'model_' prefix fields

    messages: List[Message]
    conversation_id: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    model_provider: Optional[str] = None  # 'local', 'claude', or 'openai'
    use_rag: bool = False  # Enable RAG for this request

    # Custom API endpoints for demo mode
    custom_gpt_endpoint: Optional[str] = None
    custom_embedding_endpoint: Optional[str] = None


class ChatResponse(BaseModel):
    content: str
    role: MessageRole = MessageRole.ASSISTANT
    metadata: Optional[Dict[str, Any]] = None


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: List[float]
    dimension: int


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 5


class RAGQueryResponse(BaseModel):
    results: List[Dict[str, Any]]
    context: str


class FileUploadRequest(BaseModel):
    conversation_id: str
    file_id: str
    file_name: str
    file_type: str


class FileUploadResponse(BaseModel):
    success: bool
    file_id: str
    chunks_count: int
    message: str


class FileDeleteRequest(BaseModel):
    conversation_id: str
    file_id: str


class FileDeleteResponse(BaseModel):
    success: bool
    message: str


class CollectionStatsResponse(BaseModel):
    collection_name: str
    vectors_count: int
    points_count: int
    status: str
