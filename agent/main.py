from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import uvicorn
import os
import logging

from app.api.routes import router
from app.config import settings
from app.logging_config import setup_logging
from app.middleware import RequestLoggingMiddleware, ErrorHandlingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

# Load environment variables
load_dotenv()

# Initialize logging
setup_logging(
    log_level=settings.LOG_LEVEL,
    enable_file_logging=settings.ENABLE_FILE_LOGGING,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Agentic AI Engine",
    description="LangGraph-powered AI Engine with RAG capabilities",
    version="1.0.1",
)

# Add middleware (order matters - first added = outermost)
# Error handling (outermost)
app.add_middleware(ErrorHandlingMiddleware)

# Rate limiting (before request logging)
app.add_middleware(RateLimitMiddleware, requests_per_minute=60)

# Request logging
app.add_middleware(RequestLoggingMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api/v1")

logger.info("FastAPI application initialized")


@app.get("/")
async def root():
    return {"message": "Agentic AI Engine", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
    )
