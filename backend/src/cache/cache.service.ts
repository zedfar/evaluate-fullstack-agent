import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = 300,
  ): Promise<T> {
    try {
      const cached = await this.cacheManager.get<T>(key);
      // Check if cached exists (not just truthy, because 0, false, '' are valid cached values)
      if (cached !== undefined && cached !== null) {
        return cached;
      }

      const value = await factory();
      await this.cacheManager.set(key, value, ttl);
      return value;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}: ${error.message}`);
      // If cache fails, just execute the factory function
      return factory();
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const store = this.cacheManager.store as any;
      const keys = await store.keys();
      const keysToDelete = keys.filter((key: string) => key.includes(pattern));

      for (const key of keysToDelete) {
        await this.cacheManager.del(key);
      }
    } catch (error) {
      this.logger.error(`Cache invalidatePattern error for pattern ${pattern}: ${error.message}`);
      // Fail silently - cache invalidation is not critical
    }
  }

  async setUser(userId: string, userData: any, ttl: number = 3600): Promise<void> {
    await this.cacheManager.set(`user:${userId}`, userData, ttl);
  }

  async getUser(userId: string): Promise<any> {
    return this.cacheManager.get(`user:${userId}`);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.cacheManager.del(`user:${userId}`);
  }

  async setConversation(
    conversationId: string,
    data: any,
    ttl: number = 600,
  ): Promise<void> {
    await this.cacheManager.set(`conversation:${conversationId}`, data, ttl);
  }

  async getConversation(conversationId: string): Promise<any> {
    return this.cacheManager.get(`conversation:${conversationId}`);
  }

  async invalidateConversation(conversationId: string): Promise<void> {
    await this.cacheManager.del(`conversation:${conversationId}`);
    await this.invalidatePattern(`messages:${conversationId}`);
    await this.invalidatePattern(`files:${conversationId}`);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
      // Fail silently - cache operations should not block the main flow
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return this.cacheManager.get<T>(key);
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      return undefined;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Cache del error for key ${key}: ${error.message}`);
      // Fail silently
    }
  }

  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset();
    } catch (error) {
      this.logger.error(`Cache reset error: ${error.message}`);
      // Fail silently
    }
  }
}
