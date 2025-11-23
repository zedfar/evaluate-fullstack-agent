from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None

    # LangSmith
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: Optional[str] = None
    LANGCHAIN_PROJECT: str = "agentic-ai"

    # Model Provider Selection
    DEFAULT_MODEL_PROVIDER: str = "local"  # 'local' or 'claude'

    # Claude Anthropic
    ANTHROPIC_API_KEY: Optional[str] = None
    CLAUDE_MODEL: str = "claude-3-5-sonnet-20241022"

    # Local Model (GPT-OSS-20B)
    LOCAL_MODEL_URL: str = "http://10.12.120.43:8787/v1"
    LOCAL_MODEL_NAME: str = "gpt-oss-20b"
    LOCAL_MODEL_API_KEY: Optional[str] = None  # If required

    # Embedding Settings
    EMBEDDING_PROVIDER: str = "local"  # 'local' or 'openai'
    EMBEDDING_BASE_URL: str = "http://10.12.120.32:8142/v1"
    EMBEDDING_MODEL: str = "embedding-model"
    EMBEDDING_DIMENSION: int = 1024  # Adjust based on your embedding model
    EMBEDDING_API_KEY: Optional[str] = None

    # Model Settings (Generic)
    MODEL_NAME: str = "gpt-4-turbo-preview"  # For OpenAI fallback
    TEMPERATURE: float = 0.7
    MAX_TOKENS: int = 2000

    # RAG Settings
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    TOP_K_RETRIEVAL: int = 5  # Number of chunks to retrieve
    RAG_SCORE_THRESHOLD: float = 0.7  # Minimum similarity score (0-1)

    # File Upload Settings
    MAX_FILE_SIZE: int = 2 * 1024 * 1024  # 2MB
    ALLOWED_FILE_TYPES: str = "pdf,docx,doc,csv,txt,png,jpg,jpeg"
    UPLOAD_DIR: str = "/tmp/uploads"  # Temporary storage

    # Logging Settings
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    LOG_DIR: str = "logs"  # Directory for log files
    ENABLE_FILE_LOGGING: bool = True  # Enable logging to file
    ENABLE_REQUEST_LOGGING: bool = True  # Log all HTTP requests

    # Redis Cache Settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 1  # Use DB 1 for AI Engine (NestJS uses DB 0)
    REDIS_TTL: int = 3600  # Default TTL in seconds (1 hour)
    ENABLE_CACHE: bool = True  # Enable/disable caching globally

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
