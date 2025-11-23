"""
Logging Configuration for AI Engine
Provides centralized logging setup with file and console handlers
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime

from app.config import settings


def setup_logging(
    log_level: Optional[str] = None,
    log_file: Optional[str] = None,
    enable_file_logging: bool = True,
) -> None:
    """
    Setup application-wide logging configuration.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file. If None, uses default from settings
        enable_file_logging: Whether to enable file logging
    """
    # Get log level from parameter or settings
    level = log_level or getattr(settings, "LOG_LEVEL", "INFO")
    log_level_value = getattr(logging, level.upper(), logging.INFO)

    # Create logs directory if it doesn't exist
    log_dir = Path(getattr(settings, "LOG_DIR", "logs"))
    log_dir.mkdir(exist_ok=True)

    # Default log file name
    if log_file is None:
        log_file = log_dir / f"ai_engine_{datetime.now().strftime('%Y%m%d')}.log"
    else:
        log_file = Path(log_file)

    # Create formatters
    console_formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level_value)

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level_value)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # File handler (rotating)
    if enable_file_logging:
        file_handler = logging.handlers.RotatingFileHandler(
            filename=log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(log_level_value)
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)

    # Set specific loggers to appropriate levels
    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("qdrant_client").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)  # Suppress auto-reload logs
    logging.getLogger("watchfiles.main").setLevel(logging.WARNING)
    logging.getLogger("multipart").setLevel(logging.WARNING)  # Suppress multipart parsing logs

    # Log startup message
    root_logger.info("=" * 60)
    root_logger.info(f"AI Engine Logging Initialized")
    root_logger.info(f"Log Level: {level.upper()}")
    root_logger.info(f"Console Logging: Enabled")
    root_logger.info(f"File Logging: {'Enabled' if enable_file_logging else 'Disabled'}")
    if enable_file_logging:
        root_logger.info(f"Log File: {log_file}")
    root_logger.info("=" * 60)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


class RequestLogger:
    """Middleware-friendly request logger."""

    def __init__(self, logger_name: str = "request"):
        self.logger = logging.getLogger(logger_name)

    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        duration: float,
        client_ip: str = None,
    ) -> None:
        """Log HTTP request details."""
        log_msg = f"{method} {path} - {status_code} - {duration:.3f}s"
        if client_ip:
            log_msg = f"[{client_ip}] {log_msg}"

        if status_code >= 500:
            self.logger.error(log_msg)
        elif status_code >= 400:
            self.logger.warning(log_msg)
        else:
            self.logger.info(log_msg)

    def log_error(self, method: str, path: str, error: Exception) -> None:
        """Log request error."""
        self.logger.error(
            f"{method} {path} - ERROR: {type(error).__name__}: {str(error)}"
        )


# Global request logger instance
request_logger = RequestLogger()
