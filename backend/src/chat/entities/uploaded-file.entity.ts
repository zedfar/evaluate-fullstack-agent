import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ChatConversation } from './chat-conversation.entity';
import { User } from '../../user/entities/user.entity';

export enum FileProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('uploaded_files')
export class UploadedFile {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174005',
    description: 'File unique identifier',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Conversation ID this file belongs to',
  })
  @Column()
  conversationId: string;

  @ApiProperty({
    type: () => ChatConversation,
    description: 'Conversation this file belongs to',
  })
  @ManyToOne(() => ChatConversation, (conversation) => conversation.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: ChatConversation;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'User ID who uploaded this file',
  })
  @Column()
  userId: string;

  @ApiProperty({
    type: () => User,
    description: 'User who uploaded this file',
  })
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174005.pdf',
    description: 'Stored file name',
  })
  @Column()
  fileName: string;

  @ApiProperty({
    example: 'document.pdf',
    description: 'Original file name',
  })
  @Column()
  originalName: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'File MIME type',
  })
  @Column()
  fileType: string;

  @ApiProperty({
    example: 1024000,
    description: 'File size in bytes',
  })
  @Column()
  fileSize: number;

  @ApiProperty({
    example: 'uploads/123e4567-e89b-12d3-a456-426614174005.pdf',
    description: 'File path on storage',
    nullable: true,
  })
  @Column({ nullable: true })
  filePath: string;

  @ApiProperty({
    example: 'vercel_blob',
    description: 'Storage type (local, s3, gcs, vercel_blob)',
    default: 'vercel_blob',
  })
  @Column({ default: 'vercel_blob' })
  storageType: string; // 'local', 's3', 'gcs', 'vercel_blob'

  @ApiProperty({
    example: 'https://abc123.public.blob.vercel-storage.com/uploads/user-id/file.pdf',
    description: 'Vercel Blob public URL',
    nullable: true,
  })
  @Column({ nullable: true })
  blobUrl: string;

  @ApiProperty({
    example: 'https://abc123.public.blob.vercel-storage.com/uploads/user-id/file.pdf',
    description: 'Vercel Blob download URL',
    nullable: true,
  })
  @Column({ nullable: true })
  blobDownloadUrl: string;

  @ApiProperty({
    example: 'completed',
    enum: FileProcessingStatus,
    description: 'File processing status',
    default: FileProcessingStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enum: FileProcessingStatus,
    default: FileProcessingStatus.PENDING,
  })
  processingStatus: FileProcessingStatus;

  @ApiProperty({
    example: 'conversation_123e4567_files',
    description: 'Qdrant collection name for vector storage',
    nullable: true,
  })
  @Column({ nullable: true })
  qdrantCollection: string;

  @ApiProperty({
    example: 42,
    description: 'Number of text chunks extracted from the file',
    nullable: true,
  })
  @Column({ nullable: true })
  chunkCount: number;

  @ApiProperty({
    example: 'Failed to process file: invalid format',
    description: 'Error message if processing failed',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'File upload timestamp',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:01:00.000Z',
    description: 'File processing completion timestamp',
  })
  @UpdateDateColumn()
  processedAt: Date;
}
