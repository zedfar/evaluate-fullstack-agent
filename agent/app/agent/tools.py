from langchain.tools import Tool
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain_community.utilities import WikipediaAPIWrapper
from typing import Optional
import operator
import logging

# Import redis cache after creating app/services module
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.services.redis_cache import redis_cache
except ImportError:
    redis_cache = None
    logging.warning("Redis cache not available for tools")

logger = logging.getLogger(__name__)


def get_search_tool() -> Tool:
    """Create a web search tool using DuckDuckGo with caching."""
    search = DuckDuckGoSearchAPIWrapper()

    def cached_search(query: str) -> str:
        """Search with caching."""
        if redis_cache and redis_cache.enabled:
            # Try cache first
            cached_result = redis_cache.get_cached_tool_result("web_search", {"query": query})
            if cached_result is not None:
                logger.info(f"Web search cache HIT for query: {query[:50]}...")
                return cached_result

            logger.info(f"Web search cache MISS for query: {query[:50]}...")

        # Execute search
        result = search.run(query)

        # Cache result
        if redis_cache and redis_cache.enabled:
            redis_cache.cache_tool_result("web_search", {"query": query}, result, ttl=86400)  # 24 hours

        return result

    return Tool(
        name="web_search",
        description="Search the web for current information. Use this when you need up-to-date information or facts about current events, people, places, or things.",
        func=cached_search,
    )


def get_wikipedia_tool() -> Tool:
    """Create a Wikipedia search tool with caching."""
    wikipedia = WikipediaAPIWrapper()

    def cached_wikipedia(query: str) -> str:
        """Wikipedia search with caching."""
        if redis_cache and redis_cache.enabled:
            # Try cache first
            cached_result = redis_cache.get_cached_tool_result("wikipedia", {"query": query})
            if cached_result is not None:
                logger.info(f"Wikipedia cache HIT for query: {query[:50]}...")
                return cached_result

            logger.info(f"Wikipedia cache MISS for query: {query[:50]}...")

        # Execute search
        result = wikipedia.run(query)

        # Cache result
        if redis_cache and redis_cache.enabled:
            redis_cache.cache_tool_result("wikipedia", {"query": query}, result, ttl=86400)  # 24 hours

        return result

    return Tool(
        name="wikipedia",
        description="Search Wikipedia for detailed information about topics, people, places, events, and concepts. Good for historical and general knowledge.",
        func=cached_wikipedia,
    )


def get_calculator_tool() -> Tool:
    """Create a calculator tool."""

    def calculate(expression: str) -> str:
        """Safely evaluate mathematical expressions."""
        try:
            # Only allow safe operations
            allowed_chars = set("0123456789+-*/()., ")
            if not all(c in allowed_chars for c in expression):
                return "Error: Invalid characters in expression"

            result = eval(expression, {"__builtins__": {}}, {})
            return str(result)
        except Exception as e:
            return f"Error: {str(e)}"

    return Tool(
        name="calculator",
        description="Perform mathematical calculations. Input should be a valid mathematical expression like '2 + 2' or '10 * 5 / 2'.",
        func=calculate,
    )


def get_all_tools():
    """Get all available tools."""
    return [
        get_search_tool(),
        get_wikipedia_tool(),
        get_calculator_tool(),
    ]
