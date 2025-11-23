import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Settings for custom API endpoints in demo mode
 */
export class DemoSettingsDto {
  @ApiPropertyOptional({
    description: 'Custom GPT API base URL',
    example: 'http://localhost:8000/v1',
  })
  @IsOptional()
  @IsString()
  gptApiEndpoint?: string;

  @ApiPropertyOptional({
    description: 'Custom embedding API base URL',
    example: 'http://localhost:8001/v1',
  })
  @IsOptional()
  @IsString()
  embeddingApiEndpoint?: string;

  @ApiPropertyOptional({
    description: 'Model provider to use',
    example: 'local',
    enum: ['local', 'claude', 'openai'],
  })
  @IsOptional()
  @IsString()
  modelProvider?: string;

  @ApiPropertyOptional({
    description: 'Enable RAG for this conversation',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  useRag?: boolean;
}

/**
 * DTO for sending a message in demo mode
 */
export class SendMessageDto {
  @ApiProperty({
    description: 'Conversation ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, how can I analyze this data?',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Custom settings for API endpoints and model configuration',
    type: DemoSettingsDto,
  })
  @IsOptional()
  settings?: DemoSettingsDto;
}
