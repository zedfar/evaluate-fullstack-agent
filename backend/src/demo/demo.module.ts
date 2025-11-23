import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { User } from '../user/entities/user.entity';
import { ChatConversation } from '../chat/entities/chat-conversation.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { UploadedFile } from '../chat/entities/uploaded-file.entity';
import { ChatModule } from '../chat/chat.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

/**
 * Demo Module
 * Provides public demo mode functionality without authentication
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      ChatConversation,
      ChatMessage,
      UploadedFile,
    ]),
    ChatModule,
    AiGatewayModule,
    RateLimitModule,
  ],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
