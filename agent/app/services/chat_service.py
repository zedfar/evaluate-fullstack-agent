from typing import AsyncGenerator
import json
import logging
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings
from app.schemas import ChatRequest, Message, MessageRole
from app.agent.graph import get_agent_graph
from app.services.model_provider import model_provider
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self):
        # Default LLM will be set per request based on provider
        pass

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        reraise=True
    )
    async def _stream_llm_with_retry(self, llm, messages):
        """
        Stream LLM response with retry logic for transient errors.

        Retries up to 3 times with exponential backoff for:
        - TimeoutError
        - ConnectionError

        Other errors are raised immediately.
        """
        async for chunk in llm.astream(messages):
            yield chunk

    async def stream_chat(
        self, chat_request: ChatRequest
    ) -> AsyncGenerator[str, None]:
        """Stream chat responses with SSE format."""
        try:
            # Get LLM based on provider (with custom endpoint support)
            llm = model_provider.get_chat_model(
                provider=chat_request.model_provider,
                streaming=True,
                custom_base_url=chat_request.custom_gpt_endpoint,
            )

            # Convert messages to LangChain format
            messages = []
            for msg in chat_request.messages:
                if msg.role == MessageRole.USER:
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == MessageRole.ASSISTANT:
                    messages.append(AIMessage(content=msg.content))
                elif msg.role == MessageRole.SYSTEM:
                    messages.append(SystemMessage(content=msg.content))

            # If RAG is enabled and conversation_id is provided, augment with context
            if chat_request.use_rag and chat_request.conversation_id:
                # Get the last user message
                user_messages = [msg for msg in chat_request.messages if msg.role == MessageRole.USER]
                if user_messages:
                    last_query = user_messages[-1].content

                    # Get custom embeddings if custom endpoint is provided (demo mode)
                    custom_embeddings = None
                    if chat_request.custom_embedding_endpoint:
                        from app.services.embedding_service import embedding_service
                        custom_embeddings = embedding_service.get_embeddings(
                            provider="local",
                            custom_base_url=chat_request.custom_embedding_endpoint
                        )

                    # Search for relevant documents with score threshold
                    relevant_docs_with_scores = rag_service.search_documents(
                        query=last_query,
                        conversation_id=chat_request.conversation_id,
                        custom_embeddings=custom_embeddings,
                    )

                    # If documents found, add context to messages
                    if relevant_docs_with_scores:
                        context_parts = []
                        sources_info = []

                        for idx, item in enumerate(relevant_docs_with_scores, 1):
                            doc = item["document"]
                            score = item["score"]
                            source = item["file_name"]

                            context_parts.append(
                                f"[Source {idx}: {source} (Relevance: {score:.1%})]\n{doc.page_content}"
                            )

                            sources_info.append({
                                "name": source,
                                "score": score,
                                "file_id": item["file_id"],
                            })

                        context = "\n\n---\n\n".join(context_parts)

                        # Add system message with context
                        context_message = SystemMessage(
                            content=f"""You have access to the following relevant information from uploaded documents:

{context}

Use this information to help answer the user's question. If the information is relevant, cite the source. If you're not sure or the information doesn't help, you can say so."""
                        )
                        messages.insert(0, context_message)

                        # Send context info with scores to client
                        context_info = {
                            "type": "context",
                            "sources": sources_info,  # Now includes scores
                            "count": len(relevant_docs_with_scores),
                        }
                        yield f"data: {json.dumps(context_info)}\n\n"

            # Stream response using LangChain with retry logic
            async for chunk in self._stream_llm_with_retry(llm, messages):
                if chunk.content:
                    data = {
                        "type": "content",
                        "content": chunk.content,
                    }
                    yield f"data: {json.dumps(data)}\n\n"

            # Send done signal
            yield f"data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Chat streaming error: {str(e)}")

            # Better error classification
            error_message = str(e)
            if "rate limit" in error_message.lower():
                error_message = "Rate limit exceeded. Please try again in a moment."
            elif "timeout" in error_message.lower():
                error_message = "Request timeout. The AI is taking too long to respond."
            elif "connection" in error_message.lower():
                error_message = "Connection error. Please check your network."

            error_data = {
                "type": "error",
                "error": error_message,
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    async def stream_chat_with_tools(
        self, chat_request: ChatRequest
    ) -> AsyncGenerator[str, None]:
        """Stream chat responses with tool execution using LangGraph."""
        try:
            # Convert messages to LangChain format
            messages = []
            for msg in chat_request.messages:
                if msg.role == MessageRole.USER:
                    messages.append(HumanMessage(content=msg.content))
                elif msg.role == MessageRole.ASSISTANT:
                    messages.append(AIMessage(content=msg.content))
                elif msg.role == MessageRole.SYSTEM:
                    messages.append(SystemMessage(content=msg.content))

            # Get agent graph with appropriate provider
            agent_graph = get_agent_graph(provider=chat_request.model_provider)

            # Run agent graph
            async for event in agent_graph.astream(
                {"messages": messages}, {"recursion_limit": 10}
            ):
                # Stream intermediate steps and final response
                for node_name, node_output in event.items():
                    if "messages" in node_output:
                        for message in node_output["messages"]:
                            if hasattr(message, "content") and message.content:
                                data = {
                                    "type": "content",
                                    "content": message.content,
                                    "node": node_name,
                                }
                                yield f"data: {json.dumps(data)}\n\n"

                            # Send tool call info
                            if hasattr(message, "tool_calls") and message.tool_calls:
                                for tool_call in message.tool_calls:
                                    tool_data = {
                                        "type": "tool_call",
                                        "tool": tool_call.get("name"),
                                        "args": tool_call.get("args"),
                                    }
                                    yield f"data: {json.dumps(tool_data)}\n\n"

            # Send done signal
            yield f"data: [DONE]\n\n"

        except Exception as e:
            error_data = {
                "type": "error",
                "error": str(e),
            }
            yield f"data: {json.dumps(error_data)}\n\n"


chat_service = ChatService()
