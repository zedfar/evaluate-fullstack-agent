"""
RAG Service - Retrieval-Augmented Generation.
Handles vector storage and retrieval using Qdrant with Redis caching.
"""

import logging
from typing import List, Optional, Dict, Any
from uuid import uuid4

from langchain_core.documents import Document
from langchain_qdrant import Qdrant
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.document_service import document_processor
from app.services.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class RAGService:
    """Service for RAG operations - document indexing and retrieval."""

    def __init__(self):
        """Initialize RAG service with Qdrant client."""
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY,
        )
        self.embeddings = embedding_service.get_embeddings()

    def get_collection_name(self, conversation_id: str) -> str:
        """Get collection name for a conversation."""
        # Use conversation_id as collection name (sanitized)
        return f"conv_{conversation_id.replace('-', '_')}"

    def create_collection(self, collection_name: str) -> None:
        """Create a new collection in Qdrant."""
        try:
            # Check if collection exists
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]

            if collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(
                        size=settings.EMBEDDING_DIMENSION,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info(f"Created collection: {collection_name}")
            else:
                logger.info(f"Collection already exists: {collection_name}")

        except Exception as e:
            logger.error(f"Error creating collection: {str(e)}")
            raise

    def index_document(
        self,
        file_path: str,
        file_type: str,
        conversation_id: str,
        file_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Process and index a document into vector store.

        Args:
            file_path: Path to the file
            file_type: Type of file
            conversation_id: ID of the conversation
            file_id: Unique file identifier
            metadata: Additional metadata

        Returns:
            Number of chunks indexed
        """
        try:
            # Process document into chunks
            chunks = document_processor.process_file(
                file_path=file_path,
                file_type=file_type,
                metadata={
                    "conversation_id": conversation_id,
                    "file_id": file_id,
                    **(metadata or {}),
                },
            )

            if not chunks:
                logger.warning(f"No chunks extracted from {file_path}")
                return 0

            # Get or create collection
            collection_name = self.get_collection_name(conversation_id)
            self.create_collection(collection_name)

            # Create vector store and add documents
            vector_store = Qdrant(
                client=self.client,
                collection_name=collection_name,
                embeddings=self.embeddings,
            )

            # Add documents to vector store
            vector_store.add_documents(chunks)

            logger.info(
                f"Indexed {len(chunks)} chunks for file {file_id} in collection {collection_name}"
            )
            return len(chunks)

        except Exception as e:
            logger.error(f"Error indexing document: {str(e)}")
            raise

    def search_documents(
        self,
        query: str,
        conversation_id: str,
        top_k: Optional[int] = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
        score_threshold: Optional[float] = None,
        custom_embeddings= None,
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant documents with caching and score filtering.

        Args:
            query: Search query
            conversation_id: ID of the conversation
            top_k: Number of results to return
            filter_metadata: Filter by metadata
            score_threshold: Maximum distance threshold (0-2) for COSINE distance.
                           Lower values = stricter matching (only very similar docs).
                           Typical values: 0.3-0.5 for good balance.
                           Defaults to RAG_SCORE_THRESHOLD.
            custom_embeddings: Custom embeddings instance (for demo mode with custom endpoints)

        Returns:
            List of dicts with 'document', 'score', 'file_name', and 'file_id' keys
            Note: 'score' is COSINE distance (lower = more similar)
        """
        try:
            # Try cache first
            cached_results = redis_cache.get_cached_search_result(query, conversation_id)
            if cached_results is not None:
                logger.info(f"RAG search cache HIT for query in conversation {conversation_id}")
                # Convert cached dicts back to proper format with Document objects
                return [
                    {
                        "document": Document(
                            page_content=r.get("page_content", ""),
                            metadata=r.get("metadata", {})
                        ),
                        "score": r.get("score", 0.0),
                        "file_name": r.get("file_name", "Unknown"),
                        "file_id": r.get("file_id", ""),
                    }
                    for r in cached_results
                ]

            logger.info(f"RAG search cache MISS for query in conversation {conversation_id}")

            collection_name = self.get_collection_name(conversation_id)
            top_k = top_k or settings.TOP_K_RETRIEVAL
            score_threshold = score_threshold if score_threshold is not None else settings.RAG_SCORE_THRESHOLD

            # Check if collection exists
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]

            if collection_name not in collection_names:
                logger.warning(f"Collection not found: {collection_name}")
                return []

            # Try using Qdrant vector store first
            try:
                # Use custom embeddings if provided (for demo mode), otherwise use default
                embeddings_to_use = custom_embeddings if custom_embeddings is not None else self.embeddings

                vector_store = Qdrant(
                    client=self.client,
                    collection_name=collection_name,
                    embeddings=embeddings_to_use,
                )

                # Search for similar documents with scores
                results_with_scores = vector_store.similarity_search_with_score(
                    query=query,
                    k=top_k,
                    filter=filter_metadata,
                )

                # Log actual scores for debugging
                if results_with_scores:
                    scores_str = ", ".join([f"{score:.4f}" for _, score in results_with_scores])
                    logger.info(f"Raw distance scores from Qdrant (COSINE): [{scores_str}]")

                # Filter by score threshold
                # NOTE: With COSINE distance, lower score = higher similarity
                # So we use <= threshold instead of >= threshold
                filtered_results = [
                    {
                        "document": doc,
                        "score": float(score),
                        "file_name": doc.metadata.get("file_name", "Unknown"),
                        "file_id": doc.metadata.get("file_id", ""),
                    }
                    for doc, score in results_with_scores
                    if score <= score_threshold  # Changed from >= to <=
                ]

                logger.info(
                    f"Found {len(filtered_results)}/{len(results_with_scores)} "
                    f"documents below distance threshold {score_threshold:.2f} (lower is better)"
                )

                # Cache results - serialize Document objects for storage
                cacheable_results = [
                    {
                        "page_content": item["document"].page_content,
                        "metadata": item["document"].metadata,
                        "score": item["score"],
                        "file_name": item["file_name"],
                        "file_id": item["file_id"],
                    }
                    for item in filtered_results
                ]
                redis_cache.cache_search_result(
                    query, conversation_id, cacheable_results, ttl=3600
                )

                return filtered_results

            except (AttributeError, TypeError) as e:
                # Fallback to manual search if Qdrant vector store has compatibility issues
                logger.warning(f"Qdrant vector store compatibility issue, using fallback: {str(e)}")
                results = self._manual_search_with_scores(
                    query, collection_name, top_k, filter_metadata, score_threshold
                )

                # Cache fallback results too - serialize Document objects
                if results:
                    cacheable_results = [
                        {
                            "page_content": item["document"].page_content,
                            "metadata": item["document"].metadata,
                            "score": item["score"],
                            "file_name": item["file_name"],
                            "file_id": item["file_id"],
                        }
                        for item in results
                    ]
                    redis_cache.cache_search_result(query, conversation_id, cacheable_results, ttl=3600)

                return results

        except Exception as e:
            logger.error(f"Error searching documents: {str(e)}")
            return []

    def _manual_search_with_scores(
        self,
        query: str,
        collection_name: str,
        top_k: int,
        filter_metadata: Optional[Dict[str, Any]] = None,
        score_threshold: float = 0.7,
    ) -> List[Dict[str, Any]]:
        """
        Manual search implementation using Qdrant client directly with score filtering.

        Args:
            query: Search query
            collection_name: Name of the collection
            top_k: Number of results to return
            filter_metadata: Filter by metadata
            score_threshold: Minimum similarity score

        Returns:
            List of dicts with document, score, file_name, and file_id
        """
        try:
            # Generate query embedding
            query_vector = self.embeddings.embed_query(query)

            # Prepare search request
            search_params = {
                "collection_name": collection_name,
                "query_vector": query_vector,
                "limit": top_k,
                "score_threshold": score_threshold,  # Qdrant native score filtering
            }

            # Add filter if provided
            if filter_metadata:
                search_params["query_filter"] = filter_metadata

            # Perform search using Qdrant client
            search_results = self.client.search(**search_params)

            # Convert to Document objects with scores
            results = []
            for result in search_results:
                # Extract metadata and content from payload
                payload = result.payload or {}
                content = payload.get("page_content", payload.get("text", ""))
                metadata = payload.get("metadata", {})

                results.append({
                    "document": Document(
                        page_content=content,
                        metadata=metadata,
                    ),
                    "score": float(result.score),
                    "file_name": metadata.get("file_name", "Unknown"),
                    "file_id": metadata.get("file_id", ""),
                })

            logger.info(f"Manual search found {len(results)} documents above threshold {score_threshold:.2f}")
            return results

        except Exception as e:
            logger.error(f"Error in manual search: {str(e)}")
            return []

    def delete_file_vectors(self, conversation_id: str, file_id: str) -> bool:
        """
        Delete all vectors associated with a file.

        Args:
            conversation_id: ID of the conversation
            file_id: ID of the file to delete

        Returns:
            True if successful
        """
        try:
            collection_name = self.get_collection_name(conversation_id)

            # Delete points with matching file_id in metadata
            self.client.delete(
                collection_name=collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="metadata.file_id",
                            match=MatchValue(value=file_id),
                        )
                    ]
                ),
            )

            logger.info(f"Deleted vectors for file {file_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting file vectors: {str(e)}")
            return False

    def delete_collection(self, conversation_id: str) -> bool:
        """
        Delete entire collection for a conversation.

        Args:
            conversation_id: ID of the conversation

        Returns:
            True if successful
        """
        try:
            collection_name = self.get_collection_name(conversation_id)
            self.client.delete_collection(collection_name=collection_name)

            # Invalidate cache for this conversation
            redis_cache.invalidate_conversation_cache(conversation_id)

            logger.info(f"Deleted collection: {collection_name}")
            return True

        except Exception as e:
            logger.error(f"Error deleting collection: {str(e)}")
            return False

    def get_collection_stats(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """
        Get statistics about a collection.

        Args:
            conversation_id: ID of the conversation

        Returns:
            Dictionary with collection stats or None
        """
        try:
            collection_name = self.get_collection_name(conversation_id)
            info = self.client.get_collection(collection_name=collection_name)

            return {
                "collection_name": collection_name,
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
                "status": info.status,
            }

        except Exception as e:
            logger.error(f"Error getting collection stats: {str(e)}")
            return None


# Singleton instance
rag_service = RAGService()
