import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class ExecuteTestCaseDto {
  @ApiProperty({ enum: ['pass', 'fail'], example: 'pass' })
  @IsIn(['pass', 'fail'])
  result: string;

  @ApiPropertyOptional({ description: '실제 결과 내용' })
  @IsOptional()
  @IsString()
  actual?: string;
}
