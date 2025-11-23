import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import axios from 'axios';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
      latency?: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async checkAll(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {};

    // Check database
    try {
      const dbStart = Date.now();
      await this.dataSource.query('SELECT 1');
      checks.database = {
        status: 'up',
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      checks.database = {
        status: 'down',
        message: error.message,
      };
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await this.cacheManager.set('health_check', 'ok', 1000);
      const value = await this.cacheManager.get('health_check');
      if (value === 'ok') {
        checks.redis = {
          status: 'up',
          latency: Date.now() - redisStart,
        };
      } else {
        checks.redis = {
          status: 'down',
          message: 'Redis read/write test failed',
        };
      }
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      checks.redis = {
        status: 'down',
        message: error.message,
      };
    }

    // Check AI Engine
    try {
      const aiEngineStart = Date.now();
      const aiEngineUrl = this.configService.get('AI_ENGINE_URL');
      const response = await axios.get(`${aiEngineUrl}/health`, {
        timeout: 5000,
      });

      if (response.status === 200) {
        checks.aiEngine = {
          status: 'up',
          latency: Date.now() - aiEngineStart,
        };
      } else {
        checks.aiEngine = {
          status: 'down',
          message: `Unexpected status: ${response.status}`,
        };
      }
    } catch (error) {
      this.logger.error('AI Engine health check failed:', error);
      checks.aiEngine = {
        status: 'down',
        message: error.code === 'ECONNREFUSED'
          ? 'Connection refused'
          : error.message,
      };
    }

    // Determine overall status
    const allUp = Object.values(checks).every((check) => check.status === 'up');
    const allDown = Object.values(checks).every(
      (check) => check.status === 'down',
    );

    const status = allUp ? 'healthy' : allDown ? 'unhealthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async checkAIEngine(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    try {
      const startTime = Date.now();
      const aiEngineUrl = this.configService.get('AI_ENGINE_URL');
      const response = await axios.get(`${aiEngineUrl}/health`, {
        timeout: 5000,
      });

      checks.aiEngine = {
        status: response.status === 200 ? 'up' : 'down',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('AI Engine health check failed:', error);
      checks.aiEngine = {
        status: 'down',
        message: error.message,
      };
    }

    return {
      status: checks.aiEngine.status === 'up' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async checkDatabase(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      checks.database = {
        status: 'up',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      checks.database = {
        status: 'down',
        message: error.message,
      };
    }

    return {
      status: checks.database.status === 'up' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async checkRedis(): Promise<HealthCheckResult> {
    const checks: HealthCheckResult['checks'] = {};

    try {
      const startTime = Date.now();
      await this.cacheManager.set('health_check', 'ok', 1000);
      const value = await this.cacheManager.get('health_check');

      checks.redis = {
        status: value === 'ok' ? 'up' : 'down',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      checks.redis = {
        status: 'down',
        message: error.message,
      };
    }

    return {
      status: checks.redis.status === 'up' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
