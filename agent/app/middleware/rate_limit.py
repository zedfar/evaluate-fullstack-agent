"""
Rate Limiting Middleware for AI Engine.
Prevents abuse and DoS attacks by limiting requests per IP.
"""

import logging
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List
import asyncio

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware for AI Engine.

    Limits requests per IP address to prevent abuse.
    """

    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, List[datetime]] = defaultdict(list)
        self.cleanup_task = None
        logger.info(f"Rate limiting enabled: {requests_per_minute} requests/minute")

    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"

        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)

        # Clean old entries for this IP
        now = datetime.now()
        self.requests[client_ip] = [
            ts for ts in self.requests[client_ip]
            if now - ts < timedelta(minutes=1)
        ]

        # Check rate limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            logger.warning(
                f"Rate limit exceeded for {client_ip}: "
                f"{len(self.requests[client_ip])} requests in last minute"
            )
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"Maximum {self.requests_per_minute} requests per minute allowed. Please try again later.",
                    "retry_after": 60  # seconds
                }
            )

        # Add current request
        self.requests[client_ip].append(now)

        # Log request
        logger.debug(
            f"Request from {client_ip}: {len(self.requests[client_ip])} requests in last minute"
        )

        response = await call_next(request)
        return response

    async def cleanup_old_entries(self):
        """Periodically clean up old entries to prevent memory leaks."""
        while True:
            await asyncio.sleep(300)  # Run every 5 minutes
            now = datetime.now()
            cutoff = now - timedelta(minutes=5)

            # Remove IPs with no recent requests
            ips_to_remove = [
                ip for ip, timestamps in self.requests.items()
                if not timestamps or max(timestamps) < cutoff
            ]

            for ip in ips_to_remove:
                del self.requests[ip]

            if ips_to_remove:
                logger.info(f"Cleaned up rate limit data for {len(ips_to_remove)} IPs")
