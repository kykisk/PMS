import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({ example: '회원가입 폼 화면' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reqId?: string;

  @ApiPropertyOptional({ example: 'new' })
  @IsOptional()
  @IsString()
  status?: string;
}
