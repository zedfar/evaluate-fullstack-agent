import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Sse,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { DemoService } from './demo.service';
import { SendMessageDto } from './dto/send-message.dto';
import { DEMO_LIMITS } from './demo.constants';

/**
 * Demo Controller
 * Public endpoints for demo mode (no authentication required)
 * Protected only by rate limiting
 */
@ApiTags('Demo')
@Controller('demo')
@UseGuards(RateLimitGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  /**
   * Get demo usage statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get demo usage statistics',
    description: 'Returns current conversation count and limits for demo user',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo statistics',
    schema: {
      example: {
        currentConversations: 5,
        maxConversations: 10,
        remainingSlots: 5,
        isLimitReached: false,
      },
    },
  })
  async getDemoStats() {
    return this.demoService.getDemoStats();
  }

  /**
   * Create new demo conversation
   */
  @Post('conversations')
  @ApiOperation({
    summary: 'Create new demo conversation',
    description: 'Creates a new conversation for demo user (max 10 total)',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    schema: {
      example: {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Demo limit reached (10 conversations)',
    schema: {
      example: {
        message: 'Demo limit reached',
        detail:
          'Maximum 10 conversations allowed for demo users. Please contact administrator to reset your demo account.',
        code: 'DEMO_LIMIT_REACHED',
        currentCount: 10,
        maxLimit: 10,
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (rate limit)',
  })
  async createConversation() {
    const conversationId = await this.demoService.createConversation();
    return { conversationId };
  }

  /**
   * Get demo conversation with messages
   */
  @Get(':conversationId')
  @ApiOperation({
    summary: 'Get demo conversation',
    description: 'Returns conversation details with all messages',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async getConversation(@Param('conversationId') conversationId: string) {
    return this.demoService.getConversation(conversationId);
  }

  /**
   * Send message in demo conversation (SSE streaming)
   */
  @Post('message')
  @Sse()
  @ApiOperation({
    summary: 'Send message in demo conversation',
    description:
      'Sends a message and returns streaming response. Supports custom API endpoints.',
  })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      basic: {
        summary: 'Basic message',
        value: {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          message: 'Hello, how can you help me?',
        },
      },
      withSettings: {
        summary: 'Message with custom settings',
        value: {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          message: 'Analyze this data',
          settings: {
            gptApiEndpoint: 'http://localhost:8000/v1',
            embeddingApiEndpoint: 'http://localhost:8001/v1',
            modelProvider: 'local',
            useRag: true,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Streaming response (Server-Sent Events)',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (rate limit)',
  })
  async sendMessage(
    @Body() dto: SendMessageDto,
  ): Promise<Observable<MessageEvent>> {
    return this.demoService.sendMessage(dto);
  }

  /**
   * Upload file to demo conversation
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: DEMO_LIMITS.MAX_FILE_SIZE, // 500KB
      },
      fileFilter: (req, file, callback) => {
        // Validate file type
        const allowedMimes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
          'application/msword', // doc
          'text/plain',
          'text/csv',
          'image/png',
          'image/jpeg',
        ];

        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException({
              message: 'Invalid file type',
              detail: 'Allowed types: PDF, DOCX, DOC, TXT, CSV, PNG, JPG',
              code: 'DEMO_INVALID_FILE_TYPE',
            }),
            false,
          );
        }
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload file to demo conversation',
    description:
      'Uploads a file for RAG processing (max 500KB, max 5 files per conversation)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 500KB)',
        },
        conversationId: {
          type: 'string',
          description: 'Conversation ID',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
      required: ['file', 'conversationId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'File too large or too many files',
    schema: {
      example: {
        message: 'File too large',
        detail: 'File size exceeds 500KB limit',
        code: 'DEMO_FILE_TOO_LARGE',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (rate limit)',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('conversationId') conversationId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!conversationId) {
      throw new BadRequestException('conversationId is required');
    }

    // Additional size check (redundant but secure)
    if (file.size > DEMO_LIMITS.MAX_FILE_SIZE) {
      throw new BadRequestException({
        message: 'File too large',
        detail: `File size exceeds ${DEMO_LIMITS.MAX_FILE_SIZE / 1024}KB limit`,
        code: 'DEMO_FILE_TOO_LARGE',
      });
    }

    return this.demoService.uploadFile(file, conversationId);
  }

  /**
   * Get files for demo conversation
   */
  @Get(':conversationId/files')
  @ApiOperation({
    summary: 'Get files for demo conversation',
    description: 'Returns all uploaded files for a conversation',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of files',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async getFiles(@Param('conversationId') conversationId: string) {
    return this.demoService.getFiles(conversationId);
  }

  /**
   * Delete file from demo conversation
   */
  @Delete('files/:fileId')
  @ApiOperation({
    summary: 'Delete file from demo conversation',
    description: 'Deletes a file and its vectors from RAG',
  })
  @ApiParam({
    name: 'fileId',
    description: 'File ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  async deleteFile(@Param('fileId') fileId: string) {
    return this.demoService.deleteFile(fileId);
  }
}
