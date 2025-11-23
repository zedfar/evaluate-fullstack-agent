"""
Redis Cache Service for AI Engine.
Provides caching for embeddings, RAG results, and tool outputs.
"""

import logging
import json
import hashlib
from typing import Any, Optional, List, Callable
from functools import wraps
import redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)


class RedisCacheService:
    """Service for Redis caching operations."""

    def __init__(self):
        """Initialize Redis connection."""
        self.client: Optional[redis.Redis] = None
        self.enabled = settings.ENABLE_CACHE

        if self.enabled:
            try:
                self.client = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    db=settings.REDIS_DB,
                    decode_responses=False,  # Handle binary data for embeddings
                    socket_connect_timeout=5,
                    socket_timeout=5,
                )
                # Test connection
                self.client.ping()
                logger.info(f"Redis cache connected: {settings.REDIS_HOST}:{settings.REDIS_PORT} (DB {settings.REDIS_DB})")
            except RedisError as e:
                logger.warning(f"Redis connection failed: {e}. Caching disabled.")
                self.enabled = False
                self.client = None

    def _generate_key(self, prefix: str, *args: Any) -> str:
        """
        Generate cache key from prefix and arguments.

        Args:
            prefix: Key prefix (e.g., 'embedding', 'search')
            *args: Arguments to hash

        Returns:
            Cache key string
        """
        # Create hash from arguments
        content = json.dumps(args, sort_keys=True, default=str)
        hash_value = hashlib.sha256(content.encode()).hexdigest()[:16]
        return f"ai:{prefix}:{hash_value}"

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None
        """
        if not self.enabled or not self.client:
            return None

        try:
            value = self.client.get(key)
            if value:
                # Try to deserialize JSON
                try:
                    return json.loads(value)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Return raw bytes for non-JSON data (embeddings)
                    return value
        except RedisError as e:
            logger.error(f"Redis GET error: {e}")

        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (default: settings.REDIS_TTL)

        Returns:
            True if successful
        """
        if not self.enabled or not self.client:
            return False

        try:
            ttl = ttl or settings.REDIS_TTL

            # Serialize value
            if isinstance(value, (bytes, bytearray)):
                serialized = value
            else:
                serialized = json.dumps(value, default=str)

            self.client.setex(key, ttl, serialized)
            return True
        except RedisError as e:
            logger.error(f"Redis SET error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key

        Returns:
            True if successful
        """
        if not self.enabled or not self.client:
            return False

        try:
            self.client.delete(key)
            return True
        except RedisError as e:
            logger.error(f"Redis DELETE error: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.

        Args:
            pattern: Pattern to match (e.g., 'ai:embedding:*')

        Returns:
            Number of keys deleted
        """
        if not self.enabled or not self.client:
            return 0

        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except RedisError as e:
            logger.error(f"Redis DELETE PATTERN error: {e}")
            return 0

    def cache_embedding(self, text: str, model: str, embedding: List[float], ttl: int = 86400) -> bool:
        """
        Cache embedding result.

        Args:
            text: Input text
            model: Model name
            embedding: Embedding vector
            ttl: TTL in seconds (default: 24 hours)

        Returns:
            True if successful
        """
        key = self._generate_key("embedding", text, model)
        return self.set(key, embedding, ttl)

    def get_cached_embedding(self, text: str, model: str) -> Optional[List[float]]:
        """
        Get cached embedding.

        Args:
            text: Input text
            model: Model name

        Returns:
            Cached embedding or None
        """
        key = self._generate_key("embedding", text, model)
        return self.get(key)

    def cache_search_result(
        self,
        query: str,
        conversation_id: str,
        results: List[dict],
        ttl: int = 3600,
    ) -> bool:
        """
        Cache RAG search results.

        Args:
            query: Search query
            conversation_id: Conversation ID
            results: Search results
            ttl: TTL in seconds (default: 1 hour)

        Returns:
            True if successful
        """
        key = self._generate_key("search", conversation_id, query)
        return self.set(key, results, ttl)

    def get_cached_search_result(
        self,
        query: str,
        conversation_id: str,
    ) -> Optional[List[dict]]:
        """
        Get cached search results.

        Args:
            query: Search query
            conversation_id: Conversation ID

        Returns:
            Cached results or None
        """
        key = self._generate_key("search", conversation_id, query)
        return self.get(key)

    def cache_tool_result(
        self,
        tool_name: str,
        args: dict,
        result: Any,
        ttl: int = 86400,
    ) -> bool:
        """
        Cache tool execution result.

        Args:
            tool_name: Name of the tool
            args: Tool arguments
            result: Tool result
            ttl: TTL in seconds (default: 24 hours)

        Returns:
            True if successful
        """
        key = self._generate_key("tool", tool_name, args)
        return self.set(key, result, ttl)

    def get_cached_tool_result(
        self,
        tool_name: str,
        args: dict,
    ) -> Optional[Any]:
        """
        Get cached tool result.

        Args:
            tool_name: Name of the tool
            args: Tool arguments

        Returns:
            Cached result or None
        """
        key = self._generate_key("tool", tool_name, args)
        return self.get(key)

    def invalidate_conversation_cache(self, conversation_id: str) -> int:
        """
        Invalidate all cache for a conversation.

        Args:
            conversation_id: Conversation ID

        Returns:
            Number of keys deleted
        """
        pattern = f"ai:search:*{conversation_id}*"
        return self.delete_pattern(pattern)

    def get_stats(self) -> dict:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        if not self.enabled or not self.client:
            return {"enabled": False}

        try:
            info = self.client.info()
            return {
                "enabled": True,
                "connected": True,
                "db_size": self.client.dbsize(),
                "used_memory": info.get("used_memory_human", "N/A"),
                "hit_rate": "N/A",  # Redis doesn't track this directly
            }
        except RedisError as e:
            logger.error(f"Redis STATS error: {e}")
            return {"enabled": True, "connected": False, "error": str(e)}


# Singleton instance
redis_cache = RedisCacheService()


def cached(prefix: str, ttl: Optional[int] = None):
    """
    Decorator for caching function results.

    Usage:
        @cached('my_function', ttl=3600)
        def my_function(arg1, arg2):
            # expensive operation
            return result
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not redis_cache.enabled:
                return await func(*args, **kwargs)

            # Generate cache key
            cache_key = redis_cache._generate_key(prefix, args, kwargs)

            # Try to get from cache
            cached_result = redis_cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache HIT for {prefix}: {cache_key}")
                return cached_result

            # Execute function
            logger.debug(f"Cache MISS for {prefix}: {cache_key}")
            result = await func(*args, **kwargs)

            # Cache result
            redis_cache.set(cache_key, result, ttl)
            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not redis_cache.enabled:
                return func(*args, **kwargs)

            # Generate cache key
            cache_key = redis_cache._generate_key(prefix, args, kwargs)

            # Try to get from cache
            cached_result = redis_cache.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache HIT for {prefix}: {cache_key}")
                return cached_result

            # Execute function
            logger.debug(f"Cache MISS for {prefix}: {cache_key}")
            result = func(*args, **kwargs)

            # Cache result
            redis_cache.set(cache_key, result, ttl)
            return result

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
