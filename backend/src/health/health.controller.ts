import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async check() {
    return this.healthService.checkAll();
  }

  @Get('ai-engine')
  async checkAIEngine() {
    return this.healthService.checkAIEngine();
  }

  @Get('database')
  async checkDatabase() {
    return this.healthService.checkDatabase();
  }

  @Get('redis')
  async checkRedis() {
    return this.healthService.checkRedis();
  }
}
