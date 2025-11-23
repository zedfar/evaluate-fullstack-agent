import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { ChatMessage } from './chat-message.entity';
import { UploadedFile } from './uploaded-file.entity';

@Entity('chat_conversations')
export class ChatConversation {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Conversation unique identifier',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'My AI Conversation',
    description: 'Conversation title',
    default: 'New Chat',
  })
  @Column({ default: 'New Chat' })
  title: string;

  @ApiProperty({
    example: false,
    description: 'Whether this conversation is publicly shareable',
    default: false,
  })
  @Column({ default: false })
  isPublic: boolean;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'User ID who owns this conversation',
  })
  @Column('uuid')
  userId: string;

  @ApiProperty({
    type: () => User,
    description: 'User who owns this conversation',
  })
  @ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({
    type: () => ChatMessage,
    isArray: true,
    description: 'Messages in this conversation',
  })
  @OneToMany(() => ChatMessage, (message) => message.conversation, {
    cascade: true,
  })
  messages: ChatMessage[];

  @ApiProperty({
    type: () => UploadedFile,
    isArray: true,
    description: 'Files uploaded in this conversation',
  })
  @OneToMany(() => UploadedFile, (file) => file.conversation, {
    cascade: true,
  })
  files: UploadedFile[];

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Conversation creation timestamp',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Conversation last update timestamp',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
