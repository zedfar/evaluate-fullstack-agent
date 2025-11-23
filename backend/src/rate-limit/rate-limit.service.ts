import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Check rate limit using sliding window counter.
   * Returns true if request is allowed, false if limit exceeded.
   */
  async checkLimit(
    identifier: string,
    limit: number = 100,
    windowSeconds: number = 60,
  ): Promise<boolean> {
    try {
      const key = `ratelimit:${identifier}`;
      const current = await this.cacheManager.get<number>(key);

      if (current === undefined || current === null) {
        // First request in window
        await this.cacheManager.set(key, 1, windowSeconds);
        return true;
      }

      if (current >= limit) {
        return false;
      }

      // Increment counter
      await this.cacheManager.set(key, current + 1, windowSeconds);
      return true;
    } catch (error) {
      this.logger.error(`RateLimit checkLimit error for ${identifier}: ${error.message}`);
      // If Redis fails, allow the request to avoid blocking users
      return true;
    }
  }

  async getRemainingRequests(
    identifier: string,
    limit: number = 100,
  ): Promise<number> {
    const key = `ratelimit:${identifier}`;
    const current = await this.cacheManager.get<number>(key);
    return Math.max(0, limit - (current || 0));
  }

  async getCurrentCount(identifier: string): Promise<number> {
    const key = `ratelimit:${identifier}`;
    const current = await this.cacheManager.get<number>(key);
    return current || 0;
  }

  async resetLimit(identifier: string): Promise<void> {
    const key = `ratelimit:${identifier}`;
    await this.cacheManager.del(key);
  }
}
