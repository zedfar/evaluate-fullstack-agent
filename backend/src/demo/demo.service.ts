import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { User } from '../user/entities/user.entity';
import { ChatConversation } from '../chat/entities/chat-conversation.entity';
import { UploadedFile } from '../chat/entities/uploaded-file.entity';
import { ChatService } from '../chat/chat.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { SendMessageDto } from './dto/send-message.dto';
import {
  getDemoUserId,
  DEMO_LIMITS,
  DEMO_ERROR_CODES,
} from './demo.constants';

/**
 * Demo Service
 * Handles all demo mode functionality with rate limiting and restrictions
 */
@Injectable()
export class DemoService implements OnModuleInit {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoUserId: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ChatConversation)
    private readonly conversationRepository: Repository<ChatConversation>,
    @InjectRepository(UploadedFile)
    private readonly fileRepository: Repository<UploadedFile>,
    private readonly chatService: ChatService,
    private readonly aiGatewayService: AiGatewayService,
  ) {
    // Get demo user ID from environment
    this.demoUserId = getDemoUserId();
    this.logger.log(`Demo user ID configured: ${this.demoUserId}`);
  }

  /**
   * Validate demo user exists on module initialization
   */
  async onModuleInit() {
    try {
      const user = await this.userRepository.findOne({
        where: { id: this.demoUserId },
      });

      if (!user) {
        throw new Error(
          `Demo user with ID "${this.demoUserId}" not found in database. ` +
            'Please create the user manually before starting the application.',
        );
      }

      this.logger.log(
        `✅ Demo user validated: ${user.name || user.email} (${user.email})`,
      );
    } catch (error) {
      this.logger.error(`❌ Demo user validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get demo usage statistics
   */
  async getDemoStats() {
    const count = await this.conversationRepository.count({
      where: { userId: this.demoUserId },
    });

    return {
      currentConversations: count,
      maxConversations: DEMO_LIMITS.MAX_CONVERSATIONS,
      remainingSlots: Math.max(0, DEMO_LIMITS.MAX_CONVERSATIONS - count),
      isLimitReached: count >= DEMO_LIMITS.MAX_CONVERSATIONS,
    };
  }

  /**
   * Create a new demo conversation
   * @throws BadRequestException if conversation limit reached
   */
  async createConversation(): Promise<string> {
    // Check conversation limit
    const count = await this.conversationRepository.count({
      where: { userId: this.demoUserId },
    });

    this.logger.log(
      `Creating demo conversation (${count}/${DEMO_LIMITS.MAX_CONVERSATIONS})`,
    );

    if (count >= DEMO_LIMITS.MAX_CONVERSATIONS) {
      this.logger.warn(
        `Demo conversation limit reached for user ${this.demoUserId}`,
      );
      throw new BadRequestException({
        message: 'Demo limit reached',
        detail:
          `Maximum ${DEMO_LIMITS.MAX_CONVERSATIONS} conversations allowed for demo users. ` +
          'Please contact administrator to reset your demo account.',
        code: DEMO_ERROR_CODES.LIMIT_REACHED,
        currentCount: count,
        maxLimit: DEMO_LIMITS.MAX_CONVERSATIONS,
      });
    }

    // Create new conversation
    const conversation = await this.chatService.createConversation(
      this.demoUserId,
      `Demo Chat ${count + 1}`,
    );

    this.logger.log(
      `Demo conversation created: ${conversation.id} (${count + 1}/${DEMO_LIMITS.MAX_CONVERSATIONS})`,
    );

    return conversation.id;
  }

  /**
   * Get demo conversation with messages
   * @throws NotFoundException if conversation not found or doesn't belong to demo user
   */
  async getConversation(conversationId: string) {
    const conversation = await this.chatService.findConversationById(
      conversationId,
      this.demoUserId,
    );

    if (!conversation) {
      throw new NotFoundException({
        message: 'Demo conversation not found',
        code: DEMO_ERROR_CODES.CONVERSATION_NOT_FOUND,
      });
    }

    return conversation;
  }

  /**
   * Send message in demo conversation with streaming response
   * Supports custom API endpoints via settings
   */
  async sendMessage(dto: SendMessageDto): Promise<Observable<MessageEvent>> {
    // Validate conversation belongs to demo user
    const conversation = await this.conversationRepository.findOne({
      where: { id: dto.conversationId, userId: this.demoUserId },
    });

    if (!conversation) {
      throw new NotFoundException({
        message: 'Demo conversation not found',
        code: DEMO_ERROR_CODES.CONVERSATION_NOT_FOUND,
      });
    }

    this.logger.log(
      `Sending message in demo conversation ${dto.conversationId}`,
    );

    // Extract settings
    const modelProvider = dto.settings?.modelProvider || 'local';
    const useRag = dto.settings?.useRag || false;
    const customGptEndpoint = dto.settings?.gptApiEndpoint;
    const customEmbeddingEndpoint = dto.settings?.embeddingApiEndpoint;

    // Pass custom endpoints to AI gateway (for demo mode)
    return this.aiGatewayService.streamChat(
      this.demoUserId,
      dto.message,
      dto.conversationId,
      modelProvider,
      useRag,
      customGptEndpoint,
      customEmbeddingEndpoint,
    );
  }

  /**
   * Upload file to demo conversation
   * @throws BadRequestException if file limits exceeded
   */
  async uploadFile(file: Express.Multer.File, conversationId: string) {
    // Validate conversation belongs to demo user
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId: this.demoUserId },
    });

    if (!conversation) {
      throw new NotFoundException({
        message: 'Demo conversation not found',
        code: DEMO_ERROR_CODES.CONVERSATION_NOT_FOUND,
      });
    }

    // Check file count limit
    const fileCount = await this.fileRepository.count({
      where: { conversationId },
    });

    if (fileCount >= DEMO_LIMITS.MAX_FILES_PER_CONV) {
      throw new BadRequestException({
        message: 'File limit reached',
        detail: `Maximum ${DEMO_LIMITS.MAX_FILES_PER_CONV} files per demo conversation`,
        code: DEMO_ERROR_CODES.TOO_MANY_FILES,
      });
    }

    // Verify file size (redundant check, but good for security)
    if (file.size > DEMO_LIMITS.MAX_FILE_SIZE) {
      throw new BadRequestException({
        message: 'File too large',
        detail: `File size exceeds ${DEMO_LIMITS.MAX_FILE_SIZE / 1024}KB limit`,
        code: DEMO_ERROR_CODES.FILE_TOO_LARGE,
      });
    }

    this.logger.log(
      `Uploading file to demo conversation ${conversationId}: ${file.originalname} (${file.size} bytes)`,
    );

    // Use ChatService to handle upload
    return this.chatService.uploadFile(file, conversationId, this.demoUserId);
  }

  /**
   * Get files for demo conversation
   */
  async getFiles(conversationId: string) {
    // Validate conversation belongs to demo user
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId: this.demoUserId },
    });

    if (!conversation) {
      throw new NotFoundException({
        message: 'Demo conversation not found',
        code: DEMO_ERROR_CODES.CONVERSATION_NOT_FOUND,
      });
    }

    return this.chatService.getConversationFiles(
      conversationId,
      this.demoUserId,
    );
  }

  /**
   * Delete file from demo conversation
   */
  async deleteFile(fileId: string) {
    // Verify file belongs to demo user
    const file = await this.fileRepository.findOne({
      where: { id: fileId, userId: this.demoUserId },
    });

    if (!file) {
      throw new NotFoundException({
        message: 'File not found',
        code: DEMO_ERROR_CODES.CONVERSATION_NOT_FOUND,
      });
    }

    this.logger.log(`Deleting file ${fileId} from demo conversation`);

    return this.chatService.deleteFile(fileId, this.demoUserId);
  }
}
