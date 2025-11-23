/**
 * Cache TTL Configuration
 *
 * Centralized TTL (Time To Live) configuration for all cache keys.
 * Values are in seconds and can be overridden via environment variables.
 */

export const CacheTTL = {
  // User-related cache
  USER_PROFILE: parseInt(process.env.CACHE_TTL_USER || '3600'), // 1 hour
  USER_BY_EMAIL: parseInt(process.env.CACHE_TTL_USER_EMAIL || '3600'), // 1 hour

  // Conversation cache
  CONVERSATION: parseInt(process.env.CACHE_TTL_CONVERSATION || '600'), // 10 minutes
  CONVERSATION_LIST: parseInt(process.env.CACHE_TTL_CONVERSATION_LIST || '300'), // 5 minutes
  CONVERSATION_MESSAGES: parseInt(process.env.CACHE_TTL_MESSAGES || '600'), // 10 minutes

  // File cache
  FILES: parseInt(process.env.CACHE_TTL_FILES || '3600'), // 1 hour

  // AI Engine cache (Python service uses different DB)
  EMBEDDING: parseInt(process.env.CACHE_TTL_EMBEDDING || '86400'), // 24 hours
  SEARCH_RESULT: parseInt(process.env.CACHE_TTL_SEARCH || '3600'), // 1 hour
  TOOL_RESULT: parseInt(process.env.CACHE_TTL_TOOL || '86400'), // 24 hours

  // Session cache
  SESSION: parseInt(process.env.CACHE_TTL_SESSION || '86400'), // 24 hours

  // Analytics cache
  ANALYTICS: parseInt(process.env.CACHE_TTL_ANALYTICS || '2592000'), // 30 days

  // Rate limiting window (default)
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '60'), // 1 minute

  // Stream timeout
  STREAM_TIMEOUT: parseInt(process.env.STREAM_TIMEOUT || '300'), // 5 minutes
};

/**
 * Cache Key Prefixes
 *
 * Consistent key naming across the application
 */
export class CacheKeys {
  // User keys
  static user(userId: string): string {
    return `user:${userId}`;
  }

  static userByEmail(email: string): string {
    return `user:email:${email}`;
  }

  // Conversation keys
  static conversation(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  static conversations(userId: string): string {
    return `conversations:${userId}`;
  }

  static messages(conversationId: string): string {
    return `messages:${conversationId}`;
  }

  static files(conversationId: string): string {
    return `files:${conversationId}`;
  }

  // Session keys
  static session(userId: string, sessionId: string): string {
    return `session:${userId}:${sessionId}`;
  }

  static userSessions(userId: string): string {
    return `user_sessions:${userId}`;
  }

  // Rate limit keys
  static rateLimit(identifier: string): string {
    return `ratelimit:${identifier}`;
  }

  // Stream keys
  static stream(streamId: string): string {
    return `stream:${streamId}`;
  }

  static userStreams(userId: string): string {
    return `user_streams:${userId}`;
  }

  // Analytics keys
  static analyticsEvent(eventType: string): string {
    return `analytics:event:${eventType}`;
  }

  static analyticsDaily(date: string, eventType: string): string {
    return `analytics:daily:${date}:${eventType}`;
  }

  static analyticsUser(userId: string, eventType: string): string {
    return `analytics:user:${userId}:${eventType}`;
  }

  static analyticsConversation(conversationId: string, eventType: string): string {
    return `analytics:conversation:${conversationId}:${eventType}`;
  }

  // AI Engine keys (used in Python service)
  static aiEmbedding(hash: string, model: string): string {
    return `ai:embedding:${hash}`;
  }

  static aiSearch(conversationId: string, queryHash: string): string {
    return `ai:search:${conversationId}:${queryHash}`;
  }

  static aiTool(toolName: string, argsHash: string): string {
    return `ai:tool:${toolName}:${argsHash}`;
  }
}

/**
 * Rate Limit Presets
 */
export const RateLimits = {
  // Authentication endpoints
  AUTH_LOGIN: {
    limit: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN || '5'),
    window: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN_WINDOW || '300'), // 5 per 5 minutes
  },
  AUTH_REGISTER: {
    limit: parseInt(process.env.RATE_LIMIT_AUTH_REGISTER || '3'),
    window: parseInt(process.env.RATE_LIMIT_AUTH_REGISTER_WINDOW || '3600'), // 3 per hour
  },

  // Chat endpoints
  CHAT_MESSAGE: {
    limit: parseInt(process.env.RATE_LIMIT_CHAT_MESSAGE || '60'),
    window: parseInt(process.env.RATE_LIMIT_CHAT_MESSAGE_WINDOW || '60'), // 60 per minute
  },
  CHAT_CREATE: {
    limit: parseInt(process.env.RATE_LIMIT_CHAT_CREATE || '20'),
    window: parseInt(process.env.RATE_LIMIT_CHAT_CREATE_WINDOW || '60'), // 20 per minute
  },

  // File upload
  FILE_UPLOAD: {
    limit: parseInt(process.env.RATE_LIMIT_FILE_UPLOAD || '10'),
    window: parseInt(process.env.RATE_LIMIT_FILE_UPLOAD_WINDOW || '60'), // 10 per minute
  },

  // General API
  API_GENERAL: {
    limit: parseInt(process.env.RATE_LIMIT_API_GENERAL || '100'),
    window: parseInt(process.env.RATE_LIMIT_API_GENERAL_WINDOW || '60'), // 100 per minute
  },

  // Unauthenticated requests
  UNAUTH: {
    limit: parseInt(process.env.RATE_LIMIT_UNAUTH || '50'),
    window: parseInt(process.env.RATE_LIMIT_UNAUTH_WINDOW || '60'), // 50 per minute
  },
};
