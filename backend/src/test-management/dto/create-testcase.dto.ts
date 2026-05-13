import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateTestCaseDto {
  @ApiProperty({ example: '유효한 이메일/비밀번호로 로그인 성공' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: ['unit', 'integration', 'system', 'acceptance'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: ['high', 'medium', 'low'], default: 'medium' })
  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  steps?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testData?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expected?: string;
}
