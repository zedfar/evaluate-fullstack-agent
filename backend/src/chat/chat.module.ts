import { forwardRef, Module, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { UploadedFile } from './entities/uploaded-file.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { CacheServiceModule } from '../cache/cache.module';
import { BlobStorageService } from '../storage/blob-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatConversation, ChatMessage, UploadedFile]),
    HttpModule,
    forwardRef(() => AiGatewayModule),
    RateLimitModule,
    CacheServiceModule,
    // Configure Multer to store files in memory for upload to Vercel Blob
    MulterModule.register({
      storage: memoryStorage(), // Store in memory buffer
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB explicit limit
        files: 1, // Only 1 file at a time
      },
      fileFilter: (req, file, callback) => {
        // Whitelist allowed MIME types
        const allowedMimes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/csv',
          'text/plain',
          'text/markdown',
          'image/png',
          'image/jpeg',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `File type not allowed: ${file.mimetype}. Allowed types: PDF, DOCX, DOC, CSV, TXT, MD, PNG, JPEG`,
            ),
            false,
          );
        }
      },
    }),
  ],
  controllers: [],
  providers: [ChatService, BlobStorageService],
  exports: [ChatService],
})
export class ChatModule {}
