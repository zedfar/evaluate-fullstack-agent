import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ChatConversation } from './chat-conversation.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

@Entity('chat_messages')
export class ChatMessage {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174002',
    description: 'Message unique identifier',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Conversation ID this message belongs to',
  })
  @Column('uuid')
  conversationId: string;

  @ApiProperty({
    type: () => ChatConversation,
    description: 'Conversation this message belongs to',
  })
  @ManyToOne(() => ChatConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  conversation: ChatConversation;

  @ApiProperty({
    example: 'user',
    enum: MessageRole,
    description: 'Role of the message sender',
    default: MessageRole.USER,
  })
  @Column({
    type: 'enum',
    enum: MessageRole,
    default: MessageRole.USER,
  })
  role: MessageRole;

  @ApiProperty({
    example: 'Hello, how can you help me?',
    description: 'Message content',
  })
  @Column('text')
  content: string;

  @ApiProperty({
    example: { model: 'claude-3', tokens: 150 },
    description: 'Additional metadata about the message',
    nullable: true,
  })
  @Column('jsonb', { nullable: true })
  metadata: any;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Message creation timestamp',
  })
  @CreateDateColumn()
  createdAt: Date;
}
