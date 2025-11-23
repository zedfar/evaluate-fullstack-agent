"""
Compression utilities for Redis caching.
Reduces memory usage for large objects like embeddings.
"""

import zlib
import pickle
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CompressionService:
    """Service for compressing/decompressing cached data."""

    @staticmethod
    def compress(data: Any, level: int = 6) -> bytes:
        """
        Compress data using zlib.

        Args:
            data: Data to compress
            level: Compression level (1-9, higher = better compression but slower)

        Returns:
            Compressed bytes
        """
        try:
            # Serialize with pickle
            pickled = pickle.dumps(data)

            # Compress
            compressed = zlib.compress(pickled, level=level)

            # Log compression ratio
            original_size = len(pickled)
            compressed_size = len(compressed)
            ratio = (1 - compressed_size / original_size) * 100
            logger.debug(
                f"Compressed {original_size} bytes to {compressed_size} bytes "
                f"(saved {ratio:.1f}%)"
            )

            return compressed
        except Exception as e:
            logger.error(f"Compression error: {e}")
            # Fallback: return pickled data without compression
            return pickle.dumps(data)

    @staticmethod
    def decompress(compressed_data: bytes) -> Optional[Any]:
        """
        Decompress data.

        Args:
            compressed_data: Compressed bytes

        Returns:
            Decompressed data or None if error
        """
        try:
            # Decompress
            pickled = zlib.decompress(compressed_data)

            # Deserialize
            data = pickle.loads(pickled)

            return data
        except zlib.error:
            # Maybe it's not compressed, try to unpickle directly
            try:
                return pickle.loads(compressed_data)
            except Exception as e:
                logger.error(f"Decompression error: {e}")
                return None
        except Exception as e:
            logger.error(f"Decompression error: {e}")
            return None


# Singleton instance
compression_service = CompressionService()
