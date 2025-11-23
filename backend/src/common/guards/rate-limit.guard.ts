import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RATE_LIMIT_WINDOW_KEY = 'rateLimitWindow';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private rateLimitService: RateLimitService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get rate limit configuration from decorator metadata
    const limit = this.reflector.getAllAndOverride<number>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const window = this.reflector.getAllAndOverride<number>(
      RATE_LIMIT_WINDOW_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no rate limit is configured, allow the request
    if (!limit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Create identifier: use userId if authenticated, otherwise IP address
    const identifier = user ? `user:${user.id}` : `ip:${request.ip}`;

    try {
      const allowed = await this.rateLimitService.checkLimit(
        identifier,
        limit,
        window || 60,
      );

      if (!allowed) {
        const remaining = await this.rateLimitService.getRemainingRequests(
          identifier,
          limit,
        );
        const current = await this.rateLimitService.getCurrentCount(identifier);

        this.logger.warn(
          `Rate limit exceeded for ${identifier}. Current: ${current}, Limit: ${limit}`,
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded. Please try again later.',
            remaining: Math.max(0, remaining),
            limit,
            window: window || 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add rate limit info to response headers
      const remaining = await this.rateLimitService.getRemainingRequests(
        identifier,
        limit,
      );
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', limit.toString());
      response.setHeader('X-RateLimit-Remaining', remaining.toString());
      response.setHeader('X-RateLimit-Window', (window || 60).toString());

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If rate limit service fails, allow the request (fail open)
      this.logger.error(`Rate limit check failed: ${error.message}`);
      return true;
    }
  }
}
