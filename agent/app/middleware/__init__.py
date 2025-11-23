"""
Middleware for AI Engine
Handles request logging, error tracking, and performance monitoring
"""

import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import settings

logger = logging.getLogger("middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests and responses."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.enabled = settings.ENABLE_REQUEST_LOGGING

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log details."""
        if not self.enabled:
            return await call_next(request)

        # Skip logging for health check to reduce noise
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"

        # Start timer
        start_time = time.time()

        # Process request
        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Log request
            self._log_request(
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration=duration,
                client_ip=client_ip,
            )

            # Add custom headers
            response.headers["X-Process-Time"] = f"{duration:.3f}s"

            return response

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                f"[{client_ip}] {request.method} {request.url.path} - "
                f"ERROR after {duration:.3f}s: {type(e).__name__}: {str(e)}"
            )
            raise

    def _log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration: float,
        client_ip: str,
    ) -> None:
        """Log request details with appropriate level."""
        log_msg = f"[{client_ip}] {method} {path} - {status_code} - {duration:.3f}s"

        if status_code >= 500:
            logger.error(log_msg)
        elif status_code >= 400:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for centralized error handling and logging."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Catch and log any unhandled exceptions."""
        try:
            return await call_next(request)
        except Exception as e:
            logger.exception(
                f"Unhandled exception in {request.method} {request.url.path}: "
                f"{type(e).__name__}: {str(e)}"
            )
            # Re-raise to let FastAPI handle it
            raise


# Export all middleware classes
__all__ = [
    "RequestLoggingMiddleware",
    "ErrorHandlingMiddleware",
]
