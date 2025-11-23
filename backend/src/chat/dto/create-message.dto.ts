import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({
    example: 'What is the weather today?',
    description: 'The message content to send to the AI',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Conversation ID (optional, creates new conversation if not provided)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({
    example: 'local',
    description: 'Model provider to use (local or claude)',
    required: false,
    enum: ['local', 'claude'],
  })
  @IsString()
  @IsOptional()
  modelProvider?: string; // 'local' or 'claude'

  @ApiProperty({
    example: true,
    description: 'Enable RAG (Retrieval-Augmented Generation) for this request',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  useRag?: boolean; // Enable RAG for this request
}
