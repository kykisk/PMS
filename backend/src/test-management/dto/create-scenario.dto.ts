import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateScenarioDto {
  @ApiProperty({ example: '정상 로그인 시나리오' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'integration', enum: ['unit', 'integration', 'system', 'acceptance'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ default: 'functional', enum: ['functional', 'performance', 'security', 'usability', 'compatibility'] })
  @IsOptional()
  @IsString()
  testType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testData?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reqId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  featureId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
