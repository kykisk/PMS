import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateIssueDto {
  @ApiProperty({ example: 'API 성능 저하', description: '이슈/리스크 제목' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['issue', 'risk'] })
  @IsIn(['issue', 'risk'])
  type: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' })
  @IsOptional()
  @IsString()
  status?: string;
}
