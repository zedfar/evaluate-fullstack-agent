"""
Embedding Service - Generate embeddings for RAG.
Supports local embedding server and OpenAI embeddings with Redis caching.
"""

import logging
from typing import List, Optional
from langchain_core.embeddings import Embeddings
from langchain_openai import OpenAIEmbeddings

from app.config import settings
from app.services.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class CustomEmbeddings(Embeddings):
    """Custom embeddings using local embedding server."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: Optional[str] = None,
    ):
        """
        Initialize custom embeddings.

        Args:
            base_url: Base URL of embedding server
            model: Model name
            api_key: API key if required
        """
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of documents with caching."""
        import httpx

        # Try to get from cache for each text
        results = []
        texts_to_embed = []
        indices_to_embed = []

        for i, text in enumerate(texts):
            cached = redis_cache.get_cached_embedding(text, self.model)
            if cached is not None:
                results.append((i, cached))
                logger.debug(f"Embedding cache HIT for text {i}")
            else:
                texts_to_embed.append(text)
                indices_to_embed.append(i)
                results.append((i, None))  # Placeholder

        # Embed uncached texts
        if texts_to_embed:
            logger.debug(f"Embedding cache MISS: {len(texts_to_embed)} texts to embed")
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            # Add /embeddings endpoint to base URL
            url = f"{self.base_url}/embeddings"

            response = httpx.post(
                url,
                json={
                    "input": texts_to_embed,
                    "model": self.model,
                },
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()

            data = response.json()
            embeddings = [item["embedding"] for item in data["data"]]

            # Cache new embeddings and update results
            for idx, text, embedding in zip(indices_to_embed, texts_to_embed, embeddings):
                redis_cache.cache_embedding(text, self.model, embedding, ttl=86400)  # 24 hours
                results[idx] = (idx, embedding)

        # Sort by index and extract embeddings
        results.sort(key=lambda x: x[0])
        return [emb for _, emb in results]

    def embed_query(self, text: str) -> List[float]:
        """Embed a query string with caching."""
        # Try cache first
        cached = redis_cache.get_cached_embedding(text, self.model)
        if cached is not None:
            logger.debug("Query embedding cache HIT")
            return cached

        logger.debug("Query embedding cache MISS")
        # Embed and cache
        embedding = self.embed_documents([text])[0]
        return embedding


class EmbeddingService:
    """Service for managing embeddings."""

    @staticmethod
    def get_embeddings(
        provider: Optional[str] = None, custom_base_url: Optional[str] = None
    ) -> Embeddings:
        """
        Get embeddings model based on provider.

        Args:
            provider: 'local' or 'openai'. Defaults to settings.EMBEDDING_PROVIDER
            custom_base_url: Custom API base URL (for demo mode)

        Returns:
            Embeddings instance
        """
        provider = provider or settings.EMBEDDING_PROVIDER

        if provider == "local":
            # Use custom base URL if provided, otherwise use default
            base_url = custom_base_url or settings.EMBEDDING_BASE_URL

            return CustomEmbeddings(
                base_url=base_url,
                model=settings.EMBEDDING_MODEL,
                api_key=settings.EMBEDDING_API_KEY,
            )

        elif provider == "openai":
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is required for OpenAI embeddings")

            return OpenAIEmbeddings(
                model="text-embedding-3-small",
                api_key=settings.OPENAI_API_KEY,
            )

        else:
            raise ValueError(f"Unknown embedding provider: {provider}. Use 'local' or 'openai'")


# Singleton instance
embedding_service = EmbeddingService()
