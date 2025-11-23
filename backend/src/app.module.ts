import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { LoggerModule } from 'nestjs-pino';
import { multistream } from 'pino';
import { createStream } from 'rotating-file-stream';
import { join } from 'path';
import { PreviewModule } from './preview/preview.module';
import { DemoModule } from './demo/demo.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { CacheServiceModule } from './cache/cache.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { StreamModule } from './stream/stream.module';
import { HealthModule } from './health/health.module';

/**
 * Sample Mode App Module
 * Simplified version for public demo - no authentication required
 *
 * Features:
 * - Demo chat with custom API endpoints
 * - Preview mode for sharing conversations
 * - Rate limiting for protection
 * - No user authentication
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Redis Cache Module (with fallback to memory)
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisCache');

        try {
          const store = await redisStore({
            socket: {
              host: configService.get('REDIS_HOST', 'localhost'),
              port: configService.get('REDIS_PORT', 6379),
              connectTimeout: 10000,
              reconnectStrategy: (retries) => {
                if (retries > 10) {
                  logger.error('Redis: Max reconnection attempts reached');
                  return new Error('Max reconnection attempts reached');
                }
                const delay = Math.min(retries * 100, 3000);
                logger.warn(`Redis: Reconnecting... Attempt ${retries}`);
                return delay;
              },
            },
            password: configService.get('REDIS_PASSWORD'),
            ttl: configService.get('REDIS_TTL', 300) * 1000,
            database: configService.get('REDIS_DB', 0),
          });

          const client = store.client;

          client.on('error', (error) => {
            logger.error(`Redis Error: ${error.message}`);
          });

          client.on('ready', () => {
            logger.log('Redis: Ready and connected');
          });

          return {
            store: () => store,
          } as any;
        } catch (error) {
          logger.error(`Redis: Failed to initialize: ${error.message}`);
          logger.warn('Redis: Falling back to in-memory cache');
          return {
            store: 'memory' as any,
            max: 100,
            ttl: configService.get('REDIS_TTL', 300) * 1000,
          };
        }
      },
    }),
    // Logging
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get('NODE_ENV') !== 'production';

        const allLogsStream = createStream('application.log', {
          interval: '1d',
          maxFiles: 7,
          path: join(process.cwd(), 'logs'),
          compress: 'gzip',
        });

        const errorLogsStream = createStream('error.log', {
          interval: '1d',
          maxFiles: 30,
          path: join(process.cwd(), 'logs'),
          compress: 'gzip',
        });

        const streams: any[] = [
          { level: 'info', stream: allLogsStream },
          { level: 'error', stream: errorLogsStream },
        ];

        if (isDev) {
          const pretty = require('pino-pretty')({
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
            levelFirst: true,
            singleLine: false,
            messageFormat: (log: any, messageKey: string) => {
              const msg = log[messageKey];
              const level = log.level;

              const emoji =
                level === 10 ? '📝' :
                  level === 20 ? '🔍' :
                    level === 30 ? 'ℹ️ ' :
                      level === 40 ? '⚠️ ' :
                        level === 50 ? '🔥 ' :
                          '💬 ';

              return `${emoji}${msg}`;
            },
          });
          streams.push({
            level: 'debug',
            stream: pretty,
          });
        }

        return {
          pinoHttp: {
            level: isDev ? 'debug' : 'info',
            stream: multistream(streams),
            autoLogging: {
              ignore: (req) => req.url === '/health',
            },
            customLogLevel: function (req, res, error) {
              if (error || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            customSuccessMessage: function (req, res) {
              return `Request handled: ${req.method} ${req.url}`;
            },
            customErrorMessage: function (req, res, error) {
              return `Request failed: ${req.method} ${req.url} -> ${error?.message}`;
            },
          },
        };
      },
    }),
    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST'),
        port: config.get('DATABASE_PORT'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        ssl: {
          rejectUnauthorized: false,
        },
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('NODE_ENV') === 'development',
        logging: false,
      }),
    }),
    // Demo Mode Modules
    PreviewModule,
    DemoModule,
    AiGatewayModule,
    CacheServiceModule,
    RateLimitModule,
    StreamModule,
    HealthModule,
  ],
})
export class AppModule { }
