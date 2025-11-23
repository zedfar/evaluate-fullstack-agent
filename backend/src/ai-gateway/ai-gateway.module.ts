import { Module, forwardRef } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { ChatModule } from '../chat/chat.module';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { ChatConversation } from '../chat/entities/chat-conversation.entity';
// import { ChatMessage } from '../chat/entities/chat-message.entity';
// import { UploadedFile } from '../chat/entities/uploaded-file.entity';
import { ChatService } from '../chat/chat.service';

@Module({
  imports: [
    // TypeOrmModule.forFeature([ChatConversation, ChatMessage, UploadedFile]),
    forwardRef(() => ChatModule),
  ],
  // providers: [AiGatewayService, ChatService],
  providers: [AiGatewayService],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}
