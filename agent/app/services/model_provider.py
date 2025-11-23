"""
Model Provider Service - Support for multiple LLM providers.
Supports: Local (GPT-OSS), Claude Anthropic, and OpenAI.
"""

from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

from app.config import settings


class ModelProvider:
    """Factory for managing multiple LLM providers."""

    @staticmethod
    def get_chat_model(
        provider: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        streaming: bool = True,
        custom_base_url: Optional[str] = None,
    ) -> BaseChatModel:
        """
        Get chat model based on provider.

        Args:
            provider: 'local', 'claude', or 'openai'. Defaults to settings.DEFAULT_MODEL_PROVIDER
            temperature: Override default temperature
            max_tokens: Override default max tokens
            streaming: Enable streaming (default True)
            custom_base_url: Custom API base URL (for demo mode)

        Returns:
            BaseChatModel instance
        """
        provider = provider or settings.DEFAULT_MODEL_PROVIDER
        temperature = temperature if temperature is not None else settings.TEMPERATURE
        max_tokens = max_tokens if max_tokens is not None else settings.MAX_TOKENS

        if provider == "claude":
            if not settings.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY is required for Claude provider")

            return ChatAnthropic(
                model=settings.CLAUDE_MODEL,
                anthropic_api_key=settings.ANTHROPIC_API_KEY,
                temperature=temperature,
                max_tokens=max_tokens,
                streaming=streaming,
            )

        elif provider == "local":
            # GPT-OSS-20B via OpenAI-compatible API
            # Use custom base URL if provided, otherwise use default
            base_url = custom_base_url or settings.LOCAL_MODEL_URL

            try:
                return ChatOpenAI(
                    base_url=base_url,
                    api_key=settings.LOCAL_MODEL_API_KEY or "dummy-key",  # Some servers don't require key
                    model=settings.LOCAL_MODEL_NAME,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    streaming=streaming,
                )
            except TypeError as e:
                # Handle version compatibility issues (e.g., proxies argument)
                if "proxies" in str(e) or "unexpected keyword argument" in str(e):
                    raise ValueError(
                        "ChatOpenAI initialization error. This might be due to version incompatibility. "
                        "Please ensure langchain-openai is at the correct version (0.1.7 recommended). "
                        f"Original error: {str(e)}"
                    )
                raise

        elif provider == "openai":
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is required for OpenAI provider")

            try:
                return ChatOpenAI(
                    model=settings.MODEL_NAME,
                    api_key=settings.OPENAI_API_KEY,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    streaming=streaming,
                )
            except TypeError as e:
                # Handle version compatibility issues (e.g., proxies argument)
                if "proxies" in str(e) or "unexpected keyword argument" in str(e):
                    raise ValueError(
                        "ChatOpenAI initialization error. This might be due to version incompatibility. "
                        "Please ensure langchain-openai is at the correct version (0.1.7 recommended). "
                        f"Original error: {str(e)}"
                    )
                raise

        else:
            raise ValueError(f"Unknown provider: {provider}. Use 'local', 'claude', or 'openai'")

    @staticmethod
    def get_available_providers() -> list[str]:
        """Get list of available providers based on configuration."""
        providers = []

        if settings.LOCAL_MODEL_URL:
            providers.append("local")

        if settings.ANTHROPIC_API_KEY:
            providers.append("claude")

        if settings.OPENAI_API_KEY:
            providers.append("openai")

        return providers


# Singleton instance
model_provider = ModelProvider()
