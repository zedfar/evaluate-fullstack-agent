import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ChatConversation } from '../chat/entities/chat-conversation.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { UploadedFile } from '../chat/entities/uploaded-file.entity';

@Injectable()
export class PreviewService {
  private readonly logger = new Logger(PreviewService.name);

  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(UploadedFile)
    private readonly fileRepository: Repository<UploadedFile>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Get a public conversation by ID
   * Only returns conversations where isPublic = true
   */
  async getPublicConversation(conversationId: string) {
    this.logger.log(`Fetching public conversation: ${conversationId}`);

    // Check cache first
    const cacheKey = `public_conversation:${conversationId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for public conversation: ${conversationId}`);
      return cached;
    }

    // Find conversation
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, isPublic: true },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Public conversation not found or not shared',
      );
    }

    // Get messages
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    // Get files
    const files = await this.fileRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });

    const result = {
      id: conversation.id,
      title: conversation.title,
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      })),
      files: files.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        processingStatus: file.processingStatus,
        createdAt: file.createdAt,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, result, 600000);

    this.logger.log(`Successfully fetched public conversation: ${conversationId}`);
    return result;
  }

  /**
   * Check if a conversation is public
   */
  async isConversationPublic(conversationId: string): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      select: ['isPublic'],
    });

    return conversation?.isPublic || false;
  }
}
