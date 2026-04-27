import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateScenarioDto {
  @ApiProperty({ example: '정상 로그인 시나리오' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['unit', 'integration'], default: 'integration' })
  @IsOptional()
  @IsIn(['unit', 'integration'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testData?: string;

  @ApiPropertyOptional({ description: '연결 요구사항 ID' })
  @IsOptional()
  @IsString()
  reqId?: string;

  @ApiPropertyOptional({ description: '연결 기능 ID' })
  @IsOptional()
  @IsString()
  featureId?: string;
}
