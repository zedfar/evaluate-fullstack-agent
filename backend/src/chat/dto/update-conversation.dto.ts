import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateConversationDto {
  @ApiProperty({
    example: 'My AI Conversation',
    description: 'New title for the conversation',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  title: string;
}
