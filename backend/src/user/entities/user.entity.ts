import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { ChatConversation } from '../../chat/entities/chat-conversation.entity';

@Entity('users')
export class User {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User unique identifier',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @Column({ unique: true })
  email: string;

  @ApiHideProperty()
  @Column()
  @Exclude()
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
    nullable: true,
  })
  @Column({ nullable: true })
  name: string;

  @ApiProperty({
    example: 'user',
    description: 'User role',
    default: 'user',
  })
  @Column({ default: 'user' })
  role: string;

  @ApiProperty({
    type: () => ChatConversation,
    isArray: true,
    description: 'User conversations',
  })
  @OneToMany(() => ChatConversation, (conversation) => conversation.user)
  conversations: ChatConversation[];

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'User creation timestamp',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'User last update timestamp',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
