import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateLLMConfigDto {
  @ApiProperty({ enum: ['openai', 'anthropic', 'gemini', 'bedrock'] })
  @IsIn(['openai', 'anthropic', 'gemini', 'bedrock'])
  provider: string;

  @ApiProperty({ example: 'gpt-4o' })
  @IsString()
  model: string;

  @ApiProperty({ example: 'sk-...' })
  @IsString()
  apiKey: string;

  @ApiPropertyOptional({ description: 'AWS Bedrock 리전', example: 'us-east-1' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  promptTemplates?: Record<string, string>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
