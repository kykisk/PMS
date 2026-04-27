import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateRequirementDto {
  @ApiProperty({ example: 'SSO 로그인' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '인증' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'high', enum: ['high', 'medium', 'low'] })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 'new', enum: ['new', 'review', 'confirmed', 'changed', 'deleted'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
