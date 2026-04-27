import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateTestCaseDto {
  @ApiProperty({ example: '유효한 이메일/비밀번호로 로그인 성공' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: ['unit', 'integration'] })
  @IsOptional()
  @IsIn(['unit', 'integration'])
  type?: string;

  @ApiPropertyOptional({ description: '수행 절차 (JSON 배열)' })
  @IsOptional()
  steps?: any;

  @ApiPropertyOptional({ description: '테스트 데이터' })
  @IsOptional()
  @IsString()
  testData?: string;

  @ApiPropertyOptional({ description: '예상 결과' })
  @IsOptional()
  @IsString()
  expected?: string;
}
