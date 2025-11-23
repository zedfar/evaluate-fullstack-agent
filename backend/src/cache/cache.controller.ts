import { Controller, Get, Post, Delete, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { CacheService } from './cache.service';

@ApiTags('Cache Management')
@Controller('api/cache')
@UseGuards(RateLimitGuard)
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get cache and system statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics and metrics',
  })
  async getStats() {
    try {
      const store = this.cacheService['cacheManager'].store as any;
      const client = store.client;

      // Check if Redis client is available
      if (!client || typeof client.info !== 'function') {
        throw new Error('Redis client not available - using in-memory cache');
      }

      // Get Redis info
      const info = await client.info();
      const dbSize = await client.dbSize();

      // Parse Redis info
      const infoLines = info.split('\r\n');
      const usedMemory = infoLines.find((line: string) => line.startsWith('used_memory_human:'))?.split(':')[1] || 'N/A';
      const connectedClients = infoLines.find((line: string) => line.startsWith('connected_clients:'))?.split(':')[1] || 'N/A';
      const totalConnections = infoLines.find((line: string) => line.startsWith('total_connections_received:'))?.split(':')[1] || 'N/A';
      const opsPerSec = infoLines.find((line: string) => line.startsWith('instantaneous_ops_per_sec:'))?.split(':')[1] || 'N/A';

      // If we got here, Redis is working (regardless of status string)
      const isConnected = client.status === 'ready' || client.status === 'connect' || dbSize !== undefined;

      return {
        redis: {
          connected: isConnected,
          status: client.status || 'connected',
          usedMemory,
          dbSize,
          connectedClients: parseInt(connectedClients) || 0,
          totalConnections: parseInt(totalConnections) || 0,
          operationsPerSecond: parseInt(opsPerSec) || 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: 'Failed to retrieve cache stats',
        message: error.message,
        redis: {
          connected: false,
          status: 'error',
        },
        timestamp: new Date().toISOString(),
        hint: 'Check if Redis server is running and environment variables are correctly set (REDIS_HOST, REDIS_PORT)',
      };
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check cache health status' })
  @ApiResponse({
    status: 200,
    description: 'Cache health status',
  })
  async getHealth() {
    try {
      const store = this.cacheService['cacheManager'].store as any;
      const client = store.client;

      // Test Redis with ping
      const pingResult = await client.ping();

      return {
        healthy: pingResult === 'PONG',
        status: client.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Delete('clear/:pattern')
  @ApiOperation({ summary: 'Clear cache by pattern (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  async clearCacheByPattern(@Param('pattern') pattern: string) {
    try {
      await this.cacheService.invalidatePattern(pattern);
      return {
        success: true,
        message: `Cache cleared for pattern: ${pattern}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset entire cache (admin only - use with caution)' })
  @ApiResponse({
    status: 200,
    description: 'Cache reset successfully',
  })
  async resetCache() {
    try {
      await this.cacheService.reset();
      return {
        success: true,
        message: 'Cache reset successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
