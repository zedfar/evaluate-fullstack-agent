import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage, MessageRole } from './entities/chat-message.entity';
import {
  UploadedFile,
  FileProcessingStatus,
} from './entities/uploaded-file.entity';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { CacheService } from '../cache/cache.service';
import { BlobStorageService } from '../storage/blob-storage.service';

interface UploadFileResponse {
  chunks_count: number;
  message: string;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatConversation)
    private conversationRepository: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(UploadedFile)
    private uploadedFileRepository: Repository<UploadedFile>,
    private httpService: HttpService,
    private configService: ConfigService,
    private cacheService: CacheService,
    private blobStorageService: BlobStorageService,
  ) {}

  async createConversation(userId: string, title?: string) {
    const conversation = this.conversationRepository.create({
      userId,
      title: title || 'New Chat',
    });
    const saved = await this.conversationRepository.save(conversation);

    // Invalidate conversations list cache
    await this.cacheService.invalidatePattern(`conversations:${userId}`);

    return saved;
  }

  async findAllConversations(userId: string) {
    return this.cacheService.getOrSet(
      `conversations:${userId}`,
      async () => {
        // Get conversations with file count
        const conversations = await this.conversationRepository
          .createQueryBuilder('conversation')
          .where('conversation.userId = :userId', { userId })
          .loadRelationCountAndMap('conversation.fileCount', 'conversation.files')
          .orderBy('conversation.updatedAt', 'DESC')
          .getMany();

        return conversations;
      },
      300, // Cache for 5 minutes
    );
  }

  async findConversationById(id: string, userId: string) {
    return this.cacheService.getOrSet(
      `conversation:${id}`,
      async () => {
        const conversation = await this.conversationRepository.findOne({
          where: { id, userId },
          relations: ['messages'],
          order: { messages: { createdAt: 'ASC' } },
        });

        if (!conversation) {
          throw new NotFoundException('Conversation not found');
        }

        return conversation;
      },
      600, // Cache for 10 minutes
    );
  }

  async updateConversation(
    id: string,
    userId: string,
    updateDto: UpdateConversationDto,
  ) {
    // Bypass cache to get fresh data for update
    const conversation = await this.conversationRepository.findOne({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.title = updateDto.title;
    const updated = await this.conversationRepository.save(conversation);

    // Invalidate caches
    await this.cacheService.invalidateConversation(id);
    await this.cacheService.invalidatePattern(`conversations:${userId}`);

    return updated;
  }

  async deleteConversation(id: string, userId: string) {
    // Bypass cache to get fresh data for deletion
    const conversation = await this.conversationRepository.findOne({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.conversationRepository.remove(conversation);

    // Invalidate caches
    await this.cacheService.invalidateConversation(id);
    await this.cacheService.invalidatePattern(`conversations:${userId}`);

    return { message: 'Conversation deleted successfully' };
  }

  async saveMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: any,
  ) {
    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
      metadata,
    });
    const saved = await this.messageRepository.save(message);

    // Invalidate conversation cache as messages have changed
    await this.cacheService.invalidateConversation(conversationId);

    return saved;
  }

  async getConversationMessages(conversationId: string) {
    return this.cacheService.getOrSet(
      `messages:${conversationId}`,
      () => this.messageRepository.find({
        where: { conversationId },
        order: { createdAt: 'ASC' },
      }),
      600, // Cache for 10 minutes
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    conversationId: string,
    userId: string,
  ) {
    // Verify conversation exists and belongs to user
    // Bypass cache for verification
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Upload file to Vercel Blob
    const blobResult = await this.blobStorageService.uploadFile(
      file,
      `uploads/${userId}`,
    );

    // Create file record with Blob URLs
    const uploadedFile = this.uploadedFileRepository.create({
      conversationId,
      userId,
      fileName: blobResult.pathname,
      originalName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      filePath: blobResult.url,
      blobUrl: blobResult.url,
      blobDownloadUrl: blobResult.downloadUrl,
      storageType: 'vercel_blob',
      processingStatus: FileProcessingStatus.PROCESSING,
    });

    const savedFile = await this.uploadedFileRepository.save(uploadedFile);

    try {
      // file.buffer is available from memoryStorage
      // Forward to AI Engine for processing
      const aiEngineUrl = this.configService.get('AI_ENGINE_URL');
      const formData = new FormData();
      formData.append('file', file.buffer, file.originalname);
      formData.append('conversation_id', conversationId);
      formData.append('file_id', savedFile.id);

      const response: AxiosResponse<UploadFileResponse> = await firstValueFrom(
        this.httpService.post(`${aiEngineUrl}/api/v1/upload`, formData, {
          headers: formData.getHeaders(),
        }),
      );

      // Update file status
      savedFile.processingStatus = FileProcessingStatus.COMPLETED;
      savedFile.chunkCount = response.data.chunks_count;
      savedFile.qdrantCollection = `conv_${conversationId.replace(/-/g, '_')}`;
      savedFile.processedAt = new Date();

      await this.uploadedFileRepository.save(savedFile);

      // Create system message as file upload indicator
      await this.saveMessage(
        conversationId,
        MessageRole.SYSTEM,
        `File uploaded: ${file.originalname}`,
        {
          type: 'file_upload',
          fileId: savedFile.id,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          blobUrl: blobResult.url,
          chunkCount: response.data.chunks_count,
          uploadedAt: new Date().toISOString(),
        },
      );

      // Invalidate cache
      await this.cacheService.invalidateConversation(conversationId);

      return {
        success: true,
        file: savedFile,
        message: response.data.message,
      };
    } catch (error) {
      // If AI Engine processing fails, delete file from Blob
      try {
        await this.blobStorageService.deleteFile(blobResult.url);
      } catch (deleteError) {
        console.error('Failed to delete blob after error:', deleteError);
      }

      // Update file status to failed
      savedFile.processingStatus = FileProcessingStatus.FAILED;
      savedFile.errorMessage = error.message;
      await this.uploadedFileRepository.save(savedFile);

      throw new BadRequestException(
        `Failed to process file: ${error.message}`,
      );
    }
  }

  async getConversationFiles(conversationId: string, userId: string) {
    // Verify conversation exists and belongs to user (use cache)
    await this.findConversationById(conversationId, userId);

    return this.cacheService.getOrSet(
      `files:${conversationId}`,
      () => this.uploadedFileRepository.find({
        where: { conversationId, userId },
        order: { createdAt: 'DESC' },
      }),
      600, // Cache for 10 minutes
    );
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.uploadedFileRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    try {
      // Delete from AI Engine (Qdrant)
      const aiEngineUrl = this.configService.get('AI_ENGINE_URL');
      await firstValueFrom(
        this.httpService.post(`${aiEngineUrl}/api/v1/delete-file`, {
          conversation_id: file.conversationId,
          file_id: fileId,
        }),
      );

      // Delete file from storage
      if (file.storageType === 'vercel_blob' && file.blobUrl) {
        // Delete from Vercel Blob
        try {
          await this.blobStorageService.deleteFile(file.blobUrl);
        } catch (error) {
          console.error('Failed to delete from Vercel Blob:', error);
          // Continue with database deletion even if Blob deletion fails
        }
      } else if (file.storageType === 'local' && file.filePath) {
        // Fallback for old local files
        const fs = require('fs');
        if (fs.existsSync(file.filePath)) {
          fs.unlinkSync(file.filePath);
        }
      }

      // Delete from database
      await this.uploadedFileRepository.remove(file);

      // Invalidate file cache
      await this.cacheService.invalidatePattern(`files:${file.conversationId}`);

      // Create system message as file deletion indicator
      await this.saveMessage(
        file.conversationId,
        MessageRole.SYSTEM,
        `File removed: ${file.originalName}`,
        {
          type: 'file_deletion',
          fileId: fileId,
          fileName: file.originalName,
          deletedAt: new Date().toISOString(),
        },
      );

      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  async downloadFile(fileId: string, userId: string, res: any) {
    const file = await this.uploadedFileRepository.findOne({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.filePath) {
      throw new NotFoundException('File path not available');
    }

    // Handle Vercel Blob files - redirect to download URL
    if (file.storageType === 'vercel_blob') {
      const downloadUrl = file.blobDownloadUrl || file.blobUrl;
      if (!downloadUrl) {
        throw new NotFoundException('Blob URL not available');
      }
      return res.redirect(downloadUrl);
    }

    // Handle local files (backward compatibility)
    if (file.storageType === 'local') {
      const fs = require('fs');

      // Check if file exists on disk
      if (!fs.existsSync(file.filePath)) {
        throw new NotFoundException('File not found on storage');
      }

      // Set appropriate headers based on file type
      res.setHeader('Content-Type', file.fileType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`,
      );
      res.setHeader('Content-Length', file.fileSize);

      // For text files, add charset
      if (
        file.fileType.includes('text') ||
        file.fileType.includes('csv') ||
        file.fileType.includes('markdown')
      ) {
        res.setHeader('Content-Type', `${file.fileType}; charset=utf-8`);
      }

      // Stream file to response
      const fileStream = fs.createReadStream(file.filePath);
      return fileStream.pipe(res);
    }

    throw new NotFoundException('Unsupported storage type');
  }

  /**
   * Toggle public status of a conversation
   * Only the owner can change this setting
   */
  async togglePublicStatus(
    conversationId: string,
    userId: string,
    isPublic: boolean,
  ) {
    // Bypass cache to get fresh data for update
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.isPublic = isPublic;
    const updated = await this.conversationRepository.save(conversation);

    // Invalidate caches
    await this.cacheService.invalidateConversation(conversationId);
    await this.cacheService.invalidatePattern(`conversations:${userId}`);
    // Also invalidate public conversation cache
    await this.cacheService.invalidatePattern(`public_conversation:${conversationId}`);

    return {
      id: updated.id,
      title: updated.title,
      isPublic: updated.isPublic,
      message: isPublic
        ? 'Conversation is now public and can be shared'
        : 'Conversation is now private',
    };
  }
}
