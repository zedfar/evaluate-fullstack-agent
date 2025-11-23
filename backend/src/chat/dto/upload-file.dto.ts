import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Conversation ID to associate the uploaded file with',
    required: true,
  })
  @IsString()
  conversationId: string;

  @ApiProperty({
    example: 'local',
    description: 'Model provider to use for processing the file',
    required: false,
    enum: ['local', 'claude'],
  })
  @IsOptional()
  @IsString()
  modelProvider?: string; // 'local' or 'claude'
}

export class DeleteFileDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'File ID to delete',
    required: true,
  })
  @IsString()
  fileId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Conversation ID that the file belongs to',
    required: true,
  })
  @IsString()
  conversationId: string;
}
