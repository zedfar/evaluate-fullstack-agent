import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ShareConversationDto {
  @ApiProperty({
    description: 'Whether the conversation should be publicly accessible',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isPublic: boolean;
}
