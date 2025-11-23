import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { PreviewService } from './preview.service';

@ApiTags('Preview')
@Controller('preview')
@UseGuards(RateLimitGuard)
@UseInterceptors(CacheInterceptor)
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  @Get(':conversationId')
  @CacheTTL(600) // Cache for 10 minutes
  @ApiOperation({
    summary: 'Get a public conversation for preview',
    description:
      'Retrieve a conversation that has been marked as public. No authentication required.',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Public conversation details',
    schema: {
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'My Shared Conversation',
        messages: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            role: 'user',
            content: 'Hello AI!',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            role: 'assistant',
            content: 'Hello! How can I help you?',
            createdAt: '2024-01-01T00:01:00.000Z',
          },
        ],
        files: [
          {
            id: '123e4567-e89b-12d3-a456-426614174004',
            originalName: 'document.pdf',
            fileType: 'application/pdf',
            fileSize: 102400,
            processingStatus: 'completed',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Public conversation not found or not shared',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  async getPublicConversation(@Param('conversationId') conversationId: string) {
    return this.previewService.getPublicConversation(conversationId);
  }
}
