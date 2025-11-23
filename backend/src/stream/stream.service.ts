import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';

export interface StreamInfo {
  streamId: string;
  userId: string;
  conversationId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

@Injectable()
export class StreamService implements OnModuleDestroy {
  private cleanupInterval: NodeJS.Timeout;
  private readonly STREAM_TIMEOUT = 300; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // Start cleanup task
    this.startCleanupTask();
  }

  async registerStream(
    userId: string,
    conversationId: string,
  ): Promise<string> {
    const streamId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.STREAM_TIMEOUT * 1000);

    const streamInfo: StreamInfo = {
      streamId,
      userId,
      conversationId,
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    };

    const key = `stream:${streamId}`;
    await this.cacheManager.set(key, streamInfo, this.STREAM_TIMEOUT);

    // Add to user's active streams list
    const userStreamsKey = `user_streams:${userId}`;
    const streams = (await this.cacheManager.get<string[]>(userStreamsKey)) || [];
    streams.push(streamId);
    await this.cacheManager.set(userStreamsKey, streams, this.STREAM_TIMEOUT);

    return streamId;
  }

  async updateActivity(streamId: string): Promise<void> {
    const key = `stream:${streamId}`;
    const stream = await this.cacheManager.get<StreamInfo>(key);

    if (stream) {
      stream.lastActivityAt = new Date();
      const ttl = Math.ceil(
        (stream.expiresAt.getTime() - new Date().getTime()) / 1000,
      );

      if (ttl > 0) {
        await this.cacheManager.set(key, stream, ttl);
      }
    }
  }

  async unregisterStream(streamId: string): Promise<void> {
    const key = `stream:${streamId}`;
    const stream = await this.cacheManager.get<StreamInfo>(key);

    if (stream) {
      // Remove from user's streams list
      const userStreamsKey = `user_streams:${stream.userId}`;
      const streams =
        (await this.cacheManager.get<string[]>(userStreamsKey)) || [];
      await this.cacheManager.set(
        userStreamsKey,
        streams.filter((sid) => sid !== streamId),
        this.STREAM_TIMEOUT,
      );
    }

    await this.cacheManager.del(key);
  }

  async getUserActiveStreams(userId: string): Promise<StreamInfo[]> {
    const userStreamsKey = `user_streams:${userId}`;
    const streamIds =
      (await this.cacheManager.get<string[]>(userStreamsKey)) || [];

    const streams: StreamInfo[] = [];
    for (const streamId of streamIds) {
      const key = `stream:${streamId}`;
      const stream = await this.cacheManager.get<StreamInfo>(key);
      if (stream) {
        streams.push(stream);
      }
    }

    return streams;
  }

  async getAllActiveStreams(): Promise<StreamInfo[]> {
    const store = this.cacheManager.store as any;
    const keys = await store.keys();
    const streamKeys = keys.filter((key: string) => key.startsWith('stream:'));

    const streams: StreamInfo[] = [];
    for (const key of streamKeys) {
      const stream = await this.cacheManager.get<StreamInfo>(key);
      if (stream) {
        streams.push(stream);
      }
    }

    return streams;
  }

  async getStreamCount(): Promise<number> {
    const store = this.cacheManager.store as any;
    const keys = await store.keys();
    return keys.filter((key: string) => key.startsWith('stream:')).length;
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredStreams();
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanupExpiredStreams(): Promise<void> {
    const streams = await this.getAllActiveStreams();
    const now = new Date().getTime();

    for (const stream of streams) {
      const expiresAt = new Date(stream.expiresAt).getTime();
      if (now >= expiresAt) {
        await this.unregisterStream(stream.streamId);
      }
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
