import { SetMetadata } from '@nestjs/common';
import {
  RATE_LIMIT_KEY,
  RATE_LIMIT_WINDOW_KEY,
} from '../guards/rate-limit.guard';

/**
 * Rate limit decorator to set limits on controller methods or classes
 *
 * @param limit - Maximum number of requests allowed
 * @param windowSeconds - Time window in seconds (default: 60)
 *
 * @example
 * // Apply to a single route
 * @RateLimit(10, 60) // 10 requests per minute
 * @Post('chat')
 * async chat() { ... }
 *
 * @example
 * // Apply to entire controller
 * @RateLimit(100, 60) // 100 requests per minute for all routes
 * @Controller('chat')
 * export class ChatController { ... }
 */
export const RateLimit = (limit: number, windowSeconds: number = 60) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(RATE_LIMIT_KEY, limit)(target, propertyKey, descriptor);
    SetMetadata(RATE_LIMIT_WINDOW_KEY, windowSeconds)(
      target,
      propertyKey,
      descriptor,
    );
  };
};

/**
 * Common rate limit presets
 */
export const RateLimitPresets = {
  // Strict limits for expensive operations
  Strict: () => RateLimit(10, 60), // 10 req/min
  // Standard limits for normal operations
  Standard: () => RateLimit(60, 60), // 60 req/min (1 req/sec)
  // Lenient limits for read operations
  Lenient: () => RateLimit(120, 60), // 120 req/min (2 req/sec)
  // Very lenient for health checks, etc
  VeryLenient: () => RateLimit(300, 60), // 300 req/min (5 req/sec)
};
